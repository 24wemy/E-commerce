import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ProductFormModal } from './ProductFormModal';
import { DeleteProductButton } from './DeleteProductButton';
import { formatIDR, formatKg } from '@/lib/business-rules';
import { PageHeader, Panel, Table, Pill } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });

  return (
    <div>
      <PageHeader title="Produk" subtitle={`${products.length} produk • harga dan SKU dipakai langsung oleh checkout (server)`}>
        <ProductFormModal />
      </PageHeader>
      <Panel>
        <Table head={['', 'SKU', 'Nama', 'Kategori', 'Harga/kg', 'Stok', 'Min.', 'Status', 'Aksi']}>
          {products.map((p) => (
            <tr key={p.id} className={p.isActive ? '' : 'opacity-60'}>
              <td className="px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.images[0]} alt="" className="h-10 w-10 rounded object-cover bg-slate-100" />
              </td>
              <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
              <td className="px-3 py-2 font-medium">
                <Link href={`/admin/inventory?product=${p.id}`} className="hover:underline" title="Lihat stok & log">
                  {p.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs">{p.category}</td>
              <td className="px-3 py-2 tabular-nums">{formatIDR(p.pricePerKg)}</td>
              <td className={`px-3 py-2 tabular-nums font-semibold ${p.stockKg <= p.minStockKg ? 'text-amber-700' : ''}`}>{formatKg(p.stockKg)}</td>
              <td className="px-3 py-2 tabular-nums">{formatKg(p.minStockKg)}</td>
              <td className="px-3 py-2">
                {p.isActive ? <Pill className="bg-emerald-50 text-emerald-700 border-emerald-300">Aktif</Pill> : <Pill className="border-slate-300">Nonaktif</Pill>}
              </td>
              <td className="px-3 py-2 flex gap-1">
                <ProductFormModal existingProduct={p} />
                <DeleteProductButton id={p.id} />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
