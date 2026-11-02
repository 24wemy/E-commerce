import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { updateAdminOrderStatusAction, confirmPickupAction } from '@/actions/admin';
import { STORE, formatIDR, formatKg, formatDateTime, googleMapsDirections } from '@/lib/business-rules';
import { AUTO_COMPLETE_HOURS } from '@/lib/order-status';
import { STATUS_LABEL, adminNextStatus } from '@/lib/fulfillment';
import { DeliveriesMap } from '@/components/maps';
import { expressDeadline, isFreshOrder, orderScheduleText, witaTime } from '@/lib/schedule';
import { PageHeader, Panel, Pill, StatCard, fieldCls, btnGhostCls } from '@/components/admin/ui';
import { ActionButton, ActionForm } from '@/components/admin/ActionForm';

export const dynamic = 'force-dynamic';

const ACTIVE = ['PROCESSING', 'CONFIRMED', 'WEIGHT_VERIFIED', 'SHIPPED', 'READY_FOR_PICKUP'] as const;

export default async function DeliveriesPage() {
  const orders = await prisma.order.findMany({
    where: { stockDeducted: true, status: { in: [...ACTIVE] } },
    orderBy: [{ shippingDistanceKm: 'asc' }],
    include: { user: true, items: { include: { product: true } } },
  });
  const now = new Date();
  // Prioritas: antar sekarang (paling lama dibayar dulu) → jadwal paling awal → jarak terdekat
  const due = (o: (typeof orders)[number]) =>
    o.isExpress ? expressDeadline(o.paidAt)?.getTime() ?? 0 : o.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const out = (o: (typeof orders)[number]) => Number(o.status === 'SHIPPED' || o.status === 'READY_FOR_PICKUP');
  const byPriority = (a: (typeof orders)[number], b: (typeof orders)[number]) =>
    out(a) - out(b) || Number(b.isExpress) - Number(a.isExpress) || due(a) - due(b) || a.shippingDistanceKm - b.shippingDistanceKm;
  const deliveries = orders.filter((o) => o.fulfillmentMethod === 'DELIVERY').sort(byPriority);
  const pickups = orders.filter((o) => o.fulfillmentMethod === 'PICKUP').sort(byPriority);
  const expressWaiting = deliveries.filter((o) => o.isExpress && o.status !== 'SHIPPED');
  const stops = deliveries
    .filter((o) => o.deliveryLat != null && o.deliveryLng != null)
    .map((o, i) => ({ lat: o.deliveryLat!, lng: o.deliveryLng!, label: String(i + 1), title: o.orderNumber }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengantaran & pengambilan"
        subtitle="Pesanan lunas yang belum selesai, diurutkan: belum berangkat dulu, lalu antar sekarang → jadwal paling awal → jarak terdekat. Halaman ini memuat ulang otomatis tiap 30 detik."
      />
      {expressWaiting.length > 0 && (
        <div role="alert" data-express-alert className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{expressWaiting.length} pesanan antar sekarang</strong> menunggu dikirim. Batas tiba paling dekat:{' '}
          {witaTime(expressDeadline(expressWaiting[0].paidAt) ?? now)} WITA.
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Perlu diantar" value={deliveries.filter((o) => o.status !== 'SHIPPED').length} hint={expressWaiting.length ? `${expressWaiting.length} antar sekarang` : undefined} />
        <StatCard label="Sedang di jalan" value={deliveries.filter((o) => o.status === 'SHIPPED').length} />
        <StatCard label="Disiapkan untuk diambil" value={pickups.filter((o) => o.status !== 'READY_FOR_PICKUP').length} />
        <StatCard label="Menunggu diambil" value={pickups.filter((o) => o.status === 'READY_FOR_PICKUP').length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={`Peta antar (${stops.length} titik)`}>
          <div className="h-[460px] overflow-hidden rounded-lg border border-slate-200">
            <DeliveriesMap store={STORE} stops={stops} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Pin hijau = toko. Nomor pin sesuai urutan di daftar.</p>
        </Panel>

        <Panel title="Urutan antar">
          {deliveries.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada pesanan yang perlu diantar.</p>
          ) : (
            <ol className="space-y-3">
              {deliveries.map((o, i) => {
                const next = adminNextStatus('DELIVERY', o.status);
                const deadline = o.isExpress ? expressDeadline(o.paidAt) : null;
                const late = deadline && o.status !== 'SHIPPED' && deadline < now;
                return (
                  <li key={o.id} className={`rounded-lg border p-3 text-sm ${o.isExpress ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-cabai-500 text-xs font-bold text-white">{i + 1}</span>
                        <Link href={`/admin/orders/${o.orderNumber}`} className="font-semibold text-ink hover:underline">
                          {o.user?.name ?? o.orderNumber}
                        </Link>
                        <Badges isExpress={o.isExpress} fresh={isFreshOrder(o.paidAt, now.getTime())} late={!!late} />
                        <p className={`mt-1 text-xs font-semibold ${late ? 'text-red-700' : o.isExpress ? 'text-amber-800' : 'text-daun-800'}`}>
                          {orderScheduleText(o, now)}
                        </p>
                        <p className="mt-1 text-slate-600">{o.shippingAddress}</p>
                        {o.addressNote && <p className="text-xs text-slate-500">Patokan: {o.addressNote}</p>}
                        <p className="text-xs text-slate-500">
                          {o.shippingDistanceKm} km · {formatKg(o.requestedWeightKg)} · {formatIDR(o.finalAmount)}
                          {o.user?.phone ? ` · ${o.user.phone}` : ''}
                        </p>
                      </div>
                      <Pill className="border-slate-300">{STATUS_LABEL[o.status]}</Pill>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {next && (
                        <ActionButton action={updateAdminOrderStatusAction.bind(null, o.orderNumber, next as never)} className={btnGhostCls}>
                          Tandai: {STATUS_LABEL[next]}
                        </ActionButton>
                      )}
                      {o.status === 'SHIPPED' && <AwaitingCustomer shippedAt={o.shippedAt} />}
                      {o.deliveryLat != null && o.deliveryLng != null && (
                        <a href={googleMapsDirections(o.deliveryLat, o.deliveryLng)} target="_blank" rel="noreferrer" className={btnGhostCls}>
                          Rute
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Ambil di toko">
        {pickups.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada pesanan ambil di toko yang menunggu.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pickups.map((o) => {
              const next = adminNextStatus('PICKUP', o.status);
              return (
                <div key={o.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/admin/orders/${o.orderNumber}`} className="font-semibold text-ink hover:underline">
                        {o.user?.name ?? o.orderNumber}
                      </Link>
                      <Badges isExpress={false} fresh={isFreshOrder(o.paidAt, now.getTime())} late={false} />
                      <p className="mt-1 text-xs font-semibold text-daun-800">Ambil {orderScheduleText(o, now)}</p>
                      <p className="text-xs text-slate-500">
                        {o.items.map((i) => `${i.product.name} ${formatKg(i.requestedKg)}`).join(', ')}
                      </p>
                    </div>
                    <Pill className="border-slate-300">{STATUS_LABEL[o.status]}</Pill>
                  </div>
                  <div className="mt-2">
                    {next === 'READY_FOR_PICKUP' && (
                      <ActionButton action={updateAdminOrderStatusAction.bind(null, o.orderNumber, 'READY_FOR_PICKUP' as never)} className={btnGhostCls}>
                        Tandai: Siap diambil
                      </ActionButton>
                    )}
                    {next === 'PICKED_UP' && (
                      <ActionForm action={confirmPickupAction} className="flex gap-2">
                        <input type="hidden" name="orderNumber" value={o.orderNumber} />
                        <input name="pickupCode" required placeholder="Kode dari pelanggan" className={`${fieldCls} uppercase`} />
                        <button className="rounded-md bg-daun-700 px-3 text-sm font-semibold text-white">Serahkan</button>
                      </ActionForm>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Badges({ isExpress, fresh, late }: { isExpress: boolean; fresh: boolean; late: boolean }) {
  return (
    <>
      {isExpress && <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">Antar sekarang</span>}
      {late && <span className="ml-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Terlambat</span>}
      {fresh && <span className="ml-1.5 rounded-full bg-daun-700 px-2 py-0.5 text-[11px] font-bold text-white">Baru</span>}
    </>
  );
}

/** Pesanan sudah dikirim: menunggu pelanggan menekan "Pesanan sudah saya terima". */
function AwaitingCustomer({ shippedAt }: { shippedAt: Date | null }) {
  const auto = shippedAt ? new Date(shippedAt.getTime() + AUTO_COMPLETE_HOURS * 3600_000) : null;
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
      Menunggu konfirmasi pelanggan{auto ? ` · otomatis selesai ${formatDateTime(auto)}` : ''}
    </span>
  );
}
