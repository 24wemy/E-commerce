'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Navigation } from 'lucide-react';
import { updateOrderStatusAction } from '@/actions/orders';
import { ReviewModal } from '@/components/shop/ReviewModal';
import { RouteMap } from '@/components/maps';
import { trackSteps, currentStep, nextStatus, adminNextStatus, STATUS_LABEL, METHOD_LABEL, isCompleted, Method } from '@/lib/fulfillment';
import { STORE, googleMapsDirections } from '@/lib/business-rules';

type HistoryItem = { status: string; note: string | null; at: string };

type Props = {
  orderId: string;
  orderNumber: string;
  status: string;
  paid: boolean;
  isAdmin: boolean;
  hasReview: boolean;
  productName?: string;
  method: Method;
  destination: { lat: number; lng: number } | null;
  distanceKm: number;
  slot: string | null;
  pickupCode: string | null;
  history: HistoryItem[];
};

const time = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' });

export function DeliveryTracker(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);

  const cancelled = p.status === 'CANCELLED' || p.status === 'EXPIRED';
  const steps = trackSteps(p.method);
  const current = currentStep(p.method, p.status, p.paid);
  const next = p.isAdmin ? adminNextStatus(p.method, p.status) : nextStatus(p.method, p.status);

  // Jam tiap langkah dari riwayat status (ambil kemunculan pertama)
  const stepTime = steps.map((s) => p.history.find((h) => s.statuses.includes(h.status))?.at ?? null);

  const advance = async (to: string) => {
    setBusy(true);
    setError('');
    const res = await updateOrderStatusAction(p.orderNumber, to as never);
    setBusy(false);
    if (!res.success) setError(res.error ?? 'Status gagal diubah.');
    router.refresh();
  };

  const map = (
    <div className="h-56 overflow-hidden rounded-xl border border-slate-200 sm:h-64">
      <RouteMap store={STORE} destination={p.method === 'DELIVERY' ? p.destination : null} />
    </div>
  );

  if (cancelled) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-ink">{p.status === 'EXPIRED' ? 'Pesanan kedaluwarsa' : 'Pesanan dibatalkan'}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {p.status === 'EXPIRED'
            ? 'Pembayaran tidak diselesaikan dalam 30 menit, jadi stok dilepas kembali. Silakan buat pesanan baru.'
            : 'Pesanan ini tidak diproses. Jika sudah membayar, dana dikembalikan sesuai metode pembayaran Anda.'}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {METHOD_LABEL[p.method]}
            {p.slot ? ` · ${p.method === 'PICKUP' ? `ambil ${p.slot}` : p.slot}` : ''}
            {p.method === 'DELIVERY' && p.distanceKm ? ` · ±${p.distanceKm} km dari toko` : ''}
          </p>
          <h2 className="text-lg font-semibold text-ink">{p.paid ? steps[current].title : 'Menunggu pembayaran'}</h2>
          <p className="text-sm text-slate-600">
            {p.paid ? steps[current].desc : 'Pesanan dipotong setelah pembayaran diterima. Selesaikan pembayaran dalam 30 menit.'}
          </p>
          {p.method === 'DELIVERY' && p.status === 'SHIPPED' && (
            <p className="mt-1 text-xs text-slate-500">Bila tidak dikonfirmasi, pesanan otomatis dianggap diterima 24 jam setelah dikirim.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!p.isAdmin && p.method === 'DELIVERY' && p.status === 'SHIPPED' && (
            <button
              disabled={busy}
              onClick={() => advance('DELIVERED')}
              className="rounded-lg bg-daun-700 px-4 py-2 text-sm font-semibold text-white hover:bg-daun-800 disabled:opacity-50"
            >
              Pesanan sudah saya terima
            </button>
          )}
          {!p.isAdmin && isCompleted(p.status) && !p.hasReview && (
            <button onClick={() => setReviewOpen(true)} className="rounded-lg bg-daun-700 px-4 py-2 text-sm font-semibold text-white hover:bg-daun-800">
              Beri ulasan
            </button>
          )}
          {p.isAdmin && p.method === 'DELIVERY' && p.status === 'SHIPPED' && (
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">Menunggu konfirmasi pelanggan</span>
          )}
          {p.isAdmin && p.paid && next && next !== 'PICKED_UP' && (
            <button
              disabled={busy}
              onClick={() => advance(next)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
            >
              Tandai: {STATUS_LABEL[next]}
            </button>
          )}
        </div>
      </div>

      {p.method === 'PICKUP' && p.paid && p.pickupCode && !isCompleted(p.status) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-kunyit-200 bg-kunyit-50 px-4 py-3">
          <div>
            <p className="text-sm text-slate-700">Kode ambil — tunjukkan ke petugas toko</p>
            <p className="text-2xl font-bold tracking-[0.2em] text-ink">{p.pickupCode}</p>
          </div>
          <a
            href={googleMapsDirections(STORE.lat, STORE.lng)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            <Navigation className="h-4 w-4" /> Petunjuk arah ke toko
          </a>
        </div>
      )}

      {p.paid && (
        <ol className="grid gap-4 sm:grid-cols-4 sm:gap-0">
          {steps.map((s, i) => {
            const done = i <= current;
            return (
              <li key={s.title} className="relative flex gap-3 sm:block sm:pr-4">
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className={`absolute left-[13px] top-7 h-[calc(100%-4px)] w-0.5 sm:left-7 sm:top-[13px] sm:h-0.5 sm:w-[calc(100%-28px)] ${
                      i < current ? 'bg-daun-600' : 'bg-slate-200'
                    }`}
                  />
                )}
                <span
                  className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold ${
                    done ? 'border-daun-600 bg-daun-600 text-white' : 'border-slate-300 bg-white text-slate-400'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="block sm:mt-2">
                  <span className={`block text-sm font-semibold ${done ? 'text-ink' : 'text-slate-400'}`}>{s.title}</span>
                  {done && stepTime[i] && <span className="block text-xs text-slate-500">{time(stepTime[i]!)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {error && <p className="text-sm text-cabai-600">{error}</p>}

      {map}

      {p.history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Riwayat status ({p.history.length})</summary>
          <ul className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-4">
            {[...p.history].reverse().map((h, i) => (
              <li key={i} className="text-slate-600">
                <span className="font-medium text-ink">{STATUS_LABEL[h.status] ?? h.status}</span> · {time(h.at)}
                {h.note ? <span className="block text-xs text-slate-500">{h.note}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ReviewModal
        orderId={p.orderId}
        orderNumber={p.orderNumber}
        productName={p.productName ?? 'pesanan ini'}
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </section>
  );
}
