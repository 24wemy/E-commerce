'use server';

import { z } from 'zod';
import { appUrl } from '@/lib/app-url';
import { prisma } from '@/lib/prisma';
import { snap, coreApi, isMidtransProduction } from '@/lib/midtrans';
import { auth } from '@/auth';
import { evaluatePromo } from '@/lib/promo';
import { expireStaleOrders, getReservedStock, lockProducts } from '@/lib/inventory';
import { markOrderPaid, cancelOrder } from '@/lib/orders';
import { PAYMENT_EXPIRY_MINUTES, STORE, quoteDelivery, formatKg } from '@/lib/business-rules';
import { EXPRESS, resolveSlot } from '@/lib/schedule';
import { sendOrderConfirmationEmail } from '@/lib/email';

const itemsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantityKg: z.number().positive().max(1000),
    })
  )
  .min(1, 'Keranjang kosong.')
  .max(50);

function mergeItems(items: z.infer<typeof itemsSchema>) {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.productId, (map.get(i.productId) ?? 0) + i.quantityKg);
  return Array.from(map, ([productId, quantityKg]) => ({ productId, quantityKg: Math.round(quantityKg * 10) / 10 }));
}

/** Hitung harga dari DATABASE (bukan dari browser). */
async function priceCart(rawItems: Array<{ productId: string; quantityKg: number }>) {
  const items = mergeItems(itemsSchema.parse(rawItems));
  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const map = new Map(products.map((p) => [p.id, p]));
  const lines = items.map((i) => {
    const p = map.get(i.productId);
    if (!p || !p.isActive) throw new Error('Ada produk di keranjang yang sudah tidak tersedia. Hapus lalu coba lagi.');
    return { product: p, quantityKg: i.quantityKg, lineTotal: Math.round(p.pricePerKg * i.quantityKg) };
  });
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  return { lines, subtotal };
}

const fulfillmentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('DELIVERY'),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().trim().min(10, 'Alamat pengantaran terlalu pendek').max(500),
    note: z.string().trim().max(200).optional(),
    slot: z.string().min(1, 'Pilih jadwal pengantaran').max(40),
  }),
  z.object({
    method: z.literal('PICKUP'),
    slot: z.string().min(1, 'Pilih jadwal ambil').max(40),
  }),
]);
type FulfillmentInput = z.infer<typeof fulfillmentSchema>;

/** Ongkir dihitung di SERVER dari titik peta (bukan angka dari browser). */
function shippingFor(f: { method: 'DELIVERY' | 'PICKUP'; lat?: number; lng?: number } | undefined) {
  if (!f || f.method === 'PICKUP') return { ok: true as const, fee: 0, distanceKm: 0 };
  if (f.lat === undefined || f.lng === undefined) return { ok: false as const, error: 'Pilih lokasi pengantaran di peta.' };
  const q = quoteDelivery(f.lat, f.lng);
  return q.ok ? { ok: true as const, fee: q.fee, distanceKm: q.distanceKm } : { ok: false as const, error: q.error };
}

/** Preview promo untuk UI keranjang/checkout. Tetap divalidasi ulang saat checkout. */
export async function previewPromoAction(input: {
  code: string;
  items: Array<{ productId: string; quantityKg: number }>;
  fulfillment?: { method: 'DELIVERY' | 'PICKUP'; lat?: number; lng?: number };
}) {
  try {
    const session = await auth();
    const { subtotal } = await priceCart(input.items);
    const ship = shippingFor(input.fulfillment);
    const res = await evaluatePromo(prisma, {
      code: input.code,
      userId: session?.user?.id ?? null,
      subtotal,
      // Belum memilih lokasi: anggap ongkir tier terendah agar promo gratis ongkir tetap bisa dicek
      shippingFee: ship.ok ? ship.fee : 0,
      fulfillment: input.fulfillment?.method,
    });
    if (!res.ok) return { ok: false as const, error: res.error, subtotal };
    return {
      ok: true as const,
      code: res.promotion.code,
      type: res.promotion.type,
      description: res.description,
      discountAmount: res.discountAmount,
      shippingDiscount: res.shippingDiscount,
      subtotal,
    };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message, subtotal: 0 };
  }
}

const checkoutSchema = z.object({
  items: itemsSchema,
  customer: z.object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
    phone: z.string().trim().min(8, 'Nomor HP tidak valid').max(20),
    businessName: z.string().trim().max(120).optional(),
    requestTaxInvoice: z.boolean().optional(),
  }),
  fulfillment: fulfillmentSchema,
  promoCode: z.string().trim().max(40).optional(),
});

