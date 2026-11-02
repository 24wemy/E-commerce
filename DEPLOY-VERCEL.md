# Deploy ke Vercel + Supabase (+ Cloudflare saat domain sudah ada)

Arsitektur (tetap **2-tier**):

```
Pengunjung ──HTTPS──> [Cloudflare: DNS / proxy + WAF]  ← ditambahkan setelah domain dibeli
                          │
                          ▼
              Vercel (Next.js, function region sin1 Singapura)   ← Tier 1: Aplikasi
                          │  PostgreSQL (TLS)
                          ▼
              Supabase (region Singapore)                         ← Tier 2: Database
                          ▲
Midtrans Sandbox ──webhook──> https://<domain>/api/webhooks/midtrans
```

Urutan kerja: **(1)** database siap → **(2)** kode ke GitHub → **(3)** deploy Vercel di alamat `*.vercel.app` → **(4)** sambungkan Midtrans → **(5)** nanti, setelah domain dibeli: Cloudflare + domain.

---

## 1. Database Supabase (sekali saja, dari laptop)

Pastikan `.env` di laptop sudah memakai project Supabase **Singapore**, lalu:

```bash
npm run db:migrate
npm run db:seed
```

Vercel **tidak** menjalankan migrasi. Setiap ada migrasi baru, jalankan `npm run db:migrate` dari laptop (ke database produksi) sebelum/ketika deploy.

## 2. Simpan kode di GitHub

1. Buat repository **private** baru di https://github.com/new (mis. `fresh-minut`), tanpa README.
2. Di folder proyek (PowerShell / terminal):
   ```bash
   git init
   git add .
   git status          # PASTIKAN .env TIDAK ada di daftar (sudah di .gitignore)
   git commit -m "Fresh Minut siap deploy"
   git branch -M main
   git remote add origin https://github.com/<username>/fresh-minut.git
   git push -u origin main
   ```

> `.env` berisi password database & kunci Midtrans — jangan pernah di-commit. Nilai-nilainya diisi di Vercel (langkah 3).

## 3. Deploy di Vercel

1. Login https://vercel.com dengan akun GitHub → **Add New… → Project** → pilih repo `fresh-minut` → **Import**.
2. Framework terdeteksi otomatis **Next.js**. Build Command / Output biarkan default (`npm run build`).
3. Buka **Environment Variables**, isi (centang Production & Preview):

| Nama | Nilai |
|---|---|
| `DATABASE_URL` | Supabase **Transaction pooler** (port **6543**) |
| `DIRECT_URL` | Supabase **Session pooler** (port **5432**) |
| `AUTH_SECRET` | string acak baru — buat dengan `npx auth secret` (jangan pakai yang lokal) |
| `AUTH_TRUST_HOST` | `true` |
| `MIDTRANS_IS_PRODUCTION` | `false` |
| `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` | `false` |
| `MIDTRANS_SERVER_KEY` | `SB-Mid-server-…` (**rotasi dulu** kunci yang pernah dibagikan, lihat catatan di bawah) |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | `SB-Mid-client-…` |
| `GEMINI_API_KEY` | API key Gemini (opsional) |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | sama seperti `.env` lokal |
| `NOMINATIM_USER_AGENT` | `FreshMinut/1.0 (email-anda@contoh.com)` |
| `SMTP_*` | opsional |
| `TRUST_CLOUDFLARE` | `false` (ubah ke `true` hanya setelah domain di-proxy Cloudflare) |

   `AUTH_URL` dan `NEXT_PUBLIC_APP_URL` **boleh dikosongkan** dulu — aplikasi otomatis memakai alamat produksi Vercel. Isi setelah punya domain.

4. Klik **Deploy**. Selesai ±2–3 menit → dapat alamat `https://fresh-minut-xxxx.vercel.app` (sudah HTTPS).
5. Cek region: **Project → Settings → Functions → Function Regions** harus **Singapore (sin1)**. Sudah diatur lewat `vercel.json`; bila dashboard menampilkan lain, pilih Singapore lalu **Redeploy**. Function yang jauh dari database (default Vercel: Washington `iad1`) akan membuat setiap halaman lambat.

Setiap `git push` ke `main` otomatis membuat deploy baru.

## 4. Sambungkan Midtrans Sandbox

1. https://dashboard.midtrans.com (mode **Sandbox**) → **Settings → Payment → Notification URL**:
   `https://fresh-minut-xxxx.vercel.app/api/webhooks/midtrans` → Save → **Test notification URL** (harus 200).
2. Uji: login pelanggan → checkout → bayar dengan kartu `4811 1111 1111 1114` / OTP `112233`. Setelah bayar, status pesanan otomatis **Lunas** tanpa menekan "Cek status" (webhook bekerja karena aplikasi sudah online).

**Rotasi kunci Midtrans** (karena server key sandbox sempat dibagikan di chat): Midtrans Dashboard → Settings → Access Keys → buat/ganti server key, lalu perbarui di Vercel (+ `.env` lokal).

---

## 5. Setelah domain dibeli: Cloudflare + domain

### 5a. Pasang domain (wajib, apa pun pilihan proxy-nya)

