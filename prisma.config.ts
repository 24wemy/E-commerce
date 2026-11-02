import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: URL koneksi untuk CLI (migrate/seed) ada di sini, bukan di schema.prisma.
// DIRECT_URL = koneksi langsung Supabase (port 5432) — wajib untuk migrasi.
// Aplikasi (runtime) memakai DATABASE_URL (pooler Supabase, port 6543) lewat src/lib/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // `prisma generate` (saat build di Vercel) tidak butuh koneksi DB, jadi jangan gagal bila DIRECT_URL kosong.
  // `prisma migrate` tetap butuh DIRECT_URL yang benar.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://unset:unset@localhost:5432/unset',
  },
});
