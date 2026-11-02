import { prisma } from '@/lib/prisma';
import { SafeImage } from '@/components/shop/SafeImage';
import { notFound } from 'next/navigation';
import { Header } from '@/components/shop/Header';
import { Footer } from '@/components/shop/Footer';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import Link from 'next/link';
import { ChevronLeft, Star, ShieldCheck, ThumbsUp, MessageSquare } from 'lucide-react';
import { getProductReviewsAction } from '@/actions/review';
import { getReservedStock } from '@/lib/inventory';
import { categoryLabel } from '@/lib/catalog';

export const revalidate = 0; // Fresh review data

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const decodedSlug = decodeURIComponent(params.slug);

  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { slug: decodedSlug },
        { slug: params.slug },
        { name: { equals: decodedSlug, mode: 'insensitive' } },
      ],
    },
  });

  if (!product || !product.isActive) {
    notFound();
  }
  const reserved = await getReservedStock(prisma, [product.id]);
  const availableKg = Math.max(0, Math.round((product.stockKg - (reserved.get(product.id) ?? 0)) * 10) / 10);

  // Fetch reviews for this product
  const { reviews, avgRating, total } = await getProductReviewsAction(product.id);

  const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-5xl flex-1 space-y-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-daun-600">
          <ChevronLeft className="h-4 w-4" /> Kembali ke katalog
        </Link>

        {/* Product Details Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-2xl border border-daun-100 p-6 sm:p-8 shadow-sm">
          {/* Image */}
          <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
            <SafeImage src={product.images[0]} alt={product.name} className="h-full w-full object-cover" iconClassName="h-24 w-24" />
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Link href={`/?kategori=${product.category}#katalog`} className="text-sm font-semibold text-daun-700 hover:underline">
                  {categoryLabel(product.category)}
                </Link>
                <span className="text-xs font-semibold text-daun-800 bg-daun-50 px-2.5 py-1 rounded-full border border-daun-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Dipotong subuh, 04.00 WITA
                </span>
              </div>

              <h1 className="font-extrabold text-2xl sm:text-3xl text-slate-900">
                {product.name}
              </h1>

              {/* Rating Summary Header */}
              {total > 0 ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center text-kunyit-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(avgRating) ? 'fill-kunyit-400' : 'text-slate-300'}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-slate-800">{avgRating.toFixed(1)}</span>
                <span className="text-sm text-slate-500">dari {total} ulasan</span>
              </div>
              ) : (
                <p className="text-sm text-slate-500">Belum ada ulasan untuk produk ini.</p>
              )}

              <p className="text-3xl font-extrabold text-ink tabular-nums">
                {formatIDR(product.pricePerKg)} <span className="text-sm font-normal text-slate-500">/ kg</span>
              </p>

              <div className="pt-4 border-t">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {product.description}
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-semibold">Stok tersedia (SKU {product.sku}):</span>
                {availableKg > 0 ? (
                  <span className={`font-bold ${availableKg <= product.minStockKg ? 'text-kunyit-600' : 'text-emerald-600'}`}>
                    {availableKg <= product.minStockKg ? `Sisa sedikit — ${availableKg} kg` : `Ready (${availableKg} kg)`}
                  </span>
                ) : (
                  <span className="font-bold text-cabai-500">Stok habis</span>
                )}
              </div>

              <AddToCartButton product={{ ...product, availableKg }} />
            </div>
          </div>
        </div>

        {/* Customer Reviews & Testimonials Section */}
        <div className="bg-white rounded-2xl border border-daun-100 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-daun-600" />
                <span>Ulasan pembeli</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Ditulis oleh pelanggan setelah pesanannya dibayar</p>
            </div>

            <div className="flex items-center gap-3 bg-kunyit-50 border border-kunyit-200 p-3 rounded-xl">
              <div className="text-3xl font-black text-kunyit-600">{total ? avgRating.toFixed(1) : '—'}</div>
              <div>
                <div className="flex text-kunyit-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(avgRating) ? 'fill-kunyit-400' : 'text-slate-300'}`} />
                  ))}
                </div>
                <div className="text-[11px] font-semibold text-slate-600">dari {total} ulasan</div>
              </div>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <ThumbsUp className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold">Belum Ada Ulasan Untuk Produk Ini</p>
              <p className="text-xs text-slate-400 mt-1">Jadilah yang pertama membeli & memberikan ulasan bintang 5!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div key={rev.id} className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{rev.user.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-daun-50 text-daun-800 font-medium">
                          {rev.user.customerType === 'BUSINESS' ? ' Resto / UMKM' : ' Rumah Tangga'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-kunyit-400 mt-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-kunyit-400' : 'text-slate-300'}`} />
                        ))}
                        <span className="text-xs font-bold text-slate-700 ml-1">{rev.rating}.0</span>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed italic">&quot;{rev.comment}&quot;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
