'use server';

import { z } from 'zod';
import { appUrl } from '@/lib/app-url';
import { OrderStatus, PromotionType, CustomerSegment } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/authz';
import { moveStock, lockProducts } from '@/lib/inventory';
import { cancelOrder } from '@/lib/orders';
import { advanceOrderStatus } from '@/lib/order-status';
import { refreshAllSegments } from '@/lib/crm';
import { sendMarketingEmail } from '@/lib/email';
import { SEGMENT_META, formatIDR, formatKg, formatDateTime, CustomerSegmentKey } from '@/lib/business-rules';

type ActionResult = { success: boolean; error?: string; message?: string };

function fail(e: unknown): ActionResult {
  return { success: false, error: (e as Error).message };
}



/* ----------------------------- ORDERS ----------------------------- */

export async function getAdminOrdersAction() {
  try {
    await requireAdmin();
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: { include: { product: true } }, user: true },
    });
    return { success: true, orders };
  } catch (error) {
    return { success: false, orders: [], error: (error as Error).message };
  }
}

export async function updateAdminOrderStatusAction(orderNumber: string, status: OrderStatus): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (status === 'CANCELLED') {
      await cancelOrder(orderNumber, { reason: 'Dibatalkan admin', actorId: admin.id });
      revalidatePath('/admin', 'layout');
      return { success: true };
    }
    const r = await advanceOrderStatus(orderNumber, status, { id: admin.id, role: 'ADMIN' });
    return r.success ? { success: true } : { success: false, error: r.error };
  } catch (e) {
    return fail(e);
  }
}

/** Admin menyerahkan pesanan ambil-di-toko setelah mencocokkan kode ambil pelanggan. */
export async function confirmPickupAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const orderNumber = String(formData.get('orderNumber') || '');
    const code = String(formData.get('pickupCode') || '');
    const r = await advanceOrderStatus(orderNumber, 'PICKED_UP', { id: admin.id, role: 'ADMIN' }, { pickupCode: code });
    return r.success ? { success: true, message: 'Pesanan diserahkan ke pelanggan.' } : { success: false, error: r.error };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelOrderAdminAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const orderNumber = String(formData.get('orderNumber') || '');
    const reason = String(formData.get('reason') || '').trim() || 'Dibatalkan admin';
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) return { success: false, error: 'Order tidak ditemukan' };
    if (order.status === 'CANCELLED' || order.status === 'EXPIRED') return { success: false, error: 'Order sudah batal.' };
    const r = await cancelOrder(orderNumber, {
      reason,
      paymentStatus: order.paymentStatus === 'SETTLEMENT' ? 'REFUND' : 'CANCEL',
      actorId: admin.id,
    });
    revalidatePath('/admin', 'layout');
    return { success: true, message: r.restored ? 'Order dibatalkan & stok dikembalikan.' : 'Order dibatalkan.' };
  } catch (e) {
    return fail(e);
  }
}

/** Fitur IoT timbangan dari versi sebelumnya (berat aktual). Tidak mengubah total yang sudah dibayar. */
export async function verifyAdminWeightAction(orderNumber: string, actualKg: number): Promise<ActionResult & { actualKg?: number }> {
  try {
    const admin = await requireAdmin();
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) return { success: false, error: 'Pesanan tidak ditemukan' };
    if (!(actualKg > 0)) return { success: false, error: 'Berat tidak valid' };
    await prisma.order.update({
      where: { id: order.id },
      data: { actualWeightKg: actualKg, status: order.stockDeducted ? OrderStatus.WEIGHT_VERIFIED : order.status },
    });
    await prisma.activityLog
      .create({
        data: {
          userId: admin.id,
          action: 'ADMIN_VERIFY_WEIGHT_IOT',
          entity: 'Order',
          entityId: order.id,
          details: JSON.stringify({ orderNumber, requestedKg: order.requestedWeightKg, actualKg }),
        },
      })
      .catch(() => {});
    revalidatePath('/admin', 'layout');
    return { success: true, actualKg };
  } catch (e) {
    return fail(e);
  }
}

/* ----------------------------- PRODUCTS & INVENTORY ----------------------------- */

const productSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(2).max(40).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(2000).default(''),
  pricePerKg: z.coerce.number().int().min(100),
  stockKg: z.coerce.number().min(0).optional(),
  minStockKg: z.coerce.number().min(0),
  leadTimeDays: z.coerce.number().int().min(0).max(60),
  image: z.string().trim().url().optional().or(z.literal('')),
  isActive: z.boolean(),
});

