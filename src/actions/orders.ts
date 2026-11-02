'use server';

import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { advanceOrderStatus } from '@/lib/order-status';

export async function updateOrderStatusAction(orderNumber: string, next: OrderStatus) {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Silakan login.' };
  return advanceOrderStatus(orderNumber, next, { id: session.user.id, role: session.user.role });
}

/** Cari pesanan milik sendiri berdasarkan nomor order. */
export async function findMyOrderAction(orderNumber: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Silakan login terlebih dahulu.' };
  const clean = orderNumber.trim().toUpperCase();
  const order = await prisma.order.findFirst({ where: { orderNumber: clean, userId: session.user.id } });
  if (!order) return { success: false, error: 'Nomor pesanan tidak ditemukan di akun Anda.' };
  return { success: true, orderNumber: order.orderNumber };
}
