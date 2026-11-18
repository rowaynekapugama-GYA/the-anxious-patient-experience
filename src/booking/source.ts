/**
 * Where a booking came from (v1.11.0). Book Now remembers it for the visit (public/assets/site.js, sessionStorage):
 * the utm_source of a tracked link, otherwise the website that linked here (domain only), otherwise "direct". It is
 * saved on the booking and shown in the dashboard. Nothing about the person is in it.
 */

export type Source = { source: string; medium: string; campaign: string }

/** What the browser sent, made safe: lower case, letters, numbers, dots, dashes, spaces; 60 characters at most. */
export function cleanSource(v: unknown): Source {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const c = (x: unknown) => String(x ?? '').toLowerCase().replace(/[^a-z0-9._ -]+/g, '').trim().slice(0, 60)
  return { source: c(o.source), medium: c(o.medium), campaign: c(o.campaign) }
}

const NAMES: [RegExp, string][] = [
  [/^(ig|instagram|l\.instagram\.com|instagram\.com)$/, 'Instagram'],
  [/^(fb|facebook|m\.facebook\.com|l\.facebook\.com|lm\.facebook\.com|facebook\.com)$/, 'Facebook'],
  [/^(caringbah-website|caringbah|thecaringbahdentists\.com\.au)$/, 'Caringbah website'],
  [/^(cronulla-website|cronulla|thecronulladentists\.com\.au)$/, 'Cronulla website'],
  [/^(google|google\.[a-z.]+|bing|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/, 'Search engine'],
  [/^(email|email-signature|newsletter)$/, 'Email'],
  [/^(qr|qr-code|flyer)$/, 'QR code'],
  [/^direct$/, 'Direct'],
]

/** A plain label for the dashboard: "Instagram", "Caringbah website", "Direct", or the site's own name. */
export function sourceLabel(source: string | null | undefined): string {
  const s = String(source || '').trim().toLowerCase()
  if (!s) return 'Not recorded'
  if (/^google(\.|$)/.test(s)) return 'Google'
  for (const [re, name] of NAMES) if (re.test(s)) return name
  return s
}
