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
import { sendEmail, siteOrigin } from '@/lib/email'
import { paypalActivityUrl, siteOriginFallback } from '@/lib/paypal'

export const PAY_LINK_DAYS = 14
export type DepositStatus = 'unpaid' | 'paid' | 'manual' | 'refunded' | 'failed'
export type BookingRow = {
  ref: string; slot_start: string | Date; name: string; email: string; phone: string; status: string; price: number | string
  deposit_paid: boolean; deposit_status: DepositStatus; deposit_amount: string | null; deposit_paid_at: string | null; deposit_note: string
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
  const rows = await d.query<BookingRow>(`SELECT * FROM ape_bookings WHERE pay_token_hash = $1`, [hashToken(token)])
  const row = rows[0]
  if (!row) return { state: 'invalid' }
  if (row.status === 'cancelled') return { state: 'cancelled', row }
  if (isPaid(row.deposit_status)) return { state: 'paid', row }
  if (row.pay_token_expires && new Date(row.pay_token_expires).getTime() < Date.now()) return { state: 'expired', row }
  return { state: 'ok', row }
}

export async function rememberOrder(d: core.Db, ref: string, orderId: string): Promise<void> {
  await d.query(`UPDATE ape_bookings SET paypal_order_id = $2, updated_at = now() WHERE ref = $1`, [ref, orderId])
}

/**
 * Record a completed PayPal capture. Idempotent: the same capture recorded twice changes nothing and sends nothing.
 * Returns true when this call is the one that marked it paid.
 */
export async function recordCapture(d: core.Db, ref: string, c: { captureId: string; orderId?: string; amount: number; at?: string }): Promise<boolean> {
  const r = await d.query(
    `UPDATE ape_bookings
        SET deposit_status = 'paid', deposit_paid = true, deposit_amount = $3, deposit_paid_at = coalesce($4::timestamptz, now()),
            paypal_capture_id = $2, paypal_order_id = coalesce($5, paypal_order_id), pay_token_hash = NULL, pay_token_expires = NULL, updated_at = now()
      WHERE ref = $1 AND (paypal_capture_id IS DISTINCT FROM $2) AND deposit_status <> 'paid'
      RETURNING ref`,
    [ref, c.captureId, c.amount, c.at || null, c.orderId || null])
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
    ? await d.query(`UPDATE ape_bookings SET deposit_status = 'manual', deposit_paid = true, deposit_paid_at = now(), deposit_note = $2, updated_at = now() WHERE ref = $1 AND deposit_status <> 'paid' RETURNING ref`, [ref, `${note}${note ? ' ' : ''}(marked by ${by})`.trim()])
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
    paypalUrl: row.paypal_capture_id ? paypalActivityUrl(row.paypal_capture_id) : null,
  }
}

const para = (l: string) => `<p style="font:16px/1.6 Arial,sans-serif;color:#284858">${core.escHtml(l).replace(/\n/g, '<br>')}</p>`

/** "Deposit received": a short note to the patient and to the APE inbox, once, when PayPal confirms the payment. */
export async function sendDepositReceived(cfg: core.Cfg, row: BookingRow, amount: number, captureId: string): Promise<void> {
  if (!core.emailConfigured()) return
  const tz = cfg.booking.timeZone
  const when = `${core.fmtDateTime(new Date(row.slot_start), tz, true)} (Sydney time)`
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
  const notifyTo = cfg.bookingRecipients.length ? cfg.bookingRecipients : list(process.env.BOOKING_NOTIFY_EMAIL || process.env.BOOKING_NOTIFY_TO || core.DEFAULT_NOTIFY_TO)
  const apeInbox = cfg.contact.apeEmail || core.DEFAULT_NOTIFY_TO
  const first = row.name.split(' ')[0]
  const patient = [
    `Hi ${first},`,
    `Thank you, your ${core.money(amount)} deposit has been received for your ${core.TM} New Patient Appointment.`,
    `Requested time: ${when}\nReference: ${row.ref}\nPayPal transaction: ${captureId}`,
    'The APE team will be in touch to confirm your appointment. If anything changes, simply reply to this email.',
    `Warm regards,\n${core.TM} team`,
  ]
  const team = [
    `Deposit received for ${row.ref} (${row.name}, ${when}): ${core.money(amount)} through PayPal, transaction ${captureId}.`,
    'The booking shows Deposit received in the dashboard. Nothing to do in PayPal.',
  ]
  await Promise.all([
    sendEmail({ to: [row.email], reply_to: apeInbox, subject: `Deposit received | ${core.TM}`, text: patient.join('\n\n'), html: patient.map(para).join('') }).catch((err) => console.error('deposit: patient email failed', row.ref, (err as Error).message)),
    sendEmail({ to: notifyTo, subject: `Deposit received: ${row.ref}, ${row.name}`, text: team.join('\n\n'), html: team.map(para).join('') }).catch((err) => console.error('deposit: team email failed', row.ref, (err as Error).message)),
  ])
}

export const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
