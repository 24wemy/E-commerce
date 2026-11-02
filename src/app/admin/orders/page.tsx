import Link from 'next/link';
import { runMaintenance } from '@/lib/maintenance';
import { prisma } from '@/lib/prisma';
import { cancelOrderAdminAction, updateAdminOrderStatusAction, confirmPickupAction } from '@/actions/admin';
import { adminNextStatus, STATUS_LABEL, METHOD_LABEL } from '@/lib/fulfillment';
import { formatIDR, formatDateTime } from '@/lib/business-rules';
import { isFreshOrder, orderScheduleText } from '@/lib/schedule';
import { PageHeader, Panel, Table, PaymentPill, Pill, fieldCls, btnGhostCls } from '@/components/admin/ui';
import { ActionForm, ActionButton } from '@/components/admin/ActionForm';

export const dynamic = 'force-dynamic';

export default async function AdminOrders({ searchParams }: { searchParams: { status?: string; method?: string } }) {
  await runMaintenance();
  const filter = searchParams.status;
  const method = searchParams.method === 'PICKUP' || searchParams.method === 'DELIVERY' ? searchParams.method : undefined;
  const orders = await prisma.order.findMany({
    where: {
      ...(method ? { fulfillmentMethod: method } : {}),
      ...(filter === 'paid'
        ? { stockDeducted: true }
        : filter === 'unpaid'
          ? { paymentStatus: { in: ['UNPAID', 'PENDING'] as const }, status: 'PENDING' as const }
          : filter === 'cancelled'
            ? { status: { in: ['CANCELLED', 'EXPIRED'] as const } }
            : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: true, items: { include: { product: true } } },
  });

  return (
    <div>
      <PageHeader title="Pesanan" subtitle="Batal/refund order yang sudah dibayar otomatis mengembalikan stok & mencatat log pergerakan stok.">
        {[
          ['', 'Semua'],
          ['paid', 'Dibayar'],
          ['unpaid', 'Belum bayar'],
          ['cancelled', 'Batal/kedaluwarsa'],
        ].map(([k, l]) => (
          <Link key={k} href={`/admin/orders?${new URLSearchParams({ ...(k ? { status: k } : {}), ...(method ? { method } : {}) })}`} className={`${btnGhostCls} ${filter === k || (!filter && !k) ? 'border-orange-400 text-orange-700' : ''}`}>
            {l}
          </Link>
        ))}
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          ['', 'Semua metode'],
          ['DELIVERY', 'Diantar'],
          ['PICKUP', 'Ambil di toko'],
        ].map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/orders?${new URLSearchParams({ ...(filter ? { status: filter } : {}), ...(k ? { method: k } : {}) })}`}
            className={`rounded-full border px-3 py-1 ${method === k || (!method && !k) ? 'border-daun-600 bg-daun-50 text-daun-800' : 'border-slate-300 text-slate-600'}`}
          >
            {l}
          </Link>
        ))}
        <Link href="/admin/deliveries" className="ml-auto font-semibold text-daun-700 hover:underline">
          Lihat peta pengantaran hari ini
        </Link>
      </div>
      <Panel>
        <Table head={['Order', 'Pelanggan', 'Metode', 'Item', 'Total', 'Bayar', 'Status', 'Aksi']} empty="Tidak ada pesanan.">
          {orders.map((o) => {
            const next = adminNextStatus(o.fulfillmentMethod, o.status);
            return (
              <tr key={o.id} className="align-top">
                <td className="px-3 py-2">
                  <Link href={`/admin/orders/${o.orderNumber}`} className="font-mono text-xs text-orange-700 underline">
                    {o.orderNumber}
                  </Link>
                  <div className="text-[11px] text-slate-400">{formatDateTime(o.createdAt)}</div>
                </td>
                <td className="px-3 py-2">
                  {o.user ? (
                    <Link href={`/admin/customers/${o.user.id}`} className="hover:underline">
                      {o.user.name}
                    </Link>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="font-semibold text-ink">
                    {METHOD_LABEL[o.fulfillmentMethod]}
                    {o.isExpress && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Antar sekarang</span>}
                    {isFreshOrder(o.paidAt) && <span className="ml-1.5 rounded-full bg-daun-700 px-1.5 py-0.5 text-[10px] font-bold text-white">Baru</span>}
                  </div>
                  <div className="text-slate-500">
                    {orderScheduleText(o)}
                    {o.fulfillmentMethod === 'DELIVERY' ? ` · ${o.shippingDistanceKm} km` : ''}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {o.items.map((i) => (
                    <div key={i.id}>
                      {i.product.name} × {i.requestedKg} kg
                    </div>
                  ))}
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {formatIDR(o.finalAmount)}
                  {o.promoCode && <div className="text-[11px] text-slate-500">kode {o.promoCode}</div>}
                  {o.discountAmount + o.shippingDiscount > 0 && (
                    <div className="text-[11px] text-emerald-700">hemat {formatIDR(o.discountAmount + o.shippingDiscount)}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <PaymentPill status={o.paymentStatus} />
                  {o.stockDeducted && <div className="text-[10px] text-slate-400 mt-0.5">stok dipotong</div>}
                </td>
                <td className="px-3 py-2">
                  <Pill className="border-slate-300">{STATUS_LABEL[o.status] ?? o.status}</Pill>
                  {o.cancelReason && <div className="text-[11px] text-rose-600 max-w-[180px] mt-0.5">{o.cancelReason}</div>}
                </td>
                <td className="px-3 py-2 space-y-2 min-w-[180px]">
                  {o.fulfillmentMethod === 'DELIVERY' && o.status === 'SHIPPED' && (
                    <div className="mb-1 text-[11px] text-slate-500">Menunggu konfirmasi pelanggan</div>
                  )}
                  {next && o.stockDeducted && next !== 'PICKED_UP' && (
                    <ActionButton action={updateAdminOrderStatusAction.bind(null, o.orderNumber, next as never)} className={btnGhostCls}>
                      Tandai: {STATUS_LABEL[next]}
                    </ActionButton>
                  )}
                  {next === 'PICKED_UP' && (
                    <ActionForm action={confirmPickupAction} className="flex gap-1">
                      <input type="hidden" name="orderNumber" value={o.orderNumber} />
                      <input name="pickupCode" required placeholder="Kode ambil" className={`${fieldCls} text-xs uppercase`} />
                      <button className="rounded-md bg-daun-700 px-2 text-xs font-semibold text-white">Serahkan</button>
                    </ActionForm>
                  )}
                  {o.status !== 'CANCELLED' && o.status !== 'EXPIRED' && (
                    <ActionForm
                      action={cancelOrderAdminAction}
                      confirmText={o.stockDeducted ? 'Refund order ini? Stok akan dikembalikan.' : 'Batalkan order ini?'}
                      className="flex gap-1"
                    >
                      <input type="hidden" name="orderNumber" value={o.orderNumber} />
                      <input name="reason" placeholder="Alasan" className={`${fieldCls} text-xs`} />
                      <button className="rounded-md bg-rose-600 px-2 text-xs font-semibold text-white">{o.stockDeducted ? 'Refund' : 'Batal'}</button>
                    </ActionForm>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </div>
  );
}
