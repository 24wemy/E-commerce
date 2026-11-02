'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { SentimentLabel } from '@prisma/client';

export async function createProductReviewAction(data: {
  orderId: string;
  rating: number;
  comment: string;
}) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { success: false, error: 'Silakan login terlebih dahulu untuk memberikan ulasan.' };
    }

    if (data.rating < 1 || data.rating > 5) {
      return { success: false, error: 'Rating harus antara 1 sampai 5 bintang.' };
    }

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });

    if (!order || order.userId !== session.user.id) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }
    if (!order.stockDeducted) {
      return { success: false, error: 'Ulasan hanya bisa diberikan untuk pesanan yang sudah dibayar.' };
    }

    // Determine simple sentiment label
    let sentimentLabel: SentimentLabel = SentimentLabel.NEUTRAL;
    let sentimentScore = 50;
    if (data.rating >= 4) {
      sentimentLabel = SentimentLabel.POSITIVE;
      sentimentScore = data.rating === 5 ? 95 : 80;
    } else if (data.rating <= 2) {
      sentimentLabel = SentimentLabel.NEGATIVE;
      sentimentScore = data.rating === 1 ? 15 : 30;
    }

    const review = await prisma.review.create({
      data: {
        orderId: data.orderId,
        userId: session.user.id,
        rating: data.rating,
        comment: data.comment.trim(),
        sentimentScore,
        sentimentLabel,
        aiSummary: `Review Bintang ${data.rating}: ${data.comment.trim().substring(0, 40)}...`,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'SUBMIT_PRODUCT_REVIEW',
        entity: 'Review',
        entityId: review.id,
        details: JSON.stringify({ rating: data.rating, orderId: data.orderId }),
      },
    }).catch(() => {});

    revalidatePath('/my-orders');
    revalidatePath(`/orders/${order.orderNumber}`);
    revalidatePath('/products/[slug]', 'page');
    revalidatePath('/');

    return { success: true, review };
  } catch (error: unknown) {
    console.error('Create Review Error:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getProductReviewsAction(productId?: string) {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { name: true, customerType: true } },
        order: {
          include: {
            items: { include: { product: true } },
          },
        },
      },
    });

    // Filter by productId if provided
    const filtered = productId
      ? reviews.filter((r) => r.order.items.some((i) => i.productId === productId || i.product.slug === productId))
      : reviews;

    const total = filtered.length;
    const avgRating = total > 0 ? (filtered.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1) : '5.0';

    return { success: true, reviews: filtered, avgRating: parseFloat(avgRating), total };
  } catch (error: unknown) {
    console.error('Get Product Reviews Error:', error);
    return { success: false, reviews: [], avgRating: 5.0, total: 0, error: (error as Error).message };
  }
}
