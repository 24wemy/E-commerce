// Alur status per metode penerimaan. Dipakai di server action, halaman pelanggan, dan admin.
export type Method = 'DELIVERY' | 'PICKUP';

export const METHOD_LABEL: Record<Method, string> = { DELIVERY: 'Diantar', PICKUP: 'Ambil di toko' };

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu pembayaran',
  CONFIRMED: 'Dikonfirmasi',
  WEIGHT_VERIFIED: 'Sudah ditimbang',
  PROCESSING: 'Dipotong & ditimbang',
  SHIPPED: 'Dalam pengiriman',
  DELIVERED: 'Diterima',
  READY_FOR_PICKUP: 'Siap diambil',
  PICKED_UP: 'Sudah diambil',
  CANCELLED: 'Dibatalkan',
  EXPIRED: 'Kedaluwarsa',
};

const PREP = ['PROCESSING', 'CONFIRMED', 'WEIGHT_VERIFIED'];

/** Status berikutnya yang boleh di-set admin. */
export function nextStatus(method: Method, status: string): string | null {
  if (method === 'PICKUP') {
    if (PREP.includes(status)) return 'READY_FOR_PICKUP';
    if (status === 'READY_FOR_PICKUP') return 'PICKED_UP';
    return null;
  }
  if (PREP.includes(status)) return 'SHIPPED';
  if (status === 'SHIPPED') return 'DELIVERED';
  return null;
}

/**
 * Langkah yang boleh dilakukan ADMIN. Pesanan diantar hanya boleh dikonfirmasi "Diterima" oleh pelanggan
 * (atau otomatis 24 jam setelah dikirim) — admin tidak bisa menyatakan barang sudah diterima.
 */
export function adminNextStatus(method: Method, status: string): string | null {
  const n = nextStatus(method, status);
  return method === 'DELIVERY' && n === 'DELIVERED' ? null : n;
}

export const isCompleted = (status: string) => status === 'DELIVERED' || status === 'PICKED_UP';

/** Langkah timeline yang dilihat pelanggan. `statuses` = status order yang termasuk langkah tsb. */
export function trackSteps(method: Method) {
  return method === 'PICKUP'
    ? [
        { title: 'Pembayaran diterima', desc: 'Pesanan masuk antrean potong.', statuses: ['PROCESSING'] },
        { title: 'Dipotong & ditimbang', desc: 'Dibersihkan, dipotong, dan ditimbang ulang.', statuses: ['CONFIRMED', 'WEIGHT_VERIFIED'] },
        { title: 'Siap diambil', desc: 'Tunjukkan kode ambil ke petugas toko.', statuses: ['READY_FOR_PICKUP'] },
        { title: 'Sudah diambil', desc: 'Pesanan sudah diterima. Terima kasih!', statuses: ['PICKED_UP'] },
      ]
    : [
        { title: 'Pembayaran diterima', desc: 'Pesanan masuk antrean potong subuh.', statuses: ['PROCESSING'] },
        { title: 'Dipotong & ditimbang', desc: 'Dibersihkan, dipotong, dan ditimbang ulang.', statuses: ['CONFIRMED', 'WEIGHT_VERIFIED'] },
        { title: 'Dalam pengiriman', desc: 'Kurir menuju alamat Anda.', statuses: ['SHIPPED'] },
        { title: 'Diterima', desc: 'Pesanan sudah sampai.', statuses: ['DELIVERED'] },
      ];
}

/** Indeks langkah saat ini (0..3), -1 bila belum dibayar. */
export function currentStep(method: Method, status: string, paid: boolean) {
  if (!paid) return -1;
  const steps = trackSteps(method);
  if (status === 'PROCESSING') return 0;
  const idx = steps.findIndex((s) => s.statuses.includes(status));
  return idx < 0 ? 0 : idx;
}
