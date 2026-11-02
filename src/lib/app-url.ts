/**
 * URL publik aplikasi (untuk link di email & tombol kembali dari Midtrans).
 * Urutan: NEXT_PUBLIC_APP_URL → AUTH_URL → domain produksi Vercel otomatis → localhost.
 */
export function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
