import Link from 'next/link';
import { runMaintenance } from '@/lib/maintenance';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AdminLiveRefresh } from '@/components/admin/AdminLiveRefresh';
import { signOutAction } from '@/actions/auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { LogoMark } from '@/components/shop/Logo';
import { LogOut } from 'lucide-react';


export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/login?callbackUrl=/admin');

  await runMaintenance();
  // Pesanan sudah dibayar yang belum dikirim / belum siap diambil
  const where = { stockDeducted: true, status: { in: ['PROCESSING', 'CONFIRMED', 'WEIGHT_VERIFIED'] as OrderStatus[] } };
  const [toProcess, express, latest] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, isExpress: true } }),
    prisma.order.findFirst({ where: { stockDeducted: true }, orderBy: { paidAt: 'desc' }, select: { paidAt: true } }),
  ]);
  const badge: Record<string, number> = { '/admin/orders': toProcess, '/admin/deliveries': express };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="leading-none">
              <span className="block text-[17px] font-extrabold tracking-tight text-daun-800">Fresh Minut</span>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-500">Panel admin</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{session.user.name ?? session.user.email}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" /> Keluar
              </button>
            </form>
          </div>
        </div>
        <AdminNav badge={badge} />
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
      <AdminLiveRefresh toProcess={toProcess} express={express} latestPaidAt={latest?.paidAt?.toISOString() ?? null} />
    </div>
  );
}
