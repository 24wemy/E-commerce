'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

const syncSchema = z
  .array(z.object({ productId: z.string().min(1), quantityKg: z.number().positive().max(1000) }))
  .max(50);

/**
 * Simpan isi keranjang pelanggan yang login ke database.
 * Inilah yang membuat admin bisa melihat "keranjang terbengkalai" (sudah ditaruh di keranjang, belum checkout).
 */
export async function syncCartAction(rawItems: Array<{ productId: string; quantityKg: number }>) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'CUSTOMER') return { synced: false };
  const parsed = syncSchema.safeParse(rawItems);
  if (!parsed.success) return { synced: false };

  const userId = session.user.id;
  const products = await prisma.product.findMany({
    where: { id: { in: parsed.data.map((i) => i.productId) }, isActive: true },
    select: { id: true, pricePerKg: true },
  });
  const priceMap = new Map(products.map((p) => [p.id, p.pricePerKg]));
  const items = parsed.data.filter((i) => priceMap.has(i.productId));

  const existing = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
  const sameContent =
    existing &&
    existing.status === 'ACTIVE' &&
    existing.items.length === items.length &&
    items.every((i) => existing.items.some((e) => e.productId === i.productId && e.quantityKg === i.quantityKg));
  if (sameContent) return { synced: true };

  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId },
      create: { userId, status: 'ACTIVE' },
      update: {
        // Keranjang yang sudah di-checkout lalu diisi lagi -> aktif kembali
        status: 'ACTIVE',
        lastActivityAt: new Date(),
        ...(existing?.status === 'CONVERTED' ? { reminderSentAt: null, reminderCount: 0, convertedOrderId: null } : {}),
      },
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    if (items.length) {
      await tx.cartItem.createMany({
        data: items.map((i) => ({ cartId: cart.id, productId: i.productId, quantityKg: i.quantityKg, pricePerKg: priceMap.get(i.productId)! })),
      });
    }
  });
  return { synced: true };
}

/** Ambil keranjang tersimpan (dipakai saat pelanggan login di perangkat lain). */
export async function getServerCartAction() {
  const session = await auth();
  if (!session?.user?.id) return [];
  const cart = await prisma.cart.findUnique({
    where: { userId: session.user.id },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.status !== 'ACTIVE') return [];
  return cart.items
    .filter((i) => i.product.isActive)
    .map((i) => ({
      id: i.productId,
      name: i.product.name,
      price: i.product.pricePerKg,
      image: i.product.images[0] ?? '',
      quantity: i.quantityKg,
      maxStock: i.product.stockKg,
    }));
}
