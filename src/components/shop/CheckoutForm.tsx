'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/stores/use-cart-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { createCheckoutSessionAction } from '@/actions/checkout';
import { SnapPayButton } from '@/components/shop/SnapPayButton';
import { GamificationBanner } from '@/components/shop/GamificationBanner';
import { Tag, CheckCircle2, AlertCircle, X, Building2, FileText, LogIn } from 'lucide-react';
import { formatIDR, formatKg, PAYMENT_EXPIRY_MINUTES, quoteDelivery } from '@/lib/business-rules';
import { EXPRESS } from '@/lib/schedule';
import { getMyCheckoutDefaultsAction } from '@/actions/checkout';
import { FulfillmentPicker, FulfillmentState, initialFulfillment } from '@/components/shop/FulfillmentPicker';

type Summary = {
  lines: Array<{ name: string; quantityKg: number; pricePerKg: number; lineTotal: number }>;
  subtotal: number;
  shippingFee: number;
  expressFee: number;
  slotLabel: string | null;
  discountAmount: number;
  shippingDiscount: number;
  promoCode: string | null;
  finalAmount: number;
  fulfillment: 'DELIVERY' | 'PICKUP';
};

export function CheckoutForm() {
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();
  const [isBusiness, setIsBusiness] = useState(false);
  const mode = isBusiness ? 'B2B' : 'CONSUMER';
  const {
    items,
    totalPrice,
    appliedDiscount,
    promoError,
    applyDiscountCode,
    removeDiscountCode,
    discountAmount,
    shippingFee,
    finalPrice,
    clearCart,
    setFulfillment,
    revalidateDiscount,
  } = useCartStore();

  const [formData, setFormData] = useState({ name: '', phone: '', businessName: '', requestTaxInvoice: false });
  const [ful, setFul] = useState<FulfillmentState>(() => initialFulfillment());
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapData, setSnapData] = useState<{ token: string; orderNumber: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => setMounted(true), []);

  // Isi otomatis dari profil: nama, HP, dan alamat + titik peta terakhir
  useEffect(() => {
    if (status !== 'authenticated' || defaultsLoaded) return;
    setDefaultsLoaded(true);
    getMyCheckoutDefaultsAction().then((d) => {
      if (!d) return;
      setFormData((f) => ({ ...f, name: f.name || d.name, phone: f.phone || d.phone || '', businessName: f.businessName || d.businessName || '' }));
      if (d.addressLat != null && d.addressLng != null) {
        setFul(initialFulfillment({ lat: d.addressLat, lng: d.addressLng, address: d.address, note: d.addressNote }));
      } else if (d.address) {
        setFul((v) => ({ ...v, address: d.address ?? '' }));
      }
    });
  }, [status, defaultsLoaded]);

  // Ongkir ikut berubah sesuai metode & titik peta; diskon promo dihitung ulang oleh server
  const quote = ful.method === 'DELIVERY' && ful.hasPin ? quoteDelivery(ful.lat, ful.lng) : null;
  const isExpressSel = ful.method === 'DELIVERY' && ful.deliverySlot === 'EXPRESS';
  const feeKey = (ful.method === 'PICKUP' ? 'P' : quote?.ok ? `D${quote.fee}` : 'D?') + (isExpressSel ? 'X' : '');
  useEffect(() => {
    setFulfillment({
      method: ful.method,
      lat: ful.method === 'DELIVERY' && ful.hasPin ? ful.lat : undefined,
      lng: ful.method === 'DELIVERY' && ful.hasPin ? ful.lng : undefined,
      fee: ful.method === 'PICKUP' ? 0 : quote?.ok ? quote.fee : null,
      expressFee: isExpressSel ? EXPRESS.fee : 0,
    });
    revalidateDiscount().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeKey]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setApplying(true);
    const res = await applyDiscountCode(couponInput);
    setApplying(false);
    setCouponMsg({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setCouponInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (ful.method === 'DELIVERY') {
      if (!ful.hasPin) return setError('Tentukan titik lokasi pengantaran di peta terlebih dahulu.');
      if (quote && !quote.ok) return setError(quote.error);
      if (!ful.deliverySlot) return setError('Pilih jadwal pengantaran.');
    } else if (!ful.pickupSlot) {
      return setError('Pilih jadwal ambil di toko.');
    }
    setLoading(true);
    setError('');
    const res = await createCheckoutSessionAction({
      items: items.map((i) => ({ productId: i.id, quantityKg: i.quantity })),
      customer: {
        name: formData.name,
        phone: formData.phone,
        businessName: mode === 'B2B' && formData.businessName ? formData.businessName : undefined,
        requestTaxInvoice: mode === 'B2B' ? formData.requestTaxInvoice : undefined,
      },
      fulfillment:
        ful.method === 'DELIVERY'
          ? { method: 'DELIVERY', lat: ful.lat, lng: ful.lng, address: ful.address, note: ful.note || undefined, slot: ful.deliverySlot }
          : { method: 'PICKUP', slot: ful.pickupSlot },
      promoCode: appliedDiscount?.code,
    });
    setLoading(false);
    if (res.success) {
      setSummary(res.summary);
      setSnapData({ token: res.snapToken, orderNumber: res.orderNumber });
      clearCart();
    } else {
      setError(res.error || 'Gagal membuat pesanan.');
    }
  };

  if (!mounted || status === 'loading') {
    return <Card className="p-8 text-center text-muted-foreground">Memuat checkout...</Card>;
  }

  if (items.length === 0 && !snapData) {
    return (
      <Card className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">Keranjang kamu kosong.</p>
        <Link href="/#katalog">
          <Button className="bg-daun-600 hover:bg-daun-700">Lihat Katalog</Button>
        </Link>
      </Card>
    );
  }

  if (!session?.user) {
    return (
      <Card className="p-8 text-center space-y-4 border-daun-200">
        <LogIn className="h-10 w-10 mx-auto text-daun-600" />
        <h2 className="text-lg font-bold">Login dulu untuk checkout</h2>
        <p className="text-sm text-muted-foreground">
          Akun dibutuhkan agar riwayat pesanan, poin loyalitas, dan promo khusus pelanggan tercatat. Keranjangmu tetap tersimpan.
        </p>
        <div className="flex gap-2 justify-center">
          <Link href="/login?callbackUrl=/checkout">
            <Button className="bg-daun-600 hover:bg-daun-700">Login</Button>
          </Link>
          <Link href="/register?callbackUrl=/checkout">
            <Button variant="outline">Daftar Akun Baru</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const lines = summary
    ? summary.lines
    : items.map((i) => ({ name: i.name, quantityKg: i.quantity, pricePerKg: i.price, lineTotal: Math.round(i.price * i.quantity) }));
  const subtotal = summary ? summary.subtotal : totalPrice();
  const discount = summary ? summary.discountAmount : discountAmount();
  const ongkir: number | null = summary ? summary.shippingFee - summary.shippingDiscount : shippingFee();
  const isPickup = summary ? summary.fulfillment === 'PICKUP' : ful.method === 'PICKUP';
  const express = summary ? summary.expressFee : isExpressSel ? EXPRESS.fee : 0;
  const total = summary ? summary.finalAmount : finalPrice();
  const code = summary ? summary.promoCode : appliedDiscount?.code;

  return (
    <div className="space-y-8">
      {!snapData && <GamificationBanner variant="banner" />}

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8 items-start">
        <Card className="border-slate-200 pt-0">
          <CardHeader className="bg-white border-b border-slate-200 px-6 py-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <span>Pengiriman & kontak</span>
              {mode === 'B2B' && (
                <span className="text-xs bg-daun-100 text-daun-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> B2B
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Cara terima pesanan</h3>
                <FulfillmentPicker value={ful} onChange={setFul} disabled={!!snapData} />
              </div>
              <h3 className="border-t border-slate-100 pt-4 text-sm font-semibold text-ink">Kontak penerima</h3>
              <div className="text-xs text-slate-500 bg-slate-50 border rounded-lg p-2">
                Login sebagai <strong>{session.user.email}</strong> — bukti pesanan dikirim ke email ini.
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block text-slate-700">Nama Penerima</label>
                <Input
                  required
                  disabled={!!snapData}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" disabled={!!snapData} checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} className="accent-daun-700" />
                Pembelian untuk usaha (warung, resto, katering)
              </label>
              {mode === 'B2B' && (
                <div className="bg-daun-50 border border-daun-200 p-3.5 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-daun-800 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" /> Informasi usaha
                  </div>
                  <Input
                    disabled={!!snapData}
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="Nama usaha / resto / catering"
                    className="bg-white text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!!snapData}
                      checked={formData.requestTaxInvoice}
                      onChange={(e) => setFormData({ ...formData, requestTaxInvoice: e.target.checked })}
                    />
                    <FileText className="w-3.5 h-3.5 text-daun-700" /> Minta faktur pajak
                  </label>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold mb-1 block text-slate-700">Nomor HP / WhatsApp</label>
                <Input
                  required
                  disabled={!!snapData}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="082199887766"
                />
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit border-slate-200 pt-0">
          <CardHeader className="bg-white border-b border-slate-200 px-6 py-4">
            <CardTitle className="text-xl font-bold text-slate-900">Ringkasan Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.name} className="flex justify-between gap-3 text-sm py-1 border-b border-slate-100">
                  <span>
                    {l.name} × <strong>{formatKg(l.quantityKg)}</strong>
                    <span className="block text-[11px] text-slate-400">{formatIDR(l.pricePerKg)}/kg</span>
                  </span>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">{formatIDR(l.lineTotal)}</span>
                </div>
              ))}
            </div>

            {!snapData && (
              <div className="pt-4 border-t space-y-3">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                  <Tag className="h-3.5 w-3.5 text-daun-600" /> Kode Promo
                </label>
                {appliedDiscount ? (
                  <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold text-emerald-950">{appliedDiscount.code}</div>
                        <div className="text-[11px] text-emerald-700">{appliedDiscount.description}</div>
                      </div>
                    </div>
                    <button onClick={removeDiscountCode} className="text-emerald-700 p-1" title="Hapus kode">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <Input
                      placeholder="Contoh: FRESHMINUT15"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="uppercase text-sm tracking-wide"
                    />
                    <Button type="submit" disabled={applying} variant="outline" className="border-daun-300 font-bold">
                      {applying ? 'Cek...' : 'Pasang'}
                    </Button>
                  </form>
                )}
                {(couponMsg || (promoError && !appliedDiscount)) && (
                  <div
                    className={`text-xs p-2 rounded-lg flex items-center gap-1.5 ${
                      couponMsg?.type === 'success' && appliedDiscount
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {couponMsg?.type === 'success' && appliedDiscount ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{appliedDiscount ? couponMsg?.text : promoError ?? couponMsg?.text}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal ({formatKg(lines.reduce((a, l) => a + l.quantityKg, 0))})</span>
                <span>{formatIDR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Diskon ({code})</span>
                  <span>-{formatIDR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>{isPickup ? 'Ambil di toko' : `Ongkos kirim${quote?.ok && !summary ? ` (${quote.distanceKm} km)` : ''}`}</span>
                <span>
                  {ongkir === null
                    ? 'Pilih lokasi di peta'
                    : ongkir === 0
                      ? isPickup
                        ? 'Gratis'
                        : `Gratis${code ? ` (${code})` : ''}`
                      : formatIDR(ongkir)}
                </span>
              </div>
              {express > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Biaya antar sekarang</span>
                  <span>{formatIDR(express)}</span>
                </div>
              )}
              {summary?.slotLabel && (
                <div className="flex justify-between gap-3 text-slate-500">
                  <span>Jadwal</span>
                  <span className="text-right">{summary.slotLabel}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-xl pt-2 text-daun-600 border-t">
                <span>Total Bayar</span>
                <span>{formatIDR(total)}</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pb-6">
            {error && (
              <div className="w-full text-sm bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {snapData ? (
              <div className="w-full space-y-2">
                <SnapPayButton snapToken={snapData.token} orderNumber={snapData.orderNumber} />
                <p className="text-xs text-center text-slate-500">
                  Order <strong>{snapData.orderNumber}</strong> dibuat. Selesaikan pembayaran dalam {PAYMENT_EXPIRY_MINUTES} menit.{' '}
                  <Link className="underline" href={`/orders/${snapData.orderNumber}`}>
                    Lihat detail
                  </Link>
                </p>
              </div>
            ) : (
              <Button
                type="submit"
                form="checkout-form"
                disabled={loading || items.length === 0}
                className="w-full bg-daun-700 hover:bg-daun-800 text-white font-bold py-6 text-base"
              >
                {loading ? 'Menyiapkan pembayaran...' : 'Lanjut ke Pembayaran Midtrans'}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
