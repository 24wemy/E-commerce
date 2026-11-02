/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/use-cart-store';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Plus, Minus, Check } from 'lucide-react';
import { QTY_STEP_KG, formatKg } from '@/lib/business-rules';

export function AddToCartButton({ product }: { product: any }) {
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const pricePerKg: number = product.pricePerKg;
  const stockKg: number = product.availableKg ?? product.stockKg ?? 0;
  const step = QTY_STEP_KG;

  const handleAdd = () => {
    addItem(
      {
        id: product.id,
        name: product.name,
        price: pricePerKg,
        image: product.images?.[0] || '',
        maxStock: stockKg,
      },
      quantity
    );

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-slate-700">Jumlah (Kg):</span>
        <div className="flex items-center border border-slate-300 rounded-xl bg-white">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-700"
            disabled={quantity <= step}
            onClick={() => setQuantity(Math.round((quantity - step) * 10) / 10)}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-14 text-center font-black text-sm text-slate-900">{formatKg(quantity)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-700"
            disabled={quantity + step > stockKg}
            onClick={() => setQuantity(Math.round((quantity + step) * 10) / 10)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Button
        onClick={handleAdd}
        disabled={stockKg < quantity}
        className="w-full h-12 text-base font-semibold gap-2 bg-daun-700 hover:bg-daun-800 text-white rounded-lg"
      >
        {added ? (
          <>
            <Check className="h-5 w-5" /> Ditambahkan ke Keranjang!
          </>
        ) : (
          <>
            <ShoppingBag className="h-5 w-5" /> {stockKg <= 0 ? 'Stok Habis' : `Tambah ${formatKg(quantity)} ke Keranjang`}
          </>
        )}
      </Button>
    </div>
  );
}
