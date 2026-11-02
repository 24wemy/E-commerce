'use client';

import { useEffect, useRef, useState } from 'react';
import { Truck, Store, LocateFixed, Search, Navigation, Loader2, Zap, Clock } from 'lucide-react';
import { LocationPickerMap, RouteMap } from '@/components/maps';
import {
  STORE,
  DELIVERY_TIERS,
  MIN_SHIPPING_FEE,
  quoteDelivery,
  formatIDR,
  googleMapsDirections,
} from '@/lib/business-rules';
import { EXPRESS, deliveryOptions, pickupOptions, describeExpress, type SlotOption } from '@/lib/schedule';

export type FulfillmentState = {
  method: 'DELIVERY' | 'PICKUP';
  lat: number;
  lng: number;
  hasPin: boolean;
  address: string;
  addressAuto: boolean;
  note: string;
  deliverySlot: string;
  pickupSlot: string;
};

export const initialFulfillment = (saved?: { lat?: number | null; lng?: number | null; address?: string | null; note?: string | null }): FulfillmentState => ({
  method: 'DELIVERY',
  lat: saved?.lat ?? STORE.lat,
  lng: saved?.lng ?? STORE.lng,
  hasPin: saved?.lat != null && saved?.lng != null,
  address: saved?.address ?? '',
  addressAuto: false,
  note: saved?.note ?? '',
  // Diisi otomatis dengan slot terdekat yang tersedia (lihat SlotPicker)
  deliverySlot: '',
  pickupSlot: '',
});

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-daun-600 focus:outline-none focus:ring-2 focus:ring-daun-100 disabled:bg-slate-50';

