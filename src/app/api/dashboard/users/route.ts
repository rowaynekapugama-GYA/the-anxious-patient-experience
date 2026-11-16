/**
 * Users screen (GYA only), v1.8.4: Add a user creates the login AND emails the invite (a link to choose a password,
 * 72 hours), through the same logged sender as every other email. Before v1.8.4 the screen created the login
 * straight through Payload with a temporary password and sent nothing.
 *
 * An address that already has a login is never duplicated: the answer says so, with its id, so the screen can offer
 * Send login email again.
 */
import crypto from 'node:crypto'
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { sendPasswordLink } from '@/dashboard/lib/passwordLink'
import { emailConfigured } from '@/lib/email'

export const dynamic = 'force-dynamic'
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Please sign in again.' })
  if (user.role !== 'admin') return json(403, { error: 'Only a GYA administrator can add users.' })
  let body: { name?: string; email?: string; role?: string }
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }
  const email = String(body.email || '').trim().toLowerCase()
  const name = String(body.name || '').trim().slice(0, 120)
  const role = body.role === 'admin' ? 'admin' : 'editor'
  if (!EMAIL.test(email)) return json(400, { error: 'Please enter one email address.' })

  const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
  if (found.docs[0]) return json(409, { error: 'This person already has a login.', exists: true, id: found.docs[0].id })

  const doc = await payload.create({
    collection: 'users', overrideAccess: true, depth: 0,
    // nobody knows this password: the person chooses their own from the emailed link
    data: { email, name, role, mustChangePassword: false, password: crypto.randomBytes(24).toString('base64url') + 'a1' } as never,
  }) as unknown as { id: number | string; email: string; name?: string; role: string }

  if (!emailConfigured()) {
    return json(200, { doc, invite: { ok: false, error: 'Email is not set up (SMTP2GO_API_KEY and BOOKING_FROM), so no invite was sent.' } })
  }
  const r = await sendPasswordLink(payload, email, 'invite').catch((e) => ({ ok: false, id: '', error: (e as Error).message }))
  return json(200, { doc, invite: r ? { ok: r.ok, id: r.id, error: r.error, at: new Date().toISOString() } : { ok: false, error: 'not sent' } })
}
