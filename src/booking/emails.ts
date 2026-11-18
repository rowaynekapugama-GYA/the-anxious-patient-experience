/**
 * The booking emails (v1.8.3): built from the saved booking, so they can be sent again at any time (a retry a minute
 * after a failure, or Resend in the dashboard), and every attempt is logged (src/lib/mailer.ts).
 *
 *   to the team     "New booking request APE-XXXXXX, <time>"  Reply-To: the patient
 *   to the patient  "We have received your booking request"  Reply-To: the APE inbox
 *   to GYA          a delivery check: reference, time and which emails went out. No patient details.
 *
 * A booking's email_patient and email_team columns say how it went: sent, retry (failed once, tried again after a
 * minute) or failed (failed twice: the amber "Email not sent" flag in Bookings).
 */
import * as core from '@/booking/core'
import * as deposit from '@/booking/deposit'
import { deliver, type Kind, type Result } from '@/lib/mailer'
import { liveRecipients, type Live } from '@/lib/recipients'
import { paypalConfigured } from '@/lib/paypal'
import { siteOrigin } from '@/lib/email'
import { DEFAULTS } from '@/site.config'
import { fullName, fmtDob, ageOn, sydneyToday } from './patient'
import { REMINDER } from './terms'
import { sourceLabel } from './source'

const { TM } = core
export const RETRY_SECONDS = 60

export type BookingRow = {
  ref: string; slot_start: string | Date; name: string; email: string; phone: string; notes: string
  price: number | string; special: boolean; status: string; created_at: string | Date; deposit_status?: string
  email_patient?: string; email_team?: string
  // v1.10.0 (blank or null on bookings made before v1.10.0)
  first_name?: string; last_name?: string; dob?: string | Date | null
  terms_version?: string; terms_consent_at?: string | Date | null; terms_read_at?: string | Date | null
  source?: string
}

/** "YYYY-MM-DD" from a date column (pg gives a Date at local midnight) or a string. */
export function dobIso(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  return m ? m[1] : null
}
/** The patient's name: first and last since v1.10.0, the single name before that. */
export const nameOf = (b: Pick<BookingRow, 'name' | 'first_name' | 'last_name'>) => (b.first_name ? fullName(b.first_name, b.last_name || '') : b.name)
export const firstOf = (b: Pick<BookingRow, 'name' | 'first_name'>) => (b.first_name || String(b.name || '').split(' ')[0] || 'there')
export const termsUrl = () => `${siteOrigin(DEFAULTS.siteUrl)}/book-now/terms/`

function table(rows: [string, string][]): string {
  return '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:15px/1.5 Arial,sans-serif;color:#284858">'
    + rows.map(([k, v]) => `<tr><td style="vertical-align:top;color:#7E6548;white-space:nowrap"><strong>${core.escHtml(k)}</strong></td><td style="vertical-align:top">${core.escHtml(v).replace(/\n/g, '<br>')}</td></tr>`).join('')
    + '</table>'
}
const para = (l: string) => `<p style="font:16px/1.6 Arial,sans-serif;color:#284858">${core.escHtml(l).replace(/\n/g, '<br>')}</p>`

function facts(cfg: core.Cfg, b: BookingRow) {
  const tz = cfg.booking.timeZone
  const start = new Date(b.slot_start)
  const price = Number(b.price)
  return {
    start,
    when: `${core.fmtDateTime(start, tz, true)} (Sydney time)`,
    short: core.fmtDateTime(start, tz, false),
    submitted: `${core.fmtDateTime(new Date(b.created_at), tz, true)} (Sydney time), ${new Date(b.created_at).toISOString()}`,
    clinicLine: `${cfg.clinic.name}, ${cfg.clinic.street}, ${cfg.clinic.suburb}`,
    fee: b.special
      ? `${core.money(price)} opening special (normally ${core.money(cfg.pricing.appointment)}). Health fund rebates available.`
      : `${core.money(price)}. Health fund rebates available.`,
  }
}

