import { prisma } from '@/lib/prisma';
import { getReservedStock } from '@/lib/inventory';
import { HomeClient, HomeProduct, HomePromo, HomeReview } from '@/components/shop/HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams: { q?: string; kategori?: string } }) {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  const [products, sold, reviews, promos, customerCount] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { type: 'OUT', orderId: { not: null }, createdAt: { gte: since30 } },
      _sum: { quantityKg: true },
    }),
    prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true, customerType: true, address: true } },
        order: { select: { items: { select: { productId: true } } } },
      },
    }),
    prisma.promotion.findMany({
      where: { isActive: true, targetSegment: null, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { endsAt: 'asc' },
    }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
  ]);

  const reserved = await getReservedStock(prisma, products.map((p) => p.id));
  const soldMap = new Map(sold.map((s) => [s.productId, s._sum.quantityKg ?? 0]));

  const ratingMap = new Map<string, { sum: number; n: number }>();
  for (const r of reviews) {
    for (const it of r.order.items) {
      const cur = ratingMap.get(it.productId) ?? { sum: 0, n: 0 };
      ratingMap.set(it.productId, { sum: cur.sum + r.rating, n: cur.n + 1 });
    }
  }

  const data: HomeProduct[] = products.map((p) => {
    const r = ratingMap.get(p.id);
    return {
      id: p.id,
      slug: p.slug,
      sku: p.sku,
      name: p.name,
      category: p.category,
      pricePerKg: p.pricePerKg,
      availableKg: Math.max(0, Math.round((p.stockKg - (reserved.get(p.id) ?? 0)) * 10) / 10),
      lowStock: p.stockKg <= p.minStockKg,
      sold30: soldMap.get(p.id) ?? 0,
      rating: r ? r.sum / r.n : null,
      reviewsCount: r?.n ?? 0,
      image: p.images[0] ?? '',
      description: p.description,
    };
  });

  const homePromos: HomePromo[] = promos.map((p) => ({
    code: p.code,
    name: p.name,
    type: p.type,
    value: p.value,
    maxDiscount: p.maxDiscount,
    minOrder: p.minOrder,
    endsAt: p.endsAt.toISOString(),
  }));

  const avgRating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;
  const featuredReviews: HomeReview[] = reviews
    .filter((r, i, arr) => r.rating >= 4 && r.comment.length > 20 && arr.findIndex((x) => x.comment === r.comment) === i)
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      name: r.user.name,
      isBusiness: r.user.customerType === 'BUSINESS',
      area: r.user.address?.split(',')[0] ?? null,
      date: r.createdAt.toISOString(),
    }));

  return (
    <HomeClient
      products={data}
      promos={homePromos}
      reviews={featuredReviews}
      stats={{ customers: customerCount, avgRating, reviewCount: reviews.length }}
      initialQuery={searchParams.q ?? ''}
      initialCategory={searchParams.kategori ?? ''}
    />
  );
}
