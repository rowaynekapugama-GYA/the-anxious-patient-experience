import { withPayload } from '@payloadcms/next/withPayload'

/** The headers the static site had in vercel.json (v1.4.0), now applied by Next.js. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // the public pages handle their own trailing slash in src/proxy.ts; /admin, /cms and /api are never redirected
  skipTrailingSlashRedirect: true,
  // files the dashboard reads while it runs (the content model, the photo list, the asset version)
  outputFileTracingIncludes: {
    '/api/import-content': ['./content/**/*'],
    '/api/import-media': ['./docs/build-notes/*', './public/images/**/*'],
    '/admin/**/*': ['./content/**/*', './package.json'],
  },
  images: {
    // Vercel image optimisation is capped account wide, so the repo ships pre-compressed webp and serves it as is
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // preview deployments and the vercel.app address must never be indexed
        source: '/:path*',
        has: [{ type: 'host', value: '(.*)\\.vercel\\.app' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      { source: '/assets/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/assets/:file(site\\.css|site\\.js|site-config\\.js)', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
      { source: '/images/:file(team-.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/cms/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
