/* eslint-disable no-console */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import type { PromotionType } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { refreshAllSegments } from '../src/lib/crm';
import { POINTS_PER_RUPIAH, STORE, quoteDelivery } from '../src/lib/business-rules';
import { EXPRESS, deliveryOptions, pickupOptions } from '../src/lib/schedule';

// ---------- util deterministik (hasil seed selalu sama) ----------
let seed = 20261102;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (d: number, hour = between(6, 19)) => {
  const t = new Date(now - d * DAY);
  t.setHours(hour, between(0, 59), 0, 0);
  return t;
};

const IMG = {
  broiler: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=800&q=80',
  fillet: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80',
  paha: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=800&q=80',
  jeroan: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
};

// finalStock = stok yang tersisa SETELAH semua order seed (stok awal dihitung mundur)
const PRODUCTS = [
  { sku: 'AYM-BRL-001', slug: 'ayam-broiler-segar', name: 'Ayam Broiler Segar', category: 'AYAM_SEGAR', price: 36000, final: 120, min: 30, lead: 1, img: IMG.broiler, desc: 'Dipotong fresh setiap jam 04:00 WITA dari peternakan lokal Minahasa Utara. Bebas pengawet.' },
  { sku: 'AYM-FIL-002', slug: 'dada-ayam-fillet', name: 'Dada Ayam Fillet Segar', category: 'PART_CUT', price: 48000, final: 45, min: 10, lead: 1, img: IMG.fillet, desc: '100% daging dada bersih tanpa tulang & lemak. Tinggi protein untuk resto & diet.' },
  { sku: 'AYM-PHA-003', slug: 'paha-ayam-segar', name: 'Paha Ayam Segar (Atas & Bawah)', category: 'PART_CUT', price: 42000, final: 55, min: 10, lead: 1, img: IMG.paha, desc: 'Juicy dan empuk, pas untuk ayam goreng krispi & Ayam Woku Belanga.' },
  { sku: 'AYM-HAT-004', slug: 'hati-ampela-segar', name: 'Hati & Ampela Ayam Segar', category: 'JEROAN', price: 20000, final: 25, min: 5, lead: 1, img: IMG.jeroan, desc: 'Jeroan ayam bersih & segar, dipotong subuh, bebas bau amis.' },
  { sku: 'AYM-KMP-005', slug: 'ayam-kampung-segar', name: 'Ayam Kampung Segar Utuh', category: 'AYAM_KAMPUNG', price: 65000, final: 5, min: 3, lead: 3, img: IMG.broiler, desc: 'Ayam kampung asli peternakan lokal, cocok untuk Tinutuan atau Ayam Garam. (Produk demo: stok 5 kg, minimum 3 kg)' },
  { sku: 'AYM-SYP-006', slug: 'sayap-ayam-segar', name: 'Sayap Ayam Segar', category: 'PART_CUT', price: 38000, final: 30, min: 8, lead: 1, img: IMG.paha, desc: 'Sayap ayam utuh, favorit untuk spicy wings & ayam bakar rica.' },
  { sku: 'AYM-CKR-007', slug: 'ceker-ayam-bersih', name: 'Ceker Ayam Bersih', category: 'JEROAN', price: 22000, final: 20, min: 5, lead: 1, img: IMG.jeroan, desc: 'Ceker sudah dibersihkan & dipotong kuku, siap dimasak.' },
  { sku: 'AYM-PHF-008', slug: 'paha-fillet-boneless', name: 'Paha Fillet Boneless', category: 'PART_CUT', price: 52000, final: 28, min: 6, lead: 2, img: IMG.fillet, desc: 'Paha tanpa tulang, lebih juicy dari dada — cocok untuk katsu & teriyaki.' },
  { sku: 'AYM-GPK-009', slug: 'potongan-ayam-geprek', name: 'Potongan Ayam Geprek', category: 'PART_CUT', price: 40000, final: 35, min: 8, lead: 1, img: IMG.paha, desc: 'Potongan dada & paha ukuran geprek, siap tepung.' },
  { sku: 'AYM-KLT-010', slug: 'kulit-ayam-segar', name: 'Kulit Ayam Segar', category: 'JEROAN', price: 18000, final: 15, min: 4, lead: 1, img: IMG.jeroan, desc: 'Kulit ayam segar untuk kulit krispi.' },
  { sku: 'AYM-TLG-011', slug: 'kerangka-ayam-kaldu', name: 'Kerangka Ayam (Kaldu)', category: 'JEROAN', price: 12000, final: 20, min: 5, lead: 1, img: IMG.jeroan, desc: 'Tulang & kerangka ayam untuk kaldu sup dan tinutuan.' },
  { sku: 'AYM-PJN-012', slug: 'ayam-pejantan-utuh', name: 'Ayam Pejantan Utuh', category: 'AYAM_KAMPUNG', price: 55000, final: 18, min: 5, lead: 3, img: IMG.broiler, desc: 'Ayam pejantan, tekstur mirip kampung dengan harga lebih hemat.' },
  { sku: 'OLH-NGT-013', slug: 'nugget-ayam-homemade', name: 'Nugget Ayam Homemade', category: 'OLAHAN', price: 60000, final: 22, min: 5, lead: 2, img: IMG.fillet, desc: 'Nugget dari dada ayam asli tanpa pengawet. Beku, tahan 1 bulan.' },
  { sku: 'OLH-SOS-014', slug: 'sosis-ayam', name: 'Sosis Ayam', category: 'OLAHAN', price: 58000, final: 20, min: 5, lead: 2, img: IMG.paha, desc: 'Sosis ayam homemade untuk sarapan & bekal.' },
  { sku: 'OLH-BKS-015', slug: 'bakso-ayam', name: 'Bakso Ayam', category: 'OLAHAN', price: 55000, final: 18, min: 5, lead: 2, img: IMG.fillet, desc: 'Bakso ayam kenyal, 1 kg ± 50 butir.' },
  { sku: 'OLH-WOK-016', slug: 'ayam-woku-siap-masak', name: 'Ayam Woku Bumbu Siap Masak', category: 'OLAHAN', price: 70000, final: 15, min: 4, lead: 2, img: IMG.paha, desc: 'Ayam potong + bumbu woku khas Manado, tinggal masak 20 menit.' },
  { sku: 'TLR-NGR-017', slug: 'telur-ayam-negeri', name: 'Telur Ayam Negeri', category: 'TELUR', price: 29000, final: 60, min: 15, lead: 2, img: IMG.jeroan, desc: 'Telur ayam negeri segar per kg (± 16 butir).' },
  { sku: 'TLR-KMP-018', slug: 'telur-ayam-kampung', name: 'Telur Ayam Kampung', category: 'TELUR', price: 48000, final: 20, min: 5, lead: 3, img: IMG.jeroan, desc: 'Telur ayam kampung asli per kg (± 22 butir).' },
  { sku: 'BMB-RCA-019', slug: 'bumbu-rica-manado', name: 'Bumbu Rica-Rica Manado', category: 'BUMBU', price: 85000, final: 10, min: 2, lead: 5, img: IMG.paha, desc: 'Bumbu rica-rica pedas khas Manado, siap pakai.' },
  { sku: 'BMB-WKU-020', slug: 'bumbu-woku-belanga', name: 'Bumbu Woku Belanga', category: 'BUMBU', price: 80000, final: 10, min: 2, lead: 5, img: IMG.paha, desc: 'Bumbu woku dengan daun kemangi & serai, siap pakai.' },
];
// Produk yang tidak diikutkan ke order seed (agar laporan slow-moving & stok demo jelas)
const NOT_SOLD = new Set(['AYM-KMP-005', 'BMB-RCA-019', 'BMB-WKU-020']);

