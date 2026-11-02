import { prisma } from '@/lib/prisma';
import { computeSegment, rfmScore, CustomerSegmentKey } from '@/lib/business-rules';

/** Order yang dihitung sebagai pembelian nyata. */
export const PAID_ORDER_WHERE = { paymentStatus: 'SETTLEMENT' as const, status: { not: 'CANCELLED' as const } };

export async function getCustomerStats(userId: string) {
  const agg = await prisma.order.aggregate({
    where: { userId, ...PAID_ORDER_WHERE },
    _count: { _all: true },
    _sum: { finalAmount: true },
    _max: { paidAt: true, createdAt: true },
  });
  const paidOrders = agg._count._all;
  const lastPaidAt = agg._max.paidAt ?? agg._max.createdAt ?? null;
  return { paidOrders, totalSpend: agg._sum.finalAmount ?? 0, lastPaidAt };
}

export async function refreshUserSegment(userId: string | null | undefined) {
  if (!userId) return null;
  const stats = await getCustomerStats(userId);
  const segment = computeSegment(stats);
  await prisma.user.update({ where: { id: userId }, data: { segment, segmentUpdatedAt: new Date() } });
  return segment;
}

/** Hitung ulang segmen semua pelanggan (dipanggil admin / setelah seed). */
export async function refreshAllSegments() {
  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true } });
  const stats = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { not: null }, ...PAID_ORDER_WHERE },
    _count: { _all: true },
    _max: { paidAt: true, createdAt: true },
  });
  const map = new Map(stats.map((s) => [s.userId!, s]));
  const now = new Date();
  const counts: Record<string, number> = {};
  for (const c of customers) {
    const s = map.get(c.id);
    const segment = computeSegment({
      paidOrders: s?._count._all ?? 0,
      lastPaidAt: s ? s._max.paidAt ?? s._max.createdAt : null,
      now,
    });
    counts[segment] = (counts[segment] ?? 0) + 1;
    await prisma.user.update({ where: { id: c.id }, data: { segment, segmentUpdatedAt: now } });
  }
  return counts;
}

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  customerType: string;
  segment: CustomerSegmentKey;
  loyaltyPoints: number;
  createdAt: Date;
  paidOrders: number;
  totalSpend: number;
  avgOrder: number;
  lastPaidAt: Date | null;
  daysSinceLast: number | null;
  rfm: ReturnType<typeof rfmScore>;
};

export async function getCustomerRows(): Promise<CustomerRow[]> {
  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, orderBy: { createdAt: 'desc' } });
  const stats = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { not: null }, ...PAID_ORDER_WHERE },
    _count: { _all: true },
    _sum: { finalAmount: true },
    _max: { paidAt: true, createdAt: true },
  });
  const map = new Map(stats.map((s) => [s.userId!, s]));
  const now = Date.now();
  return customers.map((c) => {
    const s = map.get(c.id);
    const paidOrders = s?._count._all ?? 0;
    const totalSpend = s?._sum.finalAmount ?? 0;
    const lastPaidAt = s ? s._max.paidAt ?? s._max.createdAt : null;
    const daysSinceLast = lastPaidAt ? Math.floor((now - lastPaidAt.getTime()) / 86_400_000) : null;
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      customerType: c.customerType,
      segment: c.segment as CustomerSegmentKey,
      loyaltyPoints: c.loyaltyPoints,
      createdAt: c.createdAt,
      paidOrders,
      totalSpend,
      avgOrder: paidOrders ? Math.round(totalSpend / paidOrders) : 0,
      lastPaidAt,
      daysSinceLast,
      rfm: rfmScore({ daysSinceLast, frequency: paidOrders, monetary: totalSpend }),
    };
  });
}

export async function getCrmMetrics() {
  const rows = await getCustomerRows();
  const buyers = rows.filter((r) => r.paidOrders > 0);
  const repeaters = rows.filter((r) => r.paidOrders >= 2);
  const revenue = buyers.reduce((a, r) => a + r.totalSpend, 0);
  const orderCount = buyers.reduce((a, r) => a + r.paidOrders, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const segments: Record<CustomerSegmentKey, number> = { PROSPECT: 0, NEW: 0, REGULAR: 0, LOYAL: 0, INACTIVE: 0 };
  for (const r of rows) segments[r.segment] = (segments[r.segment] ?? 0) + 1;
  return {
    totalCustomers: rows.length,
    buyers: buyers.length,
    newThisMonth: rows.filter((r) => r.createdAt >= monthStart).length,
    repeatPurchaseRate: buyers.length ? repeaters.length / buyers.length : 0,
    averageOrderValue: orderCount ? Math.round(revenue / orderCount) : 0,
    averageClv: buyers.length ? Math.round(revenue / buyers.length) : 0,
    revenue,
    orderCount,
    segments,
    rows,
  };
}
