/** Checking that a webhook really came from Stripe (used by src/app/api/stripe/webhook/route.ts). */
import crypto from 'node:crypto'

const TOLERANCE_SECONDS = 300

/** Stripe's signature check: HMAC-SHA256 of "<timestamp>.<raw body>" with the endpoint's signing secret. */
export function validStripeSignature(raw: string, header: string, secret: string, now = Date.now()): boolean {
  const parts = header.split(',').map((p) => p.split('=') as [string, string])
  const t = parts.find(([k]) => k === 't')?.[1]
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!t || !sigs.length || !/^\d+$/.test(t)) return false
  if (Math.abs(now / 1000 - Number(t)) > TOLERANCE_SECONDS) return false
  const want = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest()
  return sigs.some((s) => {
    const got = Buffer.from(s, 'hex')
    return got.length === want.length && crypto.timingSafeEqual(got, want)
  })
}