export async function upsertProductAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = productSchema.safeParse({ ...raw, id: raw.id || undefined, isActive: raw.isActive === 'on' || raw.isActive === 'true' });
    if (!parsed.success) return { success: false, error: `${parsed.error.issues[0].path.join('.')}: ${parsed.error.issues[0].message}` };
    const d = parsed.data;
    const slugBase = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (d.id) {
      const current = await prisma.product.findUniqueOrThrow({ where: { id: d.id } });
      await prisma.product.update({
        where: { id: d.id },
        data: {
          sku: d.sku,
          name: d.name,
          category: d.category,
          description: d.description,
          pricePerKg: d.pricePerKg,
          minStockKg: d.minStockKg,
          leadTimeDays: d.leadTimeDays,
          isActive: d.isActive,
          ...(d.image ? { images: [d.image, ...current.images.filter((i) => i !== d.image)] } : {}),
        },
      });
    } else {
      const slugTaken = await prisma.product.findUnique({ where: { slug: slugBase } });
      await prisma.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            sku: d.sku,
            name: d.name,
            slug: slugTaken ? `${slugBase}-${Date.now().toString(36)}` : slugBase,
            category: d.category,
            description: d.description,
            pricePerKg: d.pricePerKg,
            stockKg: 0,
            minStockKg: d.minStockKg,
            leadTimeDays: d.leadTimeDays,
            isActive: d.isActive,
            images: [d.image || 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800&q=80'],
          },
        });
        if (d.stockKg && d.stockKg > 0) {
          await moveStock(tx, { productId: p.id, type: 'IN', quantityKg: d.stockKg, reason: 'Stok awal produk baru', userId: admin.id });
        }
      });
    }
    revalidatePath('/admin', 'layout');
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('Unique constraint')) return { success: false, error: 'SKU atau slug sudah dipakai produk lain.' };
    return fail(e);
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const used = await prisma.orderItem.count({ where: { productId: id } });
    if (used > 0) {
      // Produk yang punya riwayat order tidak dihapus agar laporan tetap utuh -> dinonaktifkan
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      revalidatePath('/admin', 'layout');
      revalidatePath('/');
      return { success: true, message: 'Produk punya riwayat order, jadi dinonaktifkan (bukan dihapus).' };
    }
    await prisma.product.delete({ where: { id } });
    revalidatePath('/admin', 'layout');
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

const adjustSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantityKg: z.coerce.number().min(0).max(100000),
  reason: z.string().trim().min(3, 'Alasan wajib diisi (min. 3 karakter)').max(200),
});

export async function adjustStockAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = adjustSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    if (d.type !== 'ADJUSTMENT' && d.quantityKg <= 0) return { success: false, error: 'Jumlah harus lebih dari 0.' };
    const r = await prisma.$transaction(async (tx) => {
      await lockProducts(tx, [d.productId]);
      return moveStock(tx, { productId: d.productId, type: d.type, quantityKg: d.quantityKg, reason: d.reason, userId: admin.id });
    });
    if (r.after <= r.product.minStockKg) {
      await prisma.activityLog
        .create({
          data: {
            userId: admin.id,
            action: 'LOW_STOCK_ALERT',
            entity: 'Product',
            entityId: r.product.id,
            details: JSON.stringify({ product: r.product.name, stock: r.after, min: r.product.minStockKg }),
          },
        })
        .catch(() => {});
    }
    revalidatePath('/admin', 'layout');
    revalidatePath('/');
    return { success: true, message: `Stok ${r.product.name}: ${formatKg(r.before)} → ${formatKg(r.after)}` };
  } catch (e) {
    return fail(e);
  }
}

export async function getInventorySummaryAction() {
  await requireAdmin();
  const products = await prisma.product.findMany({ where: { isActive: true } });
  const totalKg = products.reduce((a, p) => a + p.stockKg, 0);
  const low = products.filter((p) => p.stockKg <= p.minStockKg);
  return { totalKg: Math.round(totalKg * 10) / 10, lowCount: low.length, lowNames: low.map((p) => p.name) };
}

/* ----------------------------- PROMOTIONS ----------------------------- */

const promoSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya huruf, angka, - dan _')
      .transform((s) => s.toUpperCase()),
    name: z.string().trim().min(3).max(80),
    description: z.string().trim().max(300).optional(),
    type: z.nativeEnum(PromotionType),
    value: z.coerce.number().int().min(0),
    maxDiscount: z.coerce.number().int().min(0).optional(),
    minOrder: z.coerce.number().int().min(0),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    quota: z.coerce.number().int().min(1).optional(),
    perCustomerLimit: z.coerce.number().int().min(1).optional(),
    targetSegment: z.nativeEnum(CustomerSegment).optional(),
    isActive: z.boolean(),
  })
  .refine((d) => d.endsAt > d.startsAt, { message: 'Tanggal berakhir harus setelah tanggal mulai', path: ['endsAt'] })
  .refine((d) => !['PERCENTAGE', 'FLASH_SALE'].includes(d.type) || (d.value > 0 && d.value <= 100), {
    message: 'Diskon persen harus 1–100',
    path: ['value'],
  })
  .refine((d) => d.type !== 'FIXED_AMOUNT' || d.value > 0, { message: 'Nominal diskon harus > 0', path: ['value'] });