export async function createCheckoutSessionAction(input: z.infer<typeof checkoutSchema>) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: 'Silakan login atau daftar terlebih dahulu untuk checkout.', needLogin: true };
  }
  if (session.user.role !== 'CUSTOMER') {
    return { success: false as const, error: 'Akun admin tidak bisa berbelanja. Gunakan akun pelanggan untuk membuat pesanan.' };
  }
  const userId = session.user.id;

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };
  const data = parsed.data;
  const items = mergeItems(data.items);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false as const, error: 'Sesi tidak valid. Silakan login ulang.', needLogin: true };

  await expireStaleOrders();

  const orderNumber = `FM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;

  const f: FulfillmentInput = data.fulfillment;
  const ship = shippingFor(f);
  if (!ship.ok) return { success: false as const, error: ship.error };
  const shippingFee = ship.fee;

  // Jadwal divalidasi ulang dengan jam SERVER (WITA): slot yang sudah lewat / terlalu mepet ditolak.
  const slot = resolveSlot(f.method, f.slot);
  if (!slot) {
    return {
      success: false as const,
      error:
        f.slot === 'EXPRESS'
          ? 'Antar sekarang sedang tidak tersedia (di luar jam operasional). Pilih jadwal lain.'
          : 'Jadwal yang dipilih sudah lewat atau terlalu mepet. Silakan pilih jadwal lain.',
    };
  }
  const expressFee = slot.express ? EXPRESS.fee : 0;

  let shippingAddress = f.method === 'DELIVERY' ? f.address : `Ambil di toko: ${STORE.name}, ${STORE.address}`;
  if (data.customer.businessName) {
    shippingAddress = `[B2B: ${data.customer.businessName}${data.customer.requestTaxInvoice ? ' • minta faktur pajak' : ''}] ${shippingAddress}`;
  }

  let created;
  try {
    created = await prisma.$transaction(
      async (tx) => {
        await lockProducts(tx, items.map((i) => i.productId));
        const products = await tx.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
        const map = new Map(products.map((p) => [p.id, p]));
        const reserved = await getReservedStock(tx, items.map((i) => i.productId));

        const lines = items.map((i) => {
          const p = map.get(i.productId);
          if (!p || !p.isActive) throw new Error('Ada produk di keranjang yang sudah tidak tersedia.');
          const available = Math.max(0, Math.round((p.stockKg - (reserved.get(p.id) ?? 0)) * 10) / 10);
          // ANTI-OVERSELLING: tolak bila permintaan melebihi stok tersedia
          if (i.quantityKg > available) {
            throw new Error(
              available <= 0
                ? `Stok "${p.name}" habis. Silakan hapus dari keranjang.`
                : `Stok "${p.name}" tidak cukup. Tersedia ${formatKg(available)}, Anda meminta ${formatKg(i.quantityKg)}.`
            );
          }
          return { product: p, quantityKg: i.quantityKg, lineTotal: Math.round(p.pricePerKg * i.quantityKg) };
        });
        const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);

        let discountAmount = 0;
        let shippingDiscount = 0;
        let promotionId: string | null = null;
        let promoCode: string | null = null;
        if (data.promoCode) {
          const promo = await evaluatePromo(tx, { code: data.promoCode, userId, subtotal, shippingFee, fulfillment: f.method });
          if (!promo.ok) throw new Error(promo.error);
          discountAmount = promo.discountAmount;
          shippingDiscount = promo.shippingDiscount;
          promotionId = promo.promotion.id;
          promoCode = promo.promotion.code;
        }

        const finalAmount = Math.max(0, subtotal - discountAmount + shippingFee - shippingDiscount + expressFee);
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            status: 'PENDING',
            paymentStatus: 'UNPAID',
            requestedWeightKg: lines.reduce((a, l) => a + l.quantityKg, 0),
            subtotal,
            discountAmount,
            shippingDiscount,
            deliveryFee: shippingFee,
            fulfillmentMethod: f.method,
            shippingDistanceKm: ship.distanceKm,
            deliveryLat: f.method === 'DELIVERY' ? f.lat : null,
            deliveryLng: f.method === 'DELIVERY' ? f.lng : null,
            addressNote: f.method === 'DELIVERY' ? f.note || null : null,
            deliverySlot: f.method === 'DELIVERY' ? slot.storeLabel : 'Ambil di toko',
            pickupSlot: f.method === 'PICKUP' ? slot.storeLabel : null,
            scheduledAt: slot.express ? null : slot.startsAt,
            scheduledEnd: slot.express ? null : slot.endsAt,
            isExpress: slot.express,
            expressFee,
            pickupCode: f.method === 'PICKUP' ? Math.random().toString(36).substring(2, 7).toUpperCase() : null,
            statusHistory: { create: { status: 'PENDING', note: 'Pesanan dibuat, menunggu pembayaran', actorId: userId } },
            estimatedAmount: finalAmount,
            finalAmount,
            promotionId,
            promoCode,
            shippingAddress,
            items: {
              create: lines.map((l) => ({
                productId: l.product.id,
                requestedKg: l.quantityKg,
                pricePerKg: l.product.pricePerKg,
                subtotal: l.lineTotal,
              })),
            },
          },
        });
        return { order, lines };
      },
      { timeout: 20_000 }
    );
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }

  const { order, lines } = created;

  // Midtrans Snap — total item_details HARUS sama dengan gross_amount
  const itemDetails: Array<{ id: string; price: number; quantity: number; name: string }> = lines.map((l) => ({
    id: l.product.sku,
    price: l.lineTotal,
    quantity: 1,
    name: `${l.product.name} (${formatKg(l.quantityKg)})`.substring(0, 50),
  }));
  if (order.deliveryFee > 0) {
    itemDetails.push({ id: 'ONGKIR', price: order.deliveryFee, quantity: 1, name: `Ongkos kirim (${order.shippingDistanceKm} km)` });
  }
  if (order.expressFee > 0) {
    itemDetails.push({ id: 'EXPRESS', price: order.expressFee, quantity: 1, name: 'Biaya antar sekarang' });
  }
  if (order.discountAmount > 0) {
    itemDetails.push({ id: 'DISKON', price: -order.discountAmount, quantity: 1, name: `Promo ${order.promoCode}` });
  }
  if (order.shippingDiscount > 0) {
    itemDetails.push({ id: 'FREEONGKIR', price: -order.shippingDiscount, quantity: 1, name: `Gratis ongkir ${order.promoCode}` });
  }

  let transaction: { token: string; redirect_url: string };
  try {
    transaction = await snap.createTransaction({
      transaction_details: { order_id: order.orderNumber, gross_amount: order.finalAmount },
      item_details: itemDetails,
      customer_details: {
        first_name: data.customer.name,
        email: user.email,
        phone: data.customer.phone,
        shipping_address: { first_name: data.customer.name, phone: data.customer.phone, address: shippingAddress.substring(0, 200) },
      },
      expiry: { unit: 'minutes', duration: PAYMENT_EXPIRY_MINUTES },
      callbacks: { finish: `${appUrl()}/orders/${order.orderNumber}` },
    });
  } catch (e) {
    console.error('Midtrans createTransaction error:', e);
    await cancelOrder(order.orderNumber, { reason: 'Gagal membuat transaksi Midtrans', paymentStatus: 'CANCEL' });
    return {
      success: false as const,
      error: 'Gagal terhubung ke Midtrans. Pastikan MIDTRANS_SERVER_KEY & NEXT_PUBLIC_MIDTRANS_CLIENT_KEY (Sandbox) sudah benar.',
    };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { snapToken: transaction.token, snapRedirectUrl: transaction.redirect_url },
  });

  // Simpan data kontak terbaru ke profil pelanggan (CRM)
  await prisma.user.update({
    where: { id: userId },
    data: {
      phone: data.customer.phone,
      ...(f.method === 'DELIVERY' ? { address: f.address, addressLat: f.lat, addressLng: f.lng, addressNote: f.note || null } : {}),
      ...(data.customer.businessName ? { businessName: data.customer.businessName, customerType: 'BUSINESS' } : {}),
    },
  });

  // Keranjang server -> CONVERTED (tidak lagi dihitung terbengkalai)
  await prisma.cart
    .update({
      where: { userId },
      data: { status: 'CONVERTED', convertedOrderId: order.id, items: { deleteMany: {} }, lastActivityAt: new Date() },
    })
    .catch(() => {});

  await prisma.activityLog
    .create({
      data: {
        userId,
        action: 'CHECKOUT_CREATED',
        entity: 'Order',
        entityId: order.id,
        details: JSON.stringify({ orderNumber, subtotal: order.subtotal, promo: order.promoCode, total: order.finalAmount }),
      },
    })
    .catch(() => {});

  sendOrderConfirmationEmail({
    userEmail: user.email,
    userName: data.customer.name,
    orderNumber: order.orderNumber,
    items: lines.map((l) => ({ name: l.product.name, price: l.product.pricePerKg, quantity: l.quantityKg })),
    totalAmount: order.finalAmount,
    discountAmount: order.discountAmount + order.shippingDiscount,
    discountCode: order.promoCode ?? undefined,
    shippingAddress,
  }).catch((e) => console.error('confirmation email failed', e));

  return {
    success: true as const,
    snapToken: transaction.token,
    redirectUrl: transaction.redirect_url,
    orderNumber: order.orderNumber,
    summary: {
      lines: lines.map((l) => ({ name: l.product.name, quantityKg: l.quantityKg, pricePerKg: l.product.pricePerKg, lineTotal: l.lineTotal })),
      subtotal: order.subtotal,
      shippingFee: order.deliveryFee,
      expressFee: order.expressFee,
      slotLabel: f.method === 'DELIVERY' ? order.deliverySlot : order.pickupSlot,
      discountAmount: order.discountAmount,
      shippingDiscount: order.shippingDiscount,
      promoCode: order.promoCode,
      finalAmount: order.finalAmount,
      fulfillment: order.fulfillmentMethod,
    },
  };
}

/** Cek status langsung ke API Midtrans (berguna saat webhook belum bisa menjangkau server, mis. localhost). */
export async function syncOrderStatusAction(orderNumber: string) {
  try {
    const session = await auth();
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) return { success: false, error: 'Order tidak ditemukan' };
    if (!session?.user || (session.user.role !== 'ADMIN' && order.userId !== session.user.id)) {
      return { success: false, error: 'Akses ditolak' };
    }
    if (order.stockDeducted) return { success: true, paymentStatus: 'SETTLEMENT', updated: false };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let st: any = null;
    try {
      st = await coreApi.transaction.status(orderNumber);
    } catch {
      return { success: false, error: 'Transaksi belum ditemukan di Midtrans (belum memilih metode bayar?)' };
    }
    const ts = st?.transaction_status;
    if ((ts === 'capture' && st.fraud_status === 'accept') || ts === 'settlement') {
      const r = await markOrderPaid(orderNumber, { paymentType: st.payment_type, source: 'status-sync' });
      return { success: true, paymentStatus: 'SETTLEMENT', updated: r === 'PAID' };
    }
    if (ts === 'pending') {
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING', paymentType: st.payment_type } });
      return { success: true, paymentStatus: 'PENDING', updated: true };
    }
    if (['deny', 'cancel', 'expire', 'failure'].includes(ts)) {
      await cancelOrder(orderNumber, {
        reason: `Midtrans: ${ts}`,
        paymentStatus: ts === 'expire' ? 'EXPIRE' : ts === 'deny' ? 'DENY' : 'CANCEL',
        expired: ts === 'expire',
      });
      return { success: true, paymentStatus: ts.toUpperCase(), updated: true };
    }
    return { success: true, paymentStatus: order.paymentStatus, updated: false };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Hanya untuk mode SANDBOX & hanya pemilik order/admin: tandai lunas tanpa Midtrans.
 * Untuk demo resmi, sebaiknya bayar lewat Snap + Midtrans Payment Simulator.
 */
export async function simulateSandboxPaymentAction(orderNumber: string) {
  if (isMidtransProduction) return { success: false, error: 'Tidak tersedia di mode produksi.' };
  const session = await auth();
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return { success: false, error: 'Order tidak ditemukan' };
  // Hanya pemilik pesanan yang "membayar" — admin tidak menandai lunas atas nama pelanggan
  if (!session?.user || order.userId !== session.user.id) {
    return { success: false, error: 'Akses ditolak' };
  }
  try {
    const r = await markOrderPaid(orderNumber, { paymentType: 'sandbox_simulation', source: 'sandbox-button' });
    if (r === 'OVERSOLD') return { success: false, error: 'Stok habis saat pembayaran — order dibatalkan.' };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/** Pelanggan membatalkan order yang BELUM dibayar. */
export async function cancelMyOrderAction(orderNumber: string) {
  const session = await auth();
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order || !session?.user || order.userId !== session.user.id) return { success: false, error: 'Akses ditolak' };
  if (order.stockDeducted || order.paymentStatus === 'SETTLEMENT') {
    return { success: false, error: 'Order sudah dibayar. Hubungi admin untuk refund.' };
  }
  await cancelOrder(orderNumber, { reason: 'Dibatalkan pelanggan', paymentStatus: 'CANCEL', actorId: session.user.id });
  try {
    await coreApi.transaction.cancel(orderNumber);
  } catch {
    /* transaksi mungkin belum dibuat di Midtrans */
  }
  return { success: true };
}

/** Data kontak & alamat terakhir milik pelanggan yang login (untuk mengisi otomatis checkout). */
export async function getMyCheckoutDefaultsAction() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, phone: true, address: true, addressLat: true, addressLng: true, addressNote: true, businessName: true },
  });
  return u;
}
