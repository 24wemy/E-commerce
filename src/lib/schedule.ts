// Jadwal antar & ambil. Semua waktu dihitung dalam WITA (UTC+8), terlepas dari zona waktu server/browser.
// Dipakai di browser (pilihan slot) dan di server (validasi ulang saat checkout).

export const WITA_OFFSET_MIN = 8 * 60;
/** Waktu potong & kemas minimal sebelum slot dimulai. */
export const PREP_MINUTES = 60;
/** Antar subuh esok hari hanya untuk pesanan sebelum jam ini (hari sebelumnya). */
export const NEXT_DAY_CUTOFF = '21:00';

/** Antar sekarang (instan): biaya tambahan di atas ongkir jarak, hanya di jam operasional. */
export const EXPRESS = {
  label: 'Antar sekarang',
  fee: 5000,
  firstOrder: '06:00',
  lastOrder: '18:00',
  etaMinMinutes: 60,
  etaMaxMinutes: 90,
};

type Window = { key: string; label: string; start: string; end: string };

export const DELIVERY_WINDOWS: Window[] = [
  { key: 'SUBUH', label: 'Subuh', start: '05:30', end: '07:00' },
  { key: 'PAGI', label: 'Pagi', start: '07:00', end: '09:00' },
  { key: 'SIANG', label: 'Siang', start: '11:00', end: '13:00' },
  { key: 'SORE', label: 'Sore', start: '15:00', end: '17:00' },
];

export const PICKUP_WINDOWS: Window[] = [
  { key: 'SUBUH', label: 'Subuh', start: '05:30', end: '07:00' },
  { key: 'PAGI', label: 'Pagi', start: '07:00', end: '09:00' },
  { key: 'SIANG', label: 'Siang', start: '09:00', end: '12:00' },
  { key: 'SORE', label: 'Sore', start: '15:00', end: '18:00' },
];

