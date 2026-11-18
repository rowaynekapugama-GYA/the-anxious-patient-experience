/**
 * The deposit policy (v1.10.0 as "booking terms", v1.11.0 Lorna's wording), shown in a pop-up when the patient moves
 * from their details to the deposit, on the pay-later page and at /book-now/terms/. Edited in the dashboard: Site
 * Settings > Booking terms. Saved in Site Settings (group bookingTerms); until something is saved there, Lorna's
 * wording below is used.
 *
 * Every saved change to the wording gets the next version number, and each booking records the version the patient
 * agreed to and when (ape_bookings.terms_version, terms_consent_at; terms_pay_read_at when agreed on the pay-later
 * page). terms_read_at was v1.10.0's second tick and is no longer filled in.
 *
 * Format: plain text. A line starting "## " is a heading, a line starting "- " is a bullet, a blank line starts a new
 * paragraph. {phone} and {deposit} are filled in from Site Settings and the booking settings.
 */
import type { Payload } from 'payload'

export const DEFAULT_VERSION = 2
export const DEFAULT_DATE = '2026-11-18'

// v1.11.0: Lorna's deposit policy, word for word from her email of 18 Nov 2026 (her decision on the terms; it replaced
// the v1.10.0 draft). {deposit} is filled in from the deposit setting, so the amount can never disagree with what is
// charged. Shown in the pop-up before the deposit step, on the pay-later page and at /book-now/terms/.
export const DEFAULT_TERMS = `## Your Appointment Deposit
To secure your appointment, a {deposit} deposit is required at the time of booking. This deposit will be deducted from the cost of your appointment on the day.

## Cancellations and Rescheduling
We understand that sometimes plans change. If you need to cancel or rearrange your appointment, please contact us more than 48 hours in advance. Your deposit can be transferred to a future appointment or refunded where applicable.

Cancellations or changes made within 48 hours of your appointment will result in your deposit being forfeited.

If you do not attend your appointment without notifying us, your deposit will be non-refundable and non-transferable.

## We're Here to Help
We understand that dental anxiety can make attending an appointment feel difficult. If you're feeling overwhelmed or something unexpected has happened, please contact us as early as possible. We'd much rather hear from you and talk things through.`

/** The v1.10.0 draft (version 1), kept so a database still holding it can be recognised and moved on to Lorna's. */
export const V1_DRAFT_TERMS = `## Your booking
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

/** Lorna's tick box, word for word. */
export const DEFAULT_CONSENT = 'I understand and agree to the deposit policy, including how my deposit will be applied to my appointment and the conditions under which it may be forfeited.'
export const V1_CONSENT = 'I consent to the terms and conditions and cancellation policy above.'
/** v1.10.0's second tick, no longer shown (kept for the record of older bookings). */
export const DEFAULT_READ = 'I have read the terms and conditions and cancellation policy.'
export const AGREE_BUTTON = 'I Agree & Continue'
export const APPROVED_BY_LORNA = 'Lorna Gladwin (email of 18 Nov 2026)'
/** The patient's booking email: Lorna's own sentence. */
export const REMINDER = 'Cancellations or changes made within 48 hours of your appointment will result in your deposit being forfeited.'

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
    // the default is Lorna's own wording, so it counts as approved by her
    approvedBy: text ? String(g?.approvedBy || '') : APPROVED_BY_LORNA,
    approvedAt: text ? (g?.approvedAt ? String(g.approvedAt) : null) : '2026-11-18T00:00:00.000Z',
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