const CUSTOMER_NAMES = [
  'Nathan Tambuku', 'Resto Minahasa Jaya', 'Grace Lumowa', 'Jefry Wenas', 'Meiske Rondonuwu', 'Stevanus Kalalo',
  'Debby Pangemanan', 'Rio Tumbelaka', 'Vanessa Supit', 'Frangky Mamesah', 'Novita Sumual', 'Hendra Lengkong',
  'Christy Walangitan', 'Albert Runtuwene', 'Yolanda Tumewu', 'Ferry Kaunang', 'Inggrid Lasut', 'Marcel Mandagi',
  'Selvi Polii', 'Robby Karundeng', 'Anneke Sondakh', 'Billy Rumengan', 'Tirza Pantow', 'Kevin Manoppo',
  'Warung Mbak Ani', 'Prisilia Tangkudung', 'Daniel Wowor', 'Gabriella Rorong', 'Catering Kasih Ibu', 'Rendy Tuwaidan',
];

// Rencana order per pelanggan -> menghasilkan segmen yang jelas
// [jumlah order dibayar, rentang hari order (min,max) dari sekarang]
type Plan = { paid: number; range: [number, number]; extra?: 'expired' | 'cancelled' };
const PLANS: Plan[] = [
  ...Array(6).fill(null).map((_, i) => ({ paid: [4, 5, 3, 4, 3, 3][i], range: [2, 55] as [number, number] })), // LOYAL
  ...Array(6).fill(null).map(() => ({ paid: 2, range: [5, 50] as [number, number] })), // REGULAR
  ...Array(6).fill(null).map((_, i) => ({ paid: 1, range: [3, 40] as [number, number], extra: i === 0 ? ('cancelled' as const) : undefined })), // NEW
  ...Array(6).fill(null).map((_, i) => ({ paid: i % 2 ? 2 : 1, range: [70, 150] as [number, number] })), // INACTIVE
  ...Array(6).fill(null).map((_, i) => ({ paid: 0, range: [1, 20] as [number, number], extra: i < 2 ? ('expired' as const) : undefined })), // PROSPECT
];

