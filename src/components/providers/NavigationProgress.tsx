'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Garis progres tipis di atas layar saat pindah halaman, supaya klik langsung terasa ditanggapi
 * walau server masih memuat data.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  // Halaman baru sudah tampil → sembunyikan
  useEffect(() => setActive(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // hanya #anchor / halaman sama
      setActive(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Pengaman: jangan tampil selamanya bila navigasi dibatalkan
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 15_000);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;
  return (
    <div role="progressbar" aria-label="Memuat halaman" className="fixed inset-x-0 top-0 z-[2000] h-[3px] overflow-hidden bg-daun-100">
      <div className="h-full w-1/3 animate-[fm-progress_1.1s_ease-in-out_infinite] bg-daun-600" />
    </div>
  );
}
