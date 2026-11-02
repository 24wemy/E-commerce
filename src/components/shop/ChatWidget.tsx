'use client';

import { SafeImage } from '@/components/shop/SafeImage';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, X, SendHorizontal, RotateCcw, Plus, Check } from 'lucide-react';
import { LogoMark } from '@/components/shop/Logo';
import { useCartStore } from '@/stores/use-cart-store';
import { formatIDR } from '@/lib/business-rules';
import { STORE_INFO } from '@/lib/catalog';

type SuggestedProduct = { id: string; slug: string; name: string; pricePerKg: number; image: string; availableKg: number };
type Msg = { id: string; role: 'user' | 'assistant'; content: string; at: number; products?: SuggestedProduct[]; failed?: boolean };

const STORAGE_KEY = 'fm-chat-v1';
const QUICK_REPLIES = [
  'Stok ayam hari ini apa saja?',
  'Ayam untuk woku 4 porsi, perlu berapa kg?',
  'Ada promo apa sekarang?',
  'Cek status pesanan saya',
  'Harga untuk warung, beli 20 kg',
];
const GREETING: Msg = {
  id: 'greet',
  role: 'assistant',
  content: 'Halo, selamat datang di Fresh Minut. Saya bisa bantu cek stok, pilih potongan yang pas untuk masakan Anda, info promo, atau status pesanan.',
  at: 0,
};

const time = (t: number) => (t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '');

function MessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (/^[•\-]\s?/.test(t)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-[9px] h-1 w-1 rounded-full bg-current opacity-60 shrink-0" />
              <span>{t.replace(/^[•\-]\s?/, '')}</span>
            </div>
          );
        }
        return <p key={i}>{t}</p>;
      })}
    </div>
  );
}

