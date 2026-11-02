import Link from 'next/link';
import { runMaintenance } from '@/lib/maintenance';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/shop/Header';
import { Footer } from '@/components/shop/Footer';
import { SafeImage } from '@/components/shop/SafeImage';
import { OrderClaimBar } from '@/components/shop/OrderClaimBar';
import { syncOrderStatusAction } from '@/actions/checkout';
import { formatIDR, formatKg, formatDate } from '@/lib/business-rules';
import { Star } from 'lucide-react';
import { STATUS_LABEL, METHOD_LABEL, isCompleted } from '@/lib/fulfillment';

export const revalidate = 0;

const PAYMENT: Record<string, { label: string; cls: string }> = {
  SETTLEMENT: { label: 'Lunas', cls: 'bg-daun-50 text-daun-800 border-daun-200' },
  UNPAID: { label: 'Menunggu pembayaran', cls: 'bg-kunyit-50 text-kunyit-800 border-kunyit-200' },
  PENDING: { label: 'Menunggu pembayaran', cls: 'bg-kunyit-50 text-kunyit-800 border-kunyit-200' },
  EXPIRE: { label: 'Kedaluwarsa', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  CANCEL: { label: 'Dibatalkan', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  DENY: { label: 'Ditolak', cls: 'bg-cabai-50 text-cabai-700 border-cabai-100' },
  REFUND: { label: 'Dikembalikan', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const DELIVERY = STATUS_LABEL;

export default async function MyOrdersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/my-orders');

  await runMaintenance();
  const pending = await prisma.order.findMany({
    where: { userId: session.user.id, paymentStatus: { in: ['UNPAID', 'PENDING'] }, status: 'PENDING' },
    select: { orderNumber: true },
  });
  for (const po of pending) await syncOrderStatusAction(po.orderNumber);

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: true } }, reviews: true },
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-ink">Pesanan saya</h1>
        <p className="mt-1 text-slate-600">Lacak pengantaran, selesaikan pembayaran, dan beri ulasan setelah pesanan diterima.</p>

        <div className="mt-6">
          <OrderClaimBar />
        </div>

        {orders.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <h2 className="text-lg font-semibold text-ink">Belum ada pesanan</h2>
            <p className="mt-1 text-slate-600">Pesanan yang Anda buat akan muncul di sini.</p>
            <Link href="/#katalog" className="mt-5 inline-flex rounded-lg bg-daun-700 px-5 py-2.5 font-semibold text-white hover:bg-daun-800">
              Mulai belanja
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const pay = PAYMENT[o.paymentStatus] ?? { label: o.paymentStatus, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
              const first = o.items[0];
              const waitingPay = o.status === 'PENDING' && ['UNPAID', 'PENDING'].includes(o.paymentStatus);
              const review = o.reviews[0];
              return (
                <li key={o.id} className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-sm">
                    <span className="text-slate-600">
                      <span className="font-semibold text-ink">{o.orderNumber}</span>
                      <span className="mx-2 text-slate-300">|</span>
                      {formatDate(o.createdAt)}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {METHOD_LABEL[o.fulfillmentMethod]}{o.isExpress ? ' (antar sekarang)' : ''} · {DELIVERY[o.status] ?? o.status}
                      </span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${pay.cls}`}>{pay.label}</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <SafeImage src={first?.product.images[0]} alt={first?.product.name ?? 'Produk'} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        {first?.product.name ?? 'Pesanan'}
                        {o.items.length > 1 && <span className="font-normal text-slate-500"> dan {o.items.length - 1} produk lain</span>}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatKg(o.actualWeightKg ?? o.requestedWeightKg)}
                        {o.actualWeightKg ? ' (berat timbang)' : ''}
                        {o.promoCode ? ` · kode ${o.promoCode}` : ''}
                      </p>
                      <p className="mt-1 font-bold text-ink">{formatIDR(o.finalAmount)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {review && (
                        <span className="flex items-center gap-1 text-sm text-slate-600">
                          <Star className="h-4 w-4 fill-kunyit-400 text-kunyit-400" /> {review.rating}/5
                        </span>
                      )}
                      <Link
                        href={`/orders/${o.orderNumber}`}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                          waitingPay ? 'bg-daun-700 text-white hover:bg-daun-800' : 'border border-slate-300 text-ink hover:bg-slate-50'
                        }`}
                      >
                        {waitingPay ? 'Bayar sekarang' : isCompleted(o.status) && !review ? 'Beri ulasan' : o.status === 'READY_FOR_PICKUP' ? 'Lihat kode ambil' : 'Lihat detail'}
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
