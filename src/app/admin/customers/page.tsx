import Link from 'next/link';
import { getCrmMetrics } from '@/lib/crm';
import { refreshSegmentsAction } from '@/actions/admin';
import { SEGMENT_META, SEGMENT_RULES, CustomerSegmentKey, formatIDR, formatDate } from '@/lib/business-rules';
import { PageHeader, Panel, Table, StatCard, SegmentPill, btnGhostCls } from '@/components/admin/ui';
import { ActionButton } from '@/components/admin/ActionForm';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({ searchParams }: { searchParams: { segment?: string; sort?: string } }) {
  const m = await getCrmMetrics();
  let rows = m.rows;
  if (searchParams.segment) rows = rows.filter((r) => r.segment === searchParams.segment);
  if (searchParams.sort === 'spend') rows = [...rows].sort((a, b) => b.totalSpend - a.totalSpend);
  else if (searchParams.sort === 'recent') rows = [...rows].sort((a, b) => (a.daysSinceLast ?? 1e9) - (b.daysSinceLast ?? 1e9));

  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { segment: searchParams.segment, sort: searchParams.sort, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/customers?${s}` : '/admin/customers';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="CRM — Pelanggan" subtitle="Profil, riwayat order, dan segmentasi otomatis dari data transaksi.">
        <ActionButton action={refreshSegmentsAction} className={btnGhostCls}>
          ↻ Hitung ulang segmen
        </ActionButton>
        <Link href="/admin/campaigns" className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white">
          Jalankan aksi retensi →
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Jumlah pelanggan" value={m.totalCustomers} hint={`${m.newThisMonth} daftar bulan ini`} />
        <StatCard label="Pernah membeli" value={m.buyers} />
        <StatCard label="Repeat purchase rate" value={`${(m.repeatPurchaseRate * 100).toFixed(1)}%`} hint="pembeli dengan ≥ 2 order dibayar" />
        <StatCard label="Rata-rata nilai order" value={formatIDR(m.averageOrderValue)} hint={`${m.orderCount} order dibayar`} />
        <StatCard label="CLV rata-rata" value={formatIDR(m.averageClv)} hint="total belanja / pembeli" />
      </div>

      <Panel title="Aturan segmentasi">
        <div className="grid sm:grid-cols-5 gap-2">
          {(Object.keys(SEGMENT_META) as CustomerSegmentKey[]).map((k) => (
            <Link
              key={k}
              href={q({ segment: searchParams.segment === k ? undefined : k })}
              className={`rounded-lg border p-3 hover:shadow ${searchParams.segment === k ? 'ring-2 ring-orange-400' : ''}`}
            >
              <div className="flex items-center justify-between">
                <SegmentPill segment={k} />
                <span className="text-xl font-black tabular-nums">{m.segments[k]}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">{SEGMENT_META[k].rule}</p>
            </Link>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Segmen diperbarui otomatis setiap order dibayar/dibatalkan. Batas tidak aktif: {SEGMENT_RULES.INACTIVE_AFTER_DAYS} hari; loyal: ≥{' '}
          {SEGMENT_RULES.LOYAL_MIN_ORDERS} order.
        </p>
      </Panel>

      <Panel
        title={`Daftar pelanggan${searchParams.segment ? ` — ${SEGMENT_META[searchParams.segment as CustomerSegmentKey]?.label}` : ''} (${rows.length})`}
        action={
          <div className="flex gap-2 text-xs">
            Urutkan:
            <Link className="underline" href={q({ sort: undefined })}>
              terbaru daftar
            </Link>
            <Link className="underline" href={q({ sort: 'spend' })}>
              total belanja
            </Link>
            <Link className="underline" href={q({ sort: 'recent' })}>
              terakhir belanja
            </Link>
          </div>
        }
      >
        <Table head={['Pelanggan', 'Segmen', 'Order lunas', 'Total belanja (CLV)', 'Rata-rata', 'Terakhir belanja', 'RFM', 'Poin', 'Daftar']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2">
                <Link href={`/admin/customers/${r.id}`} className="font-semibold hover:underline text-orange-800">
                  {r.name}
                </Link>
                <div className="text-[11px] text-slate-500">{r.email}</div>
              </td>
              <td className="px-3 py-2">
                <SegmentPill segment={r.segment} />
              </td>
              <td className="px-3 py-2 tabular-nums">{r.paidOrders}</td>
              <td className="px-3 py-2 tabular-nums">{formatIDR(r.totalSpend)}</td>
              <td className="px-3 py-2 tabular-nums">{r.avgOrder ? formatIDR(r.avgOrder) : '-'}</td>
              <td className="px-3 py-2 text-xs">{r.lastPaidAt ? `${formatDate(r.lastPaidAt)} (${r.daysSinceLast} hari)` : '-'}</td>
              <td className="px-3 py-2 font-mono text-xs" title="Recency-Frequency-Monetary (1-5)">
                {r.paidOrders ? r.rfm.label : '-'}
              </td>
              <td className="px-3 py-2 tabular-nums">{r.loyaltyPoints}</td>
              <td className="px-3 py-2 text-xs">{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
