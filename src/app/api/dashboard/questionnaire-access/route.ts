/**
 * Questionnaire access (v1.10.0), for the Users screen.
 *
 *   GET   the logins with their access, and the access log (practice owner and GYA only)
 *   POST  { id, canViewQuestionnaires }  tick or untick for one login (practice owner or GYA)
 *         { id, practiceOwner }          make a login the practice owner (GYA only)
 *         { id, canTreatmentPlans }      v1.18.0: tick or untick treatment plans (practice owner or GYA)
 * Every change is logged; the person given access is emailed. See src/lib/access.ts.
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import * as access from '@/lib/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const view = (u: Record<string, any>) => ({ id: u.id, name: String(u.name || ''), email: String(u.email), role: u.role === 'admin' ? 'admin' : 'editor', canViewQuestionnaires: !!u.canViewQuestionnaires, canTreatmentPlans: !!u.canTreatmentPlans, practiceOwner: !!u.practiceOwner })

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  if (!access.canManageAccess(user as access.Who)) return json(403, { ok: false, error: 'not_allowed' })
  const r = await payload.find({ collection: 'users', limit: 500, sort: 'email', depth: 0, overrideAccess: true })
  return json(200, { ok: true, users: r.docs.map((d) => view(d as Record<string, any>)), log: await access.accessLog() })
}

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json(400, { ok: false, error: 'invalid' }) }
  const id = b.id as string | number
  if (id === undefined || id === null || id === '') return json(400, { ok: false, error: 'invalid' })
  const actor = user as access.Who
  if (typeof b.practiceOwner === 'boolean') {
    const r = await access.setOwner(payload, actor, id, b.practiceOwner)
    if (!r.ok) return json(r.status, { ok: false, error: r.error })
    return json(200, { ok: true, user: view(r.user) })
  }
  // v1.18.0: treatment plans
  if (typeof b.canTreatmentPlans === 'boolean') {
    const r = await access.setPlanAccess(payload, actor, id, b.canTreatmentPlans)
    if (!r.ok) return json(r.status, { ok: false, error: r.error })
    return json(200, { ok: true, user: view(r.user) })
  }
  if (typeof b.canViewQuestionnaires === 'boolean') {
    const r = await access.setAccess(payload, actor, id, b.canViewQuestionnaires)
    if (!r.ok) return json(r.status, { ok: false, error: r.error })
    return json(200, { ok: true, user: view(r.user), emailed: r.emailed })
  }
  return json(400, { ok: false, error: 'invalid' })
}
