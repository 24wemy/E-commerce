// Aturan bisnis yang dipakai bersama oleh client & server.
// Semua angka di sini sengaja dikumpulkan di satu file agar mudah dijelaskan saat presentasi
// dan konsisten dengan Business Plan (kebijakan stok, ongkir, segmentasi).

/* ------------------------------------------------------------------ */
/*  Pengantaran & ambil di toko                                         */
/* ------------------------------------------------------------------ */

export type FulfillmentKey = 'DELIVERY' | 'PICKUP';

/**
 * Lokasi toko / titik potong. Koordinat contoh di Airmadidi — ganti dengan titik toko sebenarnya
 * (buka Google Maps, klik kanan lokasi toko, salin angka lat, lng).
 */
export const STORE = {
  name: 'Fresh Minut Airmadidi',
  address: 'Jl. Raya Airmadidi–Kauditan, Airmadidi Bawah, Minahasa Utara',
  lat: 1.4253,
  lng: 124.9808,
  hours: 'Setiap hari 05.00–20.00 WITA',
};

/** Ongkir berdasarkan jarak (km). Di atas tier terakhir = di luar area antar. */
export const DELIVERY_TIERS = [
  { maxKm: 3, fee: 5000 },
  { maxKm: 7, fee: 10000 },
  { maxKm: 15, fee: 15000 },
] as const;
export const MAX_DELIVERY_KM = DELIVERY_TIERS[DELIVERY_TIERS.length - 1].maxKm;
/** Jarak garis lurus × faktor ini ≈ jarak lewat jalan. */
export const ROAD_FACTOR = 1.3;
/** Ongkir terendah — dipakai untuk teks "ongkir mulai dari". */
export const MIN_SHIPPING_FEE = DELIVERY_TIERS[0].fee;


export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Hitung jarak (perkiraan jalan) & ongkir dari toko ke titik pelanggan. Dipakai di browser dan server. */
export function quoteDelivery(lat: number, lng: number):
  | { ok: true; distanceKm: number; fee: number }
  | { ok: false; distanceKm: number; error: string } {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, distanceKm: 0, error: 'Titik lokasi tidak valid. Pilih lokasi di peta.' };
  }
  const distanceKm = Math.round(haversineKm(STORE, { lat, lng }) * ROAD_FACTOR * 10) / 10;
  const tier = DELIVERY_TIERS.find((t) => distanceKm <= t.maxKm);
  if (!tier) {
    return {
      ok: false,
      distanceKm,
      error: `Lokasi berjarak sekitar ${distanceKm} km dari toko, di luar area antar (maks. ${MAX_DELIVERY_KM} km). Pilih Ambil di toko.`,
    };
  }
  return { ok: true, distanceKm, fee: tier.fee };
}

export const googleMapsDirections = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** Lama stok "dipesan sementara" untuk order yang belum dibayar (menit). Sama dengan masa berlaku Snap Midtrans. */
export const PAYMENT_EXPIRY_MINUTES = 30;

/** Keranjang dianggap terbengkalai (abandoned) jika tidak ada aktivitas selama ini (menit). */
export const ABANDONED_CART_MINUTES = 60;

/** 1 poin loyalitas per kelipatan Rp 10.000 dari total bayar. */
export const POINTS_PER_RUPIAH = 10000;

/** Kenaikan kuantitas di keranjang (kg). */
export const QTY_STEP_KG = 0.5;

/** Aturan segmentasi CRM (berdasarkan order yang sudah DIBAYAR). */
export const SEGMENT_RULES = {
  INACTIVE_AFTER_DAYS: 60, // tidak belanja > 60 hari -> Tidak Aktif
  LOYAL_MIN_ORDERS: 3, // >= 3 order dibayar & masih aktif -> Loyal
} as const;

export type CustomerSegmentKey = 'PROSPECT' | 'NEW' | 'REGULAR' | 'LOYAL' | 'INACTIVE';

export const SEGMENT_META: Record<CustomerSegmentKey, { label: string; rule: string; color: string }> = {
  PROSPECT: {
    label: 'Prospek',
    rule: 'Sudah daftar, belum pernah order yang dibayar',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  NEW: {
    label: 'Pelanggan Baru',
    rule: 'Tepat 1 order dibayar dalam 60 hari terakhir',
    color: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  REGULAR: {
    label: 'Reguler',
    rule: '2 order dibayar, order terakhir ≤ 60 hari',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  LOYAL: {
    label: 'Loyal',
    rule: '≥ 3 order dibayar, order terakhir ≤ 60 hari',
    color: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  INACTIVE: {
    label: 'Tidak Aktif',
    rule: 'Pernah belanja, tapi order terakhir > 60 hari lalu',
    color: 'bg-rose-100 text-rose-800 border-rose-300',
  },
};

export const PROMO_TYPE_META: Record<string, { label: string; hint: string }> = {
  PERCENTAGE: { label: 'Diskon Persen', hint: 'Nilai = persen (mis. 15 = 15%). Bisa diberi batas maksimal diskon.' },
  FIXED_AMOUNT: { label: 'Diskon Nominal', hint: 'Nilai = rupiah (mis. 20000 = Rp 20.000).' },
  FREE_SHIPPING: { label: 'Gratis Ongkir', hint: 'Ongkir menjadi Rp 0 bila minimum belanja terpenuhi.' },
  FLASH_SALE: { label: 'Flash Sale', hint: 'Diskon persen dengan periode singkat & kuota terbatas.' },
};

export function computeSegment(input: {
  paidOrders: number;
  lastPaidAt: Date | null;
  now?: Date;
}): CustomerSegmentKey {
  const now = input.now ?? new Date();
  if (input.paidOrders === 0 || !input.lastPaidAt) return 'PROSPECT';
  const days = (now.getTime() - input.lastPaidAt.getTime()) / 86_400_000;
  if (days > SEGMENT_RULES.INACTIVE_AFTER_DAYS) return 'INACTIVE';
  if (input.paidOrders >= SEGMENT_RULES.LOYAL_MIN_ORDERS) return 'LOYAL';
  if (input.paidOrders === 1) return 'NEW';
  return 'REGULAR';
}

/** Skor RFM sederhana (1-5) untuk nilai tambah CRM. */
export function rfmScore(input: { daysSinceLast: number | null; frequency: number; monetary: number }) {
  const d = input.daysSinceLast;
  const r = d === null ? 0 : d <= 14 ? 5 : d <= 30 ? 4 : d <= 60 ? 3 : d <= 90 ? 2 : 1;
  const f = input.frequency >= 6 ? 5 : input.frequency >= 4 ? 4 : input.frequency >= 3 ? 3 : input.frequency >= 2 ? 2 : input.frequency >= 1 ? 1 : 0;
  const m =
    input.monetary >= 1_500_000 ? 5 : input.monetary >= 1_000_000 ? 4 : input.monetary >= 500_000 ? 3 : input.monetary >= 200_000 ? 2 : input.monetary > 0 ? 1 : 0;
  return { r, f, m, label: `${r}${f}${m}` };
}

export const formatIDR = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export const formatKg = (kg: number) => `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;

export const formatDateTime = (d: Date | string) =>
  new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Makassar' });

export const formatDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Makassar' });
