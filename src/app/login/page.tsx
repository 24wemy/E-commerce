'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AuthShell, authInput, authLabel, authButton } from '@/components/shop/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      setError('Email atau password tidak cocok. Periksa lagi, lalu coba masuk.');
      return;
    }
    const cb = new URLSearchParams(window.location.search).get('callbackUrl');
    const safe = cb && cb.startsWith('/') && !cb.startsWith('//') ? cb : null;
    const session = await getSession();
    const isAdmin = session?.user?.role === 'ADMIN';
    const toAdmin = !!safe && (safe === '/admin' || safe.startsWith('/admin/'));
    // Admin selalu ke panel admin; pelanggan tidak pernah diarahkan ke halaman admin
    router.push(isAdmin ? (toAdmin ? safe! : '/admin') : safe && !toAdmin ? safe : '/');
    router.refresh();
  };

  const registerHref = () => {
    if (typeof window === 'undefined') return '/register';
    const cb = new URLSearchParams(window.location.search).get('callbackUrl');
    return cb ? `/register?callbackUrl=${encodeURIComponent(cb)}` : '/register';
  };

  return (
    <AuthShell
      title="Masuk"
      subtitle="Masuk untuk checkout dan melihat pesanan Anda."
      footer={
        <>
          Belum punya akun?{' '}
          <Link href={registerHref()} className="font-semibold text-daun-700 hover:underline">
            Daftar gratis
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={authLabel}>
            Email
          </label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
        </div>
        <div>
          <label htmlFor="password" className={authLabel}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInput}
          />
        </div>
        {error && <p className="text-sm text-cabai-600 bg-cabai-50 border border-cabai-100 rounded-lg p-3">{error}</p>}
        <button type="submit" disabled={loading} className={authButton}>
          {loading ? 'Memproses…' : 'Masuk'}
        </button>
      </form>

      {/* Akun demo hanya tampil bila NEXT_PUBLIC_SHOW_DEMO_LOGIN="true" (matikan saat produksi) */}
      {process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === 'true' && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs text-slate-500 mb-2">Akun demo (hanya untuk presentasi)</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <button type="button" onClick={() => { setEmail('admin@freshminut.com'); setPassword('admin123'); }} className="rounded-md border border-slate-300 py-2 hover:border-daun-600">
              Admin
            </button>
            <button type="button" onClick={() => { setEmail('nathantambuku13@gmail.com'); setPassword('user123'); }} className="rounded-md border border-slate-300 py-2 hover:border-daun-600">
              Pelanggan
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
