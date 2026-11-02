import { generateText } from 'ai';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getCrmMetrics, PAID_ORDER_WHERE } from '@/lib/crm';
import { geminiApiKey, geminiProvider, withGeminiFallback, rateLimited, stripMarkdown, normalizeMessages } from '@/lib/gemini';
import { ABANDONED_CART_MINUTES, SEGMENT_META, CustomerSegmentKey, formatIDR } from '@/lib/business-rules';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Ringkasan data bisnis NYATA dari database untuk dianalisis AI. */
async function buildBusinessSnapshot() {
  const now = Date.now();
  const since30 = new Date(now - 30 * 86_400_000);
  const since7 = new Date(now - 7 * 86_400_000);

  const [crm, products, sold, rev30, rev7, promos, usage, carts] = await Promise.all([
    getCrmMetrics(),
    prisma.product.findMany({ where: { isActive: true } }),
    prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { type: 'OUT', orderId: { not: null }, createdAt: { gte: since30 } },
      _sum: { quantityKg: true },
    }),
    prisma.order.aggregate({ where: { ...PAID_ORDER_WHERE, paidAt: { gte: since30 } }, _sum: { finalAmount: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { ...PAID_ORDER_WHERE, paidAt: { gte: since7 } }, _sum: { finalAmount: true }, _count: { _all: true } }),
    prisma.promotion.findMany(),
    prisma.promoUsage.groupBy({ by: ['promotionId'], _count: { _all: true }, _sum: { discountAmount: true, orderTotal: true } }),
    prisma.cart.findMany({
      where: { status: 'ACTIVE', items: { some: {} }, lastActivityAt: { lt: new Date(now - ABANDONED_CART_MINUTES * 60_000) } },
      include: { items: true, user: { select: { name: true, segment: true } } },
    }),
  ]);

  const soldMap = new Map(sold.map((s) => [s.productId, s._sum.quantityKg ?? 0]));
  const inventory = products
    .map((p) => {
      const s30 = soldMap.get(p.id) ?? 0;
      const rop = Math.round(((s30 / 30) * p.leadTimeDays + p.minStockKg) * 10) / 10;
      const status = p.stockKg <= p.minStockKg ? 'MENIPIS' : p.stockKg <= rop ? 'PERLU_REORDER' : s30 === 0 ? 'SLOW_MOVING' : 'AMAN';
      return `${p.name} (${p.sku}): stok ${p.stockKg} kg, min ${p.minStockKg}, terjual 30h ${s30} kg, lead time ${p.leadTimeDays} hari, reorder point ${rop} kg, harga ${formatIDR(p.pricePerKg)}/kg, status ${status}`;
    })
    .join('\n');

  const uMap = new Map(usage.map((u) => [u.promotionId, u]));
  const promoText = promos
    .map((p) => {
      const u = uMap.get(p.id);
      const state = !p.isActive ? 'nonaktif' : new Date() > p.endsAt ? 'kedaluwarsa' : new Date() < p.startsAt ? 'terjadwal' : 'berjalan';
      return `${p.code} (${p.type}, nilai ${p.value}, min ${formatIDR(p.minOrder)}${p.targetSegment ? `, khusus ${p.targetSegment}` : ''}, ${state}): dipakai ${u?._count._all ?? 0}x, total diskon ${formatIDR(u?._sum.discountAmount ?? 0)}, omzet ${formatIDR(u?._sum.orderTotal ?? 0)}`;
    })
    .join('\n');

  const segText = (Object.keys(SEGMENT_META) as CustomerSegmentKey[])
    .map((k) => `${SEGMENT_META[k].label}: ${crm.segments[k]} (${SEGMENT_META[k].rule})`)
    .join('\n');

  const topCustomers = [...crm.rows]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 8)
    .map((r) => `${r.name} [${SEGMENT_META[r.segment].label}]: ${r.paidOrders} order, total ${formatIDR(r.totalSpend)}, terakhir ${r.daysSinceLast ?? '-'} hari lalu`)
    .join('\n');
  const inactive = crm.rows
    .filter((r) => r.segment === 'INACTIVE')
    .map((r) => `${r.name} (${r.daysSinceLast} hari, total ${formatIDR(r.totalSpend)})`)
    .join('; ');

  const cartText = carts
    .map((c) => `${c.user.name} [${c.user.segment}]: ${formatIDR(c.items.reduce((a, i) => a + Math.round(i.pricePerKg * i.quantityKg), 0))}, pengingat ${c.reminderCount}x`)
    .join('\n');

  return `PENJUALAN: 30 hari ${formatIDR(rev30._sum.finalAmount ?? 0)} (${rev30._count._all} order); 7 hari ${formatIDR(rev7._sum.finalAmount ?? 0)} (${rev7._count._all} order).
CRM: ${crm.totalCustomers} pelanggan, ${crm.buyers} pernah beli, repeat purchase rate ${(crm.repeatPurchaseRate * 100).toFixed(1)}%, AOV ${formatIDR(crm.averageOrderValue)}, CLV rata-rata ${formatIDR(crm.averageClv)}.
SEGMEN:
${segText}
TOP PELANGGAN:
${topCustomers}
PELANGGAN TIDAK AKTIF: ${inactive || '-'}
INVENTORY:
${inventory}
PROMO:
${promoText}
KERANJANG TERBENGKALAI (> ${ABANDONED_CART_MINUTES} menit):
${cartText || '-'}`;
}

/** Business Copilot untuk admin: analisis data nyata (stok, promo, CRM) dengan Gemini. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });

  if (!geminiApiKey()) {
    return Response.json({ text: 'GEMINI_API_KEY belum diisi di file .env, jadi Business Copilot belum aktif.' });
  }
  if (rateLimited(`copilot:${session.user.id}`, 10)) {
    return Response.json({ text: 'Terlalu banyak pertanyaan dalam 1 menit (batas kuota free tier). Coba lagi sebentar.' });
  }

  const body = await req.json().catch(() => ({}));
  const messages = normalizeMessages(body.messages);
  if (!messages.length) return Response.json({ text: 'Tulis pertanyaan Anda.' });

  try {
    const snapshot = await buildBusinessSnapshot();
    const system = `Kamu adalah Business Copilot untuk admin Fresh Minut (toko ayam segar, Minahasa Utara).
Jawab HANYA berdasarkan DATA di bawah (data nyata dari database, diambil ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA). Jika data tidak cukup, katakan terus terang.
Berikan analisis singkat lalu rekomendasi keputusan yang konkret (mis. produk mana yang perlu restock & berapa kg, promo mana dilanjutkan/dihentikan berdasarkan omzet vs diskon, segmen mana yang perlu ditarik kembali & aksi retensinya).
Format: teks polos tanpa markdown (tanpa *, #, _), gunakan "•" untuk poin, maksimal ±10 poin. Angka uang dalam Rupiah.

DATA:
${snapshot}`;

    const google = geminiProvider();
    const result = await withGeminiFallback((modelId, abortSignal) =>
      generateText({ model: google(modelId), system, messages, maxRetries: 0, abortSignal })
    );
    return Response.json({ text: stripMarkdown(result.text) || 'Tidak ada jawaban.' });
  } catch (e) {
    console.error('Copilot error:', (e as Error)?.name, (e as Error)?.message, (e as { cause?: unknown })?.cause ?? '');
    return Response.json({ text: 'Copilot gagal menghubungi Gemini. Cek GEMINI_API_KEY atau kuota free tier Anda.' });
  }
}
