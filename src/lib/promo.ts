import type { Prisma, PrismaClient, Promotion } from '@prisma/client';
import { formatIDR, formatDateTime, SEGMENT_META, CustomerSegmentKey } from '@/lib/business-rules';

type Db = PrismaClient | Prisma.TransactionClient;

export type PromoResult =
  | {
      ok: true;
      promotion: Promotion;
      discountAmount: number;
      shippingDiscount: number;
      description: string;
    }
  | { ok: false; error: string };

/** Status pembayaran yang membuat kuota promo dianggap "terpakai/terpesan". */
const CONSUMING_PAYMENT = ['UNPAID', 'PENDING', 'SETTLEMENT'] as const;

/**
 * Validasi promo 100% di server. Dipakai saat pelanggan memasang kode (preview)
 * dan sekali lagi saat checkout (otoritatif). Satu order hanya boleh 1 kode (tidak bisa digabung).
 */
export async function evaluatePromo(
  db: Db,
  params: { code: string; userId: string | null; subtotal: number; shippingFee: number; fulfillment?: 'DELIVERY' | 'PICKUP'; now?: Date }
): Promise<PromoResult> {
  const code = params.code.trim().toUpperCase();
  const now = params.now ?? new Date();
  if (!code) return { ok: false, error: 'Masukkan kode promo.' };

  const promo = await db.promotion.findUnique({ where: { code } });
  if (!promo || !promo.isActive) {
    return { ok: false, error: `Kode "${code}" tidak ditemukan atau sudah dinonaktifkan.` };
  }
  if (now < promo.startsAt) {
    return { ok: false, error: `Promo ${code} belum berlaku. Mulai ${formatDateTime(promo.startsAt)}.` };
  }
  if (now > promo.endsAt) {
    return { ok: false, error: `Kode ${code} sudah kedaluwarsa (berakhir ${formatDateTime(promo.endsAt)}).` };
  }
  if (params.subtotal < promo.minOrder) {
    return {
      ok: false,
      error: `Minimal belanja ${formatIDR(promo.minOrder)} untuk kode ${code}. Kurang ${formatIDR(
        promo.minOrder - params.subtotal
      )} lagi.`,
    };
  }

  if ((promo.targetSegment || promo.perCustomerLimit) && !params.userId) {
    return { ok: false, error: 'Silakan login untuk memakai kode promo ini.' };
  }

  if (promo.targetSegment && params.userId) {
    const user = await db.user.findUnique({ where: { id: params.userId }, select: { segment: true } });
    if (!user || user.segment !== promo.targetSegment) {
      const label = SEGMENT_META[promo.targetSegment as CustomerSegmentKey]?.label ?? promo.targetSegment;
      return { ok: false, error: `Kode ${code} khusus untuk pelanggan segmen "${label}".` };
    }
  }

  if (promo.quota !== null) {
    const used = await db.order.count({
      where: { promotionId: promo.id, paymentStatus: { in: [...CONSUMING_PAYMENT] }, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
    });
    if (used >= promo.quota) return { ok: false, error: `Kuota promo ${code} sudah habis.` };
  }

  if (promo.perCustomerLimit !== null && params.userId) {
    const usedByMe = await db.order.count({
      where: {
        promotionId: promo.id,
        userId: params.userId,
        paymentStatus: { in: [...CONSUMING_PAYMENT] },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
    });
    if (usedByMe >= promo.perCustomerLimit) {
      return { ok: false, error: `Anda sudah memakai kode ${code} (batas ${promo.perCustomerLimit}x per pelanggan).` };
    }
  }

  let discountAmount = 0;
  let shippingDiscount = 0;
  let description = promo.name;

  switch (promo.type) {
    case 'PERCENTAGE':
    case 'FLASH_SALE': {
      discountAmount = Math.round((params.subtotal * promo.value) / 100);
      if (promo.maxDiscount) discountAmount = Math.min(discountAmount, promo.maxDiscount);
      description = `${promo.name} (${promo.value}%${promo.maxDiscount ? `, maks ${formatIDR(promo.maxDiscount)}` : ''})`;
      break;
    }
    case 'FIXED_AMOUNT':
      discountAmount = Math.min(promo.value, params.subtotal);
      description = `${promo.name} (potongan ${formatIDR(promo.value)})`;
      break;
    case 'FREE_SHIPPING':
      if (params.fulfillment === 'PICKUP') {
        return { ok: false, error: `Kode ${code} khusus pesanan yang diantar. Pesanan ambil di toko sudah tanpa ongkir.` };
      }
      shippingDiscount = promo.value > 0 ? Math.min(promo.value, params.shippingFee) : params.shippingFee;
      description = `${promo.name} (gratis ongkir)`;
      break;
  }

  return { ok: true, promotion: promo, discountAmount, shippingDiscount, description };
}
