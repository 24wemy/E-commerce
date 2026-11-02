import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { sendCartReminderAction } from '@/actions/admin';
import { ABANDONED_CART_MINUTES, formatIDR, formatKg, formatDateTime } from '@/lib/business-rules';
import { PageHeader, Panel, Table, StatCard, SegmentPill, Pill, btnGhostCls } from '@/components/admin/ui';
import { ActionButton } from '@/components/admin/ActionForm';

export const dynamic = 'force-dynamic';

function ago(d: Date) {
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export default async function CartsPage() {
  const carts = await prisma.cart.findMany({
    where: { status: 'ACTIVE', items: { some: {} } },
    orderBy: { lastActivityAt: 'asc' },
    include: { user: true, items: { include: { product: true } } },
  });
  const threshold = new Date(Date.now() - ABANDONED_CART_MINUTES * 60_000);
  const rows = carts.map((c) => ({
    c,
    value: c.items.reduce((a, i) => a + Math.round(i.pricePerKg * i.quantityKg), 0),
    abandoned: c.lastActivityAt < threshold,
  }));
  const abandoned = rows.filter((r) => r.abandoned);
  const converted = await prisma.cart.count({ where: { status: 'CONVERTED' } });
  const reminded = await prisma.cart.count({ where: { reminderCount: { gt: 0 } } });
  const recovered = await prisma.cart.count({ where: { status: 'CONVERTED', reminderCount: { gt: 0 } } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keranjang Belum Checkout"
        subtitle={`Isi keranjang pelanggan yang login tersimpan otomatis. Dianggap terbengkalai jika tidak ada aktivitas > ${ABANDONED_CART_MINUTES} menit.`}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Keranjang terbengkalai" value={abandoned.length} tone={abandoned.length ? 'warn' : 'default'} />
        <StatCard label="Potensi omzet tertahan" value={formatIDR(abandoned.reduce((a, r) => a + r.value, 0))} />
        <StatCard label="Masih aktif (< 1 jam)" value={rows.length - abandoned.length} />
        <StatCard label="Pulih setelah pengingat" value={`${recovered} / ${reminded}`} hint={`${converted} keranjang sudah checkout`} />
      </div>

      <Panel title="Daftar keranjang">
        <Table head={['Pelanggan', 'Segmen', 'Isi keranjang', 'Nilai', 'Aktivitas terakhir', 'Status', 'Pengingat', 'Aksi']} empty="Tidak ada keranjang yang menunggu checkout.">
          {rows.map(({ c, value, abandoned: ab }) => (
            <tr key={c.id} className="align-top">
              <td className="px-3 py-2">
                <Link href={`/admin/customers/${c.user.id}`} className="font-semibold hover:underline">
                  {c.user.name}
                </Link>
                <div className="text-[11px] text-slate-500">{c.user.email}</div>
              </td>
              <td className="px-3 py-2">
                <SegmentPill segment={c.user.segment} />
              </td>
              <td className="px-3 py-2 text-xs">
                {c.items.map((i) => (
                  <div key={i.id}>
                    {i.product.name} × {formatKg(i.quantityKg)}
                  </div>
                ))}
              </td>
              <td className="px-3 py-2 tabular-nums font-semibold">{formatIDR(value)}</td>
              <td className="px-3 py-2 text-xs">
                {ago(c.lastActivityAt)}
                <div className="text-[10px] text-slate-400">{formatDateTime(c.lastActivityAt)}</div>
              </td>
              <td className="px-3 py-2">
                {ab ? <Pill className="bg-amber-100 text-amber-900 border-amber-400">Terbengkalai</Pill> : <Pill className="bg-sky-50 text-sky-700 border-sky-300">Aktif</Pill>}
              </td>
              <td className="px-3 py-2 text-xs">{c.reminderCount ? `${c.reminderCount}x • ${formatDateTime(c.reminderSentAt!)}` : '-'}</td>
              <td className="px-3 py-2">
                <ActionButton action={sendCartReminderAction.bind(null, c.id)} className={btnGhostCls}>
                  Kirim pengingat
                </ActionButton>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