function ProductSuggestion({ p }: { p: SuggestedProduct }) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const soldOut = p.availableKg < 0.5;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
      <SafeImage src={p.image} alt={p.name} className="h-11 w-11 rounded-md object-cover" />
      <Link href={`/products/${p.slug}`} className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold text-ink truncate">{p.name}</span>
        <span className="block text-xs text-slate-500">
          {formatIDR(p.pricePerKg)}/kg · {soldOut ? 'stok habis' : `stok ${p.availableKg} kg`}
        </span>
      </Link>
      <button
        disabled={soldOut || added}
        onClick={() => {
          addItem({ id: p.id, name: p.name, price: p.pricePerKg, image: p.image, maxStock: p.availableKg }, 1);
          setAdded(true);
        }}
        className="h-8 shrink-0 rounded-md border border-daun-600 px-2.5 text-xs font-semibold text-daun-800 hover:bg-daun-50 disabled:border-slate-200 disabled:text-slate-400 flex items-center gap-1"
      >
        {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {added ? 'Ditambah' : '1 kg'}
      </button>
    </div>
  );
}

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Riwayat chat bertahan selama tab dibuka
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      /* storage tidak tersedia */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* abaikan */
    }
  }, [messages]);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('fm:open-chat', h);
    return () => window.removeEventListener('fm:open-chat', h);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  if (pathname.startsWith('/admin') || pathname === '/login' || pathname === '/register') return null;

  const send = async (text: string, history = messages) => {
    const content = text.trim();
    if (!content || busy) return;
    const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', content, at: Date.now() };
    const next = [...history.filter((m) => !m.failed), userMsg];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.filter((m) => m.id !== 'greet').map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: { text?: string; products?: SuggestedProduct[] } = await res.json();
      setMessages((m) => [
        ...m,
        { id: `a${Date.now()}`, role: 'assistant', content: data.text || 'Maaf, belum ada jawaban.', at: Date.now(), products: data.products },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: `e${Date.now()}`, role: 'assistant', content: 'Pesan belum terkirim karena koneksi terputus.', at: Date.now(), failed: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const idx = messages.lastIndexOf(lastUser);
    send(lastUser.content, messages.slice(0, idx));
  };

  const reset = () => {
    setMessages([GREETING]);
    setInput('');
  };

  const showQuick = messages.length <= 1 && !busy;

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-daun-700 hover:bg-daun-800 text-white shadow-[0_10px_30px_-8px_rgba(15,54,32,0.6)] transition-all ${
          open ? 'h-14 w-14 justify-center' : 'h-14 w-14 justify-center sm:w-auto sm:pl-4 sm:pr-5'
        } ${open ? 'max-sm:hidden' : ''}`}
        aria-label={open ? 'Tutup chat' : 'Buka chat bantuan'}
        aria-expanded={open}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            <span className="hidden sm:inline text-sm font-semibold">Butuh bantuan?</span>
          </>
        )}
      </button>

      {/* Panel */}
      {open && (
        <section
          role="dialog"
          aria-label="Chat layanan pelanggan Fresh Minut"
          className="fixed z-50 flex flex-col bg-white overflow-hidden inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[390px] sm:h-[600px] sm:max-h-[calc(100vh-8rem)] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-[0_24px_60px_-20px_rgba(15,54,32,0.45)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 duration-200"
        >
          <header className="bg-daun-800 text-white px-4 py-3.5 flex items-center gap-3">
            <span className="relative">
              <LogoMark className="h-10 w-10" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-daun-800" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold leading-tight">Fresh Minut</span>
              <span className="block text-xs text-daun-200 truncate">Online · biasanya membalas seketika</span>
            </span>
            <button onClick={reset} className="p-2 rounded-md hover:bg-white/10" aria-label="Mulai percakapan baru" title="Mulai percakapan baru">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={() => setOpen(false)} className="p-2 rounded-md hover:bg-white/10" aria-label="Tutup chat">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto bg-surface px-4 py-4 space-y-4" aria-live="polite">
            <p className="text-center text-[11px] text-slate-400">Hari ini</p>
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[82%]">
                    <div className="rounded-2xl rounded-tr-md bg-daun-700 text-white px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">{m.content}</div>
                    <p className="mt-1 text-right text-[11px] text-slate-400">{time(m.at)}</p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2.5">
                  <LogoMark className="h-7 w-7 shrink-0 mt-0.5" />
                  <div className="max-w-[85%] space-y-2">
                    <div
                      className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[14px] leading-relaxed ${
                        m.failed ? 'bg-cabai-50 text-cabai-700 border border-cabai-100' : 'bg-white border border-slate-200 text-ink'
                      }`}
                    >
                      <MessageText text={m.content} />
                      {m.failed && (
                        <button onClick={retry} className="mt-2 text-sm font-semibold underline">
                          Kirim ulang
                        </button>
                      )}
                    </div>
                    {m.products?.length ? (
                      <div className="space-y-1.5">
                        {m.products.map((p) => (
                          <ProductSuggestion key={p.id} p={p} />
                        ))}
                      </div>
                    ) : null}
                    {m.at ? <p className="text-[11px] text-slate-400">{time(m.at)}</p> : null}
                  </div>
                </div>
              )
            )}

            {busy && (
              <div className="flex gap-2.5 items-center">
                <LogoMark className="h-7 w-7 shrink-0" />
                <div className="rounded-2xl rounded-tl-md bg-white border border-slate-200 px-4 py-3 flex gap-1" aria-label="Sedang mengetik">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-2 w-2 rounded-full bg-slate-400 motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {showQuick && (
              <div className="pl-9 flex flex-wrap gap-2">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-daun-300 bg-white px-3 py-1.5 text-[13px] text-daun-800 hover:bg-daun-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-slate-200 bg-white p-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-slate-300 focus-within:border-daun-600 focus-within:ring-2 focus-within:ring-daun-100 px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Tulis pesan…"
                className="flex-1 resize-none bg-transparent text-[14px] outline-none max-h-28 py-1"
                aria-label="Tulis pesan"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="h-9 w-9 shrink-0 rounded-lg bg-daun-700 text-white grid place-items-center disabled:bg-slate-200 disabled:text-slate-400"
                aria-label="Kirim"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 text-center">
              Dijawab otomatis oleh asisten toko. Komplain pesanan?{' '}
              <a className="underline" href={`https://wa.me/${STORE_INFO.whatsapp}`} target="_blank" rel="noreferrer">
                WhatsApp kami
              </a>
            </p>
          </form>
        </section>
      )}
    </>
  );
}
