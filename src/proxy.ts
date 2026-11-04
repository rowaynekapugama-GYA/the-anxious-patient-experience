/**
 * Public addresses for the static pages, the way the v1.4.0 vercel.json served them (clean URLs with a
 * trailing slash), plus the dashboard's redirects.
 *
 *   /book-now            -> 308 /book-now/
 *   /book-now/index.html -> 308 /book-now/
 *   /book-now/           -> serves public/book-now/index.html (written by scripts/render-site.ts)
 *   anything else        -> the site's own 404 page, with a 404 status
 *
 * /admin, /cms, /api and /_next are left to Next.js and Payload.
 */
import { NextResponse, type NextRequest } from 'next/server'
import site from './generated/site-routes.json'

const ROUTES = new Set<string>(site.routes)
type R = { from: string; to: string; type?: string }
const norm = (p: string) => '/' + p.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/\/+$/, '') + '/'
const REDIRECTS = new Map<string, R>((site.redirects as R[]).filter((r) => r.from && r.to).map((r) => [norm(r.from), r]))

const APP = /^\/(admin|cms|api|_next)(\/|$)/

export const config = {
  matcher: ['/((?!_next/static|_next/image|assets/|images/).*)'],
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl
  const p = url.pathname

  // Payload's own create first user screen is never used: the first login is made on /admin/login.
  if (p.startsWith('/cms/create-first-user') && process.env.ALLOW_FIRST_USER !== 'true') {
    return new NextResponse('Not found', { status: 404, headers: { 'x-robots-tag': 'noindex' } })
  }
  // the booking script calls /api/availability/ and /api/booking/ with a trailing slash
  if (/^\/api\/(availability|booking)\/$/.test(p)) {
    return NextResponse.rewrite(new URL(p.slice(0, -1) + url.search, url.origin))
  }
  if (p === '/admin/') return NextResponse.redirect(new URL('/admin' + url.search, url.origin), 308)
  if (APP.test(p)) return NextResponse.next()

  const r = REDIRECTS.get(p.endsWith('/') ? p : p + '/')
  if (r) {
    const dest = /^https?:\/\//i.test(r.to) ? r.to : new URL(r.to, url.origin).toString()
    return NextResponse.redirect(dest, r.type === 'temporary' ? 307 : 308)
  }

  if (/\/index\.html$/i.test(p)) {
    const clean = p.slice(0, -'index.html'.length)
    if (ROUTES.has(clean)) return NextResponse.redirect(new URL(clean + url.search, url.origin), 308)
    return NextResponse.next()
  }
  if (/\.[a-z0-9]{1,6}$/i.test(p)) return NextResponse.next()   // files: sitemap.xml, robots.txt, icon.svg ...

  if (!p.endsWith('/')) return NextResponse.redirect(new URL(p + '/' + url.search, url.origin), 308)
  if (ROUTES.has(p)) return NextResponse.rewrite(new URL((p === '/' ? '/index.html' : p + 'index.html') + url.search, url.origin))
  return notFound(req)
}

async function notFound(req: NextRequest) {
  try {
    const res = await fetch(new URL('/404.html', req.nextUrl.origin))
    if (res.ok) {
      return new NextResponse(await res.text(), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
      })
    }
  } catch { /* fall through */ }
  return new NextResponse('Page not found', { status: 404, headers: { 'x-robots-tag': 'noindex' } })
}