const PROMOS: Array<{
  code: string; name: string; type: PromotionType; value: number; maxDiscount?: number; minOrder: number;
  start: number; end: number; quota?: number; perCustomer?: number | null; description: string;
}> = [
  { code: 'FRESHMINUT15', name: 'Hadiah Kuis Fresh Minut 15%', type: 'PERCENTAGE', value: 15, maxDiscount: 50000, minOrder: 100000, start: -120, end: 60, quota: 300, perCustomer: 3, description: 'Kode hadiah kuis gamifikasi.' },
  { code: 'FRESHMINUT10', name: 'Diskon Spesial 10%', type: 'PERCENTAGE', value: 10, maxDiscount: 30000, minOrder: 100000, start: -120, end: 60, quota: 300, perCustomer: 3, description: 'Kode hadiah kuis gamifikasi (skor rendah).' },
  { code: 'MINUT20K', name: 'Potongan Rp 20.000', type: 'FIXED_AMOUNT', value: 20000, minOrder: 100000, start: -120, end: 60, quota: 150, perCustomer: 2, description: 'Voucher nominal untuk pelanggan.' },
  { code: 'GROSIRB2B15', name: 'Grosir B2B 15%', type: 'PERCENTAGE', value: 15, minOrder: 300000, start: -150, end: 120, perCustomer: null, description: 'Diskon grosir untuk resto/warung/catering.' },
  { code: 'ONGKIRFREE', name: 'Gratis Ongkir', type: 'FREE_SHIPPING', value: 0, minOrder: 150000, start: -150, end: 90, quota: 500, perCustomer: 5, description: 'Gratis ongkos kirim minimal belanja Rp 150.000.' },
  { code: 'FLASHSUBUH', name: 'Flash Sale Subuh 25%', type: 'FLASH_SALE', value: 25, maxDiscount: 40000, minOrder: 50000, start: 0, end: 2, quota: 20, perCustomer: 1, description: 'Flash sale terbatas 48 jam.' },
  { code: 'MERDEKA17', name: 'Promo Kemerdekaan 17%', type: 'PERCENTAGE', value: 17, minOrder: 50000, start: -90, end: -75, quota: 100, perCustomer: 1, description: 'Promo yang sudah kedaluwarsa (untuk demo penolakan).' },
];

