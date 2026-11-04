/** Choose a new password (required at first sign in). */
import { json, routeUser } from '@/dashboard/lib/routeAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Please sign in again.' })
  let body: { current?: string; password?: string } = {}
  try { body = await req.json() } catch { /* empty */ }
  const current = String(body.current || '')
  const password = String(body.password || '')
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return json(400, { error: 'Use at least 10 characters with letters and numbers.' })
  }
  try {
    await payload.login({ collection: 'users', data: { email: String(user.email), password: current } })
  } catch {
    return json(400, { error: 'The current password is not right.' })
  }
  if (password === current) return json(400, { error: 'Choose a password that is different from the current one.' })
  await payload.update({
    collection: 'users', id: user.id, data: { password, mustChangePassword: false },
    overrideAccess: true, user,
  })
  return json(200, { ok: true })
}
