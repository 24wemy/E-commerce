'use client';

// Peta gratis: Leaflet + tile OpenStreetMap (tanpa API key). Wajib mencantumkan atribusi OSM.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

type LatLng = { lat: number; lng: number };

/** Pin berbentuk tetes (SVG) — tidak bergantung file gambar bawaan Leaflet. */
function pinIcon(color: string, label?: string) {
  return L.divIcon({
    className: '',
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17 1C8.2 1 1 8 1 16.8 1 28.5 17 43 17 43s16-14.5 16-26.2C33 8 25.8 1 17 1z" fill="${color}" stroke="white" stroke-width="2"/>
      ${label ? `<text x="17" y="21" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="white">${label}</text>` : '<circle cx="17" cy="17" r="5.5" fill="white"/>'}
    </svg>`,
  });
}
const STORE_COLOR = '#185731'; // daun-700
const HOME_COLOR = '#C8321E'; // cabai-500

function Recenter({ center, zoom }: { center: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }, [center.lat, center.lng, zoom, map]);
  return null;
}

function ClickToMove({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15);
  }, [map, points]);
  return null;
}

/** Peta untuk memilih titik pengantaran: klik peta atau geser pin. */
export function LocationPickerMap({
  value,
  store,
  onChange,
  recenterKey,
}: {
  value: LatLng;
  store: LatLng;
  onChange: (p: LatLng) => void;
  /** berubah = peta pindah ke `value` (mis. setelah pakai GPS / hasil pencarian) */
  recenterKey: number;
}) {
  const home = useMemo(() => pinIcon(HOME_COLOR), []);
  const shop = useMemo(() => pinIcon(STORE_COLOR, 'FM'), []);
  return (
    <MapContainer center={[value.lat, value.lng]} zoom={15} scrollWheelZoom className="isolate z-0 h-full w-full" attributionControl>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      <Marker position={[store.lat, store.lng]} icon={shop} interactive={false} />
      <Marker
        position={[value.lat, value.lng]}
        icon={home}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as L.Marker).getLatLng();
            onChange({ lat: ll.lat, lng: ll.lng });
          },
        }}
      />
      <ClickToMove onPick={onChange} />
      <Recenter key={recenterKey} center={value} />
    </MapContainer>
  );
}

/** Peta tampilan saja: toko (+ tujuan bila diantar). */
export function RouteMap({ store, destination, live }: { store: LatLng; destination?: LatLng | null; live?: LatLng | null }) {
  const home = useMemo(() => pinIcon(HOME_COLOR), []);
  const shop = useMemo(() => pinIcon(STORE_COLOR, 'FM'), []);
  const points = useMemo(() => [store, ...(destination ? [destination] : [])], [store, destination]);
  return (
    <MapContainer center={[store.lat, store.lng]} zoom={14} scrollWheelZoom={false} className="isolate z-0 h-full w-full">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      <Marker position={[store.lat, store.lng]} icon={shop} />
      {destination && <Marker position={[destination.lat, destination.lng]} icon={home} />}
      {destination && (
        <Polyline
          positions={[
            [store.lat, store.lng],
            [destination.lat, destination.lng],
          ]}
          pathOptions={{ color: STORE_COLOR, weight: 3, dashArray: '6 8' }}
        />
      )}
      {live && <Marker position={[live.lat, live.lng]} icon={pinIcon('#D9A204')} />}
      <FitBounds points={points} />
    </MapContainer>
  );
}

/** Peta admin: banyak titik pengantaran bernomor. */
export function DeliveriesMap({
  store,
  stops,
}: {
  store: LatLng;
  stops: Array<LatLng & { label: string; title: string }>;
}) {
  const shop = useMemo(() => pinIcon(STORE_COLOR, 'FM'), []);
  const points = useMemo(() => [store, ...stops], [store, stops]);
  return (
    <MapContainer center={[store.lat, store.lng]} zoom={12} scrollWheelZoom className="isolate z-0 h-full w-full">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      <Marker position={[store.lat, store.lng]} icon={shop} />
      {stops.map((s) => (
        <Marker key={s.title} position={[s.lat, s.lng]} icon={pinIcon(HOME_COLOR, s.label)} title={s.title} />
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
