/* eslint-disable no-console */
// Cek koneksi & API key Gemini:  npm run ai:test
import 'dotenv/config';
import { generateText } from 'ai';
import { geminiApiKey, geminiProvider, GEMINI_MODEL, GEMINI_FALLBACK_MODEL } from '../src/lib/gemini';

async function main() {
  const key = geminiApiKey();
  if (!key) {
    console.error('❌ GEMINI_API_KEY kosong di .env');
    process.exit(1);
  }
  console.log(`Key terbaca: ${key.slice(0, 6)}...${key.slice(-4)} (panjang ${key.length})`);
  const google = geminiProvider();
  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
    const t = Date.now();
    try {
      const r = await generateText({
        model: google(model),
        prompt: 'Balas satu kalimat singkat: "Halo dari Fresh Minut".',
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(30000),
      });
      console.log(`✅ ${model} (${Date.now() - t} ms): ${r.text.trim()}`);
    } catch (e) {
      const err = e as Error & { statusCode?: number; responseBody?: string };
      console.log(`❌ ${model} (${Date.now() - t} ms): ${err.statusCode ?? ''} ${err.message}`);
      if (err.responseBody) console.log('   detail:', err.responseBody.slice(0, 400));
    }
  }
}
main();
