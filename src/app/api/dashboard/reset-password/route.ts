/**
 * The page an emailed link opens (/admin/reset-password) saves the new password here (v1.8.3), so the
 * "Your password was changed" notice always goes out. The link works once: Payload clears it on use.
 * Signs the person in, like Payload's own reset did.
 */
import { getPayload, generatePayloadCookie } from 'payload'
import config from '@payload-config'
import { json } from '@/dashboard/lib/routeAuth'
import { sendPasswordChanged } from '@/dashboard/lib/passwordLink'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let token = ''
  let password = ''
  try { const b = await req.json(); token = String(b.token || '').slice(0, 200); password = String(b.password || '') } catch { return json(400, { error: 'Bad request' }) }
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return json(400, { error: 'Use at least 10 characters with letters and numbers.' })
  if (!token) return json(400, { error: 'expired' })
  const payload = await getPayload({ config })
  let result: { token?: string; user?: { email?: string } }
  try {
    result = await payload.resetPassword({ collection: 'users', data: { token, password }, overrideAccess: true }) as typeof result
  } catch {
    return json(400, { error: 'expired' })
  }
  const email = String(result.user?.email || '')
  if (email) await sendPasswordChanged(email).catch(() => null)
  const res = json(200, { ok: true })
  if (result.token) {
    const users = payload.collections.users.config
    res.headers.append('Set-Cookie', generatePayloadCookie({ collectionAuthConfig: users.auth, cookiePrefix: payload.config.cookiePrefix, token: result.token }))
  }
  return res
}
