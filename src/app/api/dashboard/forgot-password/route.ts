/**
 * "Forgotten your password?" on the sign-in page. Always answers the same way, so it never shows whether an
 * email address has an account. At most 5 requests per address an hour (v1.8.3: counted in the database, so it
 * holds across Vercel's instances). The link works once and lasts 1 hour.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { json } from '@/dashboard/lib/routeAuth'
import { sendPasswordLink } from '@/dashboard/lib/passwordLink'
import { emailConfigured } from '@/lib/email'
import { allow } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

const SAME = { ok: true, message: 'If that email address has a login, a link to choose a new password is on its way. It can take a few minutes, so please check junk mail too.' }

export async function POST(req: Request) {
  let email = ''
  try { email = String((await req.json()).email || '').trim().toLowerCase().slice(0, 200) } catch { return json(400, { error: 'Bad request' }) }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Please enter your email address.' })
  if (!emailConfigured()) return json(503, { error: 'Password emails are not set up yet. Please ask GYA to reset your password (1300 889 840).' })
  if (!(await allow(`reset:${email}`, 5, 60))) return json(200, SAME)
  try {
    const payload = await getPayload({ config })
    const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
    if (found.docs[0]) await sendPasswordLink(payload, email, 'reset')
  } catch (err) {
    console.error('forgot-password: could not send', (err as Error).message)
  }
  return json(200, SAME)
}