const emptyToUndef = (v: FormDataEntryValue | null) => (v === null || v === '' ? undefined : v);

export async function upsertPromotionAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const g = (k: string) => emptyToUndef(formData.get(k));
    const parsed = promoSchema.safeParse({
      id: g('id'),
      code: g('code'),
      name: g('name'),
      description: g('description'),
      type: g('type'),
      value: g('value') ?? 0,
      maxDiscount: g('maxDiscount'),
      minOrder: g('minOrder') ?? 0,
      startsAt: g('startsAt') ? new Date(`${g('startsAt')}+08:00`) : undefined,
      endsAt: g('endsAt') ? new Date(`${g('endsAt')}+08:00`) : undefined,
      quota: g('quota'),
      perCustomerLimit: g('perCustomerLimit'),
      targetSegment: g('targetSegment'),
      isActive: formData.get('isActive') === 'on',
    });
    if (!parsed.success) return { success: false, error: `${parsed.error.issues[0].path.join('.')}: ${parsed.error.issues[0].message}` };
    const { id, ...d } = parsed.data;
    const data = {
      ...d,
      description: d.description ?? null,
      maxDiscount: d.maxDiscount ?? null,
      quota: d.quota ?? null,
      perCustomerLimit: d.perCustomerLimit ?? null,
      targetSegment: d.targetSegment ?? null,
    };
    if (id) await prisma.promotion.update({ where: { id }, data });
    else await prisma.promotion.create({ data });
    revalidatePath('/admin/promotions');
    return { success: true };
  } catch (e) {
    if ((e as Error).message.includes('Unique constraint')) return { success: false, error: 'Kode promo sudah dipakai.' };
    return fail(e);
  }
}

export async function togglePromotionAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const p = await prisma.promotion.findUniqueOrThrow({ where: { id } });
    await prisma.promotion.update({ where: { id }, data: { isActive: !p.isActive } });
    revalidatePath('/admin/promotions');
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

/* ----------------------------- CRM ----------------------------- */

export async function refreshSegmentsAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const counts = await refreshAllSegments();
    revalidatePath('/admin', 'layout');
    return {
      success: true,
      message: Object.entries(counts)
        .map(([k, v]) => `${SEGMENT_META[k as CustomerSegmentKey].label}: ${v}`)
        .join(' • '),
    };
  } catch (e) {
    return fail(e);
  }
}

const campaignSchema = z.object({
  name: z.string().trim().min(3).max(80),
  segment: z.nativeEnum(CustomerSegment),
  promoType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.coerce.number().int().min(0),
  maxDiscount: z.coerce.number().int().min(0).optional(),
  minOrder: z.coerce.number().int().min(0),
  validDays: z.coerce.number().int().min(1).max(90),
  message: z.string().trim().min(10).max(1000),
});

/**
 * AKSI RETENSI: buat kode promo khusus segmen + kirim ke semua pelanggan di segmen tsb.
 * Kode hanya bisa dipakai pelanggan dari segmen target (divalidasi di server saat checkout).
 */
