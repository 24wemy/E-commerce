'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { registerUserAction } from '@/actions/auth';
import { AuthShell, authInput, authLabel, authButton } from '@/components/shop/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const res = await registerUserAction(formData);
    if (res.error) {
      setLoading(false);
      setError(res.error);
      return;
    }
    // Langsung login setelah daftar, lalu kembali ke halaman asal (mis. checkout)
    const login = await signIn('credentials', { email: formData.get('email'), password: formData.get('password'), redirect: false });
    const cb = new URLSearchParams(window.location.search).get('callbackUrl');
    const safe = cb && cb.startsWith('/') && !cb.startsWith('//') ? cb : '/';
    router.push(login?.error ? '/login?registered=true' : safe);
    router.refresh();
  };

  return (
    <AuthShell
      title="Buat akun"
      subtitle="Gratis. Satu akun untuk belanja, lacak pesanan, dan menerima promo."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-daun-700 hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className={authLabel}>
            Nama lengkap
          </label>
          <input id="name" name="name" required minLength={2} autoComplete="name" className={authInput} />
        </div>
        <div>
          <label htmlFor="email" className={authLabel}>
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={authInput} />
        </div>
        <div>
          <label htmlFor="password" className={authLabel}>
            Password
          </label>
          <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" className={authInput} />
          <p className="mt-1.5 text-xs text-slate-500">Minimal 6 karakter.</p>
        </div>
        {error && <p className="text-sm text-cabai-600 bg-cabai-50 border border-cabai-100 rounded-lg p-3">{error}</p>}
        <button type="submit" disabled={loading} className={authButton}>
          {loading ? 'Membuat akun…' : 'Buat akun'}
        </button>
      </form>
    </AuthShell>
  );
}
