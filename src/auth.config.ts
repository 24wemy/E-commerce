import type { NextAuthConfig } from 'next-auth';
import { Role } from '@prisma/client';

export const authConfig = {
  // Wajib diisi di .env. Nama lama NEXTAUTH_SECRET tetap diterima.
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const role = auth?.user?.role;
      const path = nextUrl.pathname;
      const isOnAdmin = path === '/admin' || path.startsWith('/admin/');
      const isFile = /\.[a-z0-9]+$/i.test(path);

      if (isOnAdmin) {
        if (role === 'ADMIN') return true;
        // Pelanggan yang sudah login tidak punya akses admin → kembali ke toko; tamu → halaman login
        if (auth?.user) return Response.redirect(new URL('/', nextUrl));
        return false;
      }

      // Akun ADMIN hanya bekerja di panel admin: tidak melihat toko, keranjang, atau checkout.
      if (role === 'ADMIN' && !isFile) {
        const order = path.match(/^\/orders\/([^/]+)$/);
        const target = order ? `/admin/orders/${order[1]}` : '/admin';
        return Response.redirect(new URL(target, nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
