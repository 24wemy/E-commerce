'use client';

import { SafeImage } from '@/components/shop/SafeImage';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Truck, Scale, ShieldCheck, Sunrise, Star, Copy, Check, Store, Search, X } from 'lucide-react';
import { Header, openChat } from '@/components/shop/Header';
import { Footer } from '@/components/shop/Footer';
import { ProductTile, TileProduct } from '@/components/shop/ProductTile';
import { MiniBakeGameModal } from '@/components/shop/MiniBakeGameModal';
import { CATEGORY_META } from '@/lib/catalog';
import { formatIDR, MIN_SHIPPING_FEE } from '@/lib/business-rules';

export type HomeProduct = TileProduct & { sku: string; sold30: number; description: string };
export type HomePromo = {
  code: string;
  name: string;
  type: string;
  value: number;
  maxDiscount: number | null;
  minOrder: number;
  endsAt: string;
};
export type HomeReview = { id: string; rating: number; comment: string; name: string; isBusiness: boolean; area: string | null; date: string };

const HERO_IMG = 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=1200&q=80';

function useCountdown(endsAt?: string) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) return setLeft('Berakhir');
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setLeft(`${d ? `${d} hari ` : ''}${pad(h)}:${pad(m)}:${pad(s)}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  return left;
}

function CopyCode({ code, dark = false }: { code: string; dark?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(code).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={`inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm font-bold tracking-wide ${
        dark ? 'border-white/60 text-white hover:bg-white/10' : 'border-daun-600 text-daun-800 hover:bg-daun-50'
      }`}
      aria-label={`Salin kode ${code}`}
    >
      {code}
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-70" />}
    </button>
  );
}

function promoValue(p: HomePromo) {
  if (p.type === 'FREE_SHIPPING') return 'Gratis ongkir';
  if (p.type === 'FIXED_AMOUNT') return `Hemat ${formatIDR(p.value)}`;
  return `Diskon ${p.value}%`;
}

export function HomeClient({
  products,
  promos,
  reviews,
  stats,
  initialQuery,
  initialCategory,
}: {
  products: HomeProduct[];
  promos: HomePromo[];
  reviews: HomeReview[];
  stats: { customers: number; avgRating: number | null; reviewCount: number };
  initialQuery: string;
  initialCategory: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<'kategori' | 'laris' | 'murah' | 'mahal'>('kategori');
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => setCategory(initialCategory), [initialCategory]);

  const today = useMemo(
    () => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Makassar' }),
    []
  );

  const broiler = products.find((p) => p.slug === 'ayam-broiler-segar');
  const flash = promos.find((p) => p.type === 'FLASH_SALE');
  const otherPromos = promos.filter((p) => p !== flash && ['ONGKIRFREE', 'GROSIRB2B15', 'MINUT20K'].includes(p.code)).slice(0, 2);
  const countdown = useCountdown(flash?.endsAt);

  const categories = Object.entries(CATEGORY_META)
    .map(([key, meta]) => {
      const items = products.filter((p) => p.category === key);
      return { key, meta, count: items.length, image: items[0]?.image };
    })
    .filter((c) => c.count > 0);

  const bestSellers = [...products].filter((p) => p.sold30 > 0 && p.availableKg > 0).sort((a, b) => b.sold30 - a.sold30).slice(0, 5);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter(
      (p) => (!category || p.category === category) && (!q || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q))
    );
    return list.sort((a, b) =>
      sort === 'murah' ? a.pricePerKg - b.pricePerKg : sort === 'mahal' ? b.pricePerKg - a.pricePerKg : sort === 'laris' ? b.sold30 - a.sold30 : 0
    );
  }, [products, category, query, sort]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* HERO */}
        <section className="bg-white border-b border-slate-200">
          <div className="mx-auto max-w-7xl px-4 py-10 lg:py-14 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-daun-50 border border-daun-200 px-3 py-1 text-sm text-daun-800">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-daun-500 opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-daun-600" />
                </span>
                Potongan {today}, pukul 04.00 WITA
              </p>
              <h1 className="mt-5 text-[2.6rem] leading-[1.08] sm:text-5xl lg:text-[3.6rem] font-extrabold tracking-tight text-ink">
                Ayam segar dipotong subuh, sampai di dapur Anda pagi ini.
              </h1>
              <p className="mt-5 text-lg text-slate-600 max-w-xl leading-relaxed">
                Dari peternak mitra di Minahasa Utara, dibersihkan dan ditimbang digital, lalu diantar ke rumah, warung, dan resto Anda. Bayar sesuai berat, mulai setengah kilo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#katalog" className="rounded-lg bg-daun-700 hover:bg-daun-800 text-white font-semibold px-6 py-3">
                  Belanja sekarang
                </a>
                <button onClick={openChat} className="rounded-lg border border-slate-300 hover:border-daun-600 hover:text-daun-800 font-semibold px-6 py-3 text-ink">
                  Tanya stok hari ini
                </button>
              </div>
              <dl className="mt-10 grid grid-cols-3 max-w-md divide-x divide-slate-200 border-y border-slate-200">
                <div className="py-3 pr-3">
                  <dt className="text-xs text-slate-500">Produk tersedia</dt>
                  <dd className="text-xl font-bold text-ink tabular-nums">{products.filter((p) => p.availableKg > 0).length}</dd>
                </div>
                <div className="py-3 px-3">
                  <dt className="text-xs text-slate-500">Pelanggan</dt>
                  <dd className="text-xl font-bold text-ink tabular-nums">{stats.customers}</dd>
                </div>
                <div className="py-3 pl-3">
                  <dt className="text-xs text-slate-500">Rating ulasan</dt>
                  <dd className="text-xl font-bold text-ink tabular-nums">{stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="relative">
              <div className="aspect-[5/4] rounded-2xl overflow-hidden bg-slate-100">
                <SafeImage src={HERO_IMG} alt="Ayam broiler segar yang baru dipotong" className="h-full w-full object-cover" iconClassName="h-24 w-24" />
              </div>
              {broiler && (
                <div className="absolute -bottom-5 left-4 sm:left-6 right-4 sm:right-auto sm:w-80 rounded-xl bg-white border border-slate-200 shadow-[0_12px_32px_-12px_rgba(15,54,32,0.35)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Stok broiler hari ini</p>
                      <p className="text-2xl font-extrabold text-ink tabular-nums">{broiler.availableKg} kg</p>
                    </div>
                    <p className="text-right">
                      <span className="block text-xs text-slate-500">Harga</span>
                      <span className="font-bold text-daun-800 tabular-nums">{formatIDR(broiler.pricePerKg)}/kg</span>
                    </p>
                  </div>
                  <Link href={`/products/${broiler.slug}`} className="mt-3 block text-center rounded-md bg-daun-50 text-daun-800 font-semibold text-sm py-2 hover:bg-daun-100">
                    Pesan broiler
                  </Link>
                </div>
              )}
              <div className="absolute top-4 right-4 rounded-full bg-kunyit-400 text-kunyit-950 w-24 h-24 grid place-items-center text-center rotate-[-8deg] shadow-md">
                <span className="text-[11px] font-bold leading-tight">
                  Potong
                  <span className="block text-xl font-extrabold">04.00</span>
                  WITA
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICE STRIP */}
        <section className="border-b border-slate-200 bg-white">
          <ul className="mx-auto max-w-7xl px-4 py-5 grid grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
            {[
              { icon: Sunrise, title: 'Dipotong tiap subuh', desc: 'Tidak ada stok beku untuk ayam segar' },
              { icon: Scale, title: 'Bayar sesuai berat', desc: 'Ditimbang digital, kelipatan 0,5 kg' },
              { icon: Truck, title: 'Antar atau ambil sendiri', desc: `Ongkir mulai ${formatIDR(MIN_SHIPPING_FEE)}, ambil di toko gratis` },
              { icon: ShieldCheck, title: 'Pembayaran aman', desc: 'VA bank, QRIS, GoPay via Midtrans' },
            ].map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="h-10 w-10 shrink-0 rounded-lg bg-daun-50 text-daun-700 grid place-items-center">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{title}</span>
                  <span className="block text-slate-500">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto max-w-7xl px-4">
          {/* CATEGORIES */}
          <section className="pt-12">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-bold text-ink">Belanja per kategori</h2>
              <a href="#katalog" onClick={() => setCategory('')} className="text-sm font-semibold text-daun-700 hover:underline">
                Lihat semua produk
              </a>
            </div>
            <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {categories.map((c) => (
                <a
                  key={c.key}
                  href="#katalog"
                  onClick={() => setCategory(c.key)}
                  className={`group rounded-xl border bg-white p-2.5 text-center transition-colors ${
                    category === c.key ? 'border-daun-600 ring-2 ring-daun-100' : 'border-slate-200 hover:border-daun-300'
                  }`}
                >
                  <span className="block aspect-square rounded-lg overflow-hidden bg-slate-100">
                    <SafeImage src={c.image} alt={c.meta.label} className="h-full w-full object-cover" />
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-ink leading-tight">{c.meta.short}</span>
                  <span className="block text-xs text-slate-500">{c.count} produk</span>
                </a>
              ))}
            </div>
          </section>

          {/* PROMO */}
          {(flash || otherPromos.length > 0) && (
            <section id="promo" className="pt-12 scroll-mt-32 grid lg:grid-cols-[1.6fr_1fr] gap-4">
              {flash ? (
                <div className="relative overflow-hidden rounded-2xl bg-daun-800 text-white p-7 sm:p-9 min-h-[260px] flex flex-col justify-between">
                  <div className="absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-kunyit-400/90" aria-hidden />
                  <div className="absolute right-8 bottom-8 hidden sm:block text-right text-kunyit-950">
                    <span className="block text-sm font-semibold">hemat</span>
                    <span className="block text-6xl font-extrabold leading-none">{flash.value}%</span>
                  </div>
                  <div className="relative max-w-sm">
                    <p className="text-daun-200 text-sm font-semibold">Flash sale · kuota terbatas</p>
                    <h2 className="mt-2 text-3xl font-extrabold leading-tight">{flash.name}</h2>
                    <p className="mt-2 text-daun-100">
                      {promoValue(flash)}
                      {flash.maxDiscount ? ` hingga ${formatIDR(flash.maxDiscount)}` : ''}
                      {flash.minOrder ? `, minimal belanja ${formatIDR(flash.minOrder)}` : ''}.
                    </p>
                  </div>
                  <div className="relative mt-6 flex flex-wrap items-center gap-4">
                    <CopyCode code={flash.code} dark />
                    <span className="text-sm text-daun-100">
                      Berakhir dalam <span className="font-bold text-white tabular-nums">{countdown}</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-daun-800 text-white p-8">
                  <h2 className="text-3xl font-extrabold">Promo minggu ini</h2>
                </div>
              )}
              <div className="grid gap-4">
                {otherPromos.map((p) => (
                  <div key={p.code} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{p.name}</p>
                      <p className="mt-1 text-xl font-bold text-ink">
                        {promoValue(p)}
                        {p.minOrder ? <span className="text-base font-medium text-slate-600"> · min. {formatIDR(p.minOrder)}</span> : null}
                      </p>
                    </div>
                    <div className="mt-3">
                      <CopyCode code={p.code} />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setQuizOpen(true)}
                  className="rounded-2xl border border-kunyit-300 bg-kunyit-50 p-5 text-left hover:border-kunyit-500"
                >
                  <p className="text-sm text-kunyit-800">Kuis 3 pertanyaan</p>
                  <p className="mt-1 text-xl font-bold text-ink">Jawab benar, dapat kode diskon hingga 15%</p>
                  <p className="mt-1 text-sm text-slate-600">Berlaku untuk belanja minimal {formatIDR(100000)}.</p>
                </button>
              </div>
            </section>
          )}

          {/* BEST SELLERS */}
          {bestSellers.length > 0 && (
            <section className="pt-12">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-ink">Paling sering dibeli</h2>
                  <p className="text-sm text-slate-500 mt-1">Berdasarkan pesanan 30 hari terakhir</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {bestSellers.map((p) => (
                  <ProductTile key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}

          {/* CATALOG */}
          <section id="katalog" className="pt-14 scroll-mt-32">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-ink">{category ? CATEGORY_META[category]?.label ?? 'Produk' : 'Semua produk'}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {filtered.length} produk{query ? ` untuk “${query}”` : ''}. Harga per kilogram, sudah termasuk pemotongan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Saring produk…"
                    className="h-9 w-48 rounded-md border border-slate-300 pl-8 pr-7 text-sm outline-none focus:border-daun-600"
                    aria-label="Saring produk"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Hapus pencarian">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="h-9 rounded-md border border-slate-300 px-2 text-sm bg-white"
                  aria-label="Urutkan"
                >
                  <option value="kategori">Urutan kategori</option>
                  <option value="laris">Terlaris</option>
                  <option value="murah">Harga terendah</option>
                  <option value="mahal">Harga tertinggi</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist">
              <button
                onClick={() => setCategory('')}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  !category ? 'bg-daun-700 border-daun-700 text-white' : 'border-slate-300 text-slate-700 hover:border-daun-500'
                }`}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold ${
                    category === c.key ? 'bg-daun-700 border-daun-700 text-white' : 'border-slate-300 text-slate-700 hover:border-daun-500'
                  }`}
                >
                  {c.meta.short}
                </button>
              ))}
            </div>

            {filtered.length ? (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map((p) => (
                  <ProductTile key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
                <p className="font-semibold text-ink">Produk tidak ditemukan</p>
                <p className="text-sm text-slate-500 mt-1">Coba kata lain, atau tanyakan langsung ke tim kami.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={() => { setQuery(''); setCategory(''); }} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
                    Tampilkan semua
                  </button>
                  <button onClick={openChat} className="rounded-md bg-daun-700 text-white px-4 py-2 text-sm font-semibold">
                    Tanya tim kami
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* B2B */}
          <section className="mt-16 rounded-2xl border border-slate-200 bg-white overflow-hidden grid lg:grid-cols-[1.3fr_1fr]">
            <div className="p-7 sm:p-10">
              <Store className="h-8 w-8 text-daun-700" />
              <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-ink">Punya warung, resto, atau usaha katering?</h2>
              <p className="mt-3 text-slate-600 max-w-xl leading-relaxed">
                Pesan rutin dalam jumlah besar dengan potongan sesuai kebutuhan dapur Anda. Gunakan kode <strong>GROSIRB2B15</strong> untuk belanja di atas {formatIDR(300000)}, dan centang permintaan faktur saat checkout.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={openChat} className="rounded-lg bg-daun-700 hover:bg-daun-800 text-white font-semibold px-5 py-2.5">
                  Diskusikan kebutuhan
                </button>
                <a href="#katalog" onClick={() => setCategory('AYAM_SEGAR')} className="rounded-lg border border-slate-300 font-semibold px-5 py-2.5 text-ink hover:border-daun-600">
                  Lihat harga broiler
                </a>
              </div>
            </div>
            <ul className="bg-daun-50 p-7 sm:p-10 space-y-4 text-sm border-t lg:border-t-0 lg:border-l border-slate-200">
              {[
                ['Potongan khusus', 'Potong 4, 8, 10, geprek, atau fillet sesuai menu.'],
                ['Antar subuh', 'Tiba sebelum dapur Anda buka.'],
                ['Faktur untuk usaha', 'Bisa diminta langsung saat checkout.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <Check className="h-5 w-5 text-daun-700 shrink-0" />
                  <span>
                    <span className="font-semibold text-ink">{t}.</span> <span className="text-slate-600">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* REVIEWS */}
          {reviews.length > 0 && (
            <section className="pt-16">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-2xl font-bold text-ink">Kata pelanggan kami</h2>
                {stats.avgRating && (
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Star className="h-5 w-5 fill-kunyit-400 text-kunyit-400" />
                    <span className="font-bold text-ink">{stats.avgRating.toFixed(1)}</span> dari {stats.reviewCount} ulasan pembeli
                  </p>
                )}
              </div>
              <div className="mt-5 grid md:grid-cols-3 gap-4">
                {reviews.map((r) => (
                  <figure key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col">
                    <div className="flex gap-0.5" aria-label={`${r.rating} dari 5 bintang`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-kunyit-400 text-kunyit-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    <blockquote className="mt-3 text-ink leading-relaxed flex-1">“{r.comment}”</blockquote>
                    <figcaption className="mt-4 flex items-center gap-3 text-sm">
                      <span className="h-9 w-9 rounded-full bg-daun-100 text-daun-800 font-bold grid place-items-center">{r.name.charAt(0)}</span>
                      <span>
                        <span className="block font-semibold text-ink">{r.name}</span>
                        <span className="block text-slate-500">
                          {r.isBusiness ? 'Pelanggan usaha' : 'Pelanggan rumah tangga'}
                          {r.area ? `, ${r.area}` : ''}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
      <MiniBakeGameModal isOpen={quizOpen} onClose={() => setQuizOpen(false)} />
    </div>
  );
}
