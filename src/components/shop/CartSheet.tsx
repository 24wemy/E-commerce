'use client';

import { SafeImage } from '@/components/shop/SafeImage';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/stores/use-cart-store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from '@/components/ui/sheet';
import { ShoppingBag, Plus, Minus, Trash2, Tag, X } from 'lucide-react';
import { QTY_STEP_KG, formatKg, formatIDR } from '@/lib/business-rules';

export function CartSheet() {
  const [mounted, setMounted] = useState(false);
  const {
    items,
    updateQuantity,
    removeItem,
    totalPrice,
    totalItems,
    appliedDiscount,
    removeDiscountCode,
    discountAmount,
    shippingFee,
    expressFee,
    finalPrice,
    promoError,
  } = useCartStore();

  useEffect(() => setMounted(true), []);

  const itemCount = mounted ? totalItems() : 0;
  const cartItems = mounted ? items : [];

  return (
    <Sheet>
      <SheetTrigger
        render={(props) => (
          // tombol native agar ref dari Sheet bisa diteruskan (menghindari peringatan React)
          <button {...props} className="relative flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50" aria-label={`Keranjang, ${itemCount} produk`}>
            <span className="relative">
              <ShoppingBag className="h-6 w-6 text-slate-700" />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-cabai-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center font-bold">
                  {itemCount}
                </span>
              )}
            </span>
            <span className="hidden lg:block text-left leading-tight">
              <span className="block text-xs text-slate-500">Keranjang</span>
              <span className="block text-sm font-semibold text-ink tabular-nums">{formatIDR(mounted ? totalPrice() : 0)}</span>
            </span>
          </button>
        )}
      />
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="text-lg font-bold text-ink">Keranjang belanja</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5">
          {cartItems.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="h-10 w-10 mx-auto text-slate-300" />
              <p className="mt-3 font-semibold text-ink">Keranjang masih kosong</p>
              <p className="text-sm text-slate-500 mt-1">Pilih produk dari katalog, lalu atur jumlah kilonya di sini.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {cartItems.map((item) => (
                <li key={item.id} className="py-4 flex gap-3">
                  <div className="h-16 w-16 rounded-md overflow-hidden bg-slate-100 shrink-0">
                    <SafeImage src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <h4 className="text-sm font-semibold text-ink leading-snug">{item.name}</h4>
                      <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-cabai-500 shrink-0" aria-label={`Hapus ${item.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">{formatIDR(item.price)}/kg</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center rounded-md border border-slate-300">
                        <button
                          className="h-7 w-7 grid place-items-center text-slate-600 hover:bg-slate-50"
                          onClick={() => updateQuantity(item.id, item.quantity - QTY_STEP_KG)}
                          aria-label="Kurangi"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-semibold w-14 text-center tabular-nums">{formatKg(item.quantity)}</span>
                        <button
                          className="h-7 w-7 grid place-items-center text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                          disabled={item.maxStock !== undefined && item.quantity + QTY_STEP_KG > item.maxStock}
                          onClick={() => updateQuantity(item.id, item.quantity + QTY_STEP_KG)}
                          aria-label="Tambah"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-ink tabular-nums">{formatIDR(Math.round(item.price * item.quantity))}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cartItems.length > 0 && (
          <SheetFooter className="border-t px-5 py-4 flex flex-col gap-3 sm:flex-col">
            {promoError && !appliedDiscount && (
              <div className="bg-cabai-50 border border-cabai-100 p-2.5 rounded-md text-xs text-cabai-700">{promoError}</div>
            )}
            {appliedDiscount && (
              <div className="bg-daun-50 border border-daun-200 p-2.5 rounded-md flex items-center justify-between text-xs text-daun-900">
                <span className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-daun-600" />
                  <span>
                    <strong>{appliedDiscount.code}</strong> · {appliedDiscount.description}
                  </span>
                </span>
                <button onClick={removeDiscountCode} className="p-1" aria-label="Lepas kode promo">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatIDR(totalPrice())}</dd>
              </div>
              {discountAmount() > 0 && (
                <div className="flex justify-between text-daun-700 font-semibold">
                  <dt>Diskon</dt>
                  <dd className="tabular-nums">−{formatIDR(discountAmount())}</dd>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <dt>Ongkos kirim</dt>
                <dd className="tabular-nums">{(() => {
                  const fee = shippingFee();
                  return fee === null ? 'Dihitung saat checkout' : fee === 0 ? 'Gratis' : formatIDR(fee);
                })()}</dd>
              </div>
              {expressFee() > 0 && (
                <div className="flex justify-between text-slate-600">
                  <dt>Antar sekarang</dt>
                  <dd className="tabular-nums">{formatIDR(expressFee())}</dd>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t text-base font-bold text-ink">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatIDR(finalPrice())}</dd>
              </div>
            </dl>
            <Link href="/checkout" className="w-full rounded-lg bg-daun-700 hover:bg-daun-800 text-white font-semibold text-center py-3">
              Lanjut ke checkout
            </Link>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
