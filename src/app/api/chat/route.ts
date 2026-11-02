import { generateText, tool, stepCountIs } from 'ai';
import { clientIp } from '@/lib/client-ip';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getReservedStock } from '@/lib/inventory';
import { geminiApiKey, geminiProvider, withGeminiFallback, rateLimited, stripMarkdown, normalizeMessages } from '@/lib/gemini';
import { DELIVERY_TIERS, MAX_DELIVERY_KM, STORE, formatIDR, formatDateTime } from '@/lib/business-rules';
import { DELIVERY_WINDOWS, PICKUP_WINDOWS, EXPRESS, PREP_MINUTES, expressAvailable } from '@/lib/schedule';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const FALLBACK_TEXT =
  'Maaf, layanan chat sedang tidak bisa menjawab. Silakan pilih produk langsung dari katalog, atau hubungi kami lewat WhatsApp untuk bantuan.';

/** Asisten belanja untuk pelanggan (halaman utama). Ditenagai Gemini (free tier). */
export async function POST(req: Request) {
  if (!geminiApiKey()) return Response.json({ text: FALLBACK_TEXT, disabled: true });

  const ip = clientIp(req);
  if (rateLimited(`chat:${ip}`, 8)) {
    return Response.json({ text: 'Pesan Anda terlalu cepat berturut-turut. Tunggu sekitar satu menit, lalu kirim lagi.' });
  }

  const body = await req.json().catch(() => ({}));
  const messages = normalizeMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return Response.json({ text: 'Silakan tulis pertanyaan Anda.' });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  try {
    // Konteks live: katalog + stok tersedia + promo publik yang sedang berjalan
    const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } });
    const reserved = await getReservedStock(prisma, products.map((p) => p.id));
    const catalog = products
      .map((p) => {
        const avail = Math.max(0, Math.round((p.stockKg - (reserved.get(p.id) ?? 0)) * 10) / 10);
        return `• ${p.name} | ${p.category} | ${formatIDR(p.pricePerKg)}/kg | stok tersedia ${avail} kg | ${p.description}`;
      })
      .join('\n');
    const now = new Date();
    const promos = await prisma.promotion.findMany({
      where: { isActive: true, targetSegment: null, startsAt: { lte: now }, endsAt: { gt: now } },
    });
    const promoText = promos.length
      ? promos
          .map(
            (p) =>
              `• Kode ${p.code}: ${p.name}${p.minOrder ? `, min. belanja ${formatIDR(p.minOrder)}` : ''}, berlaku s/d ${formatDateTime(p.endsAt)}`
          )
          .join('\n')
      : 'Tidak ada promo publik saat ini.';

    const system = `Kamu adalah Asisten Belanja Fresh Minut, toko ayam segar & produk harian di Minahasa Utara (Airmadidi, Kalawat, Kauditan, Dimembe) dan Manado.

Gaya: seperti staf toko yang ramah dan sigap — sopan, natural, langsung ke inti. Singkat: maksimal 4 kalimat atau 5 poin. Sapa "Bapak/Ibu" atau "Kak". Jangan memperkenalkan diri sebagai AI kecuali ditanya, jangan memakai emoji berlebihan (maks. 1), dan sebut nama produk persis seperti di katalog. Pahami kebutuhan rumah tangga maupun resto/warung (B2B).

KATALOG & STOK LIVE (hanya rekomendasikan produk di daftar ini; jangan janjikan stok melebihi angka "stok tersedia"):
${catalog}

PROMO PUBLIK YANG BERLAKU:
${promoText}

INFO TOKO:
• Harga dihitung per kg, kelipatan 0,5 kg.
• Pesanan bisa DIANTAR atau AMBIL DI TOKO (pilih saat checkout). Ongkir antar dihitung dari jarak titik di peta: ${DELIVERY_TIERS.map((t, i) => `${i === 0 ? '≤' : `${DELIVERY_TIERS[i - 1].maxKm}–`}${t.maxKm} km ${formatIDR(t.fee)}`).join(', ')}; lebih dari ${MAX_DELIVERY_KM} km tidak dilayani. Ambil di toko gratis ongkir di ${STORE.address} (${STORE.hours}).
• Jadwal antar (WITA): ${DELIVERY_WINDOWS.map((w) => `${w.label} ${w.start}–${w.end}`).join(', ')}. Jadwal ambil: ${PICKUP_WINDOWS.map((w) => `${w.start}–${w.end}`).join(', ')}. Slot bisa dipilih sampai ${PREP_MINUTES} menit sebelum mulai; kalau sudah lewat, otomatis pilih slot berikutnya/besok.
• "${EXPRESS.label}": diantar langsung setelah bayar, tiba ±${EXPRESS.etaMinMinutes}–${EXPRESS.etaMaxMinutes} menit, tambahan ${formatIDR(EXPRESS.fee)} (di luar ongkir jarak, tidak termasuk promo gratis ongkir). Tersedia ${EXPRESS.firstOrder}–${EXPRESS.lastOrder} WITA. Saat ini ${expressAvailable() ? 'TERSEDIA' : 'TIDAK tersedia (di luar jam)'}.
• Status pesanan diantar: Pembayaran diterima → Dipotong & ditimbang → Dalam pengiriman → Diterima. Ambil di toko: ... → Siap diambil (tunjukkan kode ambil) → Sudah diambil.
• Pembayaran lewat Midtrans (VA bank, QRIS, GoPay, kartu). Order belum dibayar otomatis batal setelah 30 menit.
• Pelanggan memesan dengan menekan tombol "Tambah ke Keranjang" lalu checkout. Kamu TIDAK bisa membuat pesanan atau memberi diskon di luar kode promo di atas.
• Pelanggan ${userId ? 'sudah login' : 'belum login (untuk cek pesanan perlu login)'}.

ATURAN:
1. Tulis teks polos tanpa markdown (tanpa *, #, _). Pakai "•" untuk daftar. Harga format Rupiah, mis. Rp 36.000/kg.
2. Jika ditanya status pesanan, panggil tool cekPesananSaya.
3. Boleh beri ide resep khas Minahasa (Ayam Woku Belanga, Ayam Garam, Tinutuan, Ayam Bakar Rica) bila relevan.
4. Jangan menjawab hal di luar belanja/ masakan; arahkan kembali dengan sopan.`;

    const google = geminiProvider();
    const result = await withGeminiFallback((modelId, abortSignal) =>
      generateText({
        model: google(modelId),
        abortSignal,
        system,
        messages,
        maxRetries: 0,
        stopWhen: stepCountIs(3),
        tools: {
          cekPesananSaya: tool({
            description: 'Cek status pesanan milik pelanggan yang sedang login. Tanpa nomor order = 3 pesanan terakhir.',
            inputSchema: z.object({ orderNumber: z.string().optional().describe('Nomor pesanan, mis. FM-20261102-ABC123') }),
            execute: async ({ orderNumber }: { orderNumber?: string }) => {
              if (!userId) return { error: 'Pelanggan belum login. Minta pelanggan login untuk cek pesanan.' };
              const orders = await prisma.order.findMany({
                where: { userId, ...(orderNumber ? { orderNumber: orderNumber.trim().toUpperCase() } : {}) },
                orderBy: { createdAt: 'desc' },
                take: 3,
                select: { orderNumber: true, status: true, paymentStatus: true, finalAmount: true, createdAt: true },
              });
              if (!orders.length) return { error: 'Pesanan tidak ditemukan di akun ini.' };
              return orders.map((o) => ({ ...o, finalAmount: formatIDR(o.finalAmount), createdAt: formatDateTime(o.createdAt) }));
            },
          }),
        },
      })
    );

    const text = stripMarkdown(result.text) || 'Ada lagi yang bisa kami bantu?';
    // Kartu produk yang disebut dalam jawaban (maks. 3) agar bisa langsung ditambah ke keranjang
    const lower = text.toLowerCase();
    const mentioned = products
      .map((p) => {
        const name = p.name.toLowerCase();
        const short = name.split(' ').slice(0, 3).join(' ');
        const idx = lower.indexOf(name) >= 0 ? lower.indexOf(name) : lower.indexOf(short);
        return { p, idx };
      })
      .filter((x) => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .slice(0, 3)
      .map(({ p }) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        pricePerKg: p.pricePerKg,
        image: p.images[0] ?? '',
        availableKg: Math.max(0, Math.round((p.stockKg - (reserved.get(p.id) ?? 0)) * 10) / 10),
      }));
    return Response.json({ text, products: mentioned });
  } catch (error) {
    console.error('API Chat Error:', (error as Error)?.name, (error as Error)?.message, (error as { cause?: unknown })?.cause ?? '');
    return Response.json({ text: FALLBACK_TEXT });
  }
}
