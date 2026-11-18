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

/** The site's own address, no trailing slash: NEXT_PUBLIC_SERVER_URL (the domain at go-live), else on a Vercel preview
 *  that preview's own address, else the project's production address Vercel reports, else the Site Settings default. */
export function originOf(s: SiteSettings): string {
  const env = process.env
  const pick = env.NEXT_PUBLIC_SERVER_URL
    || (env.VERCEL_ENV === 'preview' && env.VERCEL_BRANCH_URL ? `https://${env.VERCEL_BRANCH_URL}` : '')
    || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || s.siteUrl || ''
  return String(pick).replace(/\/+$/, '')
}

/** Preview deployments are never indexed, whatever the SEO settings say. */
export const isPreviewDeploy = () => process.env.VERCEL_ENV === 'preview'

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

/**
 * v1.11.0: the GA4 measurement ID, from Site Settings > Tracking (GYA only), else NEXT_PUBLIC_GA4_ID. Empty (off) until
 * one is set. Only a real "G-..." ID counts.
 */
export function ga4Id(t?: { ga4?: string } | null): string {
  const id = String(t?.ga4 || '').trim() || String(process.env.NEXT_PUBLIC_GA4_ID || '').trim()
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : ''
}

/**
 * Google Analytics 4 for the public pages, only when an ID is set (v1.11.0). The tag itself is /assets/analytics.js,
 * which strips private links and anything personal before Google sees it. Never on /admin (the dashboard has its own
 * layout). The Meta Pixel is not added to this website (patient privacy); the field in Site Settings is kept but unused.
 */
export function analyticsTags(t: { ga4?: string; metaPixel?: string }): string {
  const ga = ga4Id(t)
  if (!ga) return ''
  return `<script>window.APE_GA4=${JSON.stringify(ga)};</script><script src="/assets/analytics.js?v=${esc(assetVersion())}" defer></script>`
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
    apeEmailLink: mailLink(s.apeEmail, 'APE email'),
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
    googleReviewLink: esc(String(s.googleReviewLink || '')),
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
