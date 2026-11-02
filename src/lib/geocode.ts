/**
 * Geocoding gratis dengan Nominatim (OpenStreetMap).
 * Kebijakan pemakaian: maks. 1 request/detik, wajib User-Agent yang jelas, hasil sebaiknya di-cache.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const BASE = 'https://nominatim.openstreetmap.org';
const UA = process.env.NOMINATIM_USER_AGENT || 'FreshMinut/1.0 (proyek e-commerce kampus)';
// Batasi pencarian ke sekitar Minahasa Utara & Manado (kiri, atas, kanan, bawah)
const VIEWBOX = '124.55,1.80,125.30,1.20';

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 24 * 3600_000;
let queue: Promise<unknown> = Promise.resolve();
let last = 0;

async function upstream<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  // Antre agar tidak lebih dari 1 request per detik ke Nominatim
  const run = queue.then(async () => {
    const wait = Math.max(0, last + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'id' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return res.json();
  });
  queue = run.catch(() => undefined);
  const data = (await run) as T;
  cache.set(path, { at: Date.now(), data });
  if (cache.size > 2000) cache.clear();
  return data;
}

type NomItem = { lat: string; lon: string; display_name: string; name?: string };

const shortLabel = (display: string) => display.split(', ').slice(0, 4).join(', ');

export async function searchPlaces(q: string) {
  const params = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'id', viewbox: VIEWBOX, bounded: '1', limit: '5' });
  const items = await upstream<NomItem[]>(`/search?${params}`);
  return items.map((i) => ({ label: shortLabel(i.display_name), lat: Number(i.lat), lng: Number(i.lon) }));
}

export async function reverseGeocode(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: lat.toFixed(5), lon: lng.toFixed(5), format: 'jsonv2', zoom: '18' });
  const item = await upstream<NomItem & { error?: string }>(`/reverse?${params}`);
  if (!item || item.error) return null;
  return { label: shortLabel(item.display_name) };
}
