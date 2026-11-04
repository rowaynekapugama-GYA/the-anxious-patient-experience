/**
 * Build step: write the public site from content/ into public/.
 *
 *   content/pages/*.json  ->  public/index.html, public/book-now/index.html, ... (and the blog, once it has posts)
 *   sitemap.xml, robots.txt, assets/site-config.js (what the booking script reads)
 *   src/generated/site-routes.json (the addresses src/proxy.ts serves)
 *
 * Files written by an earlier render that are no longer part of the site are removed.
 * `npm run render -- <folder>` writes to another folder instead (the parity check uses it).
 */
import './load-env'
import fs from 'node:fs'
import path from 'node:path'
import { getChrome, getPages, getRedirects, getSeoDefaults, seoInfoFrom } from '../src/lib/content'
import { getSettings, pageTokens, tokensFor, originOf } from '../src/lib/site'
import { renderPageHtml } from '../src/dashboard/render'
import { getPosts } from '../src/lib/blog'
import { renderBlog } from '../src/lib/blogPages'
import type { BookingConfig } from '../src/lib/content'

const root = process.cwd()
const out = path.resolve(process.argv[2] || path.join(root, 'public'))
const manifestPath = path.join(out, '.generated.json')

const settings = getSettings()
const seo = getSeoDefaults()
const tokens = tokensFor(settings)
const origin = originOf(settings)
const chrome = getChrome()
const seoInfo = seoInfoFrom(settings)
const posts = getPosts()

const fileFor = (p: string) => (p === '/' ? 'index.html' : p === '/404' ? '404.html' : `${p.replace(/^\/|\/$/g, '')}/index.html`)

const files = new Map<string, string>()
const pages = getPages()
for (const page of pages) {
  files.set(fileFor(page.path), renderPageHtml(page, { chrome, tokens, pageTokens: pageTokens(page.path), seo, seoInfo }))
}

// the blog: a list of posts and one page per post, in the Privacy Policy page's layout
const shell = pages.find((p) => p.slug === 'privacy-policy')
if (posts.length && shell) {
  for (const [p, html] of renderBlog(posts, shell, { chrome, tokens, seo, seoInfo })) files.set(fileFor(p), html)
}

// search engines
const indexed = [
  ...pages.filter((p) => p.path !== '/404' && !p.meta?.noindex).map((p) => p.path).sort((a, b) => a.length - b.length || a.localeCompare(b)),
  ...(posts.length ? ['/blog/', ...posts.filter((p) => !p.meta?.noindex).map((p) => `/blog/${p.slug}/`)] : []),
]
files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  seo.noindexSite ? '' : indexed.map((p) => `  <url><loc>${origin}${p}</loc></url>\n`).join('')}</urlset>\n`)
files.set('robots.txt', seo.noindexSite
  ? 'User-Agent: *\nDisallow: /\n'
  : `User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /cms/\n\nSitemap: ${origin}/sitemap.xml\n`)

// what the booking script on Book Now reads (times and prices come from /api/availability/)
const booking = JSON.parse(fs.readFileSync(path.join(root, 'content', 'booking.json'), 'utf8')) as BookingConfig
const c = settings.clinic
files.set('assets/site-config.js', `/* Written by the build from Site Settings and content/booking.json. Do not edit by hand. */
window.APE_CONFIG = ${JSON.stringify({
  contact: { phone: settings.phone, apeEmail: settings.apeEmail, receptionEmail: settings.receptionEmail },
  clinic: { name: c.name, street: c.street, suburb: `${c.suburb} ${c.state} ${c.postcode}`, mapsUrl: c.mapsUrl },
  booking: { timeZone: booking.timeZone, minNoticeHours: booking.minNoticeHours },
}, null, 2)};
`)

// write, and tidy anything an earlier render wrote that is no longer part of the site
const previous: string[] = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : []
for (const f of previous) {
  if (!files.has(f) && fs.existsSync(path.join(out, f))) fs.unlinkSync(path.join(out, f))
}
for (const [f, html] of files) {
  const p = path.join(out, f)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, html)
}
fs.writeFileSync(manifestPath, JSON.stringify([...files.keys()].sort(), null, 1) + '\n')

// the addresses the proxy serves: every page, plus the old short addresses that send people to the homepage
const routes = [...files.keys()].filter((f) => f.endsWith('index.html')).map((f) => (f === 'index.html' ? '/' : '/' + f.slice(0, -'index.html'.length)))
for (const stub of ['faqs', 'meet-the-team', 'understanding-the-experience']) {
  if (fs.existsSync(path.join(root, 'public', stub, 'index.html'))) routes.push(`/${stub}/`)
}
const redirects = getRedirects()
if (out === path.join(root, 'public')) {
  fs.mkdirSync(path.join(root, 'src', 'generated'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src', 'generated', 'site-routes.json'), JSON.stringify({ routes: [...new Set(routes)].sort(), redirects }, null, 1) + '\n')
}
console.log(`render: ${pages.length} pages, ${posts.length} posts, ${files.size} files in ${path.relative(root, out) || '.'}`)
