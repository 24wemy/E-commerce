# Panduan Setup & Deploy — Fresh Minut

Arsitektur (2-tier):

```
Pengunjung ──HTTPS──> Cloudflare (DNS proxied, SSL Full Strict, WAF)
                          │
                          ▼  HTTPS (Origin Certificate)
                VPS: Nginx :443  ──>  Next.js (PM2) :3000      ← Tier 1: Aplikasi
                          │
                          ▼  PostgreSQL (SSL)
                Supabase (managed PostgreSQL)                   ← Tier 2: Database
                          ▲
Midtrans Sandbox ──webhook──> https://domainanda.com/api/webhooks/midtrans
```

---

## 1. Jalankan di laptop dulu (±15 menit)

Butuh **Node.js 20+** dan akun Supabase.

1. Salin env: `cp .env.example .env` (Windows: `copy .env.example .env`).
2. Isi `.env` (lihat bagian 2 & 3 untuk Supabase dan Midtrans). `AUTH_SECRET` bisa dibuat dengan `npx auth secret`.
3. Install & siapkan database:
   ```bash
   npm install
   npm run db:migrate     # membuat tabel di Supabase (prisma migrate deploy)
   npm run db:seed        # 20 produk, 30 pelanggan, 50+ order, 7 promo, keranjang terbengkalai
   npm run dev
   ```
4. Buka http://localhost:3000 — login admin: `admin@freshminut.com` / `admin123`, pelanggan: `nathantambuku13@gmail.com` / `user123`.

> Webhook Midtrans tidak bisa menjangkau `localhost`. Saat lokal, setelah bayar di Snap, buka halaman order: status otomatis dicek ke API Midtrans (tombol **Cek Status**). Di server yang sudah online, webhook bekerja otomatis.

---

## 2. Supabase (database)

1. Buat project di https://supabase.com → simpan **Database Password**. Pilih region **Southeast Asia (Singapore)**.
2. Klik tombol **Connect** (atas halaman project) → bagian **Connection string**:
   - **Transaction pooler** (port **6543**) → isi ke `DATABASE_URL`
   - **Session pooler** (port **5432**) → isi ke `DIRECT_URL`
   - Ganti `[YOUR-PASSWORD]` dengan password database.
3. Jalankan `npm run db:migrate` lalu `npm run db:seed` dari laptop/VPS.
4. Cek di Supabase → **Table Editor**: tabel `Product`, `Order`, `Promotion`, `StockMovement`, `Cart`, dll. sudah terisi.

Keamanan: password DB hanya di `.env` (tidak di-commit). Aplikasi mengakses DB lewat server, bukan dari browser.

---

## 3. Midtrans Sandbox (pembayaran) — untuk yang baru pertama kali

1. Daftar di https://dashboard.midtrans.com (gratis). Setelah login, pastikan toggle environment di kiri atas = **Sandbox**.
2. **Settings → Access Keys**: salin
   - **Server Key** (`SB-Mid-server-...`) → `MIDTRANS_SERVER_KEY`
   - **Client Key** (`SB-Mid-client-...`) → `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`
   - Biarkan `MIDTRANS_IS_PRODUCTION="false"` dan `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION="false"`.
3. **Settings → Payment → Notification URL** (setelah domain online):
   `https://domainanda.com/api/webhooks/midtrans` → Save. Klik **Test notification URL** (aplikasi membalas 200).
4. **Finish redirect URL** tidak wajib — aplikasi sudah mengirim URL kembali ke halaman order.

### Cara bayar saat demo (uang sungguhan TIDAK dipakai)

Setelah klik **Bayar Sekarang**, popup Snap terbuka:

| Metode | Cara |
|---|---|
| Kartu kredit | No. `4811 1111 1111 1114`, CVV `123`, exp bulan apa saja / tahun masa depan, OTP `112233` |
| BCA VA | Salin nomor VA → bayar di https://simulator.sandbox.midtrans.com/bca/va/index |
| BNI VA | https://simulator.sandbox.midtrans.com/bni/va/index |
| BRI / Permata / CIMB VA | https://simulator.sandbox.midtrans.com/openapi/va/index (pilih bank) |
| QRIS / GoPay | Salin URL gambar QR → https://simulator.sandbox.midtrans.com/v2/qris/index |

Begitu pembayaran sukses, Midtrans memanggil webhook → aplikasi otomatis: **stok berkurang + log stok**, **pemakaian promo tercatat**, **poin & segmen CRM pelanggan diperbarui**.

Sumber: https://docs.midtrans.com/docs/testing-payment-on-sandbox

---

## 3b. Lokasi toko & ongkir (peta gratis)

- Peta memakai **Leaflet + OpenStreetMap** dan alamat memakai **Nominatim**. Keduanya gratis, tanpa API key.
- **Ganti koordinat toko** di `src/lib/business-rules.ts` → `STORE` (lat, lng, alamat, jam buka). Cara mengambil koordinat: buka Google Maps, klik kanan lokasi toko, lalu klik angka koordinat untuk menyalinnya.
- Tarif ongkir per jarak ada di `DELIVERY_TIERS` (file yang sama).
- Jadwal antar/ambil, *Antar sekarang* dan batas waktunya ada di `src/lib/schedule.ts` (semua dihitung dalam WITA, jadi aman walau VPS memakai UTC):
  - `DELIVERY_WINDOWS` / `PICKUP_WINDOWS`: jam slot. Slot bisa dipilih sampai `PREP_MINUTES` (60 menit) sebelum mulai.
  - Slot subuh hanya untuk pesanan sebelum `NEXT_DAY_CUTOFF` (21.00) malam sebelumnya.
  - `EXPRESS`: biaya tambahan Rp5.000, tiba ±60–90 menit setelah bayar, bisa dipesan 06.00–18.00.
