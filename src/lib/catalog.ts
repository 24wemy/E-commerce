// Label kategori untuk tampilan toko (nilai = kolom Product.category di database)
export const CATEGORY_META: Record<string, { label: string; short: string }> = {
  AYAM_SEGAR: { label: 'Ayam Broiler', short: 'Broiler' },
  AYAM_KAMPUNG: { label: 'Ayam Kampung & Pejantan', short: 'Kampung' },
  PART_CUT: { label: 'Potongan & Fillet', short: 'Potongan' },
  JEROAN: { label: 'Jeroan, Ceker & Tulang', short: 'Jeroan' },
  OLAHAN: { label: 'Olahan & Siap Masak', short: 'Olahan' },
  TELUR: { label: 'Telur', short: 'Telur' },
  BUMBU: { label: 'Bumbu Khas Manado', short: 'Bumbu' },
};

export const categoryLabel = (c: string) => CATEGORY_META[c]?.label ?? c.replace(/_/g, ' ').toLowerCase();

export const STORE_INFO = {
  phone: '0812-4400-2026',
  whatsapp: '6281244002026',
  hours: 'Setiap hari 05.00–20.00 WITA',
  area: 'Airmadidi, Kalawat, Kauditan, Dimembe & Manado',
  address: 'Jl. Raya Airmadidi–Kauditan, Airmadidi Bawah, Minahasa Utara',
};
