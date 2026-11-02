import Link from 'next/link';
import { runMaintenance } from '@/lib/maintenance';
import { prisma } from '@/lib/prisma';
import { getCrmMetrics, PAID_ORDER_WHERE } from '@/lib/crm';
import { getLowStockProducts } from '@/lib/inventory';
import { ABANDONED_CART_MINUTES, SEGMENT_META, CustomerSegmentKey, formatIDR, formatKg, formatDateTime } from '@/lib/business-rules';
import { PageHeader, StatCard, Panel, Table, PaymentPill, SegmentPill } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  await runMaintenance();
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const abandonedBefore = new Date(Date.now() - ABANDONED_CART_MINUTES * 60_000);

  const [crm, low, paid30, recent, abandoned, promoAgg] = await Promise.all([
    getCrmMetrics(),
    getLowStockProducts(),
    prisma.order.aggregate({ where: { ...PAID_ORDER_WHERE, paidAt: { gte: since30 } }, _sum: { finalAmount: true }, _count: { _all: true } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { user: true } }),
    prisma.cart.findMany({
      where: { status: 'ACTIVE', lastActivityAt: { lt: abandonedBefore }, items: { some: {} } },
      include: { items: true },
    }),
    prisma.promoUsage.aggregate({ _sum: { discountAmount: true, orderTotal: true }, _count: { _all: true } }),
  ]);

  const abandonedValue = abandoned.reduce((a, c) => a + c.items.reduce((s, i) => s + Math.round(i.pricePerKg * i.quantityKg), 0), 0);
  const maxSeg = Math.max(1, ...Object.values(crm.segments));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard Bisnis" subtitle="Ringkasan Inventory • Promotion • CRM yang saling terhubung" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Omzet 30 hari" value={formatIDR(paid30._sum.finalAmount ?? 0)} hint={`${paid30._count._all} order dibayar`} />
        <StatCard label="Pelanggan" value={crm.totalCustomers} hint={`${crm.buyers} sudah pernah membeli`} href="/admin/customers" />
        <StatCard label="Repeat purchase rate" value={`${(crm.repeatPurchaseRate * 100).toFixed(1)}%`} hint="pembeli dengan ≥ 2 order" href="/admin/customers" />
        <StatCard label="Rata-rata nilai order" value={formatIDR(crm.averageOrderValue)} hint={`CLV rata-rata ${formatIDR(crm.averageClv)}`} />
        <StatCard
          label="Stok menipis"
          value={low.length}
          tone={low.length ? 'warn' : 'good'}
          hint={low.length ? low.slice(0, 2).map((p) => p.name).join(', ') + (low.length > 2 ? '…' : '') : 'Semua stok aman'}
          href="/admin/inventory"
        />
        <StatCard label="Keranjang terbengkalai" value={abandoned.length} hint={`potensi ${formatIDR(abandonedValue)}`} tone={abandoned.length ? 'warn' : 'default'} href="/admin/carts" />
        <StatCard label="Pemakaian promo" value={promoAgg._count._all} hint={`total diskon ${formatIDR(promoAgg._sum.discountAmount ?? 0)}`} href="/admin/promotions" />
        <StatCard label="Omzet dari promo" value={formatIDR(promoAgg._sum.orderTotal ?? 0)} href="/admin/promotions" />
      </div>

      {low.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="font-bold text-amber-900">⚠️ Peringatan stok menipis</div>
          <ul className="mt-2 grid sm:grid-cols-2 gap-1 text-sm text-amber-900">
            {low.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> ({p.sku}) — sisa {formatKg(p.stockKg)}, batas minimum {formatKg(p.minStockKg)}
              </li>
            ))}
          </ul>
          <Link href="/admin/inventory" className="text-sm font-semibold text-amber-900 underline mt-2 inline-block">
            Tambah stok →
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title="Segmen pelanggan" className="lg:col-span-1" action={<Link className="text-xs text-orange-700 font-semibold" href="/admin/customers">Detail →</Link>}>
          <div className="space-y-2">
            {(Object.keys(SEGMENT_META) as CustomerSegmentKey[]).map((k) => (
              <Link key={k} href={`/admin/customers?segment=${k}`} className="block">
                <div className="flex justify-between text-xs mb-0.5">
                  <SegmentPill segment={k} />
                  <span className="font-bold tabular-nums">{crm.segments[k]}</span>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-orange-500" style={{ width: `${(crm.segments[k] / maxSeg) * 100}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Pesanan terbaru" className="lg:col-span-2" action={<Link className="text-xs text-orange-700 font-semibold" href="/admin/orders">Semua →</Link>}>
          <Table head={['Order', 'Pelanggan', 'Total', 'Promo', 'Bayar', 'Waktu']}>
            {recent.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                <td className="px-3 py-2">{o.user?.name ?? '-'}</td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(o.finalAmount)}</td>
                <td className="px-3 py-2 font-mono text-xs">{o.promoCode ?? '-'}</td>
                <td className="px-3 py-2">
                  <PaymentPill status={o.paymentStatus} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(o.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </div>
  );
}
