'use client';

import { useState } from 'react';
import { Drumstick } from 'lucide-react';

/** Gambar dengan tampilan cadangan yang rapi bila URL foto gagal dimuat. */
export function SafeImage({ src, alt, className = '', iconClassName = 'h-1/3 w-1/3' }: { src?: string | null; alt: string; className?: string; iconClassName?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span role="img" aria-label={alt} className={`grid place-items-center bg-daun-50 text-daun-300 ${className}`}>
        <Drumstick className={iconClassName} strokeWidth={1.5} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}