export async function createRetentionCampaignAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const g = (k: string) => emptyToUndef(formData.get(k));
    const parsed = campaignSchema.safeParse({
      name: g('name'),
      segment: g('segment'),
      promoType: g('promoType'),
      value: g('value') ?? 0,
      maxDiscount: g('maxDiscount'),
      minOrder: g('minOrder') ?? 0,
      validDays: g('validDays'),
      message: g('message'),
    });
    if (!parsed.success) return { success: false, error: `${parsed.error.issues[0].path.join('.')}: ${parsed.error.issues[0].message}` };
    const d = parsed.data;
    if (d.promoType === 'PERCENTAGE' && (d.value < 1 || d.value > 100)) return { success: false, error: 'Diskon persen harus 1–100.' };
    if (d.promoType === 'FIXED_AMOUNT' && d.value < 1) return { success: false, error: 'Nominal diskon harus > 0.' };

    const recipients = await prisma.user.findMany({ where: { role: 'CUSTOMER', segment: d.segment } });
    if (recipients.length === 0) return { success: false, error: 'Tidak ada pelanggan di segmen ini. Klik "Hitung Ulang Segmen" dulu.' };

    const prefix = { PROSPECT: 'HALO', NEW: 'BARU', REGULAR: 'SETIA', LOYAL: 'VIP', INACTIVE: 'KANGEN' }[d.segment];
    const code = `${prefix}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date();
    const endsAt = new Date(now.getTime() + d.validDays * 86_400_000);

    const promotion = await prisma.promotion.create({
      data: {
        code,
        name: d.name,
        description: `Kampanye retensi untuk segmen ${SEGMENT_META[d.segment].label}`,
        type: d.promoType,
        value: d.promoType === 'FREE_SHIPPING' ? 0 : d.value,
        maxDiscount: d.maxDiscount ?? null,
        minOrder: d.minOrder,
        startsAt: now,
        endsAt,
        quota: recipients.length,
        perCustomerLimit: 1,
        targetSegment: d.segment,
        isActive: true,
      },
    });
    const campaign = await prisma.retentionCampaign.create({
      data: { name: d.name, segment: d.segment, message: d.message, promotionId: promotion.id, createdById: admin.id, recipientCount: recipients.length },
    });

    const offer =
      d.promoType === 'PERCENTAGE'
        ? `diskon ${d.value}%${d.maxDiscount ? ` (maks ${formatIDR(d.maxDiscount)})` : ''}`
        : d.promoType === 'FIXED_AMOUNT'
          ? `potongan ${formatIDR(d.value)}`
          : 'GRATIS ONGKIR';
    let sent = 0;
    let logged = 0;
    for (const r of recipients) {
      const status = await sendMarketingEmail({
        to: r.email,
        subject: `${r.name.split(' ')[0]}, ada ${offer} khusus untukmu 🍗`,
        heading: `Halo ${r.name}!`,
        body: `${d.message}\n\nGunakan kode: <b style="font-size:18px">${code}</b> untuk ${offer}${
          d.minOrder ? ` (min. belanja ${formatIDR(d.minOrder)})` : ''
        }.\nBerlaku sampai ${formatDateTime(endsAt)}, 1x pakai.`,
        ctaText: 'Pakai Kode Sekarang',
        ctaUrl: appUrl(),
      });
      if (status === 'SENT') sent++;
      if (status === 'LOGGED') logged++;
      await prisma.campaignRecipient.create({ data: { campaignId: campaign.id, userId: r.id, email: r.email, status } });
    }
    await prisma.activityLog
      .create({
        data: {
          userId: admin.id,
          action: 'RETENTION_CAMPAIGN_SENT',
          entity: 'RetentionCampaign',
          entityId: campaign.id,
          details: JSON.stringify({ code, segment: d.segment, recipients: recipients.length, sent, logged }),
        },
      })
      .catch(() => {});
    revalidatePath('/admin', 'layout');
    return {
      success: true,
      message: `Kampanye terkirim ke ${recipients.length} pelanggan dengan kode ${code}${
        logged ? ` (${logged} dicatat tanpa email karena SMTP belum diatur)` : ''
      }.`,
    };
  } catch (e) {
    return fail(e);
  }
}

/* ----------------------------- ABANDONED CART ----------------------------- */

export async function sendCartReminderAction(cartId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { user: true, items: { include: { product: true } } } });
    if (!cart || cart.status !== 'ACTIVE' || cart.items.length === 0) return { success: false, error: 'Keranjang tidak aktif / kosong.' };
    const list = cart.items.map((i) => `• ${i.product.name} — ${formatKg(i.quantityKg)}`).join('\n');
    const status = await sendMarketingEmail({
      to: cart.user.email,
      subject: 'Keranjangmu masih menunggu 🛒',
      heading: `Halo ${cart.user.name}, ayam segarmu belum di-checkout!`,
      body: `Kamu masih punya barang di keranjang:\n${list}\n\nStok terbatas & dipotong segar tiap subuh — selesaikan pesananmu sebelum kehabisan.`,
      ctaText: 'Lanjutkan Checkout',
      ctaUrl: `${appUrl()}/checkout`,
    });
    await prisma.cart.update({ where: { id: cart.id }, data: { reminderSentAt: new Date(), reminderCount: { increment: 1 } } });
    await prisma.activityLog
      .create({
        data: { userId: admin.id, action: 'ABANDONED_CART_REMINDER', entity: 'Cart', entityId: cart.id, details: JSON.stringify({ to: cart.user.email, status }) },
      })
      .catch(() => {});
    revalidatePath('/admin/carts');
    return { success: true, message: status === 'SENT' ? `Pengingat terkirim ke ${cart.user.email}` : `Pengingat dicatat (SMTP belum diatur)` };
  } catch (e) {
    return fail(e);
  }
}
