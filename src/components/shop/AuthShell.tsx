import Link from 'next/link';
import { Check } from 'lucide-react';
import { Logo } from '@/components/shop/Logo';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-white">
      <aside className="hidden lg:flex flex-col justify-between bg-daun-800 text-white p-12 relative overflow-hidden">
        <div className="absolute -left-24 -bottom-32 h-96 w-96 rounded-full bg-kunyit-400" aria-hidden />
        <Link href="/" className="relative">
          <Logo light />
        </Link>
        <div className="relative max-w-md">
          <p className="text-4xl font-extrabold leading-tight">Belanja ayam segar tanpa harus ke pasar subuh.</p>
          <ul className="mt-8 space-y-3 text-daun-100">
            {['Riwayat pesanan & status pengantaran tersimpan', 'Kode promo khusus untuk pelanggan terdaftar', 'Keranjang tetap tersimpan di semua perangkat'].map((t) => (
              <li key={t} className="flex gap-3">
                <Check className="h-5 w-5 text-kunyit-300 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-kunyit-950 font-semibold">Minahasa Utara & Manado</p>
      </aside>
      <main className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="w-full max-w-sm mx-auto">
          <Link href="/" className="lg:hidden inline-block mb-8">
            <Logo />
          </Link>
          <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
          <p className="mt-2 text-slate-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 text-sm text-slate-600">{footer}</div>
        </div>
      </main>
    </div>
  );
}

export const authInput =
  'w-full h-11 rounded-lg border border-slate-300 px-3.5 text-[15px] outline-none focus:border-daun-600 focus:ring-2 focus:ring-daun-100';
export const authLabel = 'block text-sm font-semibold text-ink mb-1.5';
export const authButton = 'w-full h-11 rounded-lg bg-daun-700 hover:bg-daun-800 text-white font-semibold disabled:opacity-60';