export type SlotOption = {
  /** 'EXPRESS' atau 'YYYY-MM-DD|KEY' */
  id: string;
  label: string;
  /** Label absolut untuk disimpan di order (tidak memakai "Hari ini"/"Besok"). */
  storeLabel: string;
  startsAt: Date;
  endsAt: Date;
  express: boolean;
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmt = (hhmm: string) => hhmm.replace(':', '.');

/** Tanggal (y, m, d) & menit-sejak-tengah-malam dalam WITA. */
function witaParts(now: Date) {
  const shifted = new Date(now.getTime() + WITA_OFFSET_MIN * 60_000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Date (UTC) untuk tanggal WITA + offset hari + jam WITA. */
function witaDate(base: { y: number; m: number; d: number }, dayOffset: number, hhmm: string) {
  const mins = toMin(hhmm);
  return new Date(Date.UTC(base.y, base.m, base.d + dayOffset, 0, mins) - WITA_OFFSET_MIN * 60_000);
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function dayLabel(base: { y: number; m: number; d: number }, offset: number) {
  if (offset === 0) return 'Hari ini';
  if (offset === 1) return 'Besok';
  const dt = new Date(Date.UTC(base.y, base.m, base.d + offset));
  return `${DAY_NAMES[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

function absDay(base: { y: number; m: number; d: number }, offset: number) {
  const dt = new Date(Date.UTC(base.y, base.m, base.d + offset));
  return `${DAY_NAMES[dt.getUTCDay()].slice(0, 3)}, ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

function scheduled(windows: Window[], now: Date, minCount: number): SlotOption[] {
  const base = witaParts(now);
  const out: SlotOption[] = [];
  for (let offset = 0; offset < 4 && out.length < minCount; offset++) {
    for (const w of windows) {
      const startsAt = witaDate(base, offset, w.start);
      // Slot harus dimulai paling cepat PREP_MINUTES dari sekarang
      if (startsAt.getTime() - now.getTime() < PREP_MINUTES * 60_000) continue;
      // Slot subuh hari X hanya untuk pesanan sebelum NEXT_DAY_CUTOFF hari X-1 (stok dipotong malam sebelumnya)
      if (w.key === 'SUBUH' && (offset === 0 || (offset === 1 && base.minutes >= toMin(NEXT_DAY_CUTOFF)))) continue;
      const date = new Date(Date.UTC(base.y, base.m, base.d + offset)).toISOString().slice(0, 10);
      out.push({
        id: `${date}|${w.key}`,
        label: `${dayLabel(base, offset)} · ${w.label} ${fmt(w.start)}–${fmt(w.end)}`,
        storeLabel: `${absDay(base, offset)} · ${w.label} ${fmt(w.start)}–${fmt(w.end)} WITA`,
        startsAt,
        endsAt: witaDate(base, offset, w.end),
        express: false,
      });
    }
  }
  return out.slice(0, minCount);
}

/** Apakah "Antar sekarang" tersedia saat ini. */
export function expressAvailable(now = new Date()) {
  const { minutes } = witaParts(now);
  return minutes >= toMin(EXPRESS.firstOrder) && minutes <= toMin(EXPRESS.lastOrder);
}

export function deliveryOptions(now = new Date()): SlotOption[] {
  const list = scheduled(DELIVERY_WINDOWS, now, 6);
  if (expressAvailable(now)) {
    list.unshift({
      id: 'EXPRESS',
      label: `${EXPRESS.label} · tiba ±${EXPRESS.etaMinMinutes}–${EXPRESS.etaMaxMinutes} menit`,
      storeLabel: `${EXPRESS.label} (±${EXPRESS.etaMinMinutes}–${EXPRESS.etaMaxMinutes} menit setelah bayar)`,
      startsAt: new Date(now.getTime() + EXPRESS.etaMinMinutes * 60_000),
      endsAt: new Date(now.getTime() + EXPRESS.etaMaxMinutes * 60_000),
      express: true,
    });
  }
  return list;
}

export function pickupOptions(now = new Date()): SlotOption[] {
  return scheduled(PICKUP_WINDOWS, now, 6);
}

/** Validasi slot pilihan pelanggan terhadap waktu SEKARANG (server). */
export function resolveSlot(method: 'DELIVERY' | 'PICKUP', id: string, now = new Date()): SlotOption | null {
  const list = method === 'DELIVERY' ? deliveryOptions(now) : pickupOptions(now);
  return list.find((s) => s.id === id) ?? null;
}

/** Jam WITA "HH.MM" dari Date. */
export const witaTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' });

export const describeExpress = () =>
  `Tambahan ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(EXPRESS.fee)}, tersedia ${fmt(EXPRESS.firstOrder)}–${fmt(EXPRESS.lastOrder)} WITA`;

/** "Hari ini 07.00–09.00" / "Besok 05.30–07.00" / "Rab, 5 Nov 15.00–17.00" relatif terhadap now (WITA). */
export function formatWindow(start: Date | string, end: Date | string, now = new Date()) {
  const a = new Date(start);
  const today = witaParts(now);
  const day = witaParts(a);
  const diff = Math.round((Date.UTC(day.y, day.m, day.d) - Date.UTC(today.y, today.m, today.d)) / 86_400_000);
  const dayTxt = diff === 0 ? 'Hari ini' : diff === 1 ? 'Besok' : diff === -1 ? 'Kemarin' : absDay(day, 0);
  return `${dayTxt} ${witaTime(a)}–${witaTime(end)}`;
}

/** Batas waktu antar sekarang: dihitung dari saat pembayaran diterima. */
export function expressDeadline(paidAt: Date | string | null | undefined) {
  return paidAt ? new Date(new Date(paidAt).getTime() + EXPRESS.etaMaxMinutes * 60_000) : null;
}

/** Pesanan dibayar dalam 15 menit terakhir dianggap "baru" di panel admin. */
export const isFreshOrder = (paidAt: Date | string | null | undefined, now = Date.now()) =>
  !!paidAt && now - new Date(paidAt).getTime() < 15 * 60_000;

/** Teks jadwal untuk ditampilkan di mana saja (pelanggan & admin). */
export function orderScheduleText(
  o: {
    isExpress: boolean;
    paidAt: Date | string | null;
    scheduledAt: Date | string | null;
    scheduledEnd: Date | string | null;
    fulfillmentMethod: 'DELIVERY' | 'PICKUP';
    deliverySlot: string;
    pickupSlot: string | null;
  },
  now = new Date()
) {
  if (o.isExpress) {
    const dl = expressDeadline(o.paidAt);
    return dl ? `${EXPRESS.label} · tiba sebelum ${witaTime(dl)} WITA` : `${EXPRESS.label} · ±${EXPRESS.etaMinMinutes}–${EXPRESS.etaMaxMinutes} menit setelah bayar`;
  }
  if (o.scheduledAt && o.scheduledEnd) return `${formatWindow(o.scheduledAt, o.scheduledEnd, now)} WITA`;
  return (o.fulfillmentMethod === 'PICKUP' ? o.pickupSlot : o.deliverySlot) ?? '-';
}
