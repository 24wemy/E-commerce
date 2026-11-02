import { reverseGeocode } from '@/lib/geocode';
import { clientIp } from '@/lib/client-ip';
import { rateLimited } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get('lat'));
  const lng = Number(sp.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json({ label: null }, { status: 400 });
  const ip = clientIp(req);
  if (rateLimited(`geo:${ip}`, 30)) return Response.json({ label: null }, { status: 429 });
  try {
    const r = await reverseGeocode(lat, lng);
    return Response.json({ label: r?.label ?? null });
  } catch (e) {
    console.warn('[geocode] reverse gagal:', (e as Error).message);
    return Response.json({ label: null });
  }
}
