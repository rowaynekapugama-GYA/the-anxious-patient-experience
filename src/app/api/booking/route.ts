/**
 * Booking requests for The Anxious Patient Experience™ (POST /api/booking/)
 *
 * The website does not connect to Core Practice. A patient chooses a time, enters their details and ticks the
 * deposit policy; this route:
 *   1. checks the time again on the server (listed day and time, from the start date, at least 24 hours away,
 *      not blocked, not already requested), works out the fee (opening special or standard) and saves the booking,
 *      all in one locked step so two people can never get the same time or more than the special allows;
 *   2. emails the request to the APE inbox and an acknowledgement to the patient (with a private "pay your deposit"
 *      link when PayPal is set up, in case they do not pay in the booking flow itself).
 *   3. v1.8.0: when PayPal is set up (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET), the browser then shows the PayPal
 *      buttons for the $100 deposit; /api/paypal/order and /api/paypal/capture do the payment and mark the booking.
 * The APE team then blocks the time in Core Practice, confirms with the patient and marks it confirmed under
 * Bookings in the dashboard (/admin/bookings).
 *
 * Environment variables: DATABASE_URL, SMTP2GO_API_KEY or RESEND_API_KEY, and BOOKING_FROM (required);
 * BOOKING_NOTIFY_EMAIL (or BOOKING_NOTIFY_TO), BOOKING_BCC, PAYPAL_* (optional). See .env.example.
 * Who gets the request: Site Settings > Who receives booking requests, else BOOKING_NOTIFY_EMAIL, else the APE inbox.
 */
import crypto from 'node:crypto'
import * as core from '@/booking/core'
import { questionnaireEnabled, onBookingRequested } from '@/lib/questionnaire'
import * as deposit from '@/booking/deposit'
import { paypalConfigured, paypalClientId } from '@/lib/paypal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const { TM } = core

function table(rows: [string, string][]): string {
  return '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:15px/1.5 Arial,sans-serif;color:#284858">'
    + rows.map(([k, v]) => `<tr><td style="vertical-align:top;color:#7E6548;white-space:nowrap"><strong>${core.escHtml(k)}</strong></td><td style="vertical-align:top">${core.escHtml(v).replace(/\n/g, '<br>')}</td></tr>`).join('')
    + '</table>'
}
const para = (l: string) => `<p style="font:16px/1.6 Arial,sans-serif;color:#284858">${core.escHtml(l).replace(/\n/g, '<br>')}</p>`

