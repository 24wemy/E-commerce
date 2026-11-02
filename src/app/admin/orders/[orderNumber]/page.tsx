import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { runMaintenance } from '@/lib/maintenance';
import { formatDateTime, formatIDR, SEGMENT_META } from '@/lib/business-rules';
import { OrderDetail, loadOrderFresh } from '@/components/orders/OrderDetail';
import { cancelOrderAdminAction, confirmPickupAction } from '@/actions/admin';
import { ActionForm } from '@/components/admin/ActionForm';
import { Panel, fieldCls } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({ params }: { params: { orderNumber: string } }) {
  await runMaintenance();
  const order = await loadOrderFresh(params.orderNumber);
  if (!order) notFound();
  const customer = order.userId
    ? await prisma.user.findUnique({
        where: { id: order.userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          segment: true,
          businessName: true,
          _count: { select: { orders: true } },
        },
      })
    : null;
  const cancellable =
    order.status !== 'CANCELLED' && order.status !== 'EXPIRED' && order.status !== 'DELIVERED' && order.status !== 'PICKED_UP';

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href="/admin/orders" className="text-sm text-slate-600 hover:text-ink">
          Kembali ke daftar pesanan
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">Pesanan {order.orderNumber}</h1>
        <p className="text-sm text-slate-600">Dibuat {formatDateTime(order.createdAt)} WITA</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Pelanggan">
          {customer ? (
            <div className="space-y-1 text-sm">
              <Link href={`/admin/customers/${customer.id}`} className="font-semibold text-ink hover:underline">
                {customer.name}
              </Link>
              {customer.businessName && <p className="text-slate-600">{customer.businessName}</p>}
              <p className="text-slate-600">{customer.email}</p>
              {customer.phone && (
                <a
                  href={`https://wa.me/${customer.phone.replace(/\D/g, '').replace(/^0/, '62')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-daun-700 hover:underline"
                >
                  WhatsApp {customer.phone}
                </a>
              )}
              <p className="pt-1 text-xs text-slate-500">
                Segmen {SEGMENT_META[customer.segment as keyof typeof SEGMENT_META]?.label ?? customer.segment} · {customer._count.orders}{' '}
                pesanan
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Akun pelanggan sudah dihapus.</p>
          )}
        </Panel>

        {order.status === 'READY_FOR_PICKUP' && (
          <Panel title="Serahkan pesanan">
            <ActionForm action={confirmPickupAction} className="space-y-2">
              <input type="hidden" name="orderNumber" value={order.orderNumber} />
              <input
                name="pickupCode"
                required
                autoComplete="off"
                placeholder="Kode ambil dari pelanggan"
                className={`${fieldCls} uppercase tracking-widest`}
              />
              <button className="w-full rounded-md bg-daun-700 py-2 text-sm font-semibold text-white hover:bg-daun-800">
                Cek kode & serahkan
              </button>
              <p className="text-xs text-slate-500">Minta pelanggan menunjukkan kode di halaman pesanannya.</p>
            </ActionForm>
          </Panel>
        )}
        {cancellable && (
          <Panel title={order.stockDeducted ? 'Refund pesanan' : 'Batalkan pesanan'}>
            <ActionForm
              action={cancelOrderAdminAction}
              confirmText={
                order.stockDeducted ? `Refund ${formatIDR(order.finalAmount)}? Stok akan dikembalikan.` : 'Batalkan pesanan ini?'
              }
              className="space-y-2"
            >
              <input type="hidden" name="orderNumber" value={order.orderNumber} />
              <input name="reason" required minLength={3} placeholder="Alasan (wajib)" className={fieldCls} />
              <button className="w-full rounded-md bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                {order.stockDeducted ? 'Refund & kembalikan stok' : 'Batalkan pesanan'}
              </button>
            </ActionForm>
          </Panel>
        )}
      </div>

      <OrderDetail order={order} isAdmin />
    </div>
  );
}
