/** Users screen (GYA only): Send login email again, a fresh link to choose a password (72 hours). */
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { sendPasswordLink } from '@/dashboard/lib/passwordLink'
import { emailConfigured } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Please sign in again.' })
  if (user.role !== 'admin') return json(403, { error: 'Only a GYA administrator can do this.' })
  if (!emailConfigured()) return json(503, { error: 'Email is not set up yet (SMTP2GO_API_KEY or RESEND_API_KEY, and BOOKING_FROM). Use Reset password to set a temporary one instead.' })
  let id: unknown
  try { id = (await req.json()).id } catch { return json(400, { error: 'Bad request' }) }
  const u = await payload.findByID({ collection: 'users', id: id as string, depth: 0, overrideAccess: true }).catch(() => null) as { email?: string } | null
  if (!u?.email) return json(404, { error: 'That account no longer exists.' })
  let r
  try {
    r = await sendPasswordLink(payload, u.email, 'invite')
  } catch (err) {
    return json(502, { error: `The email could not be sent: ${(err as Error).message}` })
  }
  if (!r) return json(404, { error: 'That account could not be found.' })
  if (!r.ok) return json(502, { error: `SMTP2GO did not accept the email: ${r.error}` })
  return json(200, { ok: true, message: `A fresh login email has been sent to ${u.email} (link valid for 72 hours).`, at: new Date().toISOString(), status: 'accepted' })
}
