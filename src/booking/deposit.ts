/**
 * The $100 deposit on a booking (v1.8.0): paid through PayPal inside Book Now, or later through a private link, or
 * recorded by hand. Everything here writes the booking's deposit columns and sends the "deposit received" emails;
 * the PayPal calls themselves are in src/lib/paypal.ts.
 *
 * deposit_status: unpaid | paid (PayPal) | manual (ticked by the team) | refunded | failed
 */
import crypto from 'node:crypto'
import * as core from './core'
import { newToken, hashToken } from '@/lib/crypto'
import { siteOrigin } from '@/lib/email'
import { paypalActivityUrl, siteOriginFallback, METHOD_LABEL } from '@/lib/paypal'
import * as tpl from '@/email/patient'
import { shell, panel, status, button, TEAM_FOOTER } from '@/email/layout'
import { DEFAULTS } from '@/site.config'

export const PAY_LINK_DAYS = 14
export type DepositStatus = 'unpaid' | 'paid' | 'manual' | 'refunded' | 'failed'
export type BookingRow = {
  ref: string; slot_start: string | Date; name: string; email: string; phone: string; status: string; price: number | string
  deposit_paid: boolean; deposit_status: DepositStatus; deposit_amount: string | null; deposit_paid_at: string | null; deposit_note: string
  deposit_method?: string; hold_until?: string | Date | null; cancel_reason?: string
  paypal_order_id: string | null; paypal_capture_id: string | null; pay_token_hash: string | null; pay_token_expires: string | null
}
export const isPaid = (s: string) => s === 'paid' || s === 'manual'

/** A private "pay your deposit" token for one booking: new each time, 14 days, only while the deposit is unpaid. */
export async function issuePayToken(d: core.Db, ref: string): Promise<string> {
  const token = newToken()
  await d.query(`UPDATE ape_bookings SET pay_token_hash = $2, pay_token_expires = now() + ($3 || ' days')::interval, updated_at = now() WHERE ref = $1`, [ref, hashToken(token), String(PAY_LINK_DAYS)])
  return token
}
export const payLinkFor = (token: string) => `${siteOrigin(siteOriginFallback())}/book-now/pay/?t=${encodeURIComponent(token)}`

/** The booking a pay token belongs to, with why it cannot be paid if it cannot. */
export async function bookingForToken(d: core.Db, token: string): Promise<{ state: 'ok' | 'paid' | 'expired' | 'cancelled' | 'invalid'; row?: BookingRow }> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return { state: 'invalid' }
  await core.releaseHolds(d) // v1.12.0: an unpaid hold that has run out is released first (state 'cancelled', reason not_paid)
  const rows = await d.query<BookingRow>(`SELECT * FROM ape_bookings WHERE pay_token_hash = $1`, [hashToken(token)])
  const row = rows[0]
  if (!row) return { state: 'invalid' }
  if (row.status === 'cancelled') return { state: 'cancelled', row }
  if (isPaid(row.deposit_status)) return { state: 'paid', row }
  if (row.pay_token_expires && new Date(row.pay_token_expires).getTime() < Date.now()) return { state: 'expired', row }
  return { state: 'ok', row }
}

/** v1.12.0: a payment is starting, so a held booking keeps its time a little longer (never shortened). */
export async function extendHold(d: core.Db, ref: string): Promise<void> {
  await d.query(`UPDATE ape_bookings SET hold_until = greatest(hold_until, now() + ($2 || ' minutes')::interval) WHERE ref = $1 AND hold_until IS NOT NULL`, [ref, String(core.HOLD_EXTEND_MINUTES)])
}
/** v1.12.0: was this booking released because its deposit was not paid in time? */
export const releasedUnpaid = (row?: Pick<BookingRow, 'status' | 'cancel_reason'>) => !!row && row.status === 'cancelled' && row.cancel_reason === 'not_paid'

export async function rememberOrder(d: core.Db, ref: string, orderId: string): Promise<void> {
  await d.query(`UPDATE ape_bookings SET paypal_order_id = $2, updated_at = now() WHERE ref = $1`, [ref, orderId])
}