async function main() {
  console.log('🧹 Menghapus data lama...');
  await prisma.orderStatusHistory.deleteMany();
  await prisma.campaignRecipient.deleteMany();
  await prisma.retentionCampaign.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.promoUsage.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.digitalReceipt.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.review.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.customerPreference.deleteMany();
  await prisma.order.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.cutOption.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  console.log('👤 Membuat admin & pelanggan...');
  const [adminHash, userHash] = await Promise.all([bcrypt.hash('admin123', 10), bcrypt.hash('user123', 10)]);
  const admin = await prisma.user.create({
    data: { id: 'usr-admin', name: 'Admin Fresh Minut', email: 'admin@freshminut.com', passwordHash: adminHash, role: 'ADMIN', customerType: 'BUSINESS' },
  });

  const customers = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const name = CUSTOMER_NAMES[i];
    const isBiz = /Resto|Warung|Catering/.test(name);
    const plan = PLANS[i];
    const registered = Math.max(plan.range[1] + between(3, 30), i >= 24 ? between(1, 25) : 0);
    const email =
      i === 0 ? 'nathantambuku13@gmail.com' : `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@contoh.id`;
    customers.push(
      await prisma.user.create({
        data: {
          id: `usr-c${String(i + 1).padStart(2, '0')}`,
          name,
          email,
          passwordHash: userHash,
          role: 'CUSTOMER',
          customerType: isBiz ? 'BUSINESS' : 'PERSONAL',
          businessName: isBiz ? name : null,
          phone: `08${between(1100000000, 5999999999)}`,
          address: pick(['Airmadidi', 'Kalawat', 'Kauditan', 'Dimembe', 'Sukur', 'Sawangan', 'Maumbi']) + `, Jl. Contoh No. ${between(1, 99)}`,
          // Titik rumah/usaha acak dalam ±6 km dari toko (koordinat contoh)
          addressLat: Math.round((STORE.lat + (rand() - 0.5) * 0.11) * 1e5) / 1e5,
          addressLng: Math.round((STORE.lng + (rand() - 0.5) * 0.11) * 1e5) / 1e5,
          createdAt: daysAgo(registered),
        },
      })
    );
  }

  console.log('🏷️  Membuat promo...');
  const promoMap = new Map<string, { id: string; p: (typeof PROMOS)[number] }>();
  for (const p of PROMOS) {
    const startsAt = p.start === 0 ? new Date(now - 3600_000) : new Date(now + p.start * DAY);
    const created = await prisma.promotion.create({
      data: {
        code: p.code,
        name: p.name,
        description: p.description,
        type: p.type,
        value: p.value,
        maxDiscount: p.maxDiscount ?? null,
        minOrder: p.minOrder,
        startsAt,
        endsAt: new Date(now + p.end * DAY),
        quota: p.quota ?? null,
        perCustomerLimit: p.perCustomer === undefined ? 1 : p.perCustomer,
        isActive: true,
      },
    });
    promoMap.set(p.code, { id: created.id, p });
  }

  console.log('📦 Membuat produk...');
  const products = [];
  for (const p of PRODUCTS) {
    products.push(
      await prisma.product.create({
        data: {
          sku: p.sku,
          slug: p.slug,
          name: p.name,
          description: p.desc,
          category: p.category,
          pricePerKg: p.price,
          stockKg: 0,
          minStockKg: p.min,
          leadTimeDays: p.lead,
          images: [p.img],
          createdAt: daysAgo(160),
        },
      })
    );
  }
  const sellable = products.filter((p) => !NOT_SOLD.has(p.sku));

  console.log('🧾 Menyusun order...');
  type Draft = {
    userIdx: number;
    at: Date;
    items: Array<{ productId: string; kg: number; price: number }>;
    paid: boolean;
    kind: 'paid' | 'expired' | 'cancelled';
  };
  const drafts: Draft[] = [];
  PLANS.forEach((plan, idx) => {
    const isBiz = customers[idx].customerType === 'BUSINESS';
    const dayList = Array.from({ length: plan.paid }, () => between(plan.range[0], plan.range[1])).sort((a, b) => b - a);
    const mk = (d: number, kind: Draft['kind']): Draft => {
      const n = between(1, 3);
      const chosen = new Set<string>();
      const items: Draft['items'] = [];
      while (items.length < n) {
        const p = pick(sellable);
        if (chosen.has(p.id)) continue;
        chosen.add(p.id);
        const kg = isBiz ? between(8, 20) : between(2, 8) / 2 + 0.5 * between(0, 1);
        items.push({ productId: p.id, kg: Math.round(kg * 2) / 2, price: p.pricePerKg });
      }
      return { userIdx: idx, at: daysAgo(d), items, paid: kind === 'paid', kind };
    };
    dayList.forEach((d) => drafts.push(mk(d, 'paid')));
    if (plan.extra === 'expired') drafts.push(mk(between(2, 10), 'expired'));
    if (plan.extra === 'cancelled') drafts.push(mk(between(5, 15), 'cancelled'));
  });
  drafts.sort((a, b) => a.at.getTime() - b.at.getTime());

  // Stok awal = stok akhir + total terjual
  const soldTotal = new Map<string, number>();
  for (const d of drafts) if (d.paid) for (const it of d.items) soldTotal.set(it.productId, (soldTotal.get(it.productId) ?? 0) + it.kg);
  const running = new Map<string, number>();
  for (const p of products) {
    const def = PRODUCTS.find((x) => x.sku === p.sku)!;
    const initial = def.final + (soldTotal.get(p.id) ?? 0);
    running.set(p.id, initial);
    await prisma.stockMovement.create({
      data: { productId: p.id, type: 'IN', quantityKg: initial, stockBefore: 0, stockAfter: initial, reason: 'Stok awal (kiriman peternak mitra)', userId: admin.id, createdAt: daysAgo(160) },
    });
  }

  const promoUseCount = new Map<string, Map<string, number>>();
  let orderNo = 0;
  let paidCount = 0;
  // Beberapa order terbaru dipindah ke "hari ini" agar papan pengantaran & tracking punya antrean hidup saat demo
  let live = 0;
  for (const d of drafts) {
    orderNo++;
    if (d.paid && live < 7 && (now - d.at.getTime()) / DAY < 12) {
      d.at = new Date(now - between(10, 200) * 60_000);
      live++;
    }
    const user = customers[d.userIdx];
    const subtotal = d.items.reduce((a, i) => a + Math.round(i.price * i.kg), 0);
    const method: 'DELIVERY' | 'PICKUP' = user.customerType === 'BUSINESS' || rand() > 0.4 ? 'DELIVERY' : 'PICKUP';
    const q = quoteDelivery(user.addressLat!, user.addressLng!);
    const shipFee = method === 'DELIVERY' && q.ok ? q.fee : 0;
    const distanceKm = method === 'DELIVERY' ? q.distanceKm : 0;

    // pilih promo yang memenuhi syarat untuk ±35% order
    let promo: { id: string; p: (typeof PROMOS)[number] } | undefined;
    if (rand() < 0.45) {
      const candidates = ['GROSIRB2B15', 'ONGKIRFREE', 'FRESHMINUT15', 'MINUT20K', 'FRESHMINUT10', 'MERDEKA17']
        .map((c) => promoMap.get(c)!)
        .filter(({ p }) => {
          const startT = now + p.start * DAY;
          const used = promoUseCount.get(p.code)?.get(user.id) ?? 0;
          const endT = now + p.end * DAY;
          if (p.type === 'FREE_SHIPPING' && method === 'PICKUP') return false;
          return subtotal >= p.minOrder && d.at.getTime() >= startT && d.at.getTime() <= endT && (p.perCustomer == null || used < p.perCustomer);
        });
      if (candidates.length) promo = pick(candidates);
    }
    let discount = 0;
    let shipDisc = 0;
    if (promo) {
      const p = promo.p;
      if (p.type === 'PERCENTAGE' || p.type === 'FLASH_SALE') discount = Math.min(Math.round((subtotal * p.value) / 100), p.maxDiscount ?? Infinity);
      else if (p.type === 'FIXED_AMOUNT') discount = Math.min(p.value, subtotal);
      else shipDisc = shipFee;
      const m = promoUseCount.get(p.code) ?? new Map();
      m.set(user.id, (m.get(user.id) ?? 0) + 1);
      promoUseCount.set(p.code, m);
    }
    // Jadwal: diambil dari aturan slot yang berlaku saat order dibuat (WITA)
    const slotOpts = method === 'DELIVERY' ? deliveryOptions(d.at) : pickupOptions(d.at);
    const express = slotOpts.find((o) => o.express);
    const slot = express && rand() < 0.2 ? express : pick(slotOpts.filter((o) => !o.express).slice(0, 4));
    const expressFee = slot.express ? EXPRESS.fee : 0;
    const finalAmount = subtotal - discount + shipFee - shipDisc + expressFee;
    const paidAtSeed = d.paid ? new Date(d.at.getTime() + between(2, 25) * 60_000) : null;
    // Waktu kejadian mengikuti jadwal: kirim/siap sebelum slot mulai, selesai setelahnya
    const paidMs = paidAtSeed?.getTime() ?? d.at.getTime();
    const tReady = slot.express ? paidMs + 25 * 60_000 : Math.max(paidMs + 10 * 60_000, slot.startsAt.getTime() - 30 * 60_000);
    const tDone = slot.express ? paidMs + 75 * 60_000 : slot.startsAt.getTime() + 40 * 60_000;
    const done = method === 'PICKUP' ? 'PICKED_UP' : 'DELIVERED';
    const ready = method === 'PICKUP' ? 'READY_FOR_PICKUP' : 'SHIPPED';
    // Order lama sudah selesai; order hari ini statusnya sesuai jam sekarang (untuk demo peta & tracking)
    const ageDays = (now - d.at.getTime()) / DAY;
    const paidStatus = now >= tDone + 3 * 3600_000 ? done : now >= tReady ? ready : 'PROCESSING';
    const ymd = d.at.toISOString().slice(0, 10).replace(/-/g, '');
    const order = await prisma.order.create({
      data: {
        orderNumber: `FM-${ymd}-S${String(orderNo).padStart(3, '0')}`,
        userId: user.id,
        status: d.kind === 'expired' ? 'EXPIRED' : d.kind === 'cancelled' ? 'CANCELLED' : paidStatus,
        paymentStatus: d.kind === 'expired' ? 'EXPIRE' : d.kind === 'cancelled' ? 'CANCEL' : 'SETTLEMENT',
        requestedWeightKg: d.items.reduce((a, i) => a + i.kg, 0),
        subtotal,
        discountAmount: discount,
        shippingDiscount: shipDisc,
        deliveryFee: shipFee,
        fulfillmentMethod: method,
        shippingDistanceKm: distanceKm,
        deliveryLat: method === 'DELIVERY' ? user.addressLat : null,
        deliveryLng: method === 'DELIVERY' ? user.addressLng : null,
        deliverySlot: method === 'DELIVERY' ? slot.storeLabel : 'Ambil di toko',
        pickupSlot: method === 'PICKUP' ? slot.storeLabel : null,
        scheduledAt: slot.express ? null : slot.startsAt,
        scheduledEnd: slot.express ? null : slot.endsAt,
        isExpress: slot.express,
        expressFee,
        shippedAt: method === 'DELIVERY' && d.paid && now >= tReady ? new Date(tReady) : null,
        pickupCode: method === 'PICKUP' ? Math.floor(rand() * 36 ** 5).toString(36).toUpperCase().padStart(5, 'X') : null,
        estimatedAmount: finalAmount,
        finalAmount,
        promotionId: d.paid && promo ? promo.id : null,
        promoCode: d.paid && promo ? promo.p.code : null,
        stockDeducted: d.paid,
        paymentType: d.paid ? pick(['bank_transfer', 'qris', 'gopay', 'credit_card']) : null,
        paidAt: paidAtSeed,
        cancelReason: d.kind === 'expired' ? 'Batas waktu pembayaran habis' : d.kind === 'cancelled' ? 'Dibatalkan pelanggan' : null,
        shippingAddress: method === 'DELIVERY' ? user.address ?? '-' : `Ambil di toko: ${STORE.name}, ${STORE.address}`,
        createdAt: d.at,
        items: { create: d.items.map((i) => ({ productId: i.productId, requestedKg: i.kg, pricePerKg: i.price, subtotal: Math.round(i.price * i.kg), createdAt: d.at })) },
      },
    });
    // Riwayat status (untuk timeline tracking)
    const H = (status: string, minutesAfter: number, note: string) => ({
      orderId: order.id,
      status: status as 'PENDING',
      note,
      createdAt: new Date(d.at.getTime() + minutesAfter * 60_000),
    });
    const hist = [H('PENDING', 0, 'Pesanan dibuat, menunggu pembayaran')];
    if (d.kind === 'expired') hist.push(H('EXPIRED', 35, 'Batas waktu pembayaran habis'));
    if (d.kind === 'cancelled') hist.push(H('CANCELLED', 10, 'Dibatalkan pelanggan'));
    if (d.paid) {
      const paidMin = Math.round((order.paidAt!.getTime() - d.at.getTime()) / 60_000);
      const minOf = (t: number) => Math.round((t - d.at.getTime()) / 60_000);
      hist.push(H('PROCESSING', paidMin, slot.express ? 'Pembayaran diterima — ANTAR SEKARANG, prioritas disiapkan' : 'Pembayaran diterima, pesanan masuk antrean potong'));
      const st = order.status;
      if (method === 'DELIVERY' && (st === 'SHIPPED' || st === 'DELIVERED')) hist.push(H('SHIPPED', minOf(tReady), 'Kurir berangkat mengantar'));
      if (st === 'DELIVERED') hist.push(H('DELIVERED', minOf(tDone), 'Dikonfirmasi diterima oleh pelanggan'));
      if (method === 'PICKUP' && (st === 'READY_FOR_PICKUP' || st === 'PICKED_UP')) hist.push(H('READY_FOR_PICKUP', minOf(tReady), 'Pesanan siap diambil di toko'));
      if (st === 'PICKED_UP') hist.push(H('PICKED_UP', minOf(tDone), 'Pesanan diambil pelanggan'));
    }
    await prisma.orderStatusHistory.createMany({ data: hist });

    if (d.paid) {
      paidCount++;
      for (const it of d.items) {
        const before = running.get(it.productId)!;
        const after = Math.round((before - it.kg) * 10) / 10;
        running.set(it.productId, after);
        await prisma.stockMovement.create({
          data: { productId: it.productId, type: 'OUT', quantityKg: it.kg, stockBefore: before, stockAfter: after, reason: `Penjualan — order ${order.orderNumber} dibayar`, orderId: order.id, userId: user.id, createdAt: order.paidAt! },
        });
      }
      if (promo) {
        await prisma.promoUsage.create({
          data: { promotionId: promo.id, orderId: order.id, userId: user.id, discountAmount: discount + shipDisc, orderSubtotal: subtotal, orderTotal: finalAmount, createdAt: order.paidAt! },
        });
      }
      await prisma.user.update({ where: { id: user.id }, data: { loyaltyPoints: { increment: Math.floor(finalAmount / POINTS_PER_RUPIAH) } } });
      if (rand() < 0.3 && ageDays > 2) {
        const rating = pick([5, 5, 5, 4, 4, 3]);
        await prisma.review.create({
          data: {
            orderId: order.id,
            userId: user.id,
            rating,
            comment: pick([
              'Ayam masih segar waktu sampai, potongannya rapi.',
              'Pengantaran tepat waktu subuh, mantap untuk jualan.',
              'Harga bersaing dan beratnya pas.',
              'Fillet bersih tanpa lemak, cocok untuk diet.',
              'Lumayan, tapi kurir agak telat sedikit.',
            ]),
            sentimentScore: rating >= 4 ? 90 : 50,
            sentimentLabel: rating >= 4 ? 'POSITIVE' : 'NEUTRAL',
            createdAt: new Date(order.createdAt.getTime() + DAY),
          },
        });
      }
    }
  }

  // Pastikan stok akhir sesuai rencana
  for (const p of products) await prisma.product.update({ where: { id: p.id }, data: { stockKg: running.get(p.id)! } });

  console.log('🛒 Membuat keranjang yang belum di-checkout...');
  const cartPlans: Array<{ idx: number; minutesAgo: number; items: Array<[string, number]> }> = [
    { idx: 24, minutesAgo: 60 * 26, items: [['AYM-BRL-001', 10], ['AYM-HAT-004', 3]] },
    { idx: 25, minutesAgo: 60 * 3, items: [['AYM-FIL-002', 2], ['OLH-NGT-013', 1]] },
    { idx: 27, minutesAgo: 60 * 50, items: [['AYM-PHA-003', 2.5]] },
    { idx: 13, minutesAgo: 60 * 5, items: [['AYM-SYP-006', 2], ['TLR-NGR-017', 1]] },
    { idx: 2, minutesAgo: 20, items: [['AYM-GPK-009', 3]] },
  ];
  for (const c of cartPlans) {
    const user = customers[c.idx];
    const at = new Date(now - c.minutesAgo * 60_000);
    await prisma.cart.create({
      data: {
        userId: user.id,
        status: 'ACTIVE',
        lastActivityAt: at,
        createdAt: at,
        items: {
          create: c.items.map(([sku, kg]) => {
            const p = products.find((x) => x.sku === sku)!;
            return { productId: p.id, quantityKg: kg, pricePerKg: p.pricePerKg, addedAt: at };
          }),
        },
      },
    });
  }

  const segments = await refreshAllSegments();

  console.log('\n✅ Seed selesai');
  console.log(`   Produk: ${products.length} | Pelanggan: ${customers.length} | Order: ${drafts.length} (${paidCount} dibayar) | Promo: ${PROMOS.length}`);
  console.log('   Segmen:', segments);
  console.log('------------------------------------------------');
  console.log('ADMIN   : admin@freshminut.com / admin123');
  console.log('CUSTOMER: nathantambuku13@gmail.com / user123 (semua pelanggan seed: password user123)');
  console.log('------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
