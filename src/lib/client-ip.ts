/**
 * IP pengunjung untuk rate limit.
 * - Di belakang proxy Cloudflare (TRUST_CLOUDFLARE=true): pakai `cf-connecting-ip`.
 * - Selain itu header tsb. diabaikan karena bisa dipalsukan pengunjung; pakai `x-real-ip` / `x-forwarded-for`
 *   (di Vercel keduanya diisi oleh Vercel sendiri).
 */
export function clientIp(req: Request) {
  const h = req.headers;
  if (process.env.TRUST_CLOUDFLARE === 'true') {
    const cf = h.get('cf-connecting-ip');
    if (cf) return cf;
  }
  return h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