const INSERT = `
  INSERT INTO ape_bookings (ref, slot_start, name, email, phone, notes, price, special)
  SELECT $1, $2::timestamptz, $3, $4, $5, $6, CASE WHEN s.ok THEN $8::int ELSE $9::int END, s.ok
  FROM (SELECT ($7::boolean AND (SELECT count(*) FROM ape_bookings WHERE special AND status <> 'cancelled') < $10::int) AS ok) s
  WHERE NOT EXISTS (SELECT 1 FROM ape_blocks b WHERE b.day = $11::date AND (b.time IS NULL OR b.time = $12))
  ON CONFLICT DO NOTHING
  RETURNING ref, price, special`

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try { body = await core.readBody(req) } catch { return core.send(400, { ok: false, error: 'invalid' }) }

  const now = Date.now()
  const ref = 'APE-' + crypto.randomBytes(3).toString('hex').toUpperCase()

  const d = core.db()
  let cfg = core.loadConfig()
  if (d) {
    try {
      await core.ensureSchema(d, cfg)
      cfg = core.loadConfig(await core.readOverrides(d))
    } catch (err) {
      console.error('booking: database error', ref, (err as Error).message)
      return core.send(503, { ok: false, error: 'unavailable' })
    }
  }

  // Spam trap: a hidden field people never see. Pretend it worked and save or send nothing.
  if (core.clean(body.website, 200)) return core.send(200, { ok: true, ref, price: cfg.pricing.appointment, special: false })

  const name = core.oneLine(core.clean(body.name, 120))
  const email = core.clean(body.email, 200)
  const phone = core.oneLine(core.clean(body.phone, 40))
  const notes = core.clean(body.notes, 2000)
  const fields: Record<string, string> = {}
  if (!name) fields.name = 'required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'invalid'
  if (body.consent !== true) fields.consent = 'required'
  if (body.policy !== true) fields.policy = 'required'
  if (Object.keys(fields).length) return core.send(400, { ok: false, error: 'invalid', fields })

  const slot = core.checkSlot(cfg, core.clean(body.slotStart, 40), now)
  if (slot.error) return core.send(slot.error === 'too_soon' ? 409 : 400, { ok: false, error: slot.error })

  if (!d || !core.emailConfigured()) {
    console.error('booking: DATABASE_URL, an email key (SMTP2GO_API_KEY or RESEND_API_KEY) and BOOKING_FROM must all be set in Vercel. Request not taken:', ref)
    return core.send(503, { ok: false, error: 'not_configured' })
  }

  // 1. Save it: one transaction, locked, so the special can never go past its limit and a time is never doubled.
  let saved: Record<string, any> | undefined
  try {
    const o = cfg.openingSpecial
    const results = await d.tx([
      ['SELECT pg_advisory_xact_lock(4242001)', []],
      [INSERT, [ref, slot.start!.toISOString(), name, email, phone, notes, core.inSpecialWindow(cfg, slot.day!), o.price, cfg.pricing.appointment, o.maxBookings, slot.day, slot.time]],
    ])
    saved = results[1][0]
  } catch (err) {
    console.error('booking: database error', ref, (err as Error).message)
    return core.send(503, { ok: false, error: 'unavailable' })
  }
  if (!saved) {
    const blocked = await d.query(`SELECT 1 FROM ape_blocks WHERE day = $1::date AND (time IS NULL OR time = $2) LIMIT 1`, [slot.day, slot.time]).catch(() => [])
    return core.send(409, { ok: false, error: blocked.length ? 'blocked' : 'taken' })
  }
  const price = Number(saved.price)
  const special = !!saved.special

  // 2. Emails
  const tz = cfg.booking.timeZone
  const start = slot.start!
  const when = `${core.fmtDateTime(start, tz, true)} (Sydney time)`
  const submitted = `${core.fmtDateTime(new Date(now), tz, true)} (Sydney time), ${new Date(now).toISOString()}`
  const clinicLine = `${cfg.clinic.name}, ${cfg.clinic.street}, ${cfg.clinic.suburb}`
  const fee = special
    ? `${core.money(price)} opening special (normally ${core.money(cfg.pricing.appointment)}). Health fund rebates available.`
    : `${core.money(price)}. Health fund rebates available.`
  // v1.8.0: a private pay link for this booking (shown in the flow and in the email), only when PayPal is set up
  const paypal = paypalConfigured()
  const payToken = paypal ? await deposit.issuePayToken(d, ref).catch(() => '') : ''
  const link = payToken ? deposit.payLinkFor(payToken) : ''
  const depositAmt = cfg.pricing.deposit
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
  const notifyTo = cfg.bookingRecipients.length ? cfg.bookingRecipients
    : list(process.env.BOOKING_NOTIFY_EMAIL || process.env.BOOKING_NOTIFY_TO || core.DEFAULT_NOTIFY_TO)
  const bcc = list(process.env.BOOKING_BCC || '')
  const apeInbox = cfg.contact.apeEmail || core.DEFAULT_NOTIFY_TO
  const clinicPhone = cfg.contact.phone

  const rows: [string, string][] = [
    ['Reference', ref],
    ['Requested time', when],
    ['Appointment', `${TM}: New Patient Appointment (70 minutes)`],
    ['Fee', fee],
    ['Deposit', paypal ? `${core.money(depositAmt)}: not paid yet. The patient pays through PayPal on the website; you will get a "Deposit received" email and the dashboard ticks itself.` : `${core.money(depositAmt)}: no online payment set up yet, send deposit details with the confirmation`],
    ['Location', clinicLine],
    ['Name', name],
    ['Email', email],
    ['Phone', phone || 'Not provided'],
    ['Note from patient', notes || 'None'],
    ['Deposit and cancellation policy', 'Read and accepted'],
    ['Collection notice', 'Agreed'],
    ['Submitted', submitted],
  ]
  const nextStep = 'Next step: block this time in Core Practice, reply to the patient to confirm and send the new patient information pack, then mark it confirmed under Bookings in the website dashboard (/admin).'
  const notify: core.Email = {
    to: notifyTo,
    reply_to: email,
    subject: `APE booking request: ${core.fmtDateTime(start, tz, false)}, ${name} (${ref})${special ? ' [opening special]' : ''}`,
    text: `New booking request for ${TM}. This time is held on the website but not yet confirmed.\n\n` + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n${nextStep}\nReplying to this email replies to the patient.`,
    html: `<p style="font:16px/1.5 Arial,sans-serif;color:#284858">New booking request for ${core.escHtml(TM)}. <strong>This time is held on the website but not yet confirmed.</strong></p>`
      + table(rows) + `<p style="font:15px/1.5 Arial,sans-serif;color:#284858">${core.escHtml(nextStep)}<br>Replying to this email replies to the patient.</p>`,
  }
  if (bcc.length) notify.bcc = bcc
  let notified = true
  try {
    await core.sendEmail(notify)
  } catch (err) {
    // The booking is saved and shows in the dashboard, so the patient is not asked to try again.
    notified = false
    console.error('booking: notification email failed (booking saved, see dashboard)', ref, (err as Error).message)
  }

  // Acknowledgement to the patient (NEW COPY in v1.4.0: needs the client's sign-off, see CHANGELOG)
  const first = name.split(' ')[0]
  const ackLines = [
    `Hi ${first},`,
    `Thank you for your booking request for ${TM} New Patient Appointment.`,
    `Requested time: ${when}\nLocation: ${clinicLine}\nFee: ${fee}\nReference: ${ref}`,
    link
      ? `A ${core.money(depositAmt)} deposit secures your appointment. If you have not already paid it on the website, you can pay it here (PayPal or card): ${link}`
      : `A ${core.money(depositAmt)} deposit secures your appointment. Deposit details will be sent with your confirmation.`,
    'The APE team will be in touch to confirm your appointment and send your new patient information pack.',
    `If anything changes or you have a question, simply reply to this email or call us on ${clinicPhone}.`,
    `Warm regards,\n${TM} team`,
  ]
  let ackSent = true
  try {
    await core.sendEmail({
      to: [email],
      reply_to: apeInbox,
      subject: `We have received your booking request | ${TM}`,
      text: ackLines.join('\n\n'),
      html: ackLines.map(para).join(''),
    })
  } catch (err) {
    ackSent = false
    console.error('booking: acknowledgement email failed (the booking is saved)', ref, (err as Error).message)
  }
  // v1.7.0: the welcome pack and questionnaire link, if Site Settings says to send them at request time
  if (questionnaireEnabled()) {
    try {
      const { getPayload } = await import('payload')
      const { default: config } = await import('@payload-config')
      await onBookingRequested(await getPayload({ config }), { ref, name, email, slot_start: start.toISOString() })
    } catch (err) {
      console.error('booking: welcome email step failed (the booking is saved)', ref, (err as Error).message)
    }
  }
  return core.send(200, {
    ok: true, ref, price, special, regular: cfg.pricing.appointment, deposit: depositAmt, notified, ackSent,
    ...(paypal && payToken ? { payment: { provider: 'paypal', clientId: paypalClientId(), token: payToken, payUrl: link, currency: 'AUD' } } : {}),
  })
}
