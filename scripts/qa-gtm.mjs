#!/usr/bin/env node
/**
 * Checks where Google Tag Manager is, and is not, after the build has written the pages (v1.15.0).
 * The build stops if any of these is broken, because a tag in the container reads the page address and the
 * referrer straight from the browser:
 *
 *   1. Every copy under public/live-pages/ has exactly one container script and one noscript frame, with the ID
 *      from Site Settings, the privacy defaults before the script, the script before the stylesheet and every other
 *      script file, the noscript straight after <body>, and no direct Google Analytics tag beside it.
 *   2. Every public page has a live copy, and nothing else does.
 *   3. No other page in public/ carries the container: the plain pages (served on vercel.app, previews and for any
 *      address with a private value), the 404 page and the old short addresses.
 *   4. With Tag Manager off there are no live copies at all.
 *   5. The container is only allowed on the live domain, never a vercel.app address or localhost.
 *   6. Nothing in the private parts of the site refers to Tag Manager: the questionnaire and pay-later pages, the
 *      dashboard, Payload, the emails and the booking code.
 *   7. The private pages still tell the browser to send no referrer, so the next page never learns their address.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const PUB = join(ROOT, 'public')
const LIVE = 'live-pages'
const problems = []
const problem = (where, msg) => problems.push(`${where}: ${msg}`)

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}
const rel = (f, base = PUB) => relative(base, f).split(sep).join('/')
const count = (s, needle) => s.split(needle).length - 1

const routes = JSON.parse(readFileSync(join(ROOT, 'src', 'generated', 'site-routes.json'), 'utf8'))
const gtm = routes.gtm
if (!gtm || typeof gtm.id !== 'string') {
  console.error('\nqa:gtm: src/generated/site-routes.json has no Tag Manager block. Run the render step first.\n')
  process.exit(1)
}
const on = gtm.id !== ''
if (on && !/^GTM-[A-Z0-9]{4,12}$/.test(gtm.id)) problem('site-routes.json', `"${gtm.id}" is not a Tag Manager ID`)

const html = walk(PUB).filter((f) => f.endsWith('.html'))
const livePages = html.filter((f) => rel(f).startsWith(`${LIVE}/`))
const plainPages = html.filter((f) => !rel(f).startsWith(`${LIVE}/`))

// 1. the live copies
for (const file of livePages) {
  const r = rel(file)
  const s = readFileSync(file, 'utf8')
  if (!on) { problem(r, 'a live copy exists although Tag Manager is off'); continue }
  const script = `<script async src="https://www.googletagmanager.com/gtm.js?id=${gtm.id}"></script>`
  const frame = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtm.id}"`
  if (count(s, 'googletagmanager.com/gtm.js') !== 1 || count(s, script) !== 1) problem(r, 'must have exactly one Tag Manager script, with the ID from Site Settings')
  if (count(s, 'googletagmanager.com/ns.html') !== 1 || count(s, frame) !== 1) problem(r, 'must have exactly one Tag Manager noscript frame, with the ID from Site Settings')
  if (count(s, 'GTM-') !== count(s, gtm.id)) problem(r, 'mentions a Tag Manager ID other than the one from Site Settings')
  const head = s.slice(0, s.search(/<\/head>/i))
  const at = head.indexOf(script)
  if (at < 0) { problem(r, 'the Tag Manager script is not in <head>'); continue }
  const defaults = head.indexOf("gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'")
  if (defaults < 0 || defaults > at) problem(r, 'the privacy defaults (advertising storage, user data and personalisation denied) must come before the Tag Manager script')
  if (!head.includes('allow_google_signals:false') || !head.includes('allow_ad_personalization_signals:false')) problem(r, 'Google signals and ad personalisation must be switched off before the Tag Manager script')
  const firstFile = head.search(/<script[^>]*\ssrc="(?!https:\/\/www\.googletagmanager\.com\/gtm\.js)|<link rel="stylesheet"/)
  if (firstFile >= 0 && firstFile < at) problem(r, 'the Tag Manager script must come before the stylesheet and every other script file')
  if (!new RegExp(`<body[^>]*>${frame.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(s)) problem(r, 'the noscript frame must come straight after <body>')
  if (!head.includes(`window.APE_TM="${gtm.id}";`)) problem(r, 'the page does not put analytics.js in Tag Manager mode')
  if (/APE_GA4|googletagmanager\.com\/gtag\/js/.test(s)) problem(r, 'loads Google Analytics directly as well as through Tag Manager')
  if (/\/(questionnaire|plan)\/[A-Za-z0-9_-]{8,}|\/book-now\/pay\/?\?t=|[?&]t=[A-Za-z0-9_-]{8,}/.test(s)) problem(r, 'contains a private link')
}

// 2. every public page has a live copy, and only public pages do
if (on) {
  const want = new Set(gtm.routes)
  const have = new Set(livePages.map((f) => '/' + rel(f).slice(LIVE.length + 1).replace(/index\.html$/, '')))
  for (const p of want) if (!have.has(p)) problem(p, 'no live copy was written for this page')
  for (const p of have) if (!want.has(p)) problem(p, 'a live copy exists for something that is not a public page')
  for (const p of want) if (/^\/(admin|cms|api|questionnaire|plan|book-now\/pay)(\/|$)/.test(p)) problem(p, 'this address must never have Tag Manager')
  for (const p of ['/', '/book-now/', '/privacy-policy/']) if (!want.has(p)) problem(p, 'this public page has no Tag Manager copy')
  if (!livePages.length) problem('public/live-pages', 'Tag Manager is on but no live copies were written')
}

// 3. nothing else in public/ carries it
for (const file of plainPages) {
  const s = readFileSync(file, 'utf8')
  if (/googletagmanager\.com\/(gtm\.js|ns\.html)|APE_TM/.test(s)) problem(rel(file), 'this page must not carry Tag Manager (only the copies under live-pages/ may)')
  if (on && /APE_GA4/.test(s)) problem(rel(file), 'loads Google Analytics directly although a Tag Manager ID is set')
}

// 5. only the live domain
for (const h of gtm.hosts || []) {
  if (/vercel\.app$|localhost|^\d+\.\d+\.\d+\.\d+$/i.test(h)) problem('site-routes.json', `Tag Manager must not be allowed on ${h}`)
}
if (on && !(gtm.hosts || []).length) problem('site-routes.json', 'Tag Manager is on but no live domain is listed')

// 6. the private parts of the site never refer to it (comments are not code)
const code = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1')
const PRIVATE = ['src/app/(site)', 'src/app/(dashboard)', 'src/app/(payload)', 'src/dashboard', 'src/email', 'src/booking', 'src/sitekit/collections', 'src/plans']
const FORBIDDEN = /gtm\.js|ns\.html|gtmParts|gtmPieces|injectGtm|gtmForBuild|tmFlag|TM_HEADER|x-ape-tm|APE_TM|live-pages/
for (const dir of PRIVATE) {
  for (const f of walk(join(ROOT, dir)).filter((x) => /\.(tsx?|mjs|js|css)$/.test(x))) {
    if (FORBIDDEN.test(code(f))) problem(rel(f, ROOT), 'a private part of the site refers to Tag Manager')
  }
}
const frame = join(ROOT, 'src', 'lib', 'SiteFrame.tsx')
if (existsSync(frame) && FORBIDDEN.test(code(frame))) problem('src/lib/SiteFrame.tsx', 'the shared page frame must not know about Tag Manager')
const publicLayout = join(ROOT, 'src', 'app', '(public)', 'layout.tsx')
if (existsSync(publicLayout) && !/TM_HEADER/.test(code(publicLayout))) problem('src/app/(public)/layout.tsx', 'must only add Tag Manager when the proxy says so (TM_HEADER)')
for (const f of walk(join(ROOT, 'src', 'app', '(public)')).filter((x) => /page\.tsx$/.test(x))) {
  if (/searchParams|params\b/.test(code(f))) problem(rel(f, ROOT), 'a public Next.js page must not read values from its address')
}

// 6b. v1.18.0: the treatment plan link stays a private Next.js page (the proxy passes /plan to Next.js, and the page
// lives with the questionnaire under src/app/(site), whose layout has no way to add Tag Manager)
const proxySrc = readFileSync(join(ROOT, 'src', 'proxy.ts'), 'utf8')
if (!/const APP = \/\^\\\/\([^)]*\bplan\b/.test(proxySrc)) problem('src/proxy.ts', '/plan must be passed to Next.js as a private page (APP)')
if (!existsSync(join(ROOT, 'src', 'app', '(site)', 'plan'))) problem('src/app/(site)/plan', 'the treatment plan link must live under src/app/(site)')
if (existsSync(join(ROOT, 'src', 'app', '(public)', 'plan'))) problem('src/app/(public)/plan', 'the treatment plan link must never be a public page')

// 7. no referrer from the private pages
if (existsSync(frame) && !/<meta name="referrer" content="no-referrer"/.test(readFileSync(frame, 'utf8'))) problem('src/lib/SiteFrame.tsx', 'the private pages must carry <meta name="referrer" content="no-referrer">')
const nextConfig = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8')
for (const src of ['/book-now/pay', '/book-now/pay/', '/questionnaire/:path*', '/plan/:path*']) {
  const line = nextConfig.split('\n').find((l) => l.includes(`source: '${src}'`) && /Referrer-Policy/.test(l) && /no-referrer'/.test(l))
  if (!line) problem('next.config.mjs', `${src} must be sent with Referrer-Policy: no-referrer`)
}

if (problems.length) {
  console.error(`\nqa:gtm: ${problems.length} problem(s) to fix:\n`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(on
  ? `qa:gtm: ${gtm.id} on ${livePages.length} live pages (${gtm.hosts.join(', ')} only), none on ${plainPages.length} other pages or in the private parts of the site`
  : `qa:gtm: Tag Manager is off for this build, and no page carries it (${plainPages.length} pages checked)`)
