import fs from 'node:fs'
import path from 'node:path'
import { DEFAULTS } from '@/site.config'
import { hasBlog } from '@/lib/blog'

export type SiteSettings = typeof DEFAULTS & Record<string, unknown>

let cache: SiteSettings | null = null

/** The client defaults with whatever the dashboard saved on top. One level merge, arrays replaced wholesale. */
export function mergeSettings(saved: Record<string, unknown>): SiteSettings {
  const merged: Record<string, unknown> = { ...DEFAULTS }
  for (const [k, v] of Object.entries(saved)) {
    if (v === null || v === undefined || v === '') continue
    const base = (DEFAULTS as Record<string, unknown>)[k]
    merged[k] =
      base && typeof base === 'object' && !Array.isArray(base) && typeof v === 'object' && !Array.isArray(v)
        ? { ...(base as object), ...Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== null && x !== undefined)) }
        : v
  }
  return merged as SiteSettings
}

/** Site Settings as the build sees them: the defaults with content/site-settings.json on top. */
export function getSettings(): SiteSettings {
  if (cache) return cache
  const file = path.join(process.cwd(), 'content', 'site-settings.json')
  let saved: Record<string, unknown> = {}
  try {
    if (fs.existsSync(file)) saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    saved = {}
  }
  cache = mergeSettings(saved)
  return cache
}

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** (02) 8599 9815 -> +61285999815 */
export function telOf(phone: string): string {
  const d = String(phone).replace(/[^\d+]/g, '')
  return d.startsWith('+') ? d : d.startsWith('0') ? `+61${d.slice(1)}` : d
}

/** The site's own address: NEXT_PUBLIC_SERVER_URL, else Site Settings. No trailing slash. */
export function originOf(s: SiteSettings): string {
  return String(process.env.NEXT_PUBLIC_SERVER_URL || s.siteUrl || '').replace(/\/+$/, '')
}

/** The ?v= on the stylesheet and scripts, so browsers fetch them again after an update. */
export function assetVersion(): string {
  if (process.env.APE_ASSET_VERSION) return process.env.APE_ASSET_VERSION
  try {
    return (JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { version: string }).version
  } catch {
    return '1'
  }
}

const placeholder = (label: string) => `<mark class="placeholder" title="Placeholder: waiting on the client">[${label}]</mark>`

/** GA4 and Meta Pixel, only when their IDs are filled in. */
export function analyticsTags(t: { ga4?: string; metaPixel?: string }): string {
  const ga = String(t.ga4 || '').trim()
  const px = String(t.metaPixel || '').trim()
  let out = ''
  if (/^G-[A-Z0-9]+$/.test(ga)) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(ga)}"></script>`
      + `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(ga)}');</script>`
  }
  if (/^\d{6,20}$/.test(px)) {
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(px)}');fbq('track','PageView');</script>`
  }
  return out
}

/** The values that {{site:...}} tokens in the content resolve to. */
export function siteTokens(): Record<string, string> {
  return tokensFor(getSettings())
}

/** The token values for a given set of settings (the dashboard preview passes its own). */
export function tokensFor(s: SiteSettings, opts: { blog?: boolean } = {}): Record<string, string> {
  const c = s.clinic
  const suburbLine = `${c.suburb} ${c.state} ${c.postcode}`.trim()
  const address = `${c.street}, ${suburbLine}`
  const phoneLink = s.phone ? `<a href="tel:${esc(telOf(s.phone))}">${esc(s.phone)}</a>` : placeholder('Phone')
  const mailLink = (addr: string, label: string) => (addr ? `<a href="mailto:${esc(addr)}">${esc(addr)}</a>` : placeholder(label))
  const addressLink = c.mapsUrl
    ? `<a href="${esc(c.mapsUrl)}" target="_blank" rel="noopener">${esc(address)}<span class="sr-only"> (opens Google Maps)</span></a>`
    : esc(address)
  const intlPhone = s.phone ? telOf(s.phone).replace(/^\+61(\d)(\d{4})(\d{4})$/, '+61 $1 $2 $3') : undefined
  const postal = { '@type': 'PostalAddress', streetAddress: c.street, addressLocality: c.suburb, addressRegion: c.state, postalCode: c.postcode, addressCountry: 'AU' }
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: c.name,
    address: postal,
    telephone: intlPhone,
    email: s.receptionEmail || undefined,
    hasMap: c.mapsUrl || undefined,
    department: {
      '@type': 'Dentist',
      name: 'The Anxious Patient Experience™',
      description: 'A nervous-system-aware approach to dental care.',
      address: postal,
      telephone: intlPhone,
      email: s.apeEmail || undefined,
    },
  }
  const blog = opts.blog ?? hasBlog()
  return {
    practiceName: esc(s.practiceName),
    phone: esc(s.phone),
    phoneHref: `tel:${esc(telOf(s.phone))}`,
    phoneLink,
    apeEmail: esc(s.apeEmail),
    receptionEmail: esc(s.receptionEmail),
    clinicName: esc(c.name),
    address: esc(address),
    mapUrl: esc(c.mapsUrl),
    clinicLine: `<span class="clinic-name">${esc(c.name)}</span> <span class="clinic-address">${addressLink}</span>`,
    footerContact: [
      `<li class="contact-name">${esc(c.name)}</li>`,
      `<li>${addressLink}</li>`,
      `<li>${phoneLink}</li>`,
      `<li class="contact-email"><span class="contact-label">APE enquiries</span>${mailLink(s.apeEmail, 'APE email')}</li>`,
      `<li class="contact-email"><span class="contact-label">General practice enquiries</span>${mailLink(s.receptionEmail, 'Reception email')}</li>`,
    ].join(''),
    schema: `<script type="application/ld+json">${JSON.stringify(schema)}</script>`,
    analytics: analyticsTags(s.tracking || {}),
    origin: originOf(s),
    v: assetVersion(),
    blogNav: blog ? '<li><a href="/blog/">Blog</a></li>' : '',
    blogFooter: blog ? '<li><a href="/blog/">Blog</a></li>' : '',
  }
}

/** Tokens that depend on the page: links back to the homepage sections. */
export function pageTokens(path: string): Record<string, string> {
  const home = path === '/'
  return { pageTop: home ? '#top' : '/', pageBase: home ? '' : '/' }
}

export { applyTokens } from '@/lib/tokens'
