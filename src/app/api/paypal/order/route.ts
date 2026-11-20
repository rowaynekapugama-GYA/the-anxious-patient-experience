/**
 * POST /api/paypal/order  {token, source?, policyAgreed?, policyAgreedAt?, policyVersion?, from?}
 * Starts the $100 deposit payment for one booking. The token is the booking's private pay token (given to the
 * browser when the booking was made, and in the "Pay your deposit" link in the patient's email). The amount is set
 * here from content/booking.json, never by the browser. Returns the PayPal order id for the PayPal buttons.
 *
 * v1.10.0: source is paypal (the PayPal buttons, including the guest card button), or with PAYPAL_ADVANCED=on card,
 * apple_pay or google_pay. v1.11.0: the patient must have agreed to the deposit policy: in the Book Now pop-up (saved
 * with the booking) or, on the pay-later page (from: 'pay-page'), in the same pop-up there, which is saved here with
 * the version they agreed to.
 */
import * as core from '@/booking/core'
import * as deposit from '@/booking/deposit'
import { ageRule } from '@/booking/age'
import { dobIso } from '@/booking/emails'
import { paypalConfigured, paypalAdvanced, createDepositOrder, siteOriginFallback, asSource } from '@/lib/paypal'
import { tickTime } from '@/booking/terms'
import { siteOrigin } from '@/lib/email'
import { tooMany } from '@/lib/questionnaire'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!paypalConfigured()) return core.send(503, { ok: false, error: 'not_configured' })
  const d = core.db()
  if (!d) return core.send(503, { ok: false, error: 'unavailable' })
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  if (tooMany(`pp-order:${ip}`, 30, 10 * 60 * 1000)) return core.send(429, { ok: false, error: 'busy' })
  let body: Record<string, unknown>
  try { body = await core.readBody(req) } catch { return core.send(400, { ok: false, error: 'invalid' }) }
  try {
    const cfg = core.loadConfig()
    await core.ensureSchema(d, cfg)
    const found = await deposit.bookingForToken(d, String(body.token || ''))
    if (found.state !== 'ok' || !found.row) return core.send(found.state === 'invalid' ? 404 : 409, { ok: false, error: deposit.releasedUnpaid(found.row) ? 'released' : found.state })
    // v1.13.0: never take a deposit for a patient under 15 on the appointment date (bookings are checked on the way in)
    if (ageRule(dobIso((found.row as { dob?: string | Date | null }).dob ?? null), found.row.slot_start).status === 'under_min') return core.send(400, { ok: false, error: 'age' })
    const source = asSource(body.source)
    if (source !== 'paypal' && !paypalAdvanced()) return core.send(400, { ok: false, error: 'source_off' })
    const row = found.row as deposit.BookingRow & { terms_consent_at?: string | null; terms_pay_read_at?: string | null }
    if (body.policyAgreed === true && body.from === 'pay-page') {
      const v = core.clean(body.policyVersion, 40)
      await d.query(`UPDATE ape_bookings SET terms_pay_read_at = coalesce(terms_pay_read_at, $2::timestamptz), terms_version = CASE WHEN $3 = '' THEN terms_version ELSE $3 END, updated_at = now() WHERE ref = $1`,
        [row.ref, tickTime(body.policyAgreedAt).toISOString(), /^\d{1,4} \(\d{4}-\d{2}-\d{2}\)$/.test(v) ? v : ''])
    } else if (body.policyAgreed !== true && !row.terms_consent_at && !row.terms_pay_read_at) {
      return core.send(400, { ok: false, error: 'policy' })
    }
    await deposit.extendHold(d, found.row.ref) // v1.12.0: a payment in progress keeps its held time
    const order = await createDepositOrder(found.row.ref, cfg.pricing.deposit, siteOrigin(siteOriginFallback()), source)
    await deposit.rememberOrder(d, found.row.ref, order.id)
    return core.send(200, { ok: true, id: order.id })
  } catch (err) {
    console.error('paypal order: failed', (err as Error).message)
    return core.send(502, { ok: false, error: 'paypal_error' })
  }
}
