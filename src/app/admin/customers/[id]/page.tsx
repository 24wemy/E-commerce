import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCustomerStats } from '@/lib/crm';
import { rfmScore, formatIDR, formatKg, formatDate, formatDateTime } from '@/lib/business-rules';
import { PageHeader, Panel, Table, StatCard, SegmentPill, PaymentPill, Pill } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      orders: { orderBy: { createdAt: 'desc' }, include: { items: { include: { product: true } } } },
      cart: { include: { items: { include: { product: true } } } },
      campaignRecipients: { include: { campaign: { include: { promotion: true } } }, orderBy: { sentAt: 'desc' } },
      reviews: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!user) notFound();
  const stats = await getCustomerStats(user.id);
  const days = stats.lastPaidAt ? Math.floor((Date.now() - stats.lastPaidAt.getTime()) / 86_400_000) : null;
  const rfm = rfmScore({ daysSinceLast: days, frequency: stats.paidOrders, monetary: stats.totalSpend });
  const cartValue = user.cart?.items.reduce((a, i) => a + Math.round(i.pricePerKg * i.quantityKg), 0) ?? 0;

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="text-sm text-slate-500 hover:underline">
        ← Semua pelanggan
      </Link>
      <PageHeader title={user.name} subtitle={`${user.email}${user.phone ? ` • ${user.phone}` : ''}${user.businessName ? ` • ${user.businessName}` : ''}`}>
        <SegmentPill segment={user.segment} />
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Order dibayar" value={stats.paidOrders} />
        <StatCard label="Total belanja (CLV)" value={formatIDR(stats.totalSpend)} />
        <StatCard label="Rata-rata order" value={stats.paidOrders ? formatIDR(Math.round(stats.totalSpend / stats.paidOrders)) : '-'} />
        <StatCard label="Terakhir belanja" value={days === null ? '-' : `${days} hari lalu`} hint={stats.lastPaidAt ? formatDate(stats.lastPaidAt) : undefined} />
        <StatCard label="Skor RFM • Poin" value={`${stats.paidOrders ? rfm.label : '-'} • ${user.loyaltyPoints}`} hint={`Daftar ${formatDate(user.createdAt)}`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title="Riwayat order" className="lg:col-span-2">
          <Table head={['Order', 'Tanggal', 'Item', 'Total', 'Promo', 'Bayar']} empty="Belum ada order.">
            {user.orders.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/admin/orders/${o.orderNumber}`} className="underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">{formatDateTime(o.createdAt)}</td>
                <td className="px-3 py-2 text-xs">{o.items.map((i) => `${i.product.name} ${formatKg(i.requestedKg)}`).join(', ')}</td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(o.finalAmount)}</td>
                <td className="px-3 py-2 font-mono text-xs">{o.promoCode ?? '-'}</td>
                <td className="px-3 py-2">
                  <PaymentPill status={o.paymentStatus} />
                </td>
              </tr>
            ))}
          </Table>
        </Panel>

        <div className="space-y-6">
          <Panel title="Keranjang saat ini">
            {user.cart && user.cart.status === 'ACTIVE' && user.cart.items.length ? (
              <div className="text-sm space-y-1">
                {user.cart.items.map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span>
                      {i.product.name} × {formatKg(i.quantityKg)}
                    </span>
                    <span className="tabular-nums">{formatIDR(Math.round(i.pricePerKg * i.quantityKg))}</span>
                  </div>
                ))}
                <div className="border-t pt-1 flex justify-between font-bold">
                  <span>Potensi</span>
                  <span>{formatIDR(cartValue)}</span>
                </div>
                <p className="text-[11px] text-slate-500">Aktivitas terakhir {formatDateTime(user.cart.lastActivityAt)}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Keranjang kosong / sudah checkout.</p>
            )}
          </Panel>
          <Panel title="Aksi retensi yang diterima">
            {user.campaignRecipients.length ? (
              <ul className="text-sm space-y-2">
                {user.campaignRecipients.map((r) => (
                  <li key={r.id}>
                    <div className="font-semibold">{r.campaign.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Kode <span className="font-mono">{r.campaign.promotion?.code ?? '-'}</span> • {formatDateTime(r.sentAt)} •{' '}
                      <Pill className="border-slate-300">{r.status}</Pill>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Belum ada.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
