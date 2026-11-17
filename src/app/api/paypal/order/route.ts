/**
 * POST /api/paypal/order  {token, source?, termsRead?, termsReadAt?, from?}
 * Starts the $100 deposit payment for one booking. The token is the booking's private pay token (given to the
 * browser when the booking was made, and in the "Pay your deposit" link in the patient's email). The amount is set
 * here from content/booking.json, never by the browser. Returns the PayPal order id for the PayPal buttons.
 *
 * v1.10.0: source is paypal (the PayPal buttons, including the guest card button), or with PAYPAL_ADVANCED=on card,
 * apple_pay or google_pay. The patient must have ticked "I have read the terms and conditions and cancellation
 * policy": on Book Now that is saved with the booking; on the pay-later page (from: 'pay-page') it is saved here.
 */
import * as core from '@/booking/core'
import * as deposit from '@/booking/deposit'
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
    if (found.state !== 'ok' || !found.row) return core.send(found.state === 'invalid' ? 404 : 409, { ok: false, error: found.state })
    const source = asSource(body.source)
    if (source !== 'paypal' && !paypalAdvanced()) return core.send(400, { ok: false, error: 'source_off' })
    const row = found.row as deposit.BookingRow & { terms_read_at?: string | null }
    if (body.termsRead === true && body.from === 'pay-page') {
      await d.query(`UPDATE ape_bookings SET terms_pay_read_at = coalesce(terms_pay_read_at, $2::timestamptz), updated_at = now() WHERE ref = $1`, [row.ref, tickTime(body.termsReadAt).toISOString()])
    } else if (body.termsRead !== true && !row.terms_read_at) {
      return core.send(400, { ok: false, error: 'terms' })
    }
    const order = await createDepositOrder(found.row.ref, cfg.pricing.deposit, siteOrigin(siteOriginFallback()), source)
    await deposit.rememberOrder(d, found.row.ref, order.id)
    return core.send(200, { ok: true, id: order.id })
  } catch (err) {
    console.error('paypal order: failed', (err as Error).message)
    return core.send(502, { ok: false, error: 'paypal_error' })
  }
}
