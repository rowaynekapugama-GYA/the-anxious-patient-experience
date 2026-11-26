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
  // v1.18.0: the PDF library reads its own files at run time, so it is not bundled
  serverExternalPackages: ['pdfkit'],
  // files the dashboard reads while it runs (the content model, the photo list, the asset version)
  outputFileTracingIncludes: {
    '/api/import-content': ['./content/**/*'],
    '/api/import-media': ['./docs/build-notes/*', './public/images/**/*'],
    '/admin/**/*': ['./content/**/*', './package.json'],
    '/questionnaire/**/*': ['./content/**/*', './public/downloads/*'],
    '/book-now/pay': ['./content/**/*'],
    '/book-now/terms': ['./content/**/*'],
    '/api/apple-pay-domain': ['./config/apple-pay/*'],
    '/api/dashboard/**/*': ['./content/**/*', './public/downloads/*', './src/pdf/fonts/*', './public/email/ape-logo-320.png'],
    // v1.18.0: the treatment plan PDF (fonts and logo) for the patient's private link
    '/plan/**/*': ['./content/**/*', './src/pdf/fonts/*', './public/email/ape-logo-320.png'],
    '/api/booking': ['./content/**/*', './public/downloads/*'],
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
      // the patient questionnaire pages: never indexed, never cached, no referrer sent anywhere
      { source: '/book-now/terms', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
      // v1.15.0: both spellings of the pay-later address, so the next page never receives its private link as the referrer
      { source: '/book-now/pay', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Cache-Control', value: 'no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/book-now/pay/', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Cache-Control', value: 'no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
      // v1.9.0: Lorna's welcome pack PDFs are sent to patients, not meant for search results
      { source: '/downloads/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
      { source: '/questionnaire/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Cache-Control', value: 'no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
      // v1.18.0: the patient's private treatment plan link, the same as the questionnaire
      { source: '/plan/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Cache-Control', value: 'no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