export function FulfillmentPicker({
  value,
  onChange,
  disabled,
}: {
  value: FulfillmentState;
  onChange: (v: FulfillmentState) => void;
  disabled?: boolean;
}) {
  const [recenterKey, setRecenterKey] = useState(0);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const [mapLabel, setMapLabel] = useState('');
  const latest = useRef(value);
  latest.current = value;

  const set = (patch: Partial<FulfillmentState>) => onChange({ ...latest.current, ...patch });
  const quote = value.method === 'DELIVERY' && value.hasPin ? quoteDelivery(value.lat, value.lng) : null;

  // Cari alamat (Nominatim lewat server kita), jeda 500 ms setelah berhenti mengetik
  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([]);
      setSearchMsg('');
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/geocode/search?q=${encodeURIComponent(q.trim())}`).then((x) => x.json());
        setResults(r.results ?? []);
        setSearchMsg(r.error ?? (r.results?.length ? '' : 'Tidak ditemukan. Coba nama jalan/kelurahan lain, atau geser pin di peta.'));
      } catch {
        setSearchMsg('Pencarian gagal. Geser pin di peta secara manual.');
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [q]);

  // Alamat dari titik peta (reverse geocode) — mengisi kolom alamat bila belum diketik manual
  useEffect(() => {
    if (value.method !== 'DELIVERY' || !value.hasPin) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode/reverse?lat=${value.lat}&lng=${value.lng}`).then((x) => x.json());
        if (r.label) {
          setMapLabel(r.label);
          const cur = latest.current;
          if (!cur.address.trim() || cur.addressAuto) onChange({ ...cur, address: r.label, addressAuto: true });
        }
      } catch {
        /* tidak masalah, alamat diisi manual */
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lat, value.lng, value.hasPin, value.method]);

  const pick = (lat: number, lng: number, recenter = false) => {
    set({ lat, lng, hasPin: true });
    if (recenter) setRecenterKey((k) => k + 1);
  };

  const useMyLocation = () => {
    setGeoMsg('');
    if (!('geolocation' in navigator)) return setGeoMsg('Browser tidak mendukung lokasi. Geser pin di peta.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pick(pos.coords.latitude, pos.coords.longitude, true);
      },
      (err) => {
        setLocating(false);
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Aktifkan izin lokasi di browser, atau cari alamat / geser pin di peta.'
            : 'Lokasi belum terdeteksi. Cari alamat atau geser pin di peta.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const options = [
    { key: 'DELIVERY' as const, icon: Truck, title: 'Diantar', desc: `Ongkir mulai ${formatIDR(MIN_SHIPPING_FEE)}, sesuai jarak` },
    { key: 'PICKUP' as const, icon: Store, title: 'Ambil di toko', desc: 'Gratis ongkir, pilih jam ambil' },
  ];

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="sr-only">Cara menerima pesanan</legend>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Cara menerima pesanan">
        {options.map(({ key, icon: Icon, title, desc }) => {
          const active = value.method === key;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={active}
              key={key}
              onClick={() => set({ method: key })}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                active ? 'border-daun-600 bg-daun-50 ring-2 ring-daun-100' : 'border-slate-200 bg-white hover:border-daun-300'
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? 'bg-daun-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-ink">{title}</span>
                <span className="block text-xs text-slate-600">{desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {value.method === 'DELIVERY' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari jalan, kelurahan, atau tempat"
                className={`${field} pl-9`}
                aria-label="Cari alamat"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
              {results.length > 0 && (
                <ul className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {results.map((r) => (
                    <li key={`${r.lat},${r.lng}`}>
                      <button
                        type="button"
                        onClick={() => {
                          set({ lat: r.lat, lng: r.lng, hasPin: true, address: r.label, addressAuto: true });
                          setRecenterKey((k) => k + 1);
                          setResults([]);
                          setQ('');
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-daun-50"
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-daun-600 px-3 py-2 text-sm font-semibold text-daun-800 hover:bg-daun-50"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Gunakan lokasi saya
            </button>
          </div>
          {(searchMsg || geoMsg) && <p className="text-xs text-slate-600">{geoMsg || searchMsg}</p>}

          <div className="relative h-72 overflow-hidden rounded-xl border border-slate-200">
            <LocationPickerMap value={{ lat: value.lat, lng: value.lng }} store={STORE} onChange={(p) => pick(p.lat, p.lng)} recenterKey={recenterKey} />
            {!value.hasPin && (
              <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs text-ink shadow">
                Klik peta atau geser pin merah ke lokasi rumah/usaha Anda.
              </div>
            )}
          </div>

          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              !quote ? 'border-slate-200 bg-slate-50 text-slate-600' : quote.ok ? 'border-daun-200 bg-daun-50 text-daun-900' : 'border-cabai-100 bg-cabai-50 text-cabai-700'
            }`}
            aria-live="polite"
          >
            {!quote
              ? `Tentukan titik lokasi untuk menghitung ongkir. Tarif: ${DELIVERY_TIERS.map((t, i) => `${i === 0 ? '≤' : `${DELIVERY_TIERS[i - 1].maxKm}–`}${t.maxKm} km ${formatIDR(t.fee)}`).join(' · ')}.`
              : quote.ok
                ? `Jarak sekitar ${quote.distanceKm} km dari toko · ongkir ${formatIDR(quote.fee)}`
                : quote.error}
          </div>

          <div>
            <label htmlFor="alamat" className="mb-1 block text-xs font-semibold text-slate-700">
              Alamat lengkap
            </label>
            <textarea
              id="alamat"
              required
              rows={2}
              value={value.address}
              onChange={(e) => set({ address: e.target.value, addressAuto: false })}
              placeholder="Jalan, nomor rumah, kelurahan, kecamatan"
              className={field}
            />
            {mapLabel && value.address !== mapLabel && (
              <button type="button" onClick={() => set({ address: mapLabel, addressAuto: true })} className="mt-1 text-xs text-daun-700 underline">
                Pakai alamat dari peta: {mapLabel}
              </button>
            )}
          </div>
          <div>
            <div>
              <label htmlFor="patokan" className="mb-1 block text-xs font-semibold text-slate-700">
                Patokan untuk kurir (opsional)
              </label>
              <input
                id="patokan"
                value={value.note}
                maxLength={200}
                onChange={(e) => set({ note: e.target.value })}
                placeholder="Mis. rumah pagar hijau dekat gereja"
                className={field}
              />
            </div>
          </div>
          <SlotPicker
            name="slot-antar"
            legend="Waktu antar"
            method="DELIVERY"
            value={value.deliverySlot}
            onChange={(id) => set({ deliverySlot: id })}
            hint={`Jadwal bisa dipilih sampai 1 jam sebelum mulai. ${describeExpress()}.`}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="h-44">
              <RouteMap store={STORE} />
            </div>
            <div className="space-y-1 p-3.5 text-sm">
              <p className="font-semibold text-ink">{STORE.name}</p>
              <p className="text-slate-600">{STORE.address}</p>
              <p className="text-slate-600">{STORE.hours}</p>
              <a
                href={googleMapsDirections(STORE.lat, STORE.lng)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 pt-1 font-semibold text-daun-700 hover:underline"
              >
                <Navigation className="h-4 w-4" /> Petunjuk arah
              </a>
            </div>
          </div>
          <SlotPicker
            name="slot-ambil"
            legend="Jam ambil"
            method="PICKUP"
            value={value.pickupSlot}
            onChange={(id) => set({ pickupSlot: id })}
            hint="Kode ambil muncul di halaman pesanan setelah pembayaran diterima."
          />
        </div>
      )}
    </fieldset>
  );
}

/** Daftar jadwal bertanggal (WITA), diperbarui tiap menit. Slot yang sudah lewat otomatis hilang. */
function SlotPicker({
  name,
  legend,
  method,
  value,
  onChange,
  hint,
}: {
  name: string;
  legend: string;
  method: 'DELIVERY' | 'PICKUP';
  value: string;
  onChange: (id: string) => void;
  hint: string;
}) {
  const [opts, setOpts] = useState<SlotOption[] | null>(null);

  useEffect(() => {
    const load = () => setOpts(method === 'DELIVERY' ? deliveryOptions() : pickupOptions());
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [method]);

  // Pilihan kosong / sudah lewat → pindah ke jadwal terjadwal terdekat (bukan express, agar tidak menambah biaya diam-diam)
  useEffect(() => {
    if (!opts || opts.some((o) => o.id === value)) return;
    const first = opts.find((o) => !o.express) ?? opts[0];
    if (first) onChange(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, value]);

  if (!opts) return <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-hidden />;

  const express = opts.find((o) => o.express);
  const regular = opts.filter((o) => !o.express);

  return (
    <div>
      <p id={`${name}-label`} className="mb-1.5 block text-xs font-semibold text-slate-700">
        {legend}
      </p>
      <div role="radiogroup" aria-labelledby={`${name}-label`} className="space-y-2">
        {express && (
          <button
            type="button"
            role="radio"
            aria-checked={value === express.id}
            onClick={() => onChange(express.id)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
              value === express.id ? 'border-kunyit-500 bg-kunyit-50 ring-2 ring-kunyit-100' : 'border-slate-200 bg-white hover:border-kunyit-400'
            }`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${value === express.id ? 'bg-kunyit-500 text-ink' : 'bg-slate-100 text-slate-600'}`}>
              <Zap className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">{EXPRESS.label}</span>
              <span className="block text-xs text-slate-600">
                Diproses langsung setelah bayar, tiba ±{EXPRESS.etaMinMinutes}–{EXPRESS.etaMaxMinutes} menit
              </span>
            </span>
            <span className="whitespace-nowrap text-sm font-semibold text-ink">+{formatIDR(EXPRESS.fee)}</span>
          </button>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {regular.map((o) => {
            const active = value === o.id;
            const [day, time] = o.label.split(' · ');
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={o.id}
                onClick={() => onChange(o.id)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  active ? 'border-daun-600 bg-daun-50 ring-2 ring-daun-100' : 'border-slate-200 bg-white hover:border-daun-300'
                }`}
              >
                <Clock className={`h-4 w-4 shrink-0 ${active ? 'text-daun-700' : 'text-slate-400'}`} />
                <span>
                  <span className="block text-xs text-slate-500">{day}</span>
                  <span className="block font-semibold text-ink">{time} WITA</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
