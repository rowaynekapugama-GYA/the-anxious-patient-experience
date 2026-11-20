/**
 * Booking requests for The Anxious Patient Experience™ (POST /api/booking/)
 *
 * The website does not connect to Core Practice. A patient chooses a time, enters their details (v1.10.0: first and
 * last name, email, phone and date of birth, all required) and (v1.11.0) agrees to Lorna's deposit policy in the
 * pop-up before the deposit step; this route:
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
import { onBookingRequested } from '@/lib/questionnaire'
import * as deposit from '@/booking/deposit'
import { paypalConfigured, paypalClientId, paypalAdvanced, paypalEnv } from '@/lib/paypal'
import { after } from 'next/server'
import * as emails from '@/booking/emails'
import { sendRequestEmails } from '@/booking/paid'
import { checkDetails, fullName } from '@/booking/patient'
import * as terms from '@/booking/terms'
import { cleanSource } from '@/booking/source'
import { ageRule, cleanGuardian, guardianOk } from '@/booking/age'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// room for the one retry a minute after a failed email (v1.8.3)
export const maxDuration = 90


const INSERT = `
  INSERT INTO ape_bookings (ref, slot_start, name, email, phone, notes, price, special, first_name, last_name, dob, terms_version, terms_consent_at, source, source_medium, source_campaign, guardian_name)
  SELECT $1, $2::timestamptz, $3, $4, $5, $6, CASE WHEN s.ok THEN $8::int ELSE $9::int END, s.ok, $13, $14, $15::date, $16, $17::timestamptz, $18, $19, $20, NULLIF($21, '')
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

  // v1.10.0: first and last name, email, an Australian phone number and a date of birth, all required
  const checked = checkDetails(body, new Date(now))
  const fields: Record<string, string> = checked.ok ? {} : { ...checked.fields }
  const notes = core.clean(body.notes, 2000)
  if (body.consent !== true) fields.consent = 'required'
  // v1.11.0: Lorna's deposit policy, agreed in the pop-up ("I Agree & Continue"). No agreement, no booking.
  if (body.policyAgreed !== true) fields.policy = 'required'
  if (!checked.ok || Object.keys(fields).length) return core.send(400, { ok: false, error: 'invalid', fields })
  const { firstName, lastName, email, phone, dob } = checked.details
  const name = fullName(firstName, lastName)
  const consentAt = terms.tickTime(body.policyAgreedAt, now)
  // the version the pop-up showed (sent back by the browser), else the one in use now
  const shown = core.clean(body.policyVersion, 40)
  const termsVersion = /^\d{1,4} \(\d{4}-\d{2}-\d{2}\)$/.test(shown) ? shown : await currentTermsLabel()
  const src = cleanSource(body.source)

  const slot = core.checkSlot(cfg, core.clean(body.slotStart, 40), now)
  if (slot.error) return core.send(slot.error === 'too_soon' ? 409 : 400, { ok: false, error: slot.error })

  // v1.13.0: for patients aged 15 and over; under 18 needs a parent or guardian's name (age on the appointment date).
  // Checked here, before anything is saved, held or paid.
  const ages = ageRule(dob, slot.start!)
  if (ages.status === 'under_min') return core.send(400, { ok: false, error: 'invalid', fields: { dob: 'under_min' } })
  const guardianName = ages.status === 'guardian' ? cleanGuardian(body.guardianName) : ''
  if (ages.status === 'guardian' && !guardianOk(guardianName)) return core.send(400, { ok: false, error: 'invalid', fields: { guardian: 'required' } })

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
      [INSERT, [ref, slot.start!.toISOString(), name, email, phone, notes, core.inSpecialWindow(cfg, slot.day!), o.price, cfg.pricing.appointment, o.maxBookings, slot.day, slot.time,
        firstName, lastName, dob, termsVersion, consentAt.toISOString(), src.source, src.medium, src.campaign, guardianName]],
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

  // 2. Emails (v1.8.3: built from the saved booking in src/booking/emails.ts, every attempt logged, a failure tried
  // again after a minute and then flagged in Bookings; GYA gets a delivery check without patient details)
  // v1.8.0: a private pay link for this booking (shown in the flow and in the email), only when PayPal is set up
  // v1.12.0: pay to book. With PayPal set up, the time is held for core.HOLD_MINUTES while the patient pays, and the
  // emails go when the deposit is paid (src/booking/paid.ts); unpaid, the hold is released. Without PayPal, a request
  // is taken as before and the team follows up the deposit.
  const paypal = paypalConfigured()
  const payToken = paypal ? await deposit.issuePayToken(d, ref).catch(() => '') : ''
  const link = payToken ? deposit.payLinkFor(payToken) : ''
  const payNow = !!payToken
  let notified = false
  let ackSent = false
  let holdUntil: string | null = null
  if (payNow) {
    const h = await d.query(`UPDATE ape_bookings SET hold_until = now() + ($2 || ' minutes')::interval WHERE ref = $1 RETURNING hold_until`, [ref, String(core.HOLD_MINUTES)])
    holdUntil = h[0]?.hold_until ? new Date(h[0].hold_until).toISOString() : null
  } else {
    ({ notified, ackSent } = await sendRequestEmails(d, cfg, ref, slot.start!, link))
  }
  if (!payNow && (!notified || !ackSent)) {
    // try once more after a minute, after the patient has their answer (Bookings and the email screen also retry)
    after(async () => {
      await new Promise((r) => setTimeout(r, (emails.RETRY_SECONDS + 2) * 1000))
      await emails.retryDue(d, cfg, ref).catch((err) => console.error('booking: retry failed', ref, (err as Error).message))
    })
  }
  // v1.9.0: the welcome pack, only if it is switched on and set to go at request time (it checks both)
  // v1.9.3: and, while the online questionnaire is live, the private link for the Book Now page to offer it
  let questionnaireUrl: string | null = null
  try {
    const { getPayload } = await import('payload')
    const { default: config } = await import('@payload-config')
    questionnaireUrl = (await onBookingRequested(await getPayload({ config }), { ref, name, email, slot_start: slot.start!.toISOString(), dob }, { welcome: !payNow })).link
  } catch (err) {
    console.error('booking: welcome email step failed (the booking is saved)', ref, (err as Error).message)
  }
  return core.send(200, {
    ok: true, ref, price, special, regular: cfg.pricing.appointment, deposit: cfg.pricing.deposit, notified, ackSent,
    ...(questionnaireUrl ? { questionnaire: { url: questionnaireUrl.replace(/^https?:\/\/[^/]+/, '') } } : {}),
    ...(paypal && payToken ? { payment: { provider: 'paypal', clientId: paypalClientId(), token: payToken, payUrl: link, currency: 'AUD', advanced: paypalAdvanced(), env: paypalEnv(), holdUntil, holdMinutes: core.HOLD_MINUTES } } : {}),
  })
}

async function currentTermsLabel(): Promise<string> {
  try {
    const { getPayload } = await import('payload')
    const { default: config } = await import('@payload-config')
    return (await terms.loadTerms(await getPayload({ config }))).label
  } catch {
    return terms.fromSettings(null).label
  }
}

