/**
 * The booking terms and cancellation policy (v1.10.0), shown in full on Book Now (its own step), on the pay-later
 * page and at /book-now/terms/. Edited in the dashboard: Site Settings > Booking terms. Saved in Site Settings
 * (group bookingTerms); until something is saved there, the drafted default below is used.
 *
 * Every saved change to the wording gets the next version number, and each booking records the version the patient
 * saw and when they ticked each box (ape_bookings.terms_version, terms_consent_at, terms_read_at).
 *
 * Format: plain text. A line starting "## " is a heading, a line starting "- " is a bullet, a blank line starts a new
 * paragraph. {phone} and {deposit} are filled in from Site Settings and the booking settings.
 */
import type { Payload } from 'payload'

export const DEFAULT_VERSION = 1
export const DEFAULT_DATE = '2026-11-17'

// The three cancellation lines are the policy already on Book Now since v1.6, word for word. The rest is drafted
// for Lorna to approve. The late-cancellation line is hers to confirm (kept, credited to a new time, or refunded).
export const DEFAULT_TERMS = `## Your booking
- Your booking is a request until the APE team confirms it with you.
- A {deposit} deposit secures your appointment.
- The appointment fee is shown when you book. Health fund rebates are available.

## Cancellation policy: 48 hours' notice
If you need to cancel or move your appointment, please give us at least 48 hours' notice.
- 48 hours' notice or more: your deposit can be transferred to a new appointment or refunded.
- Less than 48 hours' notice or non-attendance: your deposit may be retained.
- If anxiety is making it hard to attend: please contact us. We would much rather hear from you than have you simply not come.

## How to cancel or change your appointment
Reply to your booking email, or call us on {phone}.`

export const DEFAULT_CONSENT = 'I consent to the terms and conditions and cancellation policy above.'
export const DEFAULT_READ = 'I have read the terms and conditions and cancellation policy.'
export const REMINDER = 'Please remember our 48-hour cancellation policy: if you need to cancel or move your appointment, let us know at least 48 hours before.'

export type Terms = {
  text: string
  version: number
  date: string
  /** what each booking records, for example "3 (2026-12-02)" */
  label: string
  consentLabel: string
  readLabel: string
  saved: boolean
  approvedBy: string
  approvedAt: string | null
}

export const versionLabel = (version: number, date: string) => `${version} (${date})`

export function fromSettings(g: Record<string, any> | null | undefined): Terms {
  const text = String(g?.text || '').trim()
  const version = text ? Math.max(1, Number(g?.version) || 1) : DEFAULT_VERSION
  const date = text ? String(g?.changedAt || '').slice(0, 10) || DEFAULT_DATE : DEFAULT_DATE
  return {
    text: text || DEFAULT_TERMS,
    version,
    date,
    label: versionLabel(version, date),
    consentLabel: String(g?.consentLabel || '').trim() || DEFAULT_CONSENT,
    readLabel: String(g?.readLabel || '').trim() || DEFAULT_READ,
    saved: !!text,
    approvedBy: String(g?.approvedBy || ''),
    approvedAt: g?.approvedAt ? String(g.approvedAt) : null,
  }
}

export async function loadTerms(payload: Payload): Promise<Terms> {
  try {
    const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as Record<string, any>
    return fromSettings(s?.bookingTerms)
  } catch (err) {
    console.error('terms: could not read Site Settings, using the drafted default', (err as Error).message)
    return fromSettings(null)
  }
}

/** The terms with {phone} and {deposit} filled in. */
export const fill = (text: string, v: { phone: string; deposit: string }) => text.replace(/\{phone\}/g, v.phone).replace(/\{deposit\}/g, v.deposit)

export type Block = { type: 'h'; text: string } | { type: 'p'; text: string } | { type: 'ul'; items: string[] }

/** The text as headings, paragraphs and lists, for the pages and the emails. */
export function blocks(text: string): Block[] {
  const out: Block[] = []
  let para: string[] = []
  const flush = () => { if (para.length) { out.push({ type: 'p', text: para.join(' ') }); para = [] } }
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (line.startsWith('## ')) { flush(); out.push({ type: 'h', text: line.slice(3).trim() }); continue }
    if (/^[-*] /.test(line)) {
      flush()
      const last = out[out.length - 1]
      if (last && last.type === 'ul') last.items.push(line.slice(2).trim())
      else out.push({ type: 'ul', items: [line.slice(2).trim()] })
      continue
    }
    para.push(line)
  }
  flush()
  return out
}

/**
 * When the patient ticked a box, as the browser reported it. Accepted only if it is a real time in the last day and
 * not in the future (allowing for a slow clock); otherwise the time the server received the booking.
 */
export function tickTime(v: unknown, now = Date.now()): Date {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  if (Number.isFinite(t) && t <= now + 5 * 60 * 1000 && t >= now - 24 * 3600 * 1000) return new Date(Math.min(t, now))
  return new Date(now)
}

/** What a booking shows in the dashboard about the terms. */
export function termsView(row: { terms_version?: string | null; terms_consent_at?: string | Date | null; terms_read_at?: string | Date | null; terms_pay_read_at?: string | Date | null }) {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)
  return {
    version: row.terms_version || '',
    consentAt: iso(row.terms_consent_at),
    readAt: iso(row.terms_read_at),
    payReadAt: iso(row.terms_pay_read_at),
  }
}
