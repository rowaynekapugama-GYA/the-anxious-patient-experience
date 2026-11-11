/**
 * POST /api/paypal/webhook
 * PayPal's own record of what happened to each payment, as a backup for the capture call and for refunds made in
 * PayPal. Every delivery is verified with PayPal (verify-webhook-signature, PAYPAL_WEBHOOK_ID) and remembered by its
 * event id, so a repeat delivery or a replay changes nothing. Events: PAYMENT.CAPTURE.COMPLETED,
 * PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED. Anything else is acknowledged and ignored.
 */
import * as core from '@/booking/core'
import * as deposit from '@/booking/deposit'
import { paypalConfigured, verifyWebhook, refOfResource, DEPOSIT_CURRENCY, type WebhookEvent } from '@/lib/paypal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!paypalConfigured() || !process.env.PAYPAL_WEBHOOK_ID) return core.send(503, { ok: false, error: 'not_configured' })
  const raw = await req.text()
  if (raw.length > 200_000) return core.send(413, { ok: false, error: 'too_large' })
  if (!(await verifyWebhook(req.headers, raw).catch(() => false))) return core.send(400, { ok: false, error: 'bad_signature' })
  let event: WebhookEvent
  try { event = JSON.parse(raw) as WebhookEvent } catch { return core.send(400, { ok: false, error: 'invalid' }) }
  if (!event.id || !event.event_type) return core.send(400, { ok: false, error: 'invalid' })
  const d = core.db()
  if (!d) return core.send(503, { ok: false, error: 'unavailable' })
  try {
    const cfg = core.loadConfig()
    await core.ensureSchema(d, cfg)
    const ref = refOfResource(event.resource)
    // remember the event first: a second delivery of the same id stops here
    const seen = await d.query(`INSERT INTO ape_paypal_events (event_id, event_type, ref) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING event_id`, [event.id, event.event_type, ref || null])
    if (!seen.length) return core.send(200, { ok: true, repeat: true })
    if (!ref) return core.send(200, { ok: true, ignored: 'no booking reference' })
    const rows = await d.query<deposit.BookingRow>(`SELECT * FROM ape_bookings WHERE ref = $1`, [ref])
    const row = rows[0]
    if (!row) return core.send(200, { ok: true, ignored: 'unknown booking' })
    const res = event.resource || {}
    const captureId = String(res.id || '')
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const amount = Number(res.amount?.value || 0)
      if (res.amount?.currency_code !== DEPOSIT_CURRENCY || amount <= 0) return core.send(200, { ok: true, ignored: 'amount' })
      const fresh = await deposit.recordCapture(d, ref, { captureId, amount, at: res.create_time })
      if (fresh) await deposit.sendDepositReceived(cfg, row, amount, captureId)
      return core.send(200, { ok: true, applied: fresh })
    }
    if (event.event_type === 'PAYMENT.CAPTURE.DENIED') {
      return core.send(200, { ok: true, applied: await deposit.recordFailure(d, ref, `PayPal declined the payment (${captureId})`) })
    }
    if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
      // the resource is the refund; the capture it belongs to is linked under "up"
      const up = (res.links as { rel?: string; href?: string }[] | undefined)?.find((l) => l.rel === 'up')?.href || ''
      const origCapture = up.split('/').pop() || row.paypal_capture_id || ''
      return core.send(200, { ok: true, applied: await deposit.recordRefund(d, ref, origCapture, `Refunded in PayPal (${captureId})`) })
    }
    return core.send(200, { ok: true, ignored: event.event_type })
  } catch (err) {
    console.error('paypal webhook: error', event.event_type, (err as Error).message)
    return core.send(500, { ok: false, error: 'server_error' })   // PayPal retries
  }
}
