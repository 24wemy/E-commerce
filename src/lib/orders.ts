import { PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { lockProducts, moveStock } from '@/lib/inventory';
import { refreshUserSegment } from '@/lib/crm';
import { POINTS_PER_RUPIAH } from '@/lib/business-rules';
import { sendOrderPaidSuccessEmail } from '@/lib/email';

async function log(userId: string | null, action: string, entityId: string, details: unknown) {
  await prisma.activityLog
    .create({ data: { userId, action, entity: 'Order', entityId, details: JSON.stringify(details) } })
    .catch(() => {});
}

/**
 * INTEGRASI UTAMA: order dibayar -> stok berkurang (Inventory) -> pemakaian promo tercatat (Promotion)
 * -> poin & segmen pelanggan diperbarui (CRM). Idempoten: aman dipanggil berkali-kali (webhook bisa dikirim ulang).
 */
export async function markOrderPaid(orderNumber: string, opts: { paymentType?: string; source: string }) {
  const result = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({ where: { orderNumber }, include: { items: { include: { product: true } } } });
      if (!order) throw new Error(`Order ${orderNumber} tidak ditemukan`);
      if (order.stockDeducted) return { status: 'ALREADY_PAID' as const, order };

      await lockProducts(tx, order.items.map((i) => i.productId));

      // Cek ulang stok (anti-overselling di titik pembayaran)
      const fresh = await tx.product.findMany({ where: { id: { in: order.items.map((i) => i.productId) } } });
      const stockMap = new Map(fresh.map((p) => [p.id, p]));
      const shortage = order.items.find((i) => (stockMap.get(i.productId)?.stockKg ?? 0) < i.requestedKg);
      if (shortage) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.SETTLEMENT,
            status: 'CANCELLED',
            paidAt: new Date(),
            paymentType: opts.paymentType,
            cancelReason: `Stok ${shortage.product.name} habis saat pembayaran diterima — perlu refund manual`,
          },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, status: 'CANCELLED', note: `Stok ${shortage.product.name} habis saat pembayaran diterima` },
        });
        return { status: 'OVERSOLD' as const, order };
      }

      const lowStock: string[] = [];
      for (const item of order.items) {
        const { product, after } = await moveStock(tx, {
          productId: item.productId,
          type: 'OUT',
          quantityKg: item.requestedKg,
          reason: `Penjualan — order ${order.orderNumber} dibayar`,
          orderId: order.id,
          userId: order.userId,
        });
        if (after <= product.minStockKg) lowStock.push(`${product.name} (${after} kg, min ${product.minStockKg} kg)`);
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          stockDeducted: true,
          paymentStatus: PaymentStatus.SETTLEMENT,
          status: 'PROCESSING',
          paidAt: new Date(),
          paymentType: opts.paymentType ?? order.paymentType,
          cancelReason: null,
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: 'PROCESSING', note: order.isExpress ? 'Pembayaran diterima — ANTAR SEKARANG, prioritas disiapkan' : 'Pembayaran diterima, pesanan masuk antrean potong' },
      });

      if (order.promotionId) {
        await tx.promoUsage.upsert({
          where: { orderId: order.id },
          create: {
            promotionId: order.promotionId,
            orderId: order.id,
            userId: order.userId,
            discountAmount: order.discountAmount + order.shippingDiscount,
            orderSubtotal: order.subtotal,
            orderTotal: order.finalAmount,
          },
          update: {},
        });
      }

      if (order.userId) {
        await tx.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: { increment: Math.floor(order.finalAmount / POINTS_PER_RUPIAH) } },
        });
      }
      return { status: 'PAID' as const, order, lowStock };
    },
    { timeout: 20_000 }
  );

  if (result.status === 'PAID') {
    await refreshUserSegment(result.order.userId);
    await log(result.order.userId, 'PAYMENT_SETTLED', result.order.id, { orderNumber, source: opts.source });
    if (result.lowStock?.length) {
      await log(null, 'LOW_STOCK_ALERT', result.order.id, { products: result.lowStock });
    }
    sendOrderPaidSuccessEmail(result.order.id).catch((e) => console.error('paid email failed', e));
  } else if (result.status === 'OVERSOLD') {
    await log(result.order.userId, 'PAYMENT_OVERSOLD_NEEDS_REFUND', result.order.id, { orderNumber });
  }
  return result.status;
}

/** Batal / kedaluwarsa / refund: kembalikan stok bila sudah dipotong, hapus pemakaian promo, perbarui CRM. */
export async function cancelOrder(
  orderNumber: string,
  opts: { reason: string; paymentStatus?: PaymentStatus; expired?: boolean; actorId?: string | null }
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({ where: { orderNumber }, include: { items: true } });
      if (!order) throw new Error(`Order ${orderNumber} tidak ditemukan`);
      if (order.stockDeducted) {
        await lockProducts(tx, order.items.map((i) => i.productId));
        for (const item of order.items) {
          await moveStock(tx, {
            productId: item.productId,
            type: 'RETURN',
            quantityKg: item.requestedKg,
            reason: `Stok kembali — order ${order.orderNumber}: ${opts.reason}`,
            orderId: order.id,
            userId: opts.actorId ?? null,
          });
        }
      }
      await tx.promoUsage.deleteMany({ where: { orderId: order.id } });
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          stockDeducted: false,
          status: opts.expired ? 'EXPIRED' : 'CANCELLED',
          paymentStatus: opts.paymentStatus ?? (order.paymentStatus === 'SETTLEMENT' ? 'REFUND' : 'CANCEL'),
          cancelReason: opts.reason,
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: updated.status, note: opts.reason, actorId: opts.actorId ?? null },
      });
      return { order: updated, restored: order.stockDeducted };
    },
    { timeout: 20_000 }
  );
  await refreshUserSegment(result.order.userId);
  await log(opts.actorId ?? result.order.userId, 'ORDER_CANCELLED', result.order.id, {
    orderNumber,
    reason: opts.reason,
    stockRestored: result.restored,
  });
  return result;
}
