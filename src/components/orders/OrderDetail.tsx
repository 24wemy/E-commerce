import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SafeImage } from '@/components/shop/SafeImage';
import { SnapPayButton } from '@/components/shop/SnapPayButton';
import { SandboxSimulateButton } from '@/components/shop/SandboxSimulateButton';
import { DeliveryTracker } from '@/components/shop/DeliveryTracker';
import { CancelMyOrderButton } from '@/components/shop/CancelMyOrderButton';
import { syncOrderStatusAction } from '@/actions/checkout';
import type { Prisma } from '@prisma/client';
import { orderScheduleText } from '@/lib/schedule';
import { formatIDR, formatKg, formatDateTime, PAYMENT_EXPIRY_MINUTES, googleMapsDirections } from '@/lib/business-rules';


const PAYMENT_LABEL: Record<string, string> = {
  SETTLEMENT: 'Lunas',
  UNPAID: 'Belum dibayar',
  PENDING: 'Menunggu pembayaran',
  EXPIRE: 'Kedaluwarsa',
  CANCEL: 'Dibatalkan',
  DENY: 'Ditolak',
  REFUND: 'Dikembalikan',
};

const PAYMENT_TYPE: Record<string, string> = {
  bank_transfer: 'Transfer bank (VA)',
  echannel: 'Mandiri Bill',
  qris: 'QRIS',
  gopay: 'GoPay',
  credit_card: 'Kartu kredit',
  sandbox_simulation: 'Simulasi sandbox',
};

export const loadOrder = (orderNumber: string) =>
  prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: true } }, reviews: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
  });

export type OrderWithDetail = NonNullable<Prisma.PromiseReturnType<typeof loadOrder>>;

/** Muat order + cek status ke Midtrans bila belum lunas (berguna saat webhook belum menjangkau server). */
export async function loadOrderFresh(orderNumber: string) {
  let order = await loadOrder(orderNumber);
  if (order && !order.stockDeducted && ['UNPAID', 'PENDING'].includes(order.paymentStatus) && order.status === 'PENDING') {
    const r = await syncOrderStatusAction(order.orderNumber);
    if (r.success && r.updated) order = (await loadOrder(orderNumber)) ?? order;
  }
  return order;
}

/** Isi halaman detail pesanan — dipakai halaman pelanggan (/orders) dan panel admin (/admin/orders). */
export function OrderDetail({ order, isAdmin }: { order: OrderWithDetail; isAdmin: boolean }) {
  const paid = order.stockDeducted;
  const waitingPay = !paid && order.status === 'PENDING' && ['UNPAID', 'PENDING'].includes(order.paymentStatus);
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  const ongkir = order.deliveryFee - order.shippingDiscount;
  const payDeadline = new Date(order.createdAt.getTime() + PAYMENT_EXPIRY_MINUTES * 60_000);

  return (
    <>
        <DeliveryTracker
          orderId={order.id}
          orderNumber={order.orderNumber}
          status={order.status}
          paid={paid}
          isAdmin={isAdmin}
          hasReview={order.reviews.length > 0}
          productName={order.items[0]?.product.name}
          method={order.fulfillmentMethod}
          destination={order.deliveryLat != null && order.deliveryLng != null ? { lat: order.deliveryLat, lng: order.deliveryLng } : null}
          distanceKm={order.shippingDistanceKm}
          slot={orderScheduleText(order)}
          pickupCode={paid && !isAdmin ? order.pickupCode : null}
          history={order.statusHistory.map((h) => ({ status: h.status, note: h.note, at: h.createdAt.toISOString() }))}
        />

        <div className="grid gap-5 md:grid-cols-[1fr_320px]">
          <section className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold text-ink">Rincian pesanan</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                  <SafeImage src={item.product.images[0]} alt={item.product.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    {isAdmin ? (
                      <span className="font-medium text-ink">
                        {item.product.name} <span className="font-mono text-xs text-slate-400">{item.product.sku}</span>
                      </span>
                    ) : (
                      <Link href={`/products/${item.product.slug}`} className="font-medium text-ink hover:underline">
                        {item.product.name}
                      </Link>
                    )}
                    <p className="text-sm text-slate-500">
                      {formatKg(item.requestedKg)} × {formatIDR(item.pricePerKg)}/kg
                    </p>
                  </div>
                  <p className="font-semibold text-ink">{formatIDR(item.subtotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd>{formatIDR(order.subtotal)}</dd>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-daun-700">
                  <dt>Diskon {order.promoCode}</dt>
                  <dd>−{formatIDR(order.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <dt>{order.fulfillmentMethod === 'PICKUP' ? 'Ambil di toko' : `Ongkos kirim (${order.shippingDistanceKm} km)`}</dt>
                <dd>{ongkir === 0 ? (order.fulfillmentMethod === 'PICKUP' ? 'Gratis' : `Gratis (${order.promoCode})`) : formatIDR(ongkir)}</dd>
              </div>
              {order.expressFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <dt>Biaya antar sekarang</dt>
                  <dd>{formatIDR(order.expressFee)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-ink">
                <dt>Total</dt>
                <dd>{formatIDR(order.finalAmount)}</dd>
              </div>
            </dl>
          </section>

          <aside className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
              <h2 className="font-semibold text-ink">Pembayaran</h2>
              <p className="mt-2 text-slate-600">
                Status: <span className="font-medium text-ink">{PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}</span>
              </p>
              {order.paymentType && (
                <p className="text-slate-600">
                  Metode: <span className="font-medium text-ink">{PAYMENT_TYPE[order.paymentType] ?? order.paymentType}</span>
                </p>
              )}
              {order.paidAt && <p className="text-slate-600">Dibayar {formatDateTime(order.paidAt)} WITA</p>}
              {order.cancelReason && <p className="mt-2 text-cabai-600">{order.cancelReason}</p>}

              {waitingPay && (
                <div className="mt-4 space-y-3">
                  <p className="text-slate-600">Bayar sebelum {formatDateTime(payDeadline)} WITA.</p>
                  {isAdmin ? (
                    <p className="text-slate-500">Menunggu pelanggan membayar lewat Midtrans.</p>
                  ) : (
                    <>
                      {order.snapToken && <SnapPayButton snapToken={order.snapToken} orderNumber={order.orderNumber} />}
                      {!isProduction && <SandboxSimulateButton orderNumber={order.orderNumber} />}
                      <CancelMyOrderButton orderNumber={order.orderNumber} />
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
              <h2 className="font-semibold text-ink">{order.fulfillmentMethod === 'PICKUP' ? 'Lokasi ambil' : 'Alamat pengiriman'}</h2>
              <p className="mt-2 text-slate-600 whitespace-pre-line">{order.shippingAddress.replace(/["']/g, '')}</p>
              {order.addressNote && <p className="mt-1 text-slate-500">Patokan: {order.addressNote}</p>}
              {isAdmin && order.deliveryLat != null && order.deliveryLng != null && (
                <a
                  className="mt-2 inline-block font-semibold text-daun-700 hover:underline"
                  href={googleMapsDirections(order.deliveryLat, order.deliveryLng)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka rute di Google Maps
                </a>
              )}
            </section>
          </aside>
        </div>
    </>
  );
}
