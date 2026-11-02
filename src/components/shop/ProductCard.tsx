/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCartStore } from '@/stores/use-cart-store';

export function ProductCard({ product }: { product: Record<string, any> }) {
  const addItem = useCartStore((s) => s.addItem);

  const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square bg-muted">
        <Image
          src={product.images[0] || '/placeholder.png'}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 100vw, 300px"
        />
        {product.stock <= 0 && (
          <Badge variant="destructive" className="absolute top-2 left-2">
            Out of Stock
          </Badge>
        )}
      </Link>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase font-semibold">{product.category}</p>
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-medium text-base line-clamp-1 group-hover:text-primary mt-1">
            {product.name}
          </h3>
        </Link>
        <p className="font-bold text-lg text-primary mt-2">{formatIDR(product.price)}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          onClick={() =>
            addItem({
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.images[0],
            })
          }
          disabled={product.stock <= 0}
          className="w-full gap-2"
        >
          <ShoppingBag className="h-4 w-4" /> Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
}
