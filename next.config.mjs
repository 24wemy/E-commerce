/** @type {import('next').NextConfig} */
const securityHeaders = [
  // HSTS: paksa HTTPS (aktif hanya bila diakses lewat HTTPS / Cloudflare)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(self), microphone=(self)' },
];

const nextConfig = {
  poweredByHeader: false,
  experimental: {
    // dimuat langsung dari node_modules saat runtime (tidak di-bundle)
    serverComponentsExternalPackages: ['midtrans-client', 'nodemailer'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
