import 'server-only';
import { OrderStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { nextStatus, STATUS_LABEL } from '@/lib/fulfillment';

// Modul server biasa (BUKAN 'use server'): tidak bisa dipanggil langsung dari browser.
/**
 * Satu-satunya pintu untuk memajukan status pengantaran/pengambilan (dipakai admin & pelanggan).
 * - Admin: hanya boleh ke status berikutnya sesuai metode (Diantar: Dikirim → Diterima; Ambil: Siap diambil → Sudah diambil).
 * - Pelanggan pemilik order: hanya boleh konfirmasi "Diterima" saat pesanan diantar sedang dikirim.
 */
export async function advanceOrderStatus(
  orderNumber: string,
  next: OrderStatus,
  actor: { id: string; role: string },
  opts: { pickupCode?: string } = {}
) {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return { success: false, error: 'Order tidak ditemukan' };
  if (!order.stockDeducted) return { success: false, error: 'Order belum dibayar.' };

  const isAdmin = actor.role === 'ADMIN';
  const isOwner = order.userId === actor.id;
  const allowed = nextStatus(order.fulfillmentMethod, order.status);
  if (allowed !== next) {
    return { success: false, error: `Status tidak bisa diubah dari "${STATUS_LABEL[order.status]}" ke "${STATUS_LABEL[next]}".` };
  }
  const customerConfirm = order.fulfillmentMethod === 'DELIVERY' && next === 'DELIVERED';
  if (customerConfirm && !isOwner) {
    // Standar marketplace: penerimaan barang dikonfirmasi pembeli, bukan penjual.
    return {
      success: false,
      error: 'Pesanan diantar hanya bisa dikonfirmasi "Diterima" oleh pelanggan. Bila tidak dikonfirmasi, pesanan selesai otomatis 24 jam setelah dikirim.',
    };
  }
  if (!customerConfirm && !isAdmin) {
    return { success: false, error: 'Status hanya bisa diubah oleh admin.' };
  }
  // Penyerahan barang wajib dengan kode ambil milik pelanggan (bukti yang mengambil adalah pemesan)
  if (next === 'PICKED_UP' && (!opts.pickupCode || opts.pickupCode.trim().toUpperCase() !== order.pickupCode)) {
    return { success: false, error: 'Kode ambil tidak cocok.' };
  }

  const note =
    next === 'SHIPPED'
      ? 'Kurir berangkat mengantar'
      : next === 'DELIVERED'
        ? 'Dikonfirmasi diterima oleh pelanggan'
        : next === 'READY_FOR_PICKUP'
          ? 'Pesanan siap diambil di toko'
          : 'Pesanan diambil pelanggan';

  // Atomik: hanya berhasil bila status belum diubah orang lain (mis. admin & pelanggan klik bersamaan)
  const changed = await prisma.$transaction(async (tx) => {
    const r = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: next, ...(next === 'SHIPPED' ? { shippedAt: new Date() } : {}) },
    });
    if (r.count === 0) return false;
    await tx.orderStatusHistory.create({ data: { orderId: order.id, status: next, note, actorId: actor.id } });
    return true;
  });
  if (!changed) return { success: false, error: 'Status pesanan baru saja berubah. Muat ulang halaman.' };
  await prisma.activityLog
    .create({
      data: {
        userId: actor.id,
        action: 'ORDER_STATUS_UPDATED',
        entity: 'Order',
        entityId: order.id,
        details: JSON.stringify({ orderNumber, from: order.status, to: next }),
      },
    })
    .catch(() => {});
  revalidatePath(`/orders/${orderNumber}`);
  revalidatePath('/my-orders');
  revalidatePath('/admin', 'layout');
  return { success: true, newStatus: next };
}


/** Pesanan diantar otomatis dianggap diterima setelah sekian jam sejak dikirim (praktik umum marketplace). */
export const AUTO_COMPLETE_HOURS = 24;

/**
 * Tandai DELIVERED untuk pesanan yang sudah SHIPPED lebih dari AUTO_COMPLETE_HOURS jam
 * tanpa konfirmasi pelanggan. Aman dipanggil berkali-kali (idempoten), dipanggil saat halaman dibuka.
 */
export async function autoCompleteDeliveries() {
  const cutoff = new Date(Date.now() - AUTO_COMPLETE_HOURS * 3600_000);
  const due = await prisma.order.findMany({
    where: {
      fulfillmentMethod: 'DELIVERY',
      status: 'SHIPPED',
      OR: [{ shippedAt: { lte: cutoff } }, { shippedAt: null, updatedAt: { lte: cutoff } }],
    },
    select: { id: true },
    take: 200,
  });
  if (!due.length) return 0;
  const ids = due.map((o) => o.id);
  return prisma.$transaction(async (tx) => {
    // Ambil ulang yang masih SHIPPED agar tidak bentrok dengan konfirmasi pelanggan di saat yang sama
    const still = await tx.order.findMany({ where: { id: { in: ids }, status: 'SHIPPED' }, select: { id: true } });
    if (!still.length) return 0;
    const stillIds = still.map((o) => o.id);
    await tx.order.updateMany({ where: { id: { in: stillIds }, status: 'SHIPPED' }, data: { status: 'DELIVERED' } });
    await tx.orderStatusHistory.createMany({
      data: stillIds.map((orderId) => ({
        orderId,
        status: 'DELIVERED' as const,
        note: `Selesai otomatis ${AUTO_COMPLETE_HOURS} jam setelah dikirim (tidak ada keluhan)`,
      })),
    });
    return stillIds.length;
  });
}
