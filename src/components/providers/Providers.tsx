'use client';

import { SessionProvider } from 'next-auth/react';
import { CartSync } from '@/components/providers/CartSync';
import { ChatWidget } from '@/components/shop/ChatWidget';
import { NavigationProgress } from '@/components/providers/NavigationProgress';
import { Suspense } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // Tidak perlu cek sesi ke server setiap kali jendela browser difokuskan
    <SessionProvider refetchOnWindowFocus={false}>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <CartSync />
      {children}
      <ChatWidget />
    </SessionProvider>
  );
}
