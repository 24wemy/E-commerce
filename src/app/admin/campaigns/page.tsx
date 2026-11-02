import { prisma } from '@/lib/prisma';
import { createRetentionCampaignAction } from '@/actions/admin';
import { SEGMENT_META, CustomerSegmentKey, formatIDR, formatDateTime } from '@/lib/business-rules';
import { PageHeader, Panel, Table, SegmentPill, fieldCls, labelCls, btnCls } from '@/components/admin/ui';
import { ActionForm } from '@/components/admin/ActionForm';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const segCounts = await prisma.user.groupBy({ by: ['segment'], where: { role: 'CUSTOMER' }, _count: { _all: true } });
  const segMap = new Map(segCounts.map((s) => [s.segment, s._count._all]));
  const campaigns = await prisma.retentionCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { promotion: { include: { usages: true } }, recipients: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kampanye Retensi"
        subtitle="Aksi retensi CRM: pilih segmen → sistem membuat kode promo khusus segmen tsb dan mengirimkannya via email ke setiap pelanggan di segmen."
      />

      <Panel title="Buat & kirim kampanye">
        <ActionForm action={createRetentionCampaignAction} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nama kampanye</label>
            <input name="name" required className={fieldCls} defaultValue="Kami Kangen Kamu — Comeback Promo" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Segmen target</label>
            <select name="segment" className={fieldCls} defaultValue="INACTIVE">
              {(Object.keys(SEGMENT_META) as CustomerSegmentKey[]).map((k) => (
                <option key={k} value={k}>
                  {SEGMENT_META[k].label} — {segMap.get(k) ?? 0} pelanggan
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Jenis promo</label>
            <select name="promoType" className={fieldCls} defaultValue="PERCENTAGE">
              <option value="PERCENTAGE">Diskon persen</option>
              <option value="FIXED_AMOUNT">Diskon nominal</option>
              <option value="FREE_SHIPPING">Gratis ongkir</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Nilai (% / Rp)</label>
            <input name="value" type="number" min={0} defaultValue={20} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Maks. diskon (Rp)</label>
            <input name="maxDiscount" type="number" min={0} defaultValue={30000} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Min. belanja (Rp)</label>
            <input name="minOrder" type="number" min={0} defaultValue={75000} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Berlaku (hari)</label>
            <input name="validDays" type="number" min={1} max={90} defaultValue={7} className={fieldCls} />
          </div>
          <div className="sm:col-span-3">
            <label className={labelCls}>Pesan email</label>
            <textarea
              name="message"
              rows={3}
              required
              className={fieldCls}
              defaultValue="Sudah lama kamu tidak belanja ayam segar di Fresh Minut. Stok ayam potong subuh kami selalu segar — dan kali ini ada hadiah khusus untukmu."
            />
          </div>
          <div className="sm:col-span-4">
            <button className={btnCls}>Buat kode & kirim ke segmen</button>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Hasil kampanye">
        <Table head={['Kampanye', 'Segmen', 'Kode', 'Penerima', 'Dipakai', 'Konversi', 'Omzet', 'Dikirim']} empty="Belum ada kampanye.">
          {campaigns.map((c) => {
            const used = c.promotion?.usages.length ?? 0;
            const revenue = c.promotion?.usages.reduce((a, u) => a + u.orderTotal, 0) ?? 0;
            const sent = c.recipients.filter((r) => r.status === 'SENT').length;
            return (
              <tr key={c.id}>
                <td className="px-3 py-2 font-semibold">{c.name}</td>
                <td className="px-3 py-2">
                  <SegmentPill segment={c.segment} />
                </td>
                <td className="px-3 py-2 font-mono">{c.promotion?.code ?? '-'}</td>
                <td className="px-3 py-2 tabular-nums">
                  {c.recipientCount}
                  <div className="text-[10px] text-slate-400">{sent} email terkirim</div>
                </td>
                <td className="px-3 py-2 tabular-nums">{used}</td>
                <td className="px-3 py-2 tabular-nums">{c.recipientCount ? ((used / c.recipientCount) * 100).toFixed(0) : 0}%</td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(revenue)}</td>
                <td className="px-3 py-2 text-xs">{formatDateTime(c.createdAt)}</td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </div>
  );
}
