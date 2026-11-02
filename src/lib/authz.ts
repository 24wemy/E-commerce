import { auth } from '@/auth';

export class AuthzError extends Error {}

/** Wajib dipanggil di setiap server action admin. Middleware hanya melindungi halaman, bukan action. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    throw new AuthzError('Akses ditolak: hanya admin.');
  }
  return session.user;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthzError('Silakan login terlebih dahulu.');
  }
  return session.user;
}

export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}
