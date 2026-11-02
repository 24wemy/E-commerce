'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelMyOrderAction } from '@/actions/checkout';

export function CancelMyOrderButton({ orderNumber }: { orderNumber: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();
  return (
    <div className="text-center">
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          const r = await cancelMyOrderAction(orderNumber);
          setLoading(false);
          if (r.success) router.refresh();
          else setMsg(r.error ?? 'Gagal membatalkan');
        }}
        className="text-xs text-red-600 underline disabled:opacity-50"
      >
        {loading ? 'Membatalkan...' : 'Batalkan pesanan ini'}
      </button>
      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  );
}
