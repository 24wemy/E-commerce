import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Header } from '@/components/shop/Header';
import { Footer } from '@/components/shop/Footer';
import { runMaintenance } from '@/lib/maintenance';
import { formatDateTime } from '@/lib/business-rules';
import { OrderDetail, loadOrderFresh } from '@/components/orders/OrderDetail';

export const dynamic = 'force-dynamic';

export default async function OrderStatusPage({ params }: { params: { orderNumber: string } }) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/orders/${params.orderNumber}`);
  // Admin melihat pesanan dari panel admin, bukan dari tampilan toko
  if (session.user.role === 'ADMIN') redirect(`/admin/orders/${params.orderNumber}`);

  await runMaintenance();
  const order = await loadOrderFresh(params.orderNumber);
  if (!order || order.userId !== session.user.id) notFound();

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-8">
        <div>
          <Link href="/my-orders" className="text-sm text-slate-600 hover:text-ink">
            Kembali ke pesanan saya
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink">Pesanan {order.orderNumber}</h1>
          <p className="text-sm text-slate-600">Dibuat {formatDateTime(order.createdAt)} WITA</p>
        </div>
        <OrderDetail order={order} isAdmin={false} />
      </main>
      <Footer />
    </div>
  );
}
