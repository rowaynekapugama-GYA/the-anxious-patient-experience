/**
 * POST /api/paypal/capture  {token, orderId, source?}
 * The patient approved the payment in PayPal: capture it, mark the booking's deposit received and email both sides.
 * Checked: the order belongs to this booking (custom_id), the amount is the deposit, and a repeat capture of the same
 * order changes nothing. The webhook (/api/paypal/webhook) is the backup if this request never arrives.
 * v1.10.0: a card paid in the card fields is captured only when its 3D Secure result allows it (PayPal's recommended
 * actions, src/lib/paypal.ts threeDs); otherwise nothing is charged and the patient is asked to try again. How the
 * deposit was paid (PayPal, card, Apple Pay, Google Pay) is saved on the booking.
 */
import * as core from '@/booking/core'
import * as deposit from '@/booking/deposit'
import { afterPaid } from '@/booking/paid'
import { paypalConfigured, captureOrder, getOrder, threeDs, methodOf, asSource, DEPOSIT_CURRENCY, money2 } from '@/lib/paypal'
import { tooMany } from '@/lib/questionnaire'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!paypalConfigured()) return core.send(503, { ok: false, error: 'not_configured' })
  const d = core.db()
  if (!d) return core.send(503, { ok: false, error: 'unavailable' })
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  if (tooMany(`pp-capture:${ip}`, 30, 10 * 60 * 1000)) return core.send(429, { ok: false, error: 'busy' })
  let body: Record<string, unknown>
  try { body = await core.readBody(req) } catch { return core.send(400, { ok: false, error: 'invalid' }) }
  const orderId = core.clean(body.orderId, 40)
  if (!/^[A-Z0-9]{8,30}$/i.test(orderId)) return core.send(400, { ok: false, error: 'invalid' })
  try {
    const cfg = core.loadConfig()
    await core.ensureSchema(d, cfg)
    const found = await deposit.bookingForToken(d, String(body.token || ''))
    if (found.state === 'paid' && found.row) return core.send(200, { ok: true, status: 'paid', already: true })
    if (found.state !== 'ok' || !found.row) return core.send(found.state === 'invalid' ? 404 : 409, { ok: false, error: deposit.releasedUnpaid(found.row) ? 'released' : found.state })
    const row = found.row
    if (row.paypal_order_id && row.paypal_order_id !== orderId) return core.send(409, { ok: false, error: 'order_mismatch' })

    if (asSource(body.source) === 'card') {
      const before = await getOrder(orderId)
      if (!before || String(before.purchase_units?.[0]?.custom_id || '').toUpperCase() !== row.ref) return core.send(409, { ok: false, error: 'order_mismatch' })
      const check = threeDs(before)
      if (check !== 'continue') return core.send(402, { ok: false, error: check === 'retry' ? 'card_check_retry' : 'card_check_failed' })
    }
    const { order, capture } = await captureOrder(orderId)
    const unit = order.purchase_units?.[0]
    if (String(unit?.custom_id || '').toUpperCase() !== row.ref) return core.send(409, { ok: false, error: 'order_mismatch' })
    if (!capture) {
      await deposit.recordFailure(d, row.ref, `PayPal order ${orderId} ended as ${order.status}`)
      return core.send(402, { ok: false, error: 'not_completed', status: order.status })
    }
    const amount = Number(capture.amount?.value || 0)
    if (capture.amount?.currency_code !== DEPOSIT_CURRENCY || money2(amount) !== money2(cfg.pricing.deposit)) {
      console.error('paypal capture: unexpected amount', row.ref, capture.amount)
      return core.send(409, { ok: false, error: 'amount_mismatch' })
    }
    const fresh = await deposit.recordCapture(d, row.ref, { captureId: capture.id, orderId, amount, at: capture.create_time, method: methodOf(order) || asSource(body.source) })
    if (fresh) await afterPaid(d, cfg, row, amount, capture.id)
    return core.send(200, { ok: true, status: 'paid', captureId: capture.id, amount })
  } catch (err) {
    console.error('paypal capture: failed', (err as Error).message)
    return core.send(502, { ok: false, error: 'paypal_error' })
  }
}