export function teamEmail(cfg: core.Cfg, b: BookingRow, live: Pick<Live, 'team' | 'bcc'>, o: { test?: boolean } = {}): core.Email {
  const f = facts(cfg, b)
  const paypal = paypalConfigured()
  const depositAmt = cfg.pricing.deposit
  const dob = dobIso(b.dob)
  const tz = cfg.booking.timeZone
  const tick = (v: unknown) => (v ? `${core.fmtDateTime(new Date(v as string), tz, true)} (Sydney time)` : '')
  const rows: [string, string][] = [
    ['Reference', b.ref],
    ['Requested time', f.when],
    ['Appointment', `${TM}: New Patient Appointment (70 minutes)`],
    ['Fee', f.fee],
    ['Deposit', paypal ? `${core.money(depositAmt)}: not paid yet. The patient pays through PayPal on the website; you will get a "Deposit received" email and the dashboard ticks itself.` : `${core.money(depositAmt)}: no online payment set up yet, send deposit details with the confirmation`],
    ['Location', f.clinicLine],
    ...(b.first_name ? [['First name', b.first_name], ['Last name', b.last_name || '']] as [string, string][] : [['Name', b.name]] as [string, string][]),
    ['Date of birth', dob ? `${fmtDob(dob)} (age ${ageOn(dob, sydneyToday())})` : 'Not given'],
    ['Email', b.email],
    ['Phone', b.phone || 'Not provided'],
    ['Note from patient', b.notes || 'None'],
    ['Deposit policy', b.terms_consent_at ? `Agreed ${tick(b.terms_consent_at)}${b.terms_version ? `, version ${b.terms_version}` : ''}` : 'Read and accepted'],
    ['Where they came from', sourceLabel(b.source)],
    ['Collection notice', 'Agreed'],
    ['Submitted', f.submitted],
  ]
  const nextStep = 'Next step: block this time in Core Practice, reply to the patient to confirm and send the new patient information pack, then mark it confirmed under Bookings in the website dashboard (/admin).'
  const intro = `${o.test ? 'TEST EMAIL with sample details, no booking was made. ' : ''}New booking request for ${TM}. This time is held on the website but not yet confirmed.`
  return {
    to: live.team.list,
    ...(live.bcc.length && !o.test ? { bcc: live.bcc } : {}),
    reply_to: b.email,
    subject: `${o.test ? '[TEST] ' : ''}New booking request ${b.ref}, ${f.short}${b.special ? ' [opening special]' : ''}`,
    text: `${intro}\n\n` + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n${nextStep}\nReplying to this email replies to the patient.`,
    html: para(intro) + table(rows) + `<p style="font:15px/1.5 Arial,sans-serif;color:#284858">${core.escHtml(nextStep)}<br>Replying to this email replies to the patient.</p>`,
  }
}

export function patientEmail(cfg: core.Cfg, b: BookingRow, apeInbox: string, o: { payLink?: string; test?: boolean } = {}): core.Email {
  const f = facts(cfg, b)
  const depositAmt = cfg.pricing.deposit
  const first = firstOf(b)
  const lines = [
    ...(o.test ? ['TEST EMAIL with sample details, no booking was made.'] : []),
    `Hi ${first},`,
    `Thank you for your booking request for ${TM} New Patient Appointment.`,
    `Requested time: ${f.when}\nLocation: ${f.clinicLine}\nFee: ${f.fee}\nReference: ${b.ref}`,
    o.payLink
      ? `A ${core.money(depositAmt)} deposit secures your appointment. If you have not already paid it on the website, you can pay it here (PayPal or card): ${o.payLink}`
      : `A ${core.money(depositAmt)} deposit secures your appointment. Deposit details will be sent with your confirmation.`,
    `${REMINDER} You can read the full deposit policy here: ${termsUrl()}`,
    'The APE team will be in touch to confirm your appointment and send your new patient information pack.',
    `If anything changes or you have a question, simply reply to this email or call us on ${cfg.contact.phone}.`,
    `Warm regards,\n${TM} team`,
  ]
  return {
    to: [b.email],
    reply_to: apeInbox,
    subject: `${o.test ? '[TEST] ' : ''}We have received your booking request | ${TM}`,
    text: lines.join('\n\n'),
    html: lines.map(para).join(''),
  }
}

export type Outcome = { label: string; ok: boolean; id: string; error: string; retrying?: boolean }

/** The GYA delivery check: reference, time and outcomes only. Never the patient's name, phone, email or note. */
export function gyaNoticeEmail(cfg: core.Cfg, b: Pick<BookingRow, 'ref' | 'slot_start'>, outcomes: Outcome[], to: string, o: { test?: boolean } = {}): core.Email {
  const short = core.fmtDateTime(new Date(b.slot_start), cfg.booking.timeZone, false)
  const failed = outcomes.filter((x) => !x.ok)
  const lines = [
    ...(o.test ? ['TEST EMAIL, no booking was made.'] : []),
    `APE booking ${b.ref}, appointment ${short} (Sydney time).`,
    ...outcomes.map((x) => `${x.label}: ${x.ok ? `accepted by SMTP2GO${x.id ? ` (${x.id})` : ''}` : `FAILED${x.retrying ? ', trying again in a minute' : ''}: ${x.error}`}`),
    failed.length ? 'The booking is saved. If a retry also fails, it shows "Email not sent" in Bookings with Resend buttons.' : 'Nothing to do.',
    'No patient details are included in this notice.',
  ]
  return {
    to: [to],
    subject: `${o.test ? '[TEST] ' : ''}${failed.length ? 'CHECK ' : ''}APE delivery check ${b.ref}: ${failed.length ? `${failed.length} email${failed.length > 1 ? 's' : ''} failed` : 'all emails accepted'}`,
    text: lines.join('\n\n'),
    html: lines.map(para).join(''),
  }
}

/** A short alert to GYA when an email fails for good (no patient details). */
export async function alertGya(what: string, ref?: string | null, live?: Live): Promise<void> {
  const l = live ?? await liveRecipients()
  const lines = [
    `An email from The Anxious Patient Experience website could not be sent: ${what}${ref ? ` (booking ${ref})` : ''}.`,
    'Details are on the dashboard: Site Settings > Email (GYA only). No patient details are included in this alert.',
  ]
  await deliver('alert', { to: [l.gya.to], subject: `APE email failed: ${what}${ref ? ` ${ref}` : ''}`, text: lines.join('\n\n'), html: lines.map(para).join('') }, { ref })
}

async function bookingRow(d: core.Db, ref: string): Promise<BookingRow | null> {
  const r = await d.query<BookingRow>(`SELECT * FROM ape_bookings WHERE ref = $1`, [ref])
  return r[0] ?? null
}

/** A fresh pay link for the patient copy, while the deposit is still unpaid and PayPal is set up. */
async function payLinkFor(d: core.Db, b: BookingRow): Promise<string> {
  if (!paypalConfigured() || deposit.isPaid(String(b.deposit_status || 'unpaid')) || b.status === 'cancelled') return ''
  const token = await deposit.issuePayToken(d, b.ref).catch(() => '')
  return token ? deposit.payLinkFor(token) : ''
}

type Which = 'patient' | 'team'
const COL: Record<Which, string> = { patient: 'email_patient', team: 'email_team' }
const KIND: Record<Which, Kind> = { patient: 'booking-patient', team: 'booking-team' }

/**
 * Send the booking's patient and/or team email and record how it went on the booking.
 * mode 'first': a failure becomes 'retry' (tried again after a minute); 'final': a failure becomes 'failed'.
 */
export async function sendBookingEmails(d: core.Db, cfg: core.Cfg, ref: string, which: Which[], mode: 'first' | 'final', o: { payLink?: string; live?: Live } = {}): Promise<Partial<Record<Which, Result>>> {
  const b = await bookingRow(d, ref)
  if (!b) return {}
  const live = o.live ?? await liveRecipients()
  const out: Partial<Record<Which, Result>> = {}
  for (const w of which) {
    const msg = w === 'team' ? teamEmail(cfg, b, live) : patientEmail(cfg, b, live.apeInbox, { payLink: o.payLink ?? await payLinkFor(d, b) })
    const r = await deliver(KIND[w], msg, { ref, failStatus: mode === 'first' ? 'retrying' : 'failed' })
    out[w] = r
    const state = r.ok ? 'sent' : mode === 'first' ? 'retry' : 'failed'
    await d.query(`UPDATE ape_bookings SET ${COL[w]} = $2, email_retry_at = CASE WHEN $2 = 'retry' THEN now() + ($3 || ' seconds')::interval ELSE email_retry_at END, updated_at = now() WHERE ref = $1`, [ref, state, String(RETRY_SECONDS)])
  }
  return out
}

/**
 * Try again any booking email that failed once and has waited a minute. Claims each booking first, so two
 * instances never send the same email twice. Runs after a failed booking, and whenever Bookings or the email
 * screen is opened.
 */
export async function retryDue(d: core.Db, cfg: core.Cfg, onlyRef?: string): Promise<number> {
  const due = await d.query<{ ref: string; email_patient: string; email_team: string }>(
    `UPDATE ape_bookings SET email_retry_at = now() + interval '5 minutes'
      WHERE (email_patient = 'retry' OR email_team = 'retry') AND email_retry_at <= now() ${onlyRef ? 'AND ref = $1' : ''}
      RETURNING ref, email_patient, email_team`, onlyRef ? [onlyRef] : []).catch(() => [])
  if (!due.length) return 0
  const live = await liveRecipients()
  for (const r of due) {
    const which = (['patient', 'team'] as Which[]).filter((w) => (w === 'patient' ? r.email_patient : r.email_team) === 'retry')
    const res = await sendBookingEmails(d, cfg, r.ref, which, 'final', { live })
    const failed = which.filter((w) => !res[w]?.ok)
    if (failed.length) await alertGya(`${failed.map((w) => (w === 'team' ? 'new booking email to the team' : 'booking email to the patient')).join(' and ')} failed twice`, r.ref, live)
  }
  return due.length
}
