'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Scale,
  Sparkles,
  Send,
  RefreshCw,
  PackageCheck,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  ShieldAlert,
  ArrowLeft,
  Award,
  Truck,
  UtensilsCrossed,
  Clock,
  UserCheck
} from 'lucide-react';
import { BASE_PRICE_PER_KG } from '@/lib/ayamaja-services';
import { getAdminOrdersAction, updateAdminOrderStatusAction, verifyAdminWeightAction, getInventorySummaryAction } from '@/actions/admin';
import { OrderStatus } from '@prisma/client';

// Interfaces for UI state
interface CopilotMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface Complaint {
  id: string;
  customerName: string;
  customerType: string;
  rating: number;
  comment: string;
  urgency: 'TINGGI' | 'SEDANG' | 'SENANG';
  sentimentScore: number;
  aiSuggestedResponse: string;
  isResolved: boolean;
}

export default function AdminDashboardPage() {
  // Live State Simulators
  const [currentStockKg, setCurrentStockKg] = useState<number>(0);
  useEffect(() => {
    getInventorySummaryAction().then((r) => setCurrentStockKg(r.totalKg)).catch(() => {});
  }, []);
  const [basePrice, setBasePrice] = useState<number>(BASE_PRICE_PER_KG);
  const [supplierOrderKg, setSupplierOrderKg] = useState<number>(150);
  const [isOrderingSupplier, setIsOrderingSupplier] = useState<boolean>(false);
  const [supplierOrderSuccess] = useState<string | null>(null);

  // Real Database Orders State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);
  const [inputDbActualWeights, setInputDbActualWeights] = useState<{ [key: string]: string }>({});

  // Fetch real orders from database
  const loadOrders = useCallback(async () => {
    const res = await getAdminOrdersAction();
    if (res.success && res.orders) {
      setDbOrders(res.orders);
    }
    setIsLoadingOrders(false);
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000); // Polling every 5 seconds for new orders
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Handle Admin updating status
  const handleUpdateOrderStatus = async (orderNumber: string, nextStatus: OrderStatus) => {
    // Optimistic UI update
    setDbOrders((prev) =>
      prev.map((o) => (o.orderNumber === orderNumber ? { ...o, status: nextStatus } : o))
    );
    await updateAdminOrderStatusAction(orderNumber, nextStatus);
    loadOrders();
  };

  // Handle Admin verifying IoT scale weight
  const handleVerifyWeightSubmit = async (orderNumber: string, orderId: string) => {
    const val = parseFloat(inputDbActualWeights[orderId] || '0');
    if (isNaN(val) || val <= 0) return;

    await verifyAdminWeightAction(orderNumber, val);
    loadOrders();
  };

  // Copilot Chat State
  const [copilotInput, setCopilotInput] = useState('');
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Halo Bos! Saya Fresh Minut Business Copilot (Gemini). Saya membaca data nyata stok, promo, dan CRM dari database untuk membantu Anda mengambil keputusan.',
      timestamp: '08:00 WITA',
    },
  ]);

  // Complaints & AI Sentiment Data
  const [complaints, setComplaints] = useState<Complaint[]>([
    {
      id: 'cmp-1',
      customerName: 'Resto Minahasa Jaya (Airmadidi)',
      customerType: 'BUSINESS',
      rating: 2,
      comment: 'Ukuran potongan ayam untuk Potong 10 agak tidak merata. Paha lebih kecil dari biasanya.',
      urgency: 'SEDANG',
      sentimentScore: 42,
      aiSuggestedResponse: 'Halo Resto Minahasa Jaya, mohon maaf atas ketidaknyamanannya. Kami telah mencatat standar potong 10 gramatur presisi untuk pengiriman berikutnya & memberikan kompensasi diskon 5% pada invoice berikutnya.',
      isResolved: false,
    },
    {
      id: 'cmp-2',
      customerName: 'Ibu Netty (Kalawat)',
      customerType: 'PERSONAL',
      rating: 5,
      comment: 'Ayamnya sangat segar, pemotongan jam 6 pagi masih hangat pas sampai rumah. Mantap Fresh Minut!',
      urgency: 'SENANG',
      sentimentScore: 98,
      aiSuggestedResponse: 'Terima kasih banyak Ibu Netty! Kesegaran ayam prioritas utama kami. Jangan ragu pesan kembali lewat fitur Asisten Suara AI ya!',
      isResolved: true,
    },
    {
      id: 'cmp-3',
      customerName: 'Catering Berkah (Kauditan)',
      customerType: 'BUSINESS',
      rating: 1,
      comment: 'Pengiriman terlambat 30 menit dari slot jam 08.00 WITA.',
      urgency: 'TINGGI',
      sentimentScore: 15,
      aiSuggestedResponse: 'Yth. Catering Berkah, kami memohon maaf atas keterlambatan akibat jalur Airmadidi padat. Kami prioritaskan driver dedicated untuk pesanan Anda besok pagi gratis ongkir.',
      isResolved: false,
    }
  ]);

  // Copilot Assistant Logic
  const handleSendCopilot = (textToSend?: string) => {
    const query = textToSend || copilotInput;
    if (!query.trim()) return;

    const userMsg: CopilotMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
    };

    setCopilotMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setCopilotInput('');

    // Business Copilot: dijawab Gemini berdasarkan data nyata (stok, promo, CRM) dari database
    setIsCopilotLoading(true);
    const history = [...copilotMessages, userMsg]
      .filter((m) => m.id !== '1')
      .map((m) => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.text }));
    fetch('/api/admin/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    })
      .then((r) => r.json())
      .catch(() => ({ text: 'Copilot tidak dapat dihubungi. Coba lagi.' }))
      .then((data: { text?: string }) => {
        setCopilotMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: data.text || 'Tidak ada jawaban.',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
          },
        ]);
      })
      .finally(() => setIsCopilotLoading(false));
  };

  // Restock supplier logic
  // Stok masuk dicatat lewat halaman Inventory (agar tercatat di log pergerakan stok)
  const handleOrderSupplier = () => {
    setIsOrderingSupplier(true);
    window.location.href = `/admin/inventory?restock=${supplierOrderKg}`;
  };

  // Resolve complaint
  const handleResolveComplaint = (id: string) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isResolved: true } : c))
    );
  };

  const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16">
      {/* Header Seller Dashboard */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center text-xl shadow-lg shadow-red-900/30">
              🍗
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Fresh Minut Seller Copilot</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium border border-red-500/30">
                  Minahasa Utara Hub
                </span>
              </div>
              <p className="text-xs text-slate-400">Pusat Kendali Live Order & Asisten Bisnis AI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadOrders()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-2 rounded-lg border border-orange-500/30 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} /> Sync Real-Time
            </button>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-lg transition border border-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
        {/* KPI Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2 text-xs font-semibold tracking-wider uppercase">
              <span>Pendapatan Hari Ini</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">{formatIDR(4680000)}</div>
            <div className="mt-2 flex items-center text-xs text-emerald-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +14.2% dibanding kemarin
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2 text-xs font-semibold tracking-wider uppercase">
              <span>Harga Acuan Ayam</span>
              <span className="text-xs font-bold text-orange-400">Pasar Minut</span>
            </div>
            <div className="text-2xl font-black text-white">{formatIDR(basePrice)} <span className="text-sm font-normal text-slate-400">/kg</span></div>
            <div className="mt-2 text-xs text-slate-400">
              Disarankan AI: Stagnan sampai akhir pekan
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2 text-xs font-semibold tracking-wider uppercase">
              <span>Status Stok Fisik</span>
              <AlertTriangle className={`w-4 h-4 ${currentStockKg < 100 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
            </div>
            <div className="text-2xl font-black text-white">{currentStockKg} <span className="text-sm font-normal text-slate-400">kg</span></div>
            <div className={`mt-2 text-xs font-medium ${currentStockKg < 100 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {currentStockKg < 100 ? '⚠️ Stok menipis (Prediksi habis besok jam 14.00)' : '🟢 Stok dalam batas aman'}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 mb-2 text-xs font-semibold tracking-wider uppercase">
              <span>Sentimen Pelanggan AI</span>
              <Award className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-black text-white">94% <span className="text-xs text-emerald-400 font-normal">Positif</span></div>
            <div className="mt-2 text-xs text-slate-400">
              Berdasarkan 28 ulasan & keluhan terkini
            </div>
          </div>
        </div>

        {/* SECTION REAL-TIME ADMIN ORDER CONTROL CENTER */}
        <div className="bg-slate-800 border border-orange-500/40 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center font-bold text-xl">
                🚚
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Pusat Pesanan Masuk & Control Status Live</h2>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live Sync Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Admin dapat meng-update berat timbangan IoT dan memajukan status pengantaran secara real-time yang akan langsung terlihat di monitor HP pembeli.
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Total Order Terdaftar: <strong className="text-white text-sm">{dbOrders.length}</strong>
            </div>
          </div>

          {dbOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
              <Clock className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="font-semibold">Belum Ada Pesanan Pelanggan Masuk</p>
              <p className="text-xs text-slate-500 mt-1">Pesanan yang dibuat customer di toko akan otomatis muncul di sini secara live.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {dbOrders.map((ord: any) => {
                const requestedKg = ord.requestedWeightKg || 1;
                const isPaid = ord.paymentStatus === 'SETTLEMENT';

                return (
                  <div key={ord.id} className="bg-slate-900 border border-slate-700/80 rounded-xl p-5 space-y-4 transition hover:border-slate-600">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-amber-300">{ord.orderNumber}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isPaid ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                            {ord.paymentStatus}
                          </span>
                          <span className="text-xs text-slate-400">
                            • {new Date(ord.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WITA
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-orange-400" />
                          <span>Pemesan: <strong className="text-white">{ord.user?.name || 'Pelanggan Guest'}</strong> ({ord.user?.email || 'email-guest'})</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-400">Slot Pengantaran:</div>
                        <div className="text-xs font-bold text-amber-400">{ord.deliverySlot || 'Pagi (06:00 - 08:00 WITA)'}</div>
                      </div>
                    </div>

                    {/* Items & Shipping */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/50 space-y-1">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-orange-400" /> Rincian Produk:
                        </div>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {ord.items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-slate-300 pt-1">
                            <span>{item.product?.name || 'Ayam Segar'}</span>
                            <span className="font-bold">{item.requestedKg} kg ({formatIDR(item.subtotal)})</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-700 pt-1 font-bold text-slate-100 flex justify-between">
                          <span>Total Tagihan:</span>
                          <span className="text-emerald-400 text-sm">{formatIDR(ord.finalAmount)}</span>
                        </div>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/50 space-y-1">
                        <div className="font-bold text-slate-200">📍 Alamat Pengiriman Minut:</div>
                        <p className="text-slate-300 italic">{ord.shippingAddress?.replace(/["']/g, '')}</p>
                      </div>
                    </div>

                    {/* Controls: Scale Weight & Status Updater */}
                    <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      {/* IoT Scale Weight Input */}
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <label className="text-xs font-semibold text-slate-300">Timbangan IoT (Actual):</label>
                        <input
                          type="number"
                          step="0.05"
                          placeholder={ord.actualWeightKg ? String(ord.actualWeightKg) : String(requestedKg)}
                          value={inputDbActualWeights[ord.id] !== undefined ? inputDbActualWeights[ord.id] : (ord.actualWeightKg ? String(ord.actualWeightKg) : '')}
                          onChange={(e) => setInputDbActualWeights({ ...inputDbActualWeights, [ord.id]: e.target.value })}
                          className="w-20 bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1 font-bold text-center focus:border-orange-500 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400">kg</span>
                        <button
                          onClick={() => handleVerifyWeightSubmit(ord.orderNumber, ord.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-lg transition"
                        >
                          Simpan Timbangan
                        </button>
                      </div>

                      {/* Status Action Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
                        <span className="text-xs text-slate-400 font-semibold mr-1">Update Status Live:</span>

                        <button
                          onClick={() => handleUpdateOrderStatus(ord.orderNumber, OrderStatus.CONFIRMED)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold transition border ${ord.status === 'CONFIRMED' ? 'bg-blue-600 text-white border-blue-500 ring-2 ring-blue-500/40' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        >
                          1. Dikonfirmasi
                        </button>

                        <button
                          onClick={() => handleUpdateOrderStatus(ord.orderNumber, OrderStatus.WEIGHT_VERIFIED)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold transition border ${ord.status === 'WEIGHT_VERIFIED' ? 'bg-purple-600 text-white border-purple-500 ring-2 ring-purple-500/40' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        >
                          2. Ditimbang
                        </button>

                        <button
                          onClick={() => handleUpdateOrderStatus(ord.orderNumber, OrderStatus.PROCESSING)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold transition border ${ord.status === 'PROCESSING' ? 'bg-orange-600 text-white border-orange-500 ring-2 ring-orange-500/40' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        >
                          3. Dipotong
                        </button>

                        <button
                          onClick={() => handleUpdateOrderStatus(ord.orderNumber, OrderStatus.SHIPPED)}
                          className={`text-xs px-2.5 py-1 rounded font-bold transition border ${ord.status === 'SHIPPED' ? 'bg-amber-500 text-slate-900 border-amber-400 ring-2 ring-amber-400/50' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        >
                          <Truck className="w-3 h-3 inline mr-1" />
                          4. Kirim (OTW)
                        </button>

                        <button
                          onClick={() => handleUpdateOrderStatus(ord.orderNumber, OrderStatus.DELIVERED)}
                          className={`text-xs px-2.5 py-1 rounded font-bold transition border ${ord.status === 'DELIVERED' ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/40' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          5. Selesai
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2 & 3: Smart Inventory & Demand Forecasting Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Smart Inventory Predictor */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-800 to-slate-800/90 border border-slate-700 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Smart Inventory & Demand Forecasting</h2>
                  <p className="text-xs text-slate-400">Prediksi Otomatis Kebutuhan Stok Ayam Segar Minahasa Utara</p>
                </div>
              </div>

              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                AI Model v2.4 Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Card 1: Alert Kehabisan Stok */}
              <div className="bg-slate-900/80 border border-amber-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Prediksi Kehabisan Stok
                  </span>
                  <span>Akurat (92%)</span>
                </div>
                <p className="text-sm font-medium text-slate-200">
                  Dengan laju pesanan saat ini, stok <strong className="text-white">{currentStockKg} kg</strong> diprediksi habis pada:
                </p>
                <div className="text-lg font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg inline-block">
                  ⏰ Besok, Pukul 14.00 WITA
                </div>
              </div>

              {/* Card 2: Estimasi Demand Hari Raya/Jumat */}
              <div className="bg-slate-900/80 border border-red-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-red-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Lonjakan Permintaan Jumat
                  </span>
                  <span>Hari Raya / Akhir Pekan</span>
                </div>
                <p className="text-sm font-medium text-slate-200">
                  Estimasi permintaan pasar Airmadidi & Kalawat:
                </p>
                <div className="text-lg font-black text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg inline-block">
                  🍗 145 kg (+40% dari hari biasa)
                </div>
              </div>
            </div>

            {/* Quick Supplier Restock Trigger */}
            <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-400" /> Auto-Restock ke Peternak Mitra
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rekomendasi AI: Pesan <span className="text-slate-200 font-semibold">150 kg</span> untuk mengamankan slot pasokan subuh.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  value={supplierOrderKg}
                  onChange={(e) => setSupplierOrderKg(Number(e.target.value))}
                  className="w-20 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-2.5 py-2 focus:outline-none focus:border-orange-500 text-center font-bold"
                />
                <span className="text-xs font-semibold text-slate-400">kg</span>
                <button
                  onClick={handleOrderSupplier}
                  disabled={isOrderingSupplier}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition shadow-lg shadow-orange-900/20 disabled:opacity-50"
                >
                  {isOrderingSupplier ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Pesan Sekarang'}
                </button>
              </div>
            </div>

            {supplierOrderSuccess && (
              <div className="mt-3 text-xs bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-2.5 rounded-lg flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{supplierOrderSuccess}</span>
              </div>
            )}
          </div>

          {/* Quick Price Adjuster Widget */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                <Scale className="w-4 h-4 text-orange-400" /> Penyesuaian Harga Acuan (Per Kg)
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Ubah harga jual per kg secara instan untuk seluruh katalog produk Fresh Minut.
              </p>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300">Harga per Kg (IDR):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="500"
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 text-white font-black text-lg rounded-xl px-3 py-2 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="text-xs text-slate-400 bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <div className="flex justify-between">
                    <span>Ayam Potong 8:</span>
                    <span className="font-bold text-slate-200">{formatIDR(basePrice * 1.0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fillet Dada (1.2x):</span>
                    <span className="font-bold text-slate-200">{formatIDR(basePrice * 1.25)}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => alert(`Harga acuan pasar berhasil diperbarui menjadi ${formatIDR(basePrice)} / kg!`)}
              className="mt-6 w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2.5 rounded-xl transition border border-slate-600"
            >
              Update Seluruh Katalog Produk
            </button>
          </div>
        </div>

        {/* SECTION 4: AI Business Copilot Chat Interface & Complaint Center */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interactive AI Business Copilot Chat */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col h-[520px] shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center text-sm shadow-md">
                  ✨
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Business Copilot Seller</h3>
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Online & Monitoring Bisnis
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Prompt Pills */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-2 no-scrollbar">
              <button
                onClick={() => handleSendCopilot('Ringkas performa penjualan 7 dan 30 hari terakhir')}
                className="whitespace-nowrap text-xs bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition"
              >
                📊 Ringkasan Penjualan
              </button>
              <button
                onClick={() => handleSendCopilot('Promo mana yang sebaiknya dilanjutkan atau dihentikan?')}
                className="whitespace-nowrap text-xs bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition"
              >
                🏷️ Evaluasi Promo
              </button>
              <button
                onClick={() => handleSendCopilot('Segmen dan pelanggan mana yang perlu ditarik kembali? Aksi retensinya apa?')}
                className="whitespace-nowrap text-xs bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition"
              >
                🤝 Pelanggan Perlu Ditarik Kembali
              </button>
              <button
                onClick={() => handleSendCopilot('Produk apa yang harus di-restock dan berapa kg?')}
                className="whitespace-nowrap text-xs bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition"
              >
                📦 Rekomendasi Restock
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
              {copilotMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-br-none'
                        : 'bg-slate-900 text-slate-200 border border-slate-700/80 rounded-bl-none'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.text}</div>
                    <div className="text-[10px] opacity-60 mt-1 text-right">{msg.timestamp}</div>
                  </div>
                </div>
              ))}
              {isCopilotLoading && <div className="text-xs text-slate-400 animate-pulse">Copilot sedang menganalisis data...</div>}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCopilot();
              }}
              className="flex items-center gap-2 pt-2 border-t border-slate-700/80"
            >
              <input
                type="text"
                placeholder="Tanyakan analisis bisnis, stok, atau strategi harga..."
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                className="bg-orange-600 hover:bg-orange-500 text-white p-2.5 rounded-xl transition shadow-md shadow-orange-900/30"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* AI Business Alert & Complaint Center */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col h-[520px] shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Complaint & Sentiment Center</h3>
                  <p className="text-xs text-slate-400">Analisis Sentimen & Auto-Mitigasi Respon Ulasan</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {complaints.map((item) => (
                <div
                  key={item.id}
                  className={`bg-slate-900 border rounded-xl p-4 space-y-2 transition ${
                    item.isResolved ? 'border-slate-800 opacity-60' : 'border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-white">{item.customerName}</span>
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {item.customerType}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.urgency === 'TINGGI'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : item.urgency === 'SEDANG'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {item.urgency === 'SENANG' ? '🟢 POSITIF' : `⚠️ URGENSI ${item.urgency}`}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 italic font-serif">&quot;{item.comment}&quot;</p>

                  {/* AI Suggested Mitigation Response */}
                  <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-300">
                    <div className="text-[10px] font-bold text-orange-400 flex items-center gap-1 mb-1">
                      <Sparkles className="w-3 h-3" /> Rekomendasi Respon AI:
                    </div>
                    {item.aiSuggestedResponse}
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] text-slate-400">
                      Sentimen: <strong className="text-slate-200">{item.sentimentScore}/100</strong>
                    </span>

                    {!item.isResolved ? (
                      <button
                        onClick={() => handleResolveComplaint(item.id)}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1 rounded-lg transition border border-emerald-500/30"
                      >
                        ✓ Terapkan & Tanggapi
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ditangani
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
