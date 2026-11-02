'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { findMyOrderAction } from '@/actions/orders';

export function OrderClaimBar() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const res = await findMyOrderAction(orderNumber.trim());
    setLoading(false);

    if (res.success && res.orderNumber) {
      router.push(`/orders/${res.orderNumber}`);
    } else {
      setErrorMsg(res.error || 'Pesanan tidak ditemukan.');
    }
  };

  return (
    <div className="mb-5 space-y-2">
      <label htmlFor="cari-pesanan" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
        <Search className="w-4 h-4 text-slate-500" />
        Cari pesanan berdasarkan nomor
      </label>

      <form onSubmit={handleClaim} className="flex gap-2">
        <input
          id="cari-pesanan"
          type="text"
          placeholder="Contoh: FM-20261102-AB12CD"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          className="flex-1 bg-white border border-slate-300 text-ink text-sm rounded-lg px-3 py-2 uppercase focus:outline-none focus:border-daun-600 focus:ring-2 focus:ring-daun-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-daun-700 hover:bg-daun-800 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cari'}
        </button>
      </form>

      {errorMsg && (
        <div className="text-sm text-cabai-600">{errorMsg}</div>
      )}
    </div>
  );
}