1. Cloudflare (plan Free) → **Add a site** → masukkan domain → ganti **nameserver** di tempat beli domain ke nameserver Cloudflare. Tunggu status **Active**.
2. Vercel → **Project → Settings → Domains → Add** → masukkan `domainanda.com` dan `www.domainanda.com`. Vercel menampilkan record DNS yang harus dibuat.
3. Cloudflare → **DNS → Records**: buat **persis** record yang ditunjukkan Vercel, **Proxy status: DNS only (awan abu-abu)** dulu.
4. Tunggu sampai Vercel menulis **Valid Configuration** dan sertifikat HTTPS terbit (biasanya beberapa menit).
5. Isi env di Vercel lalu **Redeploy**:
   - `AUTH_URL` = `https://domainanda.com`
   - `NEXT_PUBLIC_APP_URL` = `https://domainanda.com`
6. Ubah Notification URL Midtrans ke `https://domainanda.com/api/webhooks/midtrans`.

### 5b. Pilih mode Cloudflare

**Opsi A — DNS only (awan abu-abu), direkomendasikan Vercel.**
Cloudflare tetap mengelola DNS domain; HTTPS, CDN, firewall, dan perlindungan DDoS ditangani Vercel. Paling stabil, tanpa pengaturan tambahan. Vercel menyatakan Bot Protection & firewall-nya bekerja kurang baik bila ada reverse proxy di depannya, dan pengguna yang memakai proxy melaporkan error 526/524.

**Opsi B — Proxied (awan oranye)**, bila Anda tetap butuh WAF/rate limit Cloudflare (mis. syarat tugas).
Lakukan **setelah** langkah 5a berhasil (sertifikat Vercel sudah terbit):

1. **SSL/TLS → Overview**: mode **Full (strict)**. Jangan pakai *Flexible* (menyebabkan redirect berulang).
2. **SSL/TLS → Edge Certificates**: *Always Use HTTPS* = **Off** (diganti aturan di poin 3), *Minimum TLS* = 1.2.
3. **Rules → Redirect Rules → Create** (redirect HTTP→HTTPS kecuali jalur sertifikat Vercel):
   - When: `(http.request.full_uri wildcard "http://*") and not starts_with(http.request.uri.path, "/.well-known/acme-challenge/")`
   - Then: Dynamic → `concat("https://", http.host, http.request.uri.path)`, status 301, preserve query string.
4. **Caching → Cache Rules → Create**: When `starts_with(http.request.uri.path, "/.well-known/")` → **Bypass cache**. (HTML aplikasi memang tidak di-cache Cloudflare secara default; biarkan begitu agar deploy baru langsung terlihat.)
5. **Security → WAF → Custom rules → Create** (Skip): When `http.request.uri.path eq "/api/webhooks/midtrans" or starts_with(http.request.uri.path, "/.well-known/")` → **Skip** semua (Bot Fight Mode, managed rules, rate limiting). Webhook tetap aman: aplikasi memverifikasi signature SHA-512 + nominal.
6. **Security → WAF → Rate limiting rules** (opsional): `/api/auth/callback/credentials` maks. 10 request/menit per IP.
7. DNS → ubah record domain ke **Proxied (awan oranye)**.
8. Vercel env: `TRUST_CLOUDFLARE` = `true` → **Redeploy** (agar rate limit chat/peta membaca IP asli pengunjung dari Cloudflare).
9. Uji: buka situs (gembok HTTPS), login, checkout + bayar sandbox, *Test notification URL* Midtrans.

Bila muncul **error 526/525**: pastikan SSL mode **Full (strict)** dan sertifikat domain di Vercel sudah terbit (kembalikan sementara ke awan abu-abu, tunggu Valid Configuration, lalu oranye lagi). Vercel dapat menampilkan peringatan konfigurasi saat domain di-proxy; selama situs terbuka normal dengan HTTPS, itu efek dari proxy.

---

## 6. Checklist keamanan (untuk slide "Security Setup")

- HTTPS end-to-end (Vercel cert; dengan Cloudflare proxy: Full (strict)).
- Secret hanya di Environment Variables Vercel, tidak di repo; `MIDTRANS_SERVER_KEY` tidak pernah dikirim ke browser.
- Database Supabase hanya diakses dari server (function Vercel), lewat pooler + TLS.
- Webhook Midtrans: verifikasi signature (timing-safe) + cek nominal + idempoten.
- Server action admin dicek role ADMIN; akun admin tidak bisa memakai toko/checkout; pesanan pelanggan hanya bisa dilihat pemiliknya.
- Harga & promo dihitung ulang di server, stok dikunci saat checkout & pembayaran.
- Rate limit chat AI & pencarian alamat per IP (+ WAF Cloudflare bila memakai proxy).
- Matikan `NEXT_PUBLIC_SHOW_DEMO_LOGIN` dan ganti password admin seed sebelum dipakai sungguhan.

Sumber: [Vercel — Cloudflare with Vercel](https://vercel.com/kb/guide/cloudflare-with-vercel), [Vercel — Function regions](https://vercel.com/docs/functions/configuring-functions/region), [Vercel — Functions limits](https://vercel.com/docs/functions/limitations).
