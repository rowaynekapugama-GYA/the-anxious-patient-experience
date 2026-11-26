/**
 * Public addresses for the static pages, the way the v1.4.0 vercel.json served them (clean URLs with a
 * trailing slash), plus the dashboard's redirects.
 *
 *   /book-now            -> 308 /book-now/
 *   /book-now/index.html -> 308 /book-now/
 *   /book-now/           -> serves public/book-now/index.html (written by scripts/render-site.ts)
 *   anything else        -> the site's own 404 page, with a 404 status
 *
 * /admin, /cms, /api, /_next, /questionnaire (the private patient pages, v1.7.0) and /plan (the patient's treatment
 * plan link, v1.18.0) are left to Next.js and Payload.
 *
 * v1.15.0, Google Tag Manager: each public page exists twice, the plain page and a copy with the container under
 * /live-pages/. The copy is served only on the live domain and only when the address carries nothing but utm_ tags
 * (src/lib/gtm.ts). Everything else gets the plain page: every vercel.app and preview address, and any address with
 * a private value in it. A link with only an ad click ID (fbclid, gclid ...) is redirected to the same page without
 * it. The copies cannot be opened directly, and the dashboard, the questionnaire and the pay-later page never get
 * the container at all.
 */
import { NextResponse, type NextRequest } from 'next/server'
import site from './generated/site-routes.json'
import { decide, injectGtm, pathLooksPrivate, LIVE_DIR, TM_HEADER, type GtmParts } from './lib/gtm'

const ROUTES = new Set<string>(site.routes)
type R = { from: string; to: string; type?: string }
const norm = (p: string) => '/' + p.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/\/+$/, '') + '/'
const REDIRECTS = new Map<string, R>((site.redirects as R[]).filter((r) => r.from && r.to).map((r) => [norm(r.from), r]))

// v1.18.0: /plan/ is the patient's private treatment plan link, a Next.js page like the questionnaire
const APP = /^\/(admin|cms|api|_next|questionnaire|plan)(\/|$)/
const PAY = /^\/book-now\/pay\/?$/
// v1.10.0: the booking terms page, and Apple Pay's domain check file (served from /api/apple-pay-domain)
const TERMS = /^\/book-now\/terms\/?$/
const APPLE_PAY = '/.well-known/apple-developer-merchantid-domain-association'

const GTM = site.gtm as GtmParts & { hosts: string[]; routes: string[] }
const LIVE_ROUTES = new Set<string>(GTM.routes)
/** 'live' (the copy with the container), 'plain', or the address to redirect to once an ad click ID is removed. */
const tagManagerFor = (req: NextRequest) => decide({ host: req.headers.get('host'), search: req.nextUrl.search, gtmId: GTM.id, hosts: GTM.hosts })

/** Requests passed on to Next.js never carry a Tag Manager header sent by the visitor. */
function withoutTm(req: NextRequest): { request: { headers: Headers } } | undefined {
  if (!req.headers.has(TM_HEADER)) return undefined
  const h = new Headers(req.headers)
  h.delete(TM_HEADER)
  return { request: { headers: h } }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|assets/|images/).*)'],
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl
  const p = url.pathname

  // v1.15.0: the copies with the Tag Manager container are never served at their own address
  if (p === `/${LIVE_DIR}` || p.startsWith(`/${LIVE_DIR}/`)) return notFound(req)

  // Payload's own create first user screen is never used: the first login is made on /admin/login.
  if (p.startsWith('/cms/create-first-user') && process.env.ALLOW_FIRST_USER !== 'true') {
    return new NextResponse('Not found', { status: 404, headers: { 'x-robots-tag': 'noindex' } })
  }
  // v1.8.3: Payload's own password endpoints are closed. The dashboard's (/api/dashboard/forgot-password and
  // /api/dashboard/reset-password) limit requests, keep reset links to 1 hour and send the "password changed" notice.
  if (/^\/api\/users\/(forgot-password|reset-password)\/?$/.test(p)) {
    return new NextResponse('Not found', { status: 404, headers: { 'x-robots-tag': 'noindex' } })
  }
  // the booking script calls /api/availability/ and /api/booking/ with a trailing slash
  if (/^\/api\/(availability|booking)\/$/.test(p)) {
    return NextResponse.rewrite(new URL(p.slice(0, -1) + url.search, url.origin))
  }
  if (p === '/admin/') return NextResponse.redirect(new URL('/admin' + url.search, url.origin), 308)
  // the private "pay your deposit" page (v1.8.0) is a Next.js page, with or without the trailing slash
  if (PAY.test(p)) return p.endsWith('/') ? NextResponse.rewrite(new URL('/book-now/pay' + url.search, url.origin), withoutTm(req)) : NextResponse.next(withoutTm(req))
  if (TERMS.test(p)) {
    if (!p.endsWith('/')) return NextResponse.redirect(new URL('/book-now/terms/' + url.search, url.origin), 308)
    // the deposit policy page is a Next.js page: the proxy tells its layout whether this request gets the container.
    // The header is always set here, so one sent by a visitor is never passed on.
    const tm = tagManagerFor(req)
    if (typeof tm === 'object') return NextResponse.redirect(new URL(p + tm.redirect, url.origin), 307)
    const h = new Headers(req.headers)
    h.delete(TM_HEADER)
    if (tm === 'live') h.set(TM_HEADER, GTM.id)
    return NextResponse.rewrite(new URL('/book-now/terms' + url.search, url.origin), { request: { headers: h } })
  }
  if (p === APPLE_PAY) return NextResponse.rewrite(new URL('/api/apple-pay-domain', url.origin))
  // the dashboard: pass the address on, so signing in can come back to it (v1.8.2)
  if (/^\/admin(\/|$)/.test(p)) {
    const h = new Headers(req.headers)
    h.set('x-pd-url', p + url.search)
    return NextResponse.next({ request: { headers: h } })
  }
  if (APP.test(p)) return NextResponse.next(withoutTm(req))

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
  if (ROUTES.has(p)) {
    const file = p === '/' ? '/index.html' : p + 'index.html'
    const tm = LIVE_ROUTES.has(p) ? tagManagerFor(req) : 'plain'
    if (typeof tm === 'object') return NextResponse.redirect(new URL(p + tm.redirect, url.origin), 307)
    return NextResponse.rewrite(new URL((tm === 'live' ? `/${LIVE_DIR}` : '') + file + url.search, url.origin))
  }
  return notFound(req)
}

async function notFound(req: NextRequest) {
  try {
    const res = await fetch(new URL('/404.html', req.nextUrl.origin))
    if (res.ok) {
      // v1.15.0: on the live domain the 404 page carries the container too, unless the address has a private value
      // in it or looks like a mistyped private link
      let html = await res.text()
      if (tagManagerFor(req) === 'live' && !pathLooksPrivate(req.nextUrl.pathname)) { try { html = injectGtm(html, GTM) } catch { /* the plain page */ } }
      return new NextResponse(html, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
      })
    }
  } catch { /* fall through */ }
  return new NextResponse('Page not found', { status: 404, headers: { 'x-robots-tag': 'noindex' } })
}
