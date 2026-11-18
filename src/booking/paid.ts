/**
 * v1.12.0: pay to book. With online payment set up, a new booking holds its time for core.HOLD_MINUTES while the
 * patient pays the deposit, and nothing is emailed yet. When the deposit is captured (Book Now, or the webhook as a
 * backup), afterPaid sends the booking emails to the team and the patient, the GYA delivery check and, if it is set
 * to go at request time, the welcome email. A booking with no hold (no online payment at the time, or paid later
 * through its pay link) gets the usual "Deposit received" emails instead. Unpaid holds are released by
 * core.releaseHolds.
 */
import * as core from './core'
import * as deposit from './deposit'
import * as emails from './emails'
import { deliver } from '@/lib/mailer'
import { liveRecipients } from '@/lib/recipients'

/** The booking emails (team and patient) and the GYA delivery check. Returns whether each email was accepted. */
export async function sendRequestEmails(d: core.Db, cfg: core.Cfg, ref: string, slotStart: Date, payLink: string): Promise<{ notified: boolean; ackSent: boolean }> {
  const live = await liveRecipients()
  const res = await emails.sendBookingEmails(d, cfg, ref, ['team', 'patient'], 'first', { payLink, live })
  const notified = !!res.team?.ok
  const ackSent = !!res.patient?.ok
  if (live.gya.on) {
    const outcomes: emails.Outcome[] = [
      { label: 'New booking email to the team', ok: notified, id: res.team?.id ?? '', error: res.team?.error ?? '', retrying: !notified },
      { label: 'Booking request received, to the patient', ok: ackSent, id: res.patient?.id ?? '', error: res.patient?.error ?? '', retrying: !ackSent },
    ]
    await deliver('gya-notice', emails.gyaNoticeEmail(cfg, { ref, slot_start: slotStart }, outcomes, live.gya.to), { ref })
  }
  return { notified, ackSent }
}

/** A deposit has just been recorded as paid (once per booking: recordCapture decides). */
export async function afterPaid(d: core.Db, cfg: core.Cfg, row: deposit.BookingRow, amount: number, captureId: string): Promise<void> {
  // the hold ends here; only the call that ends it sends the booking emails
  const held = await d.query(`UPDATE ape_bookings SET hold_until = NULL, updated_at = now() WHERE ref = $1 AND hold_until IS NOT NULL RETURNING ref`, [row.ref])
  if (!held.length) {
    await deposit.sendDepositReceived(cfg, row, amount, captureId)
    return
  }
  // a failed email is retried when Bookings or the email screen is opened (emails.retryDue)
  await sendRequestEmails(d, cfg, row.ref, new Date(row.slot_start), '')
  try {
    const { getPayload } = await import('payload')
    const { default: config } = await import('@payload-config')
    const { onBookingPaid } = await import('@/lib/questionnaire')
    await onBookingPaid(await getPayload({ config }), { ref: row.ref, name: row.name, email: row.email, slot_start: row.slot_start })
  } catch (err) {
    console.error('paid: welcome email step failed (the booking is paid)', row.ref, (err as Error).message)
  }
}
