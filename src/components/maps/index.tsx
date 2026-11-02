'use client';

import dynamic from 'next/dynamic';

// Leaflet butuh `window`, jadi dimuat hanya di browser (tanpa SSR).
const Loading = () => <div className="h-full w-full animate-pulse bg-daun-50" aria-label="Memuat peta" />;

export const LocationPickerMap = dynamic(() => import('./LeafletMaps').then((m) => m.LocationPickerMap), {
  ssr: false,
  loading: Loading,
});
export const RouteMap = dynamic(() => import('./LeafletMaps').then((m) => m.RouteMap), { ssr: false, loading: Loading });
export const DeliveriesMap = dynamic(() => import('./LeafletMaps').then((m) => m.DeliveriesMap), { ssr: false, loading: Loading });
