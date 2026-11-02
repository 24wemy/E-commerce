'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BellRing, X } from 'lucide-react';

const INTERVAL_MS = 30_000;

/**
 * Memuat ulang data admin tiap 30 detik (hanya saat tab terlihat), menampilkan jumlah antrean di judul tab,
 * dan memberi notifikasi saat ada pesanan dibayar yang baru masuk.
 */
export function AdminLiveRefresh({ toProcess, express, latestPaidAt }: { toProcess: number; express: number; latestPaidAt: string | null }) {
  const router = useRouter();
  const seen = useRef<string | null>(latestPaidAt);
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const t = setInterval(tick, INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router]);

  // Pesanan dibayar baru sejak terakhir dilihat → tampilkan pemberitahuan
  useEffect(() => {
    if (latestPaidAt && seen.current && latestPaidAt > seen.current) {
      setAlert(express > 0 ? `Pesanan baru masuk · ${express} antar sekarang menunggu` : 'Pesanan baru sudah dibayar');
      try {
        // Bunyi pendek tanpa file audio
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.08, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.4);
      } catch {
        /* browser memblokir audio sebelum ada interaksi — abaikan */
      }
    }
    if (latestPaidAt) seen.current = latestPaidAt;
  }, [latestPaidAt, express]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = toProcess > 0 ? `(${toProcess}) ${base}` : base;
  }, [toProcess]);

  if (!alert) return null;
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-daun-200 bg-white px-4 py-3 text-sm shadow-lg">
      <BellRing className="h-5 w-5 text-daun-700" />
      <span className="font-semibold text-ink">{alert}</span>
      <Link href="/admin/deliveries" onClick={() => setAlert(null)} className="font-semibold text-daun-700 underline">
        Lihat
      </Link>
      <button type="button" onClick={() => setAlert(null)} aria-label="Tutup" className="text-slate-400 hover:text-slate-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
