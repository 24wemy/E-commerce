import 'server-only';
import { expireStaleOrders } from '@/lib/inventory';
import { autoCompleteDeliveries } from '@/lib/order-status';

// Tugas pemeliharaan (kedaluwarsakan order belum bayar, selesaikan pengantaran >24 jam).
// Dulu dijalankan di SETIAP buka halaman → menambah 2–4 query ke database per klik.
// Sekarang paling sering sekali per menit per server; klik lain tidak menunggu apa pun.
// Aman: stok tercadang dihitung dari waktu order, jadi jeda ≤1 menit tidak memengaruhi stok.
const EVERY_MS = 60_000;
let lastRun = 0;
let running: Promise<void> | null = null;

export function runMaintenance(): Promise<void> {
  if (running) return running;
  if (Date.now() - lastRun < EVERY_MS) return Promise.resolve();
  lastRun = Date.now();
  running = Promise.all([
    expireStaleOrders().catch((e) => console.error('[maintenance] expire gagal', e)),
    autoCompleteDeliveries().catch((e) => console.error('[maintenance] auto-complete gagal', e)),
  ])
    .then(() => undefined)
    .finally(() => {
      running = null;
    });
  return running;
}
