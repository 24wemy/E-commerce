# Fresh Minut — E-Commerce Ayam Segar Minahasa Utara

Next.js 14 · Prisma 7 + **Supabase PostgreSQL** · NextAuth v5 · **Midtrans Snap (Sandbox)** · **Cloudflare** · Gemini AI

Deploy ke **Vercel + Supabase (+ Cloudflare)**: **[DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md)** · Alternatif VPS (Nginx + PM2): [DEPLOYMENT.md](./DEPLOYMENT.md)

```bash
cp .env.example .env     # isi Supabase, AUTH_SECRET, Midtrans Sandbox
npm install
npm run db:migrate && npm run db:seed
npm run dev
```

## Modul & keterhubungan (sesuai requirement Final Project)

| Requirement | Implementasi | Lokasi |
|---|---|---|
| Stok per produk (SKU) | Field `sku`, `stockKg`, `minStockKg`, `leadTimeDays` | `/admin/inventory`, `/admin/products` |
| Stok berkurang saat **dibayar** | `markOrderPaid()` dipanggil webhook Midtrans | `src/lib/orders.ts` |
| Stok kembali saat batal/refund | `cancelOrder()` → movement `RETURN` | `src/lib/orders.ts` |
| Anti-overselling | Kunci baris produk (`FOR UPDATE`) + stok "dipesan sementara" 30 menit untuk order belum bayar; dicek ulang saat pembayaran | `src/actions/checkout.ts`, `src/lib/inventory.ts` |
| Batas minimum + peringatan stok menipis | Banner di dashboard & inventory, log `LOW_STOCK_ALERT` | `/admin`, `/admin/inventory` |
| Log pergerakan stok (masuk/keluar/penyesuaian + alasan) | Tabel `StockMovement` | `/admin/inventory` |
| ≥3 jenis promo | Diskon persen, diskon nominal, gratis ongkir, flash sale (+countdown) | `/admin/promotions` |
| Aturan promo | Periode, kuota total, batas per pelanggan, minimum order, target segmen; 1 kode per order (tidak bisa digabung) | `src/lib/promo.ts` |
| Validasi promo di server | `evaluatePromo()` saat pasang kode & saat checkout | `src/lib/promo.ts` |
| Laporan promo | Pemakaian, total diskon, omzet, ROI | `/admin/promotions` |
| Profil pelanggan + riwayat order | Detail pelanggan, RFM, poin, keranjang | `/admin/customers/[id]` |
| Segmentasi ≥3 kelompok | Prospek, Baru, Reguler, Loyal, Tidak Aktif (aturan tertulis) | `src/lib/business-rules.ts` |
| Aksi retensi | Kampanye: kode promo khusus segmen + email ke tiap pelanggan, hasil konversi | `/admin/campaigns` |
| Dashboard CRM | Jumlah pelanggan, repeat purchase rate, AOV, CLV | `/admin/customers`, `/admin` |
| **Keranjang belum checkout** | Keranjang pelanggan login disinkronkan ke DB; admin melihat keranjang terbengkalai (>60 menit) + kirim pengingat | `/admin/carts` |
| **Antar / ambil di toko + peta** | Checkout memilih *Diantar* (pilih titik di peta OpenStreetMap, GPS, pencarian alamat; ongkir dihitung dari jarak: ≤3 km Rp5.000, ≤7 km Rp10.000, ≤15 km Rp15.000) atau *Ambil di toko* (gratis ongkir, slot jam ambil, kode ambil). Alamat & titik terakhir tersimpan di profil | `src/components/shop/FulfillmentPicker.tsx`, `src/lib/business-rules.ts` |
| **Jadwal & Antar sekarang** | Slot antar/ambil bertanggal (WITA): slot yang sudah lewat atau kurang dari 1 jam otomatis hilang dan ditolak server; subuh hanya untuk pesanan sebelum 21.00. *Antar sekarang* (+Rp5.000, tiba ±60–90 menit, 06.00–18.00). Admin: badge jumlah pesanan perlu diproses, notifikasi pesanan baru, auto-refresh 30 detik, prioritas & batas waktu antar sekarang. Pesanan dikirim otomatis selesai setelah 24 jam | `src/lib/schedule.ts`, `src/components/admin/AdminLiveRefresh.tsx`, `src/lib/order-status.ts` |
| **Tracking pesanan** | Timeline per metode dengan jam tiap status (Diantar: Dibayar → Diproses → Dikirim → Diterima; Ambil: … → Siap diambil → Sudah diambil), peta toko & tujuan, riwayat status. Admin: halaman **Pengantaran** (peta semua titik antar, urutan terdekat, serahkan pesanan dengan kode ambil). Pesanan diantar dikonfirmasi *Diterima* oleh pelanggan (atau otomatis 24 jam); kode ambil tidak ditampilkan ke admin | `/orders/[nomor]`, `/admin/orders/[nomor]`, `/admin/deliveries` |
| AI (bonus inovasi) | **Asisten belanja** di halaman utama (katalog, stok, promo live + cek status pesanan milik sendiri) dan **Business Copilot** admin yang menganalisis data nyata stok/promo/CRM. Gemini free tier `gemini-3.8-flash`, cadangan otomatis `gemini-3.5-flash-lite`, rate limit per IP | `src/app/api/chat`, `src/app/api/admin/copilot`, Admin → Operasional & AI |
| Opsional (nilai tambah) | Reorder point berbasis lead time, laporan slow-moving, RFM, CLV, abandoned cart reminder, flash sale countdown, promo khusus segmen, AI chatbot | — |

