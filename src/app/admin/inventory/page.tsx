import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getReservedStock } from '@/lib/inventory';
import { adjustStockAction } from '@/actions/admin';
import { formatKg, formatDateTime } from '@/lib/business-rules';
import { PageHeader, Panel, Table, Pill, StatCard, fieldCls, labelCls, btnCls } from '@/components/admin/ui';
import { ActionForm } from '@/components/admin/ActionForm';

export const dynamic = 'force-dynamic';

const MOVE_LABEL: Record<string, { label: string; cls: string }> = {
  IN: { label: 'Masuk', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  OUT: { label: 'Keluar', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
  ADJUSTMENT: { label: 'Penyesuaian', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  RETURN: { label: 'Kembali (batal/refund)', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
};

export default async function InventoryPage({ searchParams }: { searchParams: { product?: string; restock?: string } }) {
  const products = await prisma.product.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  const reserved = await getReservedStock(prisma, products.map((p) => p.id));
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const sold = await prisma.stockMovement.groupBy({
    by: ['productId'],
    where: { type: 'OUT', createdAt: { gte: since30 }, orderId: { not: null } },
    _sum: { quantityKg: true },
  });
  const soldMap = new Map(sold.map((s) => [s.productId, s._sum.quantityKg ?? 0]));
  const movements = await prisma.stockMovement.findMany({
    where: searchParams.product ? { productId: searchParams.product } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { product: true, user: true, order: true },
  });

  const rows = products.map((p) => {
    const sold30 = soldMap.get(p.id) ?? 0;
    const daily = sold30 / 30;
    // Reorder point = kebutuhan selama lead time supplier + stok pengaman (batas minimum)
    const reorderPoint = Math.round((daily * p.leadTimeDays + p.minStockKg) * 10) / 10;
    const status = p.stockKg <= 0 ? 'HABIS' : p.stockKg <= p.minStockKg ? 'MENIPIS' : p.stockKg <= reorderPoint ? 'REORDER' : 'AMAN';
    return { p, sold30, daily, reorderPoint, status, reserved: reserved.get(p.id) ?? 0 };
  });
  const lowCount = rows.filter((r) => r.p.isActive && (r.status === 'MENIPIS' || r.status === 'HABIS')).length;
  const reorderCount = rows.filter((r) => r.p.isActive && r.status === 'REORDER').length;
  const slow = rows.filter((r) => r.p.isActive && r.sold30 === 0 && r.p.stockKg > 0);

  const statusPill = (s: string) =>
    ({
      HABIS: <Pill className="bg-rose-600 text-white border-rose-700">Habis</Pill>,
      MENIPIS: <Pill className="bg-amber-100 text-amber-900 border-amber-400">⚠️ Menipis</Pill>,
      REORDER: <Pill className="bg-sky-100 text-sky-800 border-sky-300">Perlu reorder</Pill>,
      AMAN: <Pill className="bg-emerald-100 text-emerald-800 border-emerald-300">Aman</Pill>,
    })[s];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Stok berkurang otomatis saat order DIBAYAR, kembali saat dibatalkan/refund. Order yang belum dibayar memesan stok sementara (30 menit) agar tidak terjadi overselling."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Produk aktif" value={products.filter((p) => p.isActive).length} />
        <StatCard label="Stok menipis / habis" value={lowCount} tone={lowCount ? 'warn' : 'good'} />
        <StatCard label="Perlu reorder" value={reorderCount} hint="stok ≤ reorder point" />
        <StatCard label="Slow-moving (30 hari)" value={slow.length} hint="tidak terjual 30 hari" />
      </div>

      <Panel title="Catat pergerakan stok">
        <ActionForm action={adjustStockAction} resetOnSuccess className="grid gap-3 sm:grid-cols-5 items-end">
          <div className="sm:col-span-2">
            <label className={labelCls}>Produk</label>
            <select name="productId" required className={fieldCls} defaultValue={searchParams.product ?? ''}>
              <option value="" disabled>
                Pilih produk…
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (stok {formatKg(p.stockKg)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Jenis</label>
            <select name="type" className={fieldCls} defaultValue="IN">
              <option value="IN">Masuk (+)</option>
              <option value="OUT">Keluar (−) mis. rusak</option>
              <option value="ADJUSTMENT">Penyesuaian (set stok = hasil opname)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Jumlah / stok baru (kg)</label>
            <input name="quantityKg" type="number" step="0.1" min="0" required className={fieldCls} defaultValue={searchParams.restock ?? ''} />
          </div>
          <div>
            <label className={labelCls}>Alasan (wajib)</label>
            <input name="reason" required minLength={3} className={fieldCls} placeholder="mis. Kiriman peternak Kalawat" />
          </div>
          <div className="sm:col-span-5">
            <button className={btnCls}>Simpan pergerakan stok</button>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Stok per produk (SKU)">
        <Table head={['SKU', 'Produk', 'Stok fisik', 'Dipesan (belum bayar)', 'Min.', 'Lead time', 'Terjual 30h', 'Reorder point', 'Status', '']}>
          {rows.map(({ p, sold30, reorderPoint, status, reserved: r }) => (
            <tr key={p.id} className={!p.isActive ? 'opacity-50' : status === 'MENIPIS' || status === 'HABIS' ? 'bg-amber-50/60' : ''}>
              <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
              <td className="px-3 py-2">
                {p.name}
                {!p.isActive && <span className="text-[10px] text-slate-500"> (nonaktif)</span>}
              </td>
              <td className="px-3 py-2 font-bold tabular-nums">{formatKg(p.stockKg)}</td>
              <td className="px-3 py-2 tabular-nums text-slate-500">{r ? formatKg(r) : '-'}</td>
              <td className="px-3 py-2 tabular-nums">{formatKg(p.minStockKg)}</td>
              <td className="px-3 py-2 tabular-nums">{p.leadTimeDays} hari</td>
              <td className="px-3 py-2 tabular-nums">{formatKg(sold30)}</td>
              <td className="px-3 py-2 tabular-nums">{formatKg(reorderPoint)}</td>
              <td className="px-3 py-2">{statusPill(status)}</td>
              <td className="px-3 py-2">
                <Link href={`/admin/inventory?product=${p.id}`} className="text-xs text-orange-700 underline whitespace-nowrap">
                  Log stok
                </Link>
              </td>
            </tr>
          ))}
        </Table>
        <p className="text-[11px] text-slate-500 mt-2">
          Reorder point = rata-rata penjualan harian (30 hari) × lead time supplier + batas stok minimum.
        </p>
      </Panel>

      <Panel
        title={`Log pergerakan stok${searchParams.product ? ` — ${products.find((p) => p.id === searchParams.product)?.name ?? ''}` : ''}`}
        action={searchParams.product ? <Link href="/admin/inventory" className="text-xs underline">Semua produk</Link> : undefined}
      >
        <Table head={['Waktu', 'Produk', 'Jenis', 'Jumlah', 'Stok sebelum → sesudah', 'Alasan', 'Oleh']}>
          {movements.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
              <td className="px-3 py-2">{m.product.name}</td>
              <td className="px-3 py-2">
                <Pill className={MOVE_LABEL[m.type].cls}>{MOVE_LABEL[m.type].label}</Pill>
              </td>
              <td className={`px-3 py-2 tabular-nums font-semibold ${m.type === 'OUT' || m.quantityKg < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {m.type === 'OUT' ? '−' : m.quantityKg >= 0 ? '+' : ''}
                {formatKg(Math.abs(m.quantityKg))}
              </td>
              <td className="px-3 py-2 tabular-nums text-xs">
                {formatKg(m.stockBefore)} → <strong>{formatKg(m.stockAfter)}</strong>
              </td>
              <td className="px-3 py-2 text-xs">{m.reason}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{m.user?.name ?? 'Sistem'}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
