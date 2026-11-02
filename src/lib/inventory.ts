import type { Prisma, PrismaClient, StockMovementType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PAYMENT_EXPIRY_MINUTES } from '@/lib/business-rules';

type Db = PrismaClient | Prisma.TransactionClient;

/** Kunci baris produk (SELECT ... FOR UPDATE) agar dua transaksi tidak bisa mengambil stok yang sama. */
export async function lockProducts(tx: Prisma.TransactionClient, productIds: string[]) {
  if (productIds.length === 0) return;
  const ids = Array.from(new Set(productIds)).sort();
  await tx.$queryRawUnsafe(
    `SELECT id FROM "Product" WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(',')}) FOR UPDATE`,
    ...ids
  );
}

/**
 * Stok yang sedang "dipesan sementara" oleh order yang belum dibayar & belum lewat batas waktu bayar.
 * Stok fisik baru dikurangi saat order DIBAYAR, tetapi pesanan yang masih menunggu pembayaran
 * tetap mengurangi stok yang bisa dibeli orang lain -> mencegah overselling.
 */
export async function getReservedStock(db: Db, productIds: string[], excludeOrderId?: string) {
  const since = new Date(Date.now() - PAYMENT_EXPIRY_MINUTES * 60_000);
  const rows = await db.orderItem.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productIds },
      order: {
        stockDeducted: false,
        paymentStatus: { in: ['UNPAID', 'PENDING'] },
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
        createdAt: { gte: since },
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      },
    },
    _sum: { requestedKg: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.productId, r._sum.requestedKg ?? 0);
  return map;
}

/** Catat pergerakan stok + ubah stok produk dalam satu transaksi. */
export async function moveStock(
  tx: Prisma.TransactionClient,
  params: {
    productId: string;
    type: StockMovementType;
    /** IN/RETURN/OUT: jumlah positif. ADJUSTMENT: stok baru (hasil stok opname). */
    quantityKg: number;
    reason: string;
    orderId?: string | null;
    userId?: string | null;
  }
) {
  const product = await tx.product.findUniqueOrThrow({ where: { id: params.productId } });
  const before = product.stockKg;
  let after: number;
  let qty: number;
  switch (params.type) {
    case 'IN':
    case 'RETURN':
      qty = params.quantityKg;
      after = before + qty;
      break;
    case 'OUT':
      qty = params.quantityKg;
      after = before - qty;
      if (after < 0) throw new Error(`Stok ${product.name} tidak cukup (tersedia ${before} kg).`);
      break;
    case 'ADJUSTMENT':
      if (params.quantityKg < 0) throw new Error('Stok hasil penyesuaian tidak boleh negatif.');
      after = params.quantityKg;
      qty = after - before;
      break;
  }
  after = Math.round(after * 1000) / 1000;
  await tx.product.update({ where: { id: product.id }, data: { stockKg: after } });
  const movement = await tx.stockMovement.create({
    data: {
      productId: product.id,
      type: params.type,
      quantityKg: Math.round(qty * 1000) / 1000,
      stockBefore: before,
      stockAfter: after,
      reason: params.reason,
      orderId: params.orderId ?? null,
      userId: params.userId ?? null,
    },
  });
  return { product, before, after, movement };
}

/** Tandai order yang tidak dibayar melewati batas waktu sebagai EXPIRED (melepas stok yang dipesan sementara). */
export async function expireStaleOrders() {
  const cutoff = new Date(Date.now() - (PAYMENT_EXPIRY_MINUTES + 5) * 60_000);
  const stale = await prisma.order.findMany({
    where: { stockDeducted: false, paymentStatus: { in: ['UNPAID', 'PENDING'] }, status: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (!stale.length) return 0;
  const ids = stale.map((o) => o.id);
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: { in: ids } },
      data: { status: 'EXPIRED', paymentStatus: 'EXPIRE', cancelReason: 'Batas waktu pembayaran habis' },
    }),
    prisma.orderStatusHistory.createMany({
      data: ids.map((orderId) => ({ orderId, status: 'EXPIRED' as const, note: 'Batas waktu pembayaran habis' })),
    }),
  ]);
  return ids.length;
}

export async function getLowStockProducts() {
  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { stockKg: 'asc' } });
  return products.filter((p) => p.stockKg <= p.minStockKg);
}
