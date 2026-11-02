import { createGoogleGenerativeAI } from '@ai-sdk/google';

/**
 * Model Gemini (Free tier, cek: https://ai.google.dev/gemini-api/docs/pricing).
 * - Utama  : gemini-3.8-flash      -> model Flash stabil, rekomendasi Google untuk penggunaan umum
 * - Cadangan: gemini-3.5-flash-lite -> lebih hemat kuota; dipakai otomatis bila model utama kena limit/error
 * Bisa diganti lewat env GEMINI_MODEL / GEMINI_FALLBACK_MODEL tanpa ubah kode.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';

export const geminiApiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

export function geminiProvider() {
  return createGoogleGenerativeAI({ apiKey: geminiApiKey() });
}

/** Jalankan fn dengan model utama; bila gagal (mis. 429 kuota habis), coba model cadangan. */
export async function withGeminiFallback<T>(fn: (modelId: string, abortSignal: AbortSignal) => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const r = await fn(GEMINI_MODEL, AbortSignal.timeout(GEMINI_TIMEOUT_MS));
    console.log(`[gemini] ${GEMINI_MODEL} OK (${Date.now() - started} ms)`);
    return r;
  } catch (e) {
    console.warn(`[gemini] ${GEMINI_MODEL} gagal (${Date.now() - started} ms), mencoba ${GEMINI_FALLBACK_MODEL}:`, (e as Error).message);
    const t2 = Date.now();
    const r = await fn(GEMINI_FALLBACK_MODEL, AbortSignal.timeout(GEMINI_TIMEOUT_MS));
    console.log(`[gemini] ${GEMINI_FALLBACK_MODEL} OK (${Date.now() - t2} ms)`);
    return r;
  }
}

/** Batas waktu tiap panggilan model (ms) agar chat tidak menggantung tanpa jawaban. */
export const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25000);

/** Rate limit sederhana per IP/user (in-memory) agar kuota free tier tidak cepat habis. */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, maxPerMinute: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= maxPerMinute) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

/** Bersihkan markdown agar tampil rapi di UI teks biasa. */
export function stripMarkdown(text: string) {
  return (text || '')
    .replace(/#{1,6}\s?/g, '')
    .replace(/\*{1,2}/g, '')
    .replace(/(^|\s)_{1,2}|_{1,2}(\s|$)/g, '$1$2')
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type RawMsg = { role?: string; content?: unknown; parts?: Array<{ text?: string }> };

/** Normalisasi riwayat chat dari client: hanya role user/assistant, maks 12 pesan, maks 1000 karakter per pesan. */
export function normalizeMessages(raw: unknown): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(raw)) return [];
  return (raw as RawMsg[])
    .map((m) => {
      let content = '';
      if (typeof m.content === 'string') content = m.content;
      else if (Array.isArray(m.content)) content = (m.content as Array<{ text?: string }>).map((c) => c.text || '').join(' ');
      else if (Array.isArray(m.parts)) content = m.parts.map((p) => p.text || '').join(' ');
      return { role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: content.slice(0, 1000).trim() };
    })
    .filter((m) => m.content)
    .slice(-12);
}
