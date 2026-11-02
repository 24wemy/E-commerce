'use client';

import { useState, useEffect } from 'react';
import { useCartStore } from '@/stores/use-cart-store';
import { MiniBakeGameModal } from '@/components/shop/MiniBakeGameModal';
import { HelpCircle, Gift, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GamificationBannerProps {
  variant?: 'banner' | 'compact' | 'floating';
}

export function GamificationBanner({ variant = 'banner' }: GamificationBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { totalPrice, appliedDiscount, hasPlayedGame } = useCartStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const subtotal = totalPrice();
  const isEligible = subtotal >= 100000;
  const neededAmount = Math.max(0, 100000 - subtotal);

  const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  if (variant === 'compact') {
    return (
      <>
        <div
          onClick={() => setIsModalOpen(true)}
          className={`cursor-pointer rounded-xl p-3.5 border transition-all flex items-center justify-between gap-3 shadow-sm ${
            isEligible
              ? 'bg-daun-700 hover:bg-daun-800 border-daun-400/60 hover:border-daun-500'
              : 'bg-daun-50/50 border-daun-200/60 hover:bg-daun-100/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isEligible ? 'bg-daun-800 text-daun-100' : 'bg-daun-200 text-daun-800'
              }`}
            >
              {isEligible ? <HelpCircle className="h-5 w-5 animate-pulse" /> : <Lock className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>Kuis Fresh Minut (Voucher Ayam Segar)</span>
                {isEligible && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${hasPlayedGame ? 'bg-daun-800 text-white' : 'bg-emerald-600 text-white'}`}>
                    {hasPlayedGame ? 'Sudah Dimainkan (1x)' : '1x Main'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {isEligible
                  ? hasPlayedGame
                    ? 'Lihat/Pasang voucher diskon hasil kuis Anda'
                    : 'Jawab kuis & buka voucher diskon rahasia Fresh Minut 1x sebelum bayar!'
                  : `Kurang ${formatIDR(neededAmount)} lagi untuk 1x kesempatan kuis`}
              </p>
            </div>
          </div>
          <Button size="sm" variant={isEligible ? 'default' : 'outline'} className={isEligible ? 'bg-daun-600 hover:bg-daun-700 text-white shrink-0' : 'border-daun-300 text-daun-900 shrink-0'}>
            {isEligible ? (hasPlayedGame ? 'Voucher' : 'Kuis') : 'Info'}
          </Button>
        </div>

        <MiniBakeGameModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  if (variant === 'floating') {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-daun-700 hover:bg-daun-800 text-white p-3.5 rounded-full shadow-2xl hover:scale-105 transition-all border-2 border-kunyit-300/40 flex items-center gap-2 group"
        >
          <div className="relative">
            <HelpCircle className="h-6 w-6 text-kunyit-300 group-hover:rotate-12 transition-transform" />
            {isEligible && !hasPlayedGame && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <span className="text-xs font-bold hidden sm:inline pr-1">
            {hasPlayedGame ? 'Voucher Diskon' : 'Kuis Fresh Minut'}
          </span>
        </button>

        <MiniBakeGameModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  // Default Banner Variant
  const title = appliedDiscount
    ? `Kode ${appliedDiscount.code} sedang dipakai`
    : hasPlayedGame
      ? 'Kuis sudah dimainkan'
      : 'Jawab 3 pertanyaan, dapat kode diskon hingga 15%';
  const desc = isEligible
    ? hasPlayedGame
      ? 'Kode hadiah kuis bisa dilihat dan dipasang kembali kapan saja sebelum bayar.'
      : 'Kesempatan 1 kali per keranjang. Kode langsung terpasang setelah kuis selesai.'
    : `Berlaku untuk belanja minimal Rp 100.000. Tambah ${formatIDR(neededAmount)} lagi untuk membuka kuis.`;
  return (
    <>
      <div className="w-full rounded-xl border border-kunyit-200 bg-kunyit-50 p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="h-11 w-11 shrink-0 rounded-lg bg-white border border-kunyit-200 grid place-items-center text-kunyit-700">
          {appliedDiscount || hasPlayedGame ? <CheckCircle2 className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          <p className="text-sm text-slate-600 mt-0.5">{desc}</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className={`shrink-0 font-semibold ${
            isEligible ? 'bg-daun-700 hover:bg-daun-800 text-white' : 'bg-white border border-slate-300 text-ink hover:bg-slate-50'
          }`}
        >
          {isEligible ? (
            hasPlayedGame ? 'Lihat kode' : 'Mulai kuis'
          ) : (
            <span className="flex items-center gap-1.5">
              <Lock className="h-4 w-4" /> Lihat syarat
            </span>
          )}
        </Button>
      </div>

      <MiniBakeGameModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
