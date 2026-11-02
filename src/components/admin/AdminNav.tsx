'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Pesanan' },
  { href: '/admin/deliveries', label: 'Pengantaran' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/products', label: 'Produk' },
  { href: '/admin/promotions', label: 'Promo' },
  { href: '/admin/customers', label: 'CRM' },
  { href: '/admin/campaigns', label: 'Kampanye Retensi' },
  { href: '/admin/carts', label: 'Keranjang' },
  { href: '/admin/operasional', label: 'Operasional & AI' },
  { href: '/admin/logs', label: 'Log' },
];

/** Menu admin dengan penanda halaman aktif dan angka antrean. */
export function AdminNav({ badge }: { badge: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Menu admin" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-sm font-medium">
      {NAV.map((n) => {
        const active = n.href === '/admin' ? path === '/admin' : path === n.href || path.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
              active ? 'bg-daun-50 text-daun-800' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
            }`}
          >
            {n.label}
            {badge[n.href] > 0 && (
              <span
                className={`min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5 text-white ${
                  n.href === '/admin/deliveries' ? 'bg-amber-500' : 'bg-red-600'
                }`}
                aria-label={n.href === '/admin/deliveries' ? `${badge[n.href]} antar sekarang` : `${badge[n.href]} perlu diproses`}
              >
                {badge[n.href]}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
