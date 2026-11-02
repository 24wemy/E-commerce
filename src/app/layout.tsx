import type { Metadata } from 'next';
// Plus Jakarta Sans — dibundel lokal lewat npm (tidak bergantung Google Fonts saat build)
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

export const metadata: Metadata = {
  title: 'Fresh Minut — Ayam segar potong subuh, Minahasa Utara',
  description:
    'Ayam broiler, kampung, potongan, dan olahan segar yang dipotong setiap subuh dan diantar ke Airmadidi, Kalawat, Kauditan, Dimembe, dan Manado.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="antialiased font-sans bg-surface text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
