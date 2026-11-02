/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    snap: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export function SnapPayButton({ snapToken, orderNumber }: { snapToken: string; orderNumber: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const snapUrl = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  const handlePay = () => {
    if (!window.snap) {
      console.error('Snap is not loaded');
      return;
    }
    
    setLoading(true);
    window.snap.pay(snapToken, {
      onSuccess: () => router.push(`/orders/${orderNumber}?status=success`),
      onPending: () => router.push(`/orders/${orderNumber}?status=pending`),
      onError: () => router.push(`/orders/${orderNumber}?status=failed`),
      onClose: () => setLoading(false),
    });
  };

  return (
    <>
      <Script
        src={snapUrl}
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="lazyOnload"
      />
      <Button onClick={handlePay} disabled={loading} className="w-full">
        {loading ? 'Membuka pembayaran...' : 'Bayar Sekarang (Midtrans)'}
      </Button>
    </>
  );
}
