/**
 * Google Tag Manager on the public pages (v1.15.0).
 *
 * A tag inside the container (Google Analytics today) reads the page address and the referrer straight from the
 * browser, so the v1.11.0 privacy rules are kept by deciding WHERE the container is allowed to load:
 *
 *   - only on the live domain (never a vercel.app or preview address, never localhost)
 *   - only on the public pages (never /admin, /cms, the questionnaire, the pay-later page or any preview)
 *   - only when the address carries nothing but utm_ tags. A private value in the address means the page is served
 *     without the container. A known ad click ID (fbclid, gclid and so on) is removed with a redirect first.
 *
 * Every page is written twice by scripts/render-site.ts: the plain page, and a copy with the container under
 * public/live-pages/. src/proxy.ts picks one for each request with decide() below; the live copies cannot be opened
 * directly. scripts/qa-gtm.mjs fails the build if a page breaks these rules.
 *
 * This file has no imports, so the proxy, the build scripts and the tests all use the same code.
 */

export const GTM_ID_RE = /^GTM-[A-Z0-9]{4,12}$/

/** The addresses the container may load on. Anything else, including every vercel.app address, gets the plain page. */
export const LIVE_HOSTS = ['theanxiouspatientexperience.com.au', 'www.theanxiouspatientexperience.com.au']

/** Where the copies with the container are written, under public/. Never served directly. */
export const LIVE_DIR = 'live-pages'

/** The request header the proxy sets for the deposit policy page (a Next.js page, so it cannot be written twice). */
export const TM_HEADER = 'x-ape-tm'

/**
 * The container ID from Site Settings > Tracking. "off" switches Tag Manager off; anything that is not a real
 * "GTM-..." ID counts as off.
 */
export function gtmIdOf(t?: { gtm?: string | null } | null): string {
  const id = String(t?.gtm || '').trim().toUpperCase()
  return GTM_ID_RE.test(id) ? id : ''
}

/** What may be typed in the Site Settings field: empty (use the default), a GTM-... ID, or the word off. */
export function gtmFieldOk(v: unknown): boolean {
  const s = String(v ?? '').trim()
  return s === '' || /^off$/i.test(s) || GTM_ID_RE.test(s.toUpperCase())
}

export function isLiveHost(host: string | null | undefined, hosts: string[] = LIVE_HOSTS): boolean {
  const h = String(host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  return !!h && hosts.includes(h)
}

/** The only query values Google may see, as in v1.11.0. */
export const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

/**
 * Click IDs that ad platforms and email tools add to links by themselves. The website does not use them, and they
 * are not sent to Google: on the live domain they are removed with a redirect, so the page still counts as a visit.
 */
export const CLICK_IDS = [
  'fbclid', 'gclid', 'gbraid', 'wbraid', 'gclsrc', 'gad_source', 'gad_campaignid', 'dclid', 'srsltid', '_gl', '_ga',
  'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'igshid', 'igsh', 'yclid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'mkt_tok',
]

/** Anything that looks like an email, a phone number, a booking reference or a date (the v1.11.0 filter). */
export const PERSONAL = /@|\d{3}[\s.-]?\d{3}[\s.-]?\d{3}|APE-[0-9A-F]{6}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i

export type QueryVerdict =
  | { kind: 'clean' }                    // nothing, or utm_ tags only: the container may load
  | { kind: 'strip'; search: string }    // only utm_ tags and known click IDs: redirect to the address without the IDs
  | { kind: 'private' }                  // anything else: the plain page, no container

/** Sort a query string into one of the three. `search` is location.search, with or without the "?". */
export function classifyQuery(search: string): QueryVerdict {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  const keep = new URLSearchParams()
  let strip = false
  for (const [k, v] of q) {
    if (UTM.includes(k)) {
      // a utm_ value that looks personal (an email address in utm_term, say) is treated as private
      if (PERSONAL.test(v) || v.length > 120) return { kind: 'private' }
      keep.append(k, v)
    } else if (CLICK_IDS.includes(k.toLowerCase())) {
      strip = true
    } else {
      return { kind: 'private' }
    }
  }
  if (!strip) return { kind: 'clean' }
  const s = keep.toString()
  return { kind: 'strip', search: s ? `?${s}` : '' }
}

/**
 * For the 404 page only (real pages have fixed addresses): does the mistyped address look like it holds a private
 * link? A questionnaire or pay-later link that was cut, capitalised or misspelt by an email program still carries
 * its token in the path, so such an address gets the plain 404 page.
 */
export function pathLooksPrivate(pathname: string): boolean {
  const p = String(pathname || '')
  if (/question|\/pay|token|\/admin|\/cms/i.test(p)) return true
  if (PERSONAL.test(decodeURIComponent(p.replace(/%(?![0-9a-f]{2})/gi, '%25')))) return true
  return p.split('/').some((seg) => {
    if (seg.length > 40) return true
    if (!/^[A-Za-z0-9_.~-]{16,}$/.test(seg) || !/\d/.test(seg) || !/[A-Za-z]/.test(seg)) return false
    // random-looking: mixed capitals, all hexadecimal, or digits scattered through it. A slug such as
    // "some-post-title-2026" is none of these.
    return (/[A-Z]/.test(seg) && /[a-z]/.test(seg)) || /^[0-9a-f-]+$/i.test(seg) || (seg.match(/\d+/g) || []).length > 2
  })
}

export type Decision = 'live' | 'plain' | { redirect: string }

/**
 * Which copy of a public page a request gets. `gtmId` is empty when Tag Manager is off or this build has no live
 * copies (a preview deployment).
 */
export function decide(o: { host: string | null | undefined; search: string; gtmId: string; hosts?: string[] }): Decision {
  if (!o.gtmId || !isLiveHost(o.host, o.hosts)) return 'plain'
  const v = classifyQuery(o.search)
  if (v.kind === 'clean') return 'live'
  if (v.kind === 'strip') return { redirect: v.search }
  return 'plain'
}

export type GtmParts = { id: string; head: string; body: string; tail: string }

/**
 * The container snippet (the format used on The Cronulla Dentists v2.4.0 and Lava Street v1.3.4), with two things
 * around it:
 *   - before it, the privacy defaults: advertising storage, advertising user data and ad personalisation are denied
 *     and Google signals is off, whatever the container is later set to (v1.11.0 had these off in the tag itself)
 *   - after the page's own tags, a flag that puts /assets/analytics.js in Tag Manager mode, so the booking events go
 *     to the dataLayer through the same filter as before
 */
export function gtmPieces(id: string): { defaults: string; src: string; start: string; frame: string } {
  if (!GTM_ID_RE.test(id)) throw new Error(`not a Tag Manager ID: ${id}`)
  return {
    defaults: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}"
      + "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});"
      + "gtag('set',{allow_google_signals:false,allow_ad_personalization_signals:false});",
    src: `https://www.googletagmanager.com/gtm.js?id=${id}`,
    start: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());",
    frame: `https://www.googletagmanager.com/ns.html?id=${id}`,
  }
}

