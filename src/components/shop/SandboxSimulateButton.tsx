'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { simulateSandboxPaymentAction, syncOrderStatusAction } from '@/actions/checkout';
import { useRouter } from 'next/navigation';

export function SandboxSimulateButton({ orderNumber }: { orderNumber: string }) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const handleSimulate = async () => {
    setLoading(true);
    const res = await simulateSandboxPaymentAction(orderNumber);
    setLoading(false);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || 'Gagal memproses simulasi pembayaran.');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const res = await syncOrderStatusAction(orderNumber);
    setSyncing(false);
    if (res.success && res.paymentStatus === 'SETTLEMENT') {
      router.refresh();
    } else {
      alert(
        res.paymentStatus === 'PENDING'
          ? 'Status pembayaran Midtrans masih PENDING. Silakan selesaikan di simulator atau klik tombol Konfirmasi Simulasi.'
          : res.error || 'Gagal mengecek status Midtrans.'
      );
    }
  };

  return (
    <div className="mt-4 p-4 border border-kunyit-200 bg-kunyit-50 rounded-lg space-y-3">
      <div className="flex items-center gap-2 text-ink font-semibold text-sm">
        <CheckCircle className="h-4 w-4 text-daun-600" /> Mode uji (Midtrans Sandbox)
      </div>
      <p className="text-xs text-kunyit-800 leading-relaxed">
        Sudah bayar lewat popup atau simulator Midtrans? Klik Cek status pembayaran. Tombol ini tidak tampil di mode produksi.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleSync}
          disabled={syncing || loading}
          variant="outline"
          className="border-kunyit-400 text-ink hover:bg-kunyit-100 text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Mengecek...' : 'Cek status pembayaran'}
        </Button>

        <Button
          onClick={handleSimulate}
          disabled={loading || syncing}
          variant="default"
          className="bg-white border border-kunyit-300 text-ink hover:bg-kunyit-100 text-xs font-semibold"
        >
          {loading ? 'Memproses...' : 'Tandai lunas (uji)'}
        </Button>

        <a
          href="https://simulator.sandbox.midtrans.com/openapi/va/index"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-ink border border-kunyit-300 rounded hover:bg-kunyit-100 transition-colors"
        >
          Simulator Midtrans <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      </div>
    </div>
  );
}
