import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { previewPromoAction } from '@/actions/checkout';

export interface CartItem {
  /** productId */
  id: string;
  name: string;
  /** harga per kg (hanya untuk tampilan — server selalu menghitung ulang dari database) */
  price: number;
  image: string;
  /** jumlah dalam kg */
  quantity: number;
  /** stok tersedia saat ditambahkan (untuk batas tombol +) */
  maxStock?: number;
}

export interface AppliedDiscount {
  code: string;
  description: string;
  discountAmount: number;
  shippingDiscount: number;
}

/** Pilihan penerimaan di checkout. fee = ongkir hasil hitung jarak (0 untuk ambil di toko), null = belum pilih lokasi. */
export interface FulfillmentChoice {
  method: 'DELIVERY' | 'PICKUP';
  lat?: number;
  lng?: number;
  fee: number | null;
  /** Biaya tambahan "Antar sekarang" (tidak tercakup promo gratis ongkir). */
  expressFee?: number;
}

interface CartStore {
  items: CartItem[];
  fulfillment: FulfillmentChoice | null;
  setFulfillment: (f: FulfillmentChoice | null) => void;
  appliedDiscount: AppliedDiscount | null;
  promoError: string | null;
  hasPlayedGame: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>, quantityKg?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantityKg: number) => void;
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  totalPrice: () => number;
  totalItems: () => number;
  applyDiscountCode: (code: string) => Promise<{ success: boolean; message: string }>;
  revalidateDiscount: () => Promise<void>;
  removeDiscountCode: () => void;
  setHasPlayedGame: (played: boolean) => void;
  discountAmount: () => number;
  shippingFee: () => number | null;
  expressFee: () => number;
  finalPrice: () => number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      fulfillment: null,
      setFulfillment: (f) => set({ fulfillment: f }),
      appliedDiscount: null,
      promoError: null,
      hasPlayedGame: false,

      addItem: (product, quantityKg = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id);
          const cap = (q: number, max?: number) => (max !== undefined ? Math.min(q, max) : q);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === product.id
                  ? { ...i, ...product, quantity: round1(cap(i.quantity + quantityKg, product.maxStock ?? i.maxStock)) }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...product, quantity: round1(cap(quantityKg, product.maxStock)) }] };
        });
      },

      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, quantityKg) =>
        set((state) => ({
          items:
            quantityKg <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, quantity: round1(quantityKg) } : i)),
        })),

      replaceItems: (items) => set({ items }),

      clearCart: () => set({ items: [], appliedDiscount: null, promoError: null }),

      totalPrice: () => get().items.reduce((acc, i) => acc + Math.round(i.price * i.quantity), 0),

      totalItems: () => get().items.length,

      applyDiscountCode: async (code: string) => {
        const f = get().fulfillment;
        const res = await previewPromoAction({
          code,
          items: get().items.map((i) => ({ productId: i.id, quantityKg: i.quantity })),
          fulfillment: f ? { method: f.method, lat: f.lat, lng: f.lng } : undefined,
        });
        if (!res.ok) {
          set({ promoError: res.error });
          return { success: false, message: res.error };
        }
        set({
          appliedDiscount: {
            code: res.code,
            description: res.description,
            discountAmount: res.discountAmount,
            shippingDiscount: res.shippingDiscount,
          },
          promoError: null,
        });
        return { success: true, message: `Kode ${res.code} terpasang: ${res.description}` };
      },

      /** Dipanggil saat isi keranjang berubah — server menghitung ulang diskon. */
      revalidateDiscount: async () => {
        const current = get().appliedDiscount;
        if (!current) return;
        if (get().items.length === 0) {
          set({ appliedDiscount: null });
          return;
        }
        const f = get().fulfillment;
        const res = await previewPromoAction({
          code: current.code,
          items: get().items.map((i) => ({ productId: i.id, quantityKg: i.quantity })),
          fulfillment: f ? { method: f.method, lat: f.lat, lng: f.lng } : undefined,
        });
        if (!res.ok) {
          set({ appliedDiscount: null, promoError: `Kode ${current.code} dilepas: ${res.error}` });
        } else {
          set({
            appliedDiscount: {
              code: res.code,
              description: res.description,
              discountAmount: res.discountAmount,
              shippingDiscount: res.shippingDiscount,
            },
            promoError: null,
          });
        }
      },

      removeDiscountCode: () => set({ appliedDiscount: null, promoError: null }),

      setHasPlayedGame: (played: boolean) => set({ hasPlayedGame: played }),

      discountAmount: () => get().appliedDiscount?.discountAmount ?? 0,

      /** null = ongkir belum diketahui (lokasi belum dipilih). */
      shippingFee: () => {
        const f = get().fulfillment;
        if (!get().items.length || !f || f.fee === null) return null;
        return Math.max(0, f.fee - (get().appliedDiscount?.shippingDiscount ?? 0));
      },

      expressFee: () => (get().items.length ? get().fulfillment?.expressFee ?? 0 : 0),

      finalPrice: () => Math.max(0, get().totalPrice() - get().discountAmount() + (get().shippingFee() ?? 0) + get().expressFee()),
    }),
    {
      name: 'freshminut-cart-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, appliedDiscount: s.appliedDiscount, hasPlayedGame: s.hasPlayedGame, fulfillment: s.fulfillment }),
    }
  )
);