Alur integrasi: **Order dibayar → stok berkurang + log → promo tercatat → poin & segmen CRM diperbarui** (satu transaksi database, idempoten).

## Skenario Demo Wajib (urutan klik)

| # | Langkah | Di mana |
|---|---|---|
| 1 | Tunjukkan **Ayam Kampung Segar Utuh** (SKU AYM-KMP-005): stok 5 kg, minimum 3 kg | Admin → Inventory |
| 2 | Pelanggan baru **Daftar** → buka produk Ayam Kampung → tambah **3 kg** ke keranjang. (Admin → Keranjang: pelanggan muncul sebagai keranjang aktif) | Toko |
| 3 | Checkout → kode **MERDEKA17** ditolak (kedaluwarsa); **GROSIRB2B15** ditolak (minimum belanja Rp300rb); lalu **FRESHMINUT15** diterima | /checkout |
| 3b | Pilih **Diantar** → klik *Gunakan lokasi saya* atau geser pin; ongkir muncul sesuai jarak. Pilih jadwal atau *Antar sekarang* (06.00–18.00). (Alternatif: *Ambil di toko* → kode ONGKIRFREE ditolak karena khusus antar) | /checkout |
| 4 | Bayar via Snap Sandbox: kartu `4811 1111 1111 1114`, CVV `123`, OTP `112233` | Popup Midtrans |
| 5 | Stok jadi 2 kg, log "Penjualan — order … dibayar", banner **stok menipis** muncul | Admin → Dashboard / Inventory |
| 6 | Pelanggan baru tercatat di segmen **Pelanggan Baru** beserta order-nya | Admin → CRM → klik nama |
| 7 | Kampanye ke segmen **Tidak Aktif** → kode KANGENxxxx dibuat & dikirim | Admin → Kampanye Retensi |
| 8 | Laporan promo (pemakaian, total diskon, omzet) + dashboard CRM | Admin → Promo, CRM |
| 9 | Coba beli **5 kg** Ayam Kampung (stok 2) → ditolak: "Tersedia 2 kg, Anda meminta 5 kg" | /checkout |

Setelah bayar: Admin → **Pengantaran** → *Tandai: Dalam pengiriman*, lalu pelanggan menekan *Pesanan sudah saya terima* di halaman pesanannya (timeline & jam tercatat).

Reset data demo kapan saja: `npm run db:seed`.

## Akun seed

- Admin: `admin@freshminut.com` / `admin123` — akun admin hanya bisa membuka panel `/admin` (halaman toko, keranjang & checkout otomatis dialihkan ke panel). Untuk berbelanja gunakan akun pelanggan.
- Pelanggan: `nathantambuku13@gmail.com` / `user123` (semua pelanggan seed memakai password `user123`)

Ganti password admin sebelum situs dipublikasikan.
