import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { upsertPromotionAction, togglePromotionAction } from '@/actions/admin';
import { PROMO_TYPE_META, SEGMENT_META, CustomerSegmentKey, formatIDR, formatDateTime } from '@/lib/business-rules';
import { PageHeader, Panel, Table, Pill, StatCard, SegmentPill, fieldCls, labelCls, btnCls, btnGhostCls } from '@/components/admin/ui';
import { ActionForm, ActionButton } from '@/components/admin/ActionForm';

export const dynamic = 'force-dynamic';

const toLocalInput = (d: Date) => {
  // tampilkan dalam WITA (UTC+8) untuk input datetime-local
  const wita = new Date(d.getTime() + 8 * 3600_000);
  return wita.toISOString().slice(0, 16);
};

export default async function PromotionsPage({ searchParams }: { searchParams: { edit?: string } }) {
  const now = new Date();
  const promos = await prisma.promotion.findMany({ orderBy: [{ isActive: 'desc' }, { endsAt: 'desc' }] });
  const usage = await prisma.promoUsage.groupBy({
    by: ['promotionId'],
    _count: { _all: true },
    _sum: { discountAmount: true, orderTotal: true, orderSubtotal: true },
  });
  const reserved = await prisma.order.groupBy({
    by: ['promotionId'],
    where: { promotionId: { not: null }, stockDeducted: false, paymentStatus: { in: ['UNPAID', 'PENDING'] }, status: 'PENDING' },
    _count: { _all: true },
  });
  const uMap = new Map(usage.map((u) => [u.promotionId, u]));
  const rMap = new Map(reserved.map((r) => [r.promotionId!, r._count._all]));
  const editing = searchParams.edit ? promos.find((p) => p.id === searchParams.edit) : undefined;

  const totals = usage.reduce(
    (a, u) => ({ uses: a.uses + u._count._all, disc: a.disc + (u._sum.discountAmount ?? 0), omzet: a.omzet + (u._sum.orderTotal ?? 0) }),
    { uses: 0, disc: 0, omzet: 0 }
  );

  const status = (p: (typeof promos)[number]) =>
    !p.isActive ? (
      <Pill className="border-slate-300 text-slate-500">Nonaktif</Pill>
    ) : now < p.startsAt ? (
      <Pill className="bg-sky-50 text-sky-700 border-sky-300">Terjadwal</Pill>
    ) : now > p.endsAt ? (
      <Pill className="bg-slate-100 text-slate-600 border-slate-300">Kedaluwarsa</Pill>
    ) : p.quota !== null && (uMap.get(p.id)?._count._all ?? 0) >= p.quota ? (
      <Pill className="bg-rose-50 text-rose-700 border-rose-300">Kuota habis</Pill>
    ) : (
      <Pill className="bg-emerald-100 text-emerald-800 border-emerald-300">Berjalan</Pill>
    );

  const valueText = (p: (typeof promos)[number]) =>
    p.type === 'FREE_SHIPPING'
      ? 'Ongkir Rp 0'
      : p.type === 'FIXED_AMOUNT'
        ? formatIDR(p.value)
        : `${p.value}%${p.maxDiscount ? ` (maks ${formatIDR(p.maxDiscount)})` : ''}`;

  const def = editing;
  return (
    <div className="space-y-6">
      <PageHeader title="Promo" subtitle="Semua aturan promo divalidasi di server saat checkout. 1 order = 1 kode (promo tidak bisa digabung)." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Promo berjalan" value={promos.filter((p) => p.isActive && p.startsAt <= now && p.endsAt >= now).length} />
        <StatCard label="Total pemakaian (order lunas)" value={totals.uses} />
        <StatCard label="Total diskon diberikan" value={formatIDR(totals.disc)} />
        <StatCard label="Omzet dari order berpromo" value={formatIDR(totals.omzet)} hint={totals.disc ? `ROI: ${(totals.omzet / totals.disc).toFixed(1)}× dari biaya diskon` : undefined} />
      </div>

      <Panel title="Laporan promo">
        <Table head={['Kode', 'Jenis', 'Nilai', 'Aturan', 'Periode', 'Status', 'Dipakai', 'Total diskon', 'Omzet', 'Aksi']}>
          {promos.map((p) => {
            const u = uMap.get(p.id);
            const uses = u?._count._all ?? 0;
            return (
              <tr key={p.id} className="align-top">
                <td className="px-3 py-2">
                  <div className="font-mono font-bold">{p.code}</div>
                  <div className="text-[11px] text-slate-500">{p.name}</div>
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{PROMO_TYPE_META[p.type].label}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{valueText(p)}</td>
                <td className="px-3 py-2 text-[11px] text-slate-600 space-y-0.5">
                  <div>Min. order {formatIDR(p.minOrder)}</div>
                  <div>Kuota {p.quota ?? '∞'} • per pelanggan {p.perCustomerLimit ?? '∞'}x</div>
                  {p.targetSegment && (
                    <div>
                      Khusus <SegmentPill segment={p.targetSegment} />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-[11px] whitespace-nowrap">
                  {formatDateTime(p.startsAt)}
                  <br />
                  s/d {formatDateTime(p.endsAt)}
                </td>
                <td className="px-3 py-2">{status(p)}</td>
                <td className="px-3 py-2 tabular-nums">
                  <strong>{uses}</strong>
                  {p.quota !== null && <span className="text-slate-400">/{p.quota}</span>}
                  {rMap.get(p.id) ? <div className="text-[10px] text-slate-400">+{rMap.get(p.id)} menunggu bayar</div> : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(u?._sum.discountAmount ?? 0)}</td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(u?._sum.orderTotal ?? 0)}</td>
                <td className="px-3 py-2 space-y-1">
                  <Link href={`/admin/promotions?edit=${p.id}#form`} className={btnGhostCls}>
                    Edit
                  </Link>
                  <ActionButton action={togglePromotionAction.bind(null, p.id)} className="text-xs underline text-slate-600">
                    {p.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </ActionButton>
                </td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      <div id="form">
        <Panel title={def ? `Edit promo ${def.code}` : 'Buat promo baru'} action={def ? <Link href="/admin/promotions" className="text-xs underline">Batal edit</Link> : undefined}>
          <ActionForm action={upsertPromotionAction} resetOnSuccess={!def} className="grid gap-3 sm:grid-cols-4" key={def?.id ?? 'new'}>
            {def && <input type="hidden" name="id" value={def.id} />}
            <div>
              <label className={labelCls}>Kode</label>
              <input name="code" required defaultValue={def?.code} className={`${fieldCls} uppercase font-mono`} placeholder="HEMAT10" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Nama promo</label>
              <input name="name" required defaultValue={def?.name} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Jenis</label>
              <select name="type" defaultValue={def?.type ?? 'PERCENTAGE'} className={fieldCls}>
                {Object.entries(PROMO_TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nilai (% atau Rp)</label>
              <input name="value" type="number" min={0} defaultValue={def?.value ?? 10} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Maks. diskon (Rp, opsional)</label>
              <input name="maxDiscount" type="number" min={0} defaultValue={def?.maxDiscount ?? ''} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Minimum belanja (Rp)</label>
              <input name="minOrder" type="number" min={0} defaultValue={def?.minOrder ?? 0} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Segmen target (opsional)</label>
              <select name="targetSegment" defaultValue={def?.targetSegment ?? ''} className={fieldCls}>
                <option value="">Semua pelanggan</option>
                {(Object.keys(SEGMENT_META) as CustomerSegmentKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SEGMENT_META[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Mulai (WITA)</label>
              <input name="startsAt" type="datetime-local" required defaultValue={toLocalInput(def?.startsAt ?? now)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Berakhir (WITA)</label>
              <input
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={toLocalInput(def?.endsAt ?? new Date(now.getTime() + 14 * 86_400_000))}
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Kuota total (opsional)</label>
              <input name="quota" type="number" min={1} defaultValue={def?.quota ?? ''} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Batas per pelanggan</label>
              <input name="perCustomerLimit" type="number" min={1} defaultValue={def ? def.perCustomerLimit ?? '' : 1} className={fieldCls} />
            </div>
            <div className="sm:col-span-4">
              <label className={labelCls}>Deskripsi</label>
              <input name="description" defaultValue={def?.description ?? ''} className={fieldCls} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={def?.isActive ?? true} /> Aktif
            </label>
            <div className="sm:col-span-4 flex items-center gap-3">
              <button className={btnCls}>{def ? 'Simpan perubahan' : 'Buat promo'}</button>
              <span className="text-[11px] text-slate-500">
                {Object.values(PROMO_TYPE_META)
                  .map((m) => `${m.label}: ${m.hint}`)
                  .join(' • ')}
              </span>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
