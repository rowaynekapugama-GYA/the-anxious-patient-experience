/**
 * GET /.well-known/apple-developer-merchantid-domain-association (v1.10.0; src/proxy.ts sends that address here)
 *
 * Apple Pay checks this file to confirm theanxiouspatientexperience.com.au may take Apple Pay through PayPal. PayPal
 * gives the file when the domain is registered (docs/PAYPAL-ADVANCED-SETUP.md). Until GYA adds it, this is a 404.
 * The file goes in the repo at config/apple-pay/apple-developer-merchantid-domain-association, or its contents in the
 * APPLE_PAY_DOMAIN_ASSOCIATION environment variable. It is public by design (it is not a secret).
 */
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FILE = path.join(process.cwd(), 'config', 'apple-pay', 'apple-developer-merchantid-domain-association')

export function GET() {
  let body = String(process.env.APPLE_PAY_DOMAIN_ASSOCIATION || '').trim()
  if (!body) {
    try { body = fs.readFileSync(FILE, 'utf8').trim() } catch { body = '' }
  }
  if (!body) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
