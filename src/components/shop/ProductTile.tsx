'use client';

import { SafeImage } from '@/components/shop/SafeImage';
import { useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Check, Star } from 'lucide-react';
import { useCartStore } from '@/stores/use-cart-store';
import { formatIDR, formatKg, QTY_STEP_KG } from '@/lib/business-rules';
import { CATEGORY_META } from '@/lib/catalog';

export type TileProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  pricePerKg: number;
  availableKg: number;
  lowStock: boolean;
  rating: number | null;
  reviewsCount: number;
  image: string;
};

export function ProductTile({ p, defaultKg = 1 }: { p: TileProduct; defaultKg?: number }) {
  const addItem = useCartStore((s) => s.addItem);
  const [kg, setKg] = useState(Math.min(defaultKg, Math.max(QTY_STEP_KG, p.availableKg)));
  const [added, setAdded] = useState(false);
  const soldOut = p.availableKg < QTY_STEP_KG;

  const add = () => {
    addItem({ id: p.id, name: p.name, price: p.pricePerKg, image: p.image, maxStock: p.availableKg }, kg);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-daun-300 transition-colors">
      <Link href={`/products/${p.slug}`} className="relative block aspect-[4/3] bg-slate-100 overflow-hidden">
        <SafeImage src={p.image} alt={p.name} className="h-full w-full object-cover" />
        {soldOut ? (
          <span className="absolute inset-0 bg-white/70 grid place-items-center text-sm font-semibold text-slate-700">Stok habis</span>
        ) : p.lowStock || p.availableKg <= 5 ? (
          <span className="absolute left-2 top-2 rounded-md bg-cabai-500 text-white text-[11px] font-semibold px-2 py-0.5">
            Sisa {formatKg(p.availableKg)}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-col flex-1 p-3.5">
        <span className="text-xs text-slate-500">{CATEGORY_META[p.category]?.short ?? p.category}</span>
        <Link href={`/products/${p.slug}`} className="mt-0.5 font-semibold text-ink leading-snug line-clamp-2 hover:text-daun-700">
          {p.name}
        </Link>
        {p.rating ? (
          <span className="mt-1 flex items-center gap-1 text-xs text-slate-600">
            <Star className="h-3.5 w-3.5 fill-kunyit-400 text-kunyit-400" /> {p.rating.toFixed(1)}
            <span className="text-slate-400">({p.reviewsCount})</span>
          </span>
        ) : null}
        <div className="mt-auto pt-3">
          <p className="text-[17px] font-bold text-ink tabular-nums">
            {formatIDR(p.pricePerKg)}
            <span className="text-xs font-medium text-slate-500"> /kg</span>
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex items-center rounded-md border border-slate-300">
              <button
                className="h-8 w-7 grid place-items-center text-slate-600 disabled:opacity-30"
                disabled={soldOut || kg <= QTY_STEP_KG}
                onClick={() => setKg((v) => Math.round((v - QTY_STEP_KG) * 10) / 10)}
                aria-label="Kurangi"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-12 text-center text-xs font-semibold tabular-nums">{formatKg(kg)}</span>
              <button
                className="h-8 w-7 grid place-items-center text-slate-600 disabled:opacity-30"
                disabled={soldOut || kg + QTY_STEP_KG > p.availableKg}
                onClick={() => setKg((v) => Math.round((v + QTY_STEP_KG) * 10) / 10)}
                aria-label="Tambah"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button
              onClick={add}
              disabled={soldOut}
              className={`flex-1 h-8 rounded-md text-sm font-semibold flex items-center justify-center gap-1 transition-colors disabled:bg-slate-200 disabled:text-slate-500 ${
                added ? 'bg-daun-100 text-daun-800' : 'bg-daun-700 text-white hover:bg-daun-800'
              }`}
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Masuk
                </>
              ) : (
                'Tambah'
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
