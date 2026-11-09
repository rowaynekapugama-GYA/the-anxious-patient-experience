/**
 * POST /api/stripe/webhook  (optional)
 *
 * When a patient pays the $100 deposit through the Stripe Payment Link (DEPOSIT_PAYMENT_URL), Stripe tells the
 * website, and the booking is marked "Deposit received" in the dashboard by itself. The booking reference reaches
 * Stripe as the Payment Link's client_reference_id (added in src/app/api/booking/route.ts).
 *
 * Set up in Stripe: Developers > Webhooks > Add endpoint, https://<the website>/api/stripe/webhook, events
 * checkout.session.completed and checkout.session.async_payment_succeeded. Put its signing secret in
 * STRIPE_WEBHOOK_SECRET in Vercel. No Stripe API keys are needed: the website never charges cards itself.
 * Without STRIPE_WEBHOOK_SECRET this answers 503 and the team ticks deposits by hand as before.
 */
import * as core from '@/booking/core'
import { validStripeSignature } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return core.send(503, { ok: false, error: 'not_configured' })
  const raw = await req.text()
  if (raw.length > 512000) return core.send(413, { ok: false, error: 'too_large' })
  if (!validStripeSignature(raw, req.headers.get('stripe-signature') || '', secret)) return core.send(400, { ok: false, error: 'bad_signature' })
  let event: { type?: string; data?: { object?: { client_reference_id?: string | null; payment_status?: string } } }
  try { event = JSON.parse(raw) } catch { return core.send(400, { ok: false, error: 'invalid' }) }
  const paidEvent = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded'
  const s = event.data?.object
  if (!paidEvent || !s || s.payment_status !== 'paid') return core.send(200, { ok: true, ignored: true })
  const ref = core.clean(s.client_reference_id, 20)
  if (!/^APE-[0-9A-F]{6}$/.test(ref)) return core.send(200, { ok: true, ignored: true })
  const d = core.db()
  if (!d) return core.send(503, { ok: false, error: 'no_database' })
  try {
    const r = await d.query(`UPDATE ape_bookings SET deposit_paid = true, updated_at = now() WHERE ref = $1 RETURNING ref`, [ref])
    if (!r.length) console.warn('stripe webhook: no booking with reference', ref)
    return core.send(200, { ok: true, updated: r.length })
  } catch (err) {
    console.error('stripe webhook: database error', ref, (err as Error).message)
    // a non-2xx answer makes Stripe try again later
    return core.send(500, { ok: false, error: 'server_error' })
  }
}
