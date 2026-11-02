'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/stores/use-cart-store';
import { syncCartAction, getServerCartAction } from '@/actions/cart';

/**
 * Sinkronisasi keranjang browser <-> database untuk pelanggan yang login.
 * - Setiap perubahan keranjang disimpan ke server (debounce 1,5 detik) -> admin bisa melihat keranjang terbengkalai.
 * - Saat login dengan keranjang lokal kosong, keranjang tersimpan di server dipulihkan.
 * - Diskon promo dihitung ulang oleh server setiap isi keranjang berubah.
 */
export function CartSync() {
  const { data: session, status } = useSession();
  const items = useCartStore((s) => s.items);
  const replaceItems = useCartStore((s) => s.replaceItems);
  const revalidateDiscount = useCartStore((s) => s.revalidateDiscount);
  const restoredFor = useRef<string | null>(null);
  const firstRun = useRef(true);
  const lastSynced = useRef<string | null>(null);

  const userId = session?.user?.id;
  const isCustomer = session?.user?.role === 'CUSTOMER';

  // Pulihkan keranjang dari server sekali setelah login
  useEffect(() => {
    if (status !== 'authenticated' || !userId || !isCustomer || restoredFor.current === userId) return;
    restoredFor.current = userId;
    if (useCartStore.getState().items.length === 0) {
      getServerCartAction().then((serverItems) => {
        if (serverItems.length && useCartStore.getState().items.length === 0) replaceItems(serverItems);
      });
    }
  }, [status, userId, isCustomer, replaceItems]);

  // Simpan ke server setiap ada perubahan
  useEffect(() => {
    if (status !== 'authenticated' || !isCustomer) return;
    const payload = items.map((i) => ({ productId: i.id, quantityKg: i.quantity }));
    const key = JSON.stringify(payload);
    // Jangan kirim ulang isi keranjang yang sama setiap kali halaman dibuka (hemat request ke server)
    const storeKey = `fm-cart-synced:${userId}`;
    if (lastSynced.current === null) {
      try {
        lastSynced.current = sessionStorage.getItem(storeKey) ?? '';
      } catch {
        lastSynced.current = '';
      }
    }
    if (key === lastSynced.current) return;
    const t = setTimeout(() => {
      lastSynced.current = key;
      try {
        sessionStorage.setItem(storeKey, key);
      } catch {
        /* abaikan */
      }
      syncCartAction(payload).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [items, status, isCustomer, userId]);

  // Hitung ulang promo ketika isi keranjang berubah
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      revalidateDiscount().catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [items, revalidateDiscount]);

  return null;
}
