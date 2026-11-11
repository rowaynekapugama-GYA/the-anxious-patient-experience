/**
 * PayPal for the $100 deposit (v1.8.0), server side with the Orders v2 REST API.
 *
 *   PAYPAL_ENV            sandbox | live
 *   PAYPAL_CLIENT_ID      the REST app's client ID (public: the PayPal buttons on Book Now load with it)
 *   PAYPAL_CLIENT_SECRET  the REST app's secret (server only, never sent to the browser)
 *   PAYPAL_WEBHOOK_ID     the webhook created in the same app, used to verify each event's signature
 *   PAYPAL_API_URL        tests only: a local stand-in for PayPal
 *
 * Without PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET the deposit step is simply not offered: Book Now behaves as it did
 * before (the deposit details come with the confirmation). The amount is always set here, never by the browser.
 */
import { DEFAULTS } from '@/site.config'

export const DEPOSIT_CURRENCY = 'AUD'
export const BRAND_NAME = 'The Anxious Patient Experience'
export const DEPOSIT_DESCRIPTION = 'The Anxious Patient Experience deposit'

export function paypalEnv(): 'sandbox' | 'live' {
  return process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox'
}
export function paypalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
}
export const paypalClientId = () => process.env.PAYPAL_CLIENT_ID || ''
export function paypalApi(): string {
  if (process.env.PAYPAL_API_URL) return process.env.PAYPAL_API_URL.replace(/\/+$/, '')
  return paypalEnv() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}
/** Where the team can see a payment in PayPal. */
export function paypalActivityUrl(captureId: string): string {
  const host = paypalEnv() === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com'
  return `${host}/activity/payment/${encodeURIComponent(captureId)}`
}
export const money2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

// ---------------------------------------------------------------- access token
let token: { value: string; expires: number } | null = null
async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value
  const id = process.env.PAYPAL_CLIENT_ID || ''
  const secret = process.env.PAYPAL_CLIENT_SECRET || ''
  if (!id || !secret) throw new Error('PayPal is not set up (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET)')
  const r = await fetch(`${paypalApi()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const j = await r.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!r.ok || !j.access_token) throw new Error(`PayPal token ${r.status}: ${j.error_description || 'no token'}`)
  token = { value: j.access_token, expires: Date.now() + (Number(j.expires_in) || 3000) * 1000 }
  return token.value
}

async function call<T>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<{ status: number; json: T }> {
  const r = await fetch(`${paypalApi()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = (await r.json().catch(() => ({}))) as T
  return { status: r.status, json }
}

// ---------------------------------------------------------------- orders
export type Order = {
  id: string
  status: string
  purchase_units?: { custom_id?: string; reference_id?: string; payments?: { captures?: Capture[] } }[]
}
export type Capture = { id: string; status: string; amount?: { currency_code: string; value: string }; custom_id?: string; create_time?: string }

/** Create the order for one booking's deposit. The reference is PayPal's idempotency key, so a repeat makes no second order. */
export async function createDepositOrder(ref: string, amount: number, origin: string): Promise<Order> {
  const { status, json } = await call<Order & { message?: string; details?: unknown }>('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: ref,
      custom_id: ref,
      invoice_id: `${ref}-DEPOSIT`,
      description: DEPOSIT_DESCRIPTION,
      amount: { currency_code: DEPOSIT_CURRENCY, value: money2(amount) },
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: BRAND_NAME,
          locale: 'en-AU',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          return_url: `${origin}/book-now/`,
          cancel_url: `${origin}/book-now/`,
        },
      },
    },
  }, { 'PayPal-Request-Id': `${ref}-order-${Date.now().toString(36)}` })
  if (status >= 300 || !json.id) throw new Error(`PayPal create order ${status}: ${JSON.stringify(json).slice(0, 300)}`)
  return json
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const { status, json } = await call<Order>('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`)
  return status === 200 ? json : null
}

/** The completed capture on an order, if any. */
export function completedCapture(order: Order | null): Capture | null {
  for (const u of order?.purchase_units ?? []) for (const c of u.payments?.captures ?? []) if (c.status === 'COMPLETED') return c
  return null
}

/** Capture an approved order. A second call for an order already captured returns the existing capture. */
export async function captureOrder(orderId: string): Promise<{ order: Order; capture: Capture | null }> {
  const { status, json } = await call<Order & { name?: string; details?: { issue?: string }[] }>('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { 'PayPal-Request-Id': `${orderId}-capture`, Prefer: 'return=representation' })
  if (status === 201 || status === 200) return { order: json, capture: completedCapture(json) }
  if (status === 422 && json.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) {
    const order = await getOrder(orderId)
    if (order) return { order, capture: completedCapture(order) }
  }
  throw new Error(`PayPal capture ${status}: ${JSON.stringify(json).slice(0, 300)}`)
}

// ---------------------------------------------------------------- webhooks
export type WebhookEvent = { id: string; event_type: string; resource?: Record<string, any>; create_time?: string }

/** Ask PayPal whether this delivery really came from it, for the webhook in PAYPAL_WEBHOOK_ID. */
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) return false
  let event: unknown
  try { event = JSON.parse(rawBody) } catch { return false }
  const h = (k: string) => headers.get(k) || ''
  if (!h('paypal-transmission-id') || !h('paypal-transmission-sig') || !h('paypal-cert-url') || !h('paypal-auth-algo') || !h('paypal-transmission-time')) return false
  const { status, json } = await call<{ verification_status?: string }>('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: event,
  })
  return status === 200 && json.verification_status === 'SUCCESS'
}

/** The booking reference a capture belongs to: custom_id (set when the order was made), else the invoice id. */
export function refOfResource(resource: Record<string, any> | undefined): string {
  const direct = String(resource?.custom_id || '').toUpperCase()
  if (/^APE-[0-9A-F]{6}$/.test(direct)) return direct
  const inv = String(resource?.invoice_id || '').toUpperCase().replace(/-DEPOSIT$/, '')
  if (/^APE-[0-9A-F]{6}$/.test(inv)) return inv
  return ''
}

export const siteOriginFallback = () => DEFAULTS.siteUrl