/**
 * Record a completed PayPal capture. Idempotent: the same capture recorded twice changes nothing and sends nothing.
 * Returns true when this call is the one that marked it paid.
 */
export async function recordCapture(d: core.Db, ref: string, c: { captureId: string; orderId?: string; amount: number; at?: string; method?: string }): Promise<boolean> {
  const r = await d.query(
    `UPDATE ape_bookings
        SET deposit_status = 'paid', deposit_paid = true, deposit_amount = $3, deposit_paid_at = coalesce($4::timestamptz, now()),
            paypal_capture_id = $2, paypal_order_id = coalesce($5, paypal_order_id), pay_token_hash = NULL, pay_token_expires = NULL,
            deposit_method = CASE WHEN $6 = '' THEN deposit_method ELSE $6 END, updated_at = now()
      WHERE ref = $1 AND (paypal_capture_id IS DISTINCT FROM $2) AND deposit_status <> 'paid'
      RETURNING ref`,
    [ref, c.captureId, c.amount, c.at || null, c.orderId || null, String(c.method || '').slice(0, 20)])
  return r.length > 0
}

export async function recordRefund(d: core.Db, ref: string, captureId: string, note: string): Promise<boolean> {
  const r = await d.query(
    `UPDATE ape_bookings SET deposit_status = 'refunded', deposit_paid = false, deposit_note = $3, updated_at = now()
      WHERE ref = $1 AND (paypal_capture_id = $2 OR paypal_capture_id IS NULL) AND deposit_status <> 'refunded' RETURNING ref`,
    [ref, captureId, note])
  return r.length > 0
}

export async function recordFailure(d: core.Db, ref: string, note: string): Promise<boolean> {
  const r = await d.query(
    `UPDATE ape_bookings SET deposit_status = 'failed', deposit_paid = false, deposit_note = $2, updated_at = now()
      WHERE ref = $1 AND deposit_status IN ('unpaid', 'failed') RETURNING ref`,
    [ref, note])
  return r.length > 0
}

/** The team ticks or unticks the deposit by hand (a bank transfer, cash, a phone payment). */
export async function setManual(d: core.Db, ref: string, paid: boolean, note: string, by: string): Promise<boolean> {
  const r = paid
    ? await d.query(`UPDATE ape_bookings SET deposit_status = 'manual', deposit_paid = true, deposit_paid_at = now(), deposit_note = $2, hold_until = NULL, updated_at = now() WHERE ref = $1 AND deposit_status <> 'paid' RETURNING ref`, [ref, `${note}${note ? ' ' : ''}(marked by ${by})`.trim()])
    : await d.query(`UPDATE ape_bookings SET deposit_status = 'unpaid', deposit_paid = false, deposit_paid_at = NULL, deposit_note = $2, updated_at = now() WHERE ref = $1 AND deposit_status IN ('manual', 'failed', 'refunded') RETURNING ref`, [ref, `${note}${note ? ' ' : ''}(unmarked by ${by})`.trim()])
  return r.length > 0
}

/** What the dashboard and the emails show for a booking's deposit. */
export function depositView(row: Partial<BookingRow>) {
  const status = (row.deposit_status || (row.deposit_paid ? 'manual' : 'unpaid')) as DepositStatus
  return {
    status,
    label: status === 'paid' ? 'Received' : status === 'manual' ? 'Received (marked by hand)' : status === 'refunded' ? 'Refunded' : status === 'failed' ? 'Failed' : 'Not paid',
    amount: row.deposit_amount ? Number(row.deposit_amount) : null,
    paidAt: row.deposit_paid_at || null,
    note: row.deposit_note || '',
    captureId: row.paypal_capture_id || null,
    // v1.10.0: how it was paid (blank before v1.10.0, or when only the webhook recorded it)
    method: row.deposit_method ? (METHOD_LABEL[row.deposit_method] || row.deposit_method) : (row.paypal_capture_id ? 'PayPal checkout' : ''),
    paypalUrl: row.paypal_capture_id ? paypalActivityUrl(row.paypal_capture_id) : null,
  }
}

/**
 * The two "Deposit received" emails (patient and team), also used for test emails.
 * v1.14.0: the patient email is branded, with its wording from Patient emails; the team email keeps its wording.
 */
