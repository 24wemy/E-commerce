import Link from 'next/link';
import { SEGMENT_META, CustomerSegmentKey } from '@/lib/business-rules';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'warn' | 'good' | 'bad';
  href?: string;
}) {
  const toneCls = {
    default: 'border-slate-200',
    warn: 'border-amber-300 bg-amber-50',
    good: 'border-emerald-300 bg-emerald-50',
    bad: 'border-rose-300 bg-rose-50',
  }[tone];
  const body = (
    <div className={`rounded-xl border bg-white p-4 h-full ${toneCls} ${href ? 'hover:shadow-md transition' : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Panel({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          {title && <h2 className="font-bold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="px-3 py-8 text-center text-slate-400">
                {empty ?? 'Belum ada data.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${className}`}>{children}</span>;
}

export function SegmentPill({ segment }: { segment: string }) {
  const meta = SEGMENT_META[segment as CustomerSegmentKey];
  return <Pill className={meta?.color ?? ''}>{meta?.label ?? segment}</Pill>;
}

export function PaymentPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    SETTLEMENT: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    UNPAID: 'bg-amber-50 text-amber-800 border-amber-300',
    PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
    EXPIRE: 'bg-slate-100 text-slate-600 border-slate-300',
    CANCEL: 'bg-rose-50 text-rose-700 border-rose-300',
    DENY: 'bg-rose-50 text-rose-700 border-rose-300',
    REFUND: 'bg-purple-50 text-purple-700 border-purple-300',
  };
  const label: Record<string, string> = {
    SETTLEMENT: 'Lunas',
    UNPAID: 'Belum bayar',
    PENDING: 'Menunggu',
    EXPIRE: 'Kedaluwarsa',
    CANCEL: 'Batal',
    DENY: 'Ditolak',
    REFUND: 'Refund',
  };
  return <Pill className={cls[status] ?? ''}>{label[status] ?? status}</Pill>;
}

export const fieldCls =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';
export const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';
export const btnCls =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50';
export const btnGhostCls =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