/** The flag that puts /assets/analytics.js in Tag Manager mode. */
export const tmFlag = (id: string) => `window.APE_TM=${JSON.stringify(id)};`

export function gtmParts(id: string, assetVersion: string): GtmParts {
  const p = gtmPieces(id)
  return {
    id,
    head: `<script>${p.defaults}</script><script async src="${p.src}"></script><script>${p.start}</script>`,
    body: `<noscript><iframe src="${p.frame}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
    tail: `<script>${tmFlag(id)}</script><script src="/assets/analytics.js?v=${encodeURIComponent(assetVersion)}" defer></script>`,
  }
}

const count = (html: string, needle: string) => html.split(needle).length - 1

/** How many container scripts and noscript frames a page carries. A live page has exactly one of each. */
export function gtmCount(html: string): { script: number; noscript: number } {
  return { script: count(html, 'googletagmanager.com/gtm.js'), noscript: count(html, 'googletagmanager.com/ns.html') }
}

/**
 * A page with the container: the snippet as early in <head> as it can go (straight after the character set and
 * viewport tags), the noscript frame straight after <body> opens, and the analytics flag before </head>.
 * Throws rather than write a page with the container in the wrong place or twice.
 */
export function injectGtm(html: string, p: GtmParts): string {
  const before = gtmCount(html)
  if (before.script || before.noscript) throw new Error('the page already has a Tag Manager snippet')
  const viewport = /<meta name="viewport"[^>]*>/i.exec(html)
  const headOpen = /<head[^>]*>/i.exec(html)
  const at = viewport ? viewport.index + viewport[0].length : headOpen ? headOpen.index + headOpen[0].length : -1
  if (at < 0) throw new Error('no <head> to put the Tag Manager snippet in')
  let out = html.slice(0, at) + p.head + html.slice(at)
  const headClose = out.search(/<\/head>/i)
  if (headClose < 0) throw new Error('no </head>')
  out = out.slice(0, headClose) + p.tail + out.slice(headClose)
  const bodyOpen = /<body[^>]*>/i.exec(out)
  if (!bodyOpen) throw new Error('no <body> to put the Tag Manager noscript in')
  const b = bodyOpen.index + bodyOpen[0].length
  out = out.slice(0, b) + p.body + out.slice(b)
  const after = gtmCount(out)
  if (after.script !== 1 || after.noscript !== 1) throw new Error('the Tag Manager snippet did not go in exactly once')
  return out
}
