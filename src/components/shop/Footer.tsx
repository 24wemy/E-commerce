import Link from 'next/link';
import { Logo } from '@/components/shop/Logo';
import { CATEGORY_META, STORE_INFO } from '@/lib/catalog';

export function Footer() {
  return (
    <footer className="bg-daun-950 text-daun-100 mt-16">
      <div className="mx-auto max-w-7xl px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-4 text-sm text-daun-200 max-w-xs leading-relaxed">
            Ayam dipotong setiap subuh dari peternak mitra di Minahasa Utara, ditimbang digital, lalu diantar ke rumah dan usaha Anda.
          </p>
        </div>
        <div>
          <h3 className="text-white font-semibold mb-3">Kategori</h3>
          <ul className="space-y-2 text-sm">
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <li key={k}>
                <Link href={`/?kategori=${k}#katalog`} className="hover:text-white">
                  {v.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-white font-semibold mb-3">Belanja</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/my-orders" className="hover:text-white">
                Lacak pesanan
              </Link>
            </li>
            <li>
              <Link href="/#promo" className="hover:text-white">
                Promo berjalan
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-white">
                Daftar akun
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-white font-semibold mb-3">Kontak</h3>
          <ul className="space-y-2 text-sm text-daun-200">
            <li>{STORE_INFO.address}</li>
            <li>
              <a href={`https://wa.me/${STORE_INFO.whatsapp}`} className="hover:text-white">
                WhatsApp {STORE_INFO.phone}
              </a>
            </li>
            <li>{STORE_INFO.hours}</li>
          </ul>
          <p className="mt-4 text-xs text-daun-300">Pembayaran: transfer bank (VA), QRIS, GoPay, kartu — diproses Midtrans.</p>
        </div>
      </div>
      <div className="border-t border-daun-900">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-daun-300 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} Fresh Minut, Minahasa Utara</span>
          <span>Harga sudah termasuk pemotongan & pembersihan</span>
        </div>
      </div>
    </footer>
  );
}