- Pesanan yang sudah *Dalam pengiriman* otomatis dianggap diterima 24 jam kemudian (`AUTO_COMPLETE_HOURS` di `src/lib/order-status.ts`).
- Tombol *Gunakan lokasi saya* hanya bekerja di **HTTPS** atau `localhost`. Di production, HTTPS sudah disediakan Cloudflare.
- Nominatim dibatasi 1 request/detik. Aplikasi sudah memanggilnya lewat server dengan antrean dan cache, jadi aman untuk demo dan trafik kecil.

## 4. VPS (Ubuntu 22.04/24.04)

Contoh di VPS 1 vCPU / 1–2 GB RAM (IDCloudHost, Biznet Gio, DigitalOcean, dll).

```bash
# 1) Paket dasar
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

# 2) Firewall: hanya SSH + HTTP/HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# 3) Aplikasi
git clone <repo-anda> /var/www/freshminut && cd /var/www/freshminut
cp .env.example .env && nano .env      # isi semua nilai, AUTH_URL & NEXT_PUBLIC_APP_URL = https://domainanda.com
chmod 600 .env
npm ci
npm run db:migrate                     # sekali saja (seed opsional: npm run db:seed)
npm run build
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

Jika RAM 1 GB dan build gagal karena memori, tambahkan swap 2 GB:
`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`

Update aplikasi: `git pull && npm ci && npm run db:migrate && npm run build && pm2 restart freshminut`

---

## 5. Domain + Cloudflare (proxy, HTTPS, WAF)

1. Tambahkan domain ke Cloudflare (plan Free) → ganti **nameserver** di registrar domain ke nameserver Cloudflare.
2. **DNS**: record `A` `@` → IP VPS, dan `A` `www` → IP VPS, **Proxy status: Proxied (awan oranye)**. IP asli VPS jadi tersembunyi.
3. **SSL/TLS → Overview**: mode **Full (strict)**. **Edge Certificates**: aktifkan *Always Use HTTPS* dan *Minimum TLS 1.2*.
4. **SSL/TLS → Origin Server → Create Certificate** (15 tahun). Simpan di VPS:
   ```bash
   sudo mkdir -p /etc/ssl/cloudflare
   sudo nano /etc/ssl/cloudflare/origin.crt   # tempel Origin Certificate
   sudo nano /etc/ssl/cloudflare/origin.key   # tempel Private Key
   sudo chmod 600 /etc/ssl/cloudflare/origin.key
   ```
5. Nginx: salin `deploy/nginx-freshminut.conf` ke `/etc/nginx/sites-available/freshminut`, ganti domain, lalu
   ```bash
   sudo ln -s /etc/nginx/sites-available/freshminut /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   ```
6. **WAF untuk webhook Midtrans** (agar tidak diblokir Bot Fight Mode): **Security → WAF → Custom rules → Create**:
   - *If* `URI Path` `equals` `/api/webhooks/midtrans` → *Then* **Skip** → centang semua komponen (Bot Fight Mode, Managed rules, Rate limiting).
   Webhook tetap aman karena aplikasi memverifikasi **signature SHA-512** dan **nominal** setiap notifikasi.
7. (Opsional, hardening) Batasi origin hanya untuk IP Cloudflare: buat `ufw` rule allow 443 hanya dari daftar IP di https://www.cloudflare.com/ips/ lalu `sudo ufw delete allow 'Nginx Full'`.
8. Rate limiting login (opsional): **Security → WAF → Rate limiting rules** untuk `/api/auth/callback/credentials`, mis. 10 request/menit per IP.

Cek: buka `https://domainanda.com` → gembok HTTPS aktif; `curl -I https://domainanda.com` menampilkan header `server: cloudflare` dan `strict-transport-security`.

---

## 6. Checklist keamanan (untuk slide "Security Setup")

- HTTPS end-to-end: Cloudflare Full (strict) + Origin Certificate, HSTS, redirect 80→443.
- Proxied IP (IP VPS tersembunyi di balik Cloudflare), WAF + rate limit.
- Firewall `ufw`: hanya 22/80/443. App Next.js hanya listen di `127.0.0.1:3000`.
- Secret di `.env` (chmod 600), tidak di-commit; `MIDTRANS_SERVER_KEY` tidak pernah dikirim ke browser.
- Validasi server: harga diambil dari DB, promo divalidasi di server, stok dikunci (`SELECT … FOR UPDATE`) saat checkout & pembayaran.
- Webhook Midtrans: verifikasi signature (timing-safe) + cek nominal + idempoten.
- Semua server action admin dicek role ADMIN; halaman order hanya untuk pemiliknya.
- Password di-hash bcrypt; header keamanan (X-Frame-Options, nosniff, Referrer-Policy).
- Matikan `NEXT_PUBLIC_SHOW_DEMO_LOGIN` setelah presentasi.
