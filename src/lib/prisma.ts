/* eslint-disable no-var */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL;
  // Di Vercel (serverless) banyak instance berjalan bersamaan → pool kecil & koneksi menganggur cepat ditutup
  // agar tidak menghabiskan slot koneksi Supabase. Function di sin1 & DB di Singapura: buka koneksi baru murah.
  // Di server biasa (laptop/VPS) koneksi disimpan lebih lama supaya klik berikutnya tidak membuka koneksi TLS baru.
  const serverless = !!process.env.VERCEL;
  const pool = new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? (serverless ? 5 : 10)),
    idleTimeoutMillis: serverless ? 10_000 : 5 * 60_000,
    keepAlive: true,
    connectionTimeoutMillis: 15_000,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

globalThis.prismaGlobal = prisma;
