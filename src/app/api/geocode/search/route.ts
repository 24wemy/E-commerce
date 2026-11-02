import { searchPlaces } from '@/lib/geocode';
import { clientIp } from '@/lib/client-ip';
import { rateLimited } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 3) return Response.json({ results: [] });
  const ip = clientIp(req);
  if (rateLimited(`geo:${ip}`, 30)) return Response.json({ results: [], error: 'Terlalu banyak pencarian. Coba lagi sebentar.' }, { status: 429 });
  try {
    return Response.json({ results: await searchPlaces(q.slice(0, 120)) });
  } catch (e) {
    console.warn('[geocode] search gagal:', (e as Error).message);
    return Response.json({ results: [], error: 'Pencarian alamat sedang tidak tersedia. Geser pin di peta secara manual.' });
  }
}