export function depositEmails(cfg: core.Cfg, row: Pick<BookingRow, 'ref' | 'slot_start' | 'name' | 'email'>, amount: number, captureId: string, apeInbox: string, team: string[], o: { test?: boolean; template?: tpl.Template } = {}) {
  const tz = cfg.booking.timeZone
  const start = new Date(row.slot_start)
  const when = `${core.fmtDateTime(start, tz, true)} (Sydney time)`
  const origin = siteOrigin(DEFAULTS.siteUrl)
  const clinicLine = `${cfg.clinic.name}, ${cfg.clinic.street}, ${cfg.clinic.suburb}`
  const patient = tpl.render('deposit-patient', o.template ?? tpl.defaultTemplate('deposit-patient'), {
    origin,
    test: o.test,
    merge: {
      first_name: row.name.split(' ')[0], reference: row.ref, appointment_date: core.fmtDay(start, tz, true), appointment_time: core.fmtTime(start, tz),
      appointment_length: '70 minutes', location: clinicLine, deposit_amount: core.money(amount), contact_phone: cfg.contact.phone, contact_email: apeInbox,
    },
    panel: [['Requested time', when], ['Reference', row.ref], ['PayPal transaction', captureId]],
    system: [],
    markers: {},
    footer: { clinicLine, email: apeInbox, phone: cfg.contact.phone },
  })
  const teamLines = [
    ...(o.test ? ['TEST EMAIL with sample details, no payment was made.'] : []),
    `Deposit received for ${row.ref} (${row.name}, ${when}): ${core.money(amount)} through PayPal checkout, transaction ${captureId}.`,
    'The booking shows Deposit received in the dashboard. Nothing to do in PayPal.',
  ]
  const pre = o.test ? '[TEST] ' : ''
  const teamSubject = `${pre}Deposit received ${row.ref}, ${core.fmtDateTime(start, tz, false)}`
  return {
    patient: { to: [row.email], reply_to: apeInbox, subject: patient.subject, text: patient.text, html: patient.html },
    team: {
      to: team, reply_to: row.email, subject: teamSubject, text: teamLines.join('\n\n'),
      // v1.17.0: the branded layout, laid out for a quick read; the text version is unchanged
      html: shell({
        origin, variant: 'team', subject: teamSubject, footer: TEAM_FOOTER,
        preheader: `${core.money(amount)} received for ${row.ref}. Nothing to do in PayPal.`,
        eyebrow: `${o.test ? 'Test: ' : ''}Deposit received ${row.ref}`,
        heading: `${row.name}, ${core.fmtDateTime(start, tz, false)}`,
        sections: [
          ...(o.test ? [status('test', 'TEST EMAIL with sample details', 'No payment was made.')] : []),
          status('ok', `Deposit received: ${core.money(amount)}`, 'The booking shows Deposit received in the dashboard. Nothing to do in PayPal.'),
          panel([['Reference', row.ref], ['Patient', row.name], ['Appointment', when], ['Amount', core.money(amount)], ['Paid through', 'PayPal checkout'], ['PayPal transaction', captureId]]),
          button(o.test ? 'Open Bookings' : 'Open this booking', o.test ? `${origin}/admin/bookings` : `${origin}/admin/bookings?ref=${encodeURIComponent(row.ref)}`),
        ],
      }).html,
    },
  }
}

/** "Deposit received": a short note to the patient and to the team list, once, when PayPal confirms the payment. */
export async function sendDepositReceived(cfg: core.Cfg, row: BookingRow, amount: number, captureId: string): Promise<void> {
  if (!core.emailConfigured()) return
  // loaded here, not at the top, because src/booking/emails.ts imports this file
  const { liveRecipients } = await import('@/lib/recipients')
  const { deliver } = await import('@/lib/mailer')
  const live = await liveRecipients()
  const m = depositEmails(cfg, row, amount, captureId, live.apeInbox, live.team.list, { template: await tpl.loadTemplate('deposit-patient') })
  await Promise.all([
    deliver('deposit-patient', m.patient, { ref: row.ref }),
    deliver('deposit-team', m.team, { ref: row.ref }),
  ])
}

export const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
