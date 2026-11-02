'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Search, User, ChevronDown, Truck, Clock, Phone, LayoutDashboard, Package, LogOut, MessageCircle } from 'lucide-react';
import { CartSheet } from '@/components/shop/CartSheet';
import { Logo } from '@/components/shop/Logo';
import { CATEGORY_META, STORE_INFO } from '@/lib/catalog';

export function openChat() {
  window.dispatchEvent(new Event('fm:open-chat'));
}

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tutup menu bila klik di luar / tekan Esc (bukan onBlur, yang bisa menutup menu sebelum klik "Keluar" terkirim)
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut({ redirect: false });
    } finally {
      // Muat ulang penuh agar semua data sesi di halaman ikut bersih
      window.location.href = '/';
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (cat) p.set('kategori', cat);
    router.push(`/${p.toString() ? `?${p}` : ''}#katalog`);
  };

  const navCls = (active: boolean) =>
    `px-3 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${active ? 'text-daun-700 bg-daun-50' : 'text-slate-700 hover:text-daun-700'}`;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      {/* Info bar */}
      <div className="bg-daun-800 text-daun-100 text-xs">
        <div className="mx-auto max-w-7xl px-4 h-9 flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 truncate">
            <Truck className="h-3.5 w-3.5 shrink-0" /> Antar ke {STORE_INFO.area}
          </span>
          <span className="hidden md:flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pesan sebelum 21.00, diantar subuh esok hari
          </span>
          <a href={`tel:${STORE_INFO.phone.replace(/-/g, '')}`} className="hidden sm:flex items-center gap-1.5 hover:text-white">
            <Phone className="h-3.5 w-3.5" /> {STORE_INFO.phone}
          </a>
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4 lg:gap-8">
        <Link href="/" aria-label="Fresh Minut, beranda" className="shrink-0">
          <Logo />
        </Link>

        <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-2xl h-11 items-stretch rounded-lg border border-slate-300 focus-within:border-daun-600 focus-within:ring-2 focus-within:ring-daun-100 overflow-hidden">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari ayam fillet, sayap, telur kampung…"
            className="flex-1 px-4 text-sm outline-none bg-transparent placeholder:text-slate-400"
            aria-label="Cari produk"
          />
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="border-l border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
            aria-label="Kategori"
          >
            <option value="">Semua kategori</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.short}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-daun-700 hover:bg-daun-800 text-white px-4" aria-label="Cari">
            <Search className="h-4 w-4" />
          </button>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                aria-expanded={menuOpen}
              >
                <span className="h-9 w-9 rounded-full bg-daun-100 text-daun-800 font-bold grid place-items-center text-sm">
                  {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="hidden lg:block text-left leading-tight">
                  <span className="block text-xs text-slate-500">Halo,</span>
                  <span className="block text-sm font-semibold text-ink max-w-[120px] truncate">{user.name?.split(' ')[0]}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400 hidden lg:block" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm">
                  <Link href="/my-orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                    <Package className="h-4 w-4 text-slate-500" /> Pesanan saya
                  </Link>
                  {user.role === 'ADMIN' && (
                    <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                      <LayoutDashboard className="h-4 w-4 text-slate-500" /> Panel admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={logout}
                    disabled={signingOut}
                    className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2 hover:bg-slate-50 text-left disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4 text-slate-500" /> {signingOut ? 'Keluar...' : 'Keluar'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <User className="h-5 w-5 text-slate-600" />
              <span className="hidden lg:block leading-tight">
                <span className="block text-xs text-slate-500">Masuk / Daftar</span>
                <span className="block text-sm font-semibold text-ink">Akun saya</span>
              </span>
            </Link>
          )}
          <CartSheet />
        </div>
      </div>

      {/* Mobile search */}
      <form onSubmit={submitSearch} className="md:hidden px-4 pb-3">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari produk…"
            className="flex-1 px-3 py-2 text-sm outline-none"
            aria-label="Cari produk"
          />
          <button className="bg-daun-700 text-white px-3" aria-label="Cari">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Nav */}
      <nav className="border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 h-11 flex items-center gap-1 overflow-x-auto text-sm">
          <Link href="/" className={navCls(pathname === '/')}>
            Beranda
          </Link>
          <Link href="/#katalog" className={navCls(false)}>
            Semua produk
          </Link>
          <Link href="/#promo" className={navCls(false)}>
            Promo
          </Link>
          <Link href="/my-orders" className={navCls(pathname.startsWith('/my-orders') || pathname.startsWith('/orders'))}>
            Pesanan saya
          </Link>
          <button onClick={openChat} className={`${navCls(false)} flex items-center gap-1.5`}>
            <MessageCircle className="h-4 w-4" /> Bantuan
          </button>
          <span className="ml-auto hidden lg:block text-xs text-slate-500 whitespace-nowrap">{STORE_INFO.hours}</span>
        </div>
      </nav>
    </header>
  );
}
