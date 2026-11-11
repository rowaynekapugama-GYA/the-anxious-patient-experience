/**
 * The Questionnaires screens of the dashboard. Signed-in users only; the answers only for people with
 * "Can view patient questionnaires" (every open is logged, and so is every refusal).
 *
 *   GET                       the list (no answers), the count to review, whether the feature is on
 *   GET ?id=                  one questionnaire, decrypted (access needed)
 *   GET ?log=1                the access log (administrators)
 *   POST {action:'reviewed', id, reviewed}       tick or untick Reviewed (access needed)
 *   POST {action:'printed', id}                  note a print (access needed)
 *   POST {action:'delete', id}                   delete permanently (administrators; the screen asks first)
 *   POST {action:'welcome', ref}                 send or resend the welcome email for a booking
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import * as q from '@/lib/questionnaire'
import { db } from '@/booking/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const asUser = (u: Record<string, any>): q.DashUser => ({ id: u.id, email: String(u.email), role: String(u.role), canViewQuestionnaires: !!u.canViewQuestionnaires })

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  const u = asUser(user)
  const url = new URL(req.url)
  try {
    if (url.searchParams.get('log') === '1') {
      if (u.role !== 'admin') return json(403, { ok: false, error: 'admin_only' })
      const r = await payload.find({ collection: 'questionnaire-log', limit: 500, sort: '-at', overrideAccess: true, depth: 0 })
      return json(200, { ok: true, log: r.docs })
    }
    const id = url.searchParams.get('id')
    if (id) {
      if (!q.canView(u)) {
        await q.log(payload, { userEmail: u.email, userId: u.id, action: 'denied', questionnaire: id })
        return json(403, { ok: false, error: 'no_access' })
      }
      const r = await q.openQuestionnaire(payload, id, u)
      if (!r) return json(404, { ok: false, error: 'not_found' })
      return json(200, { ok: true, ...r })
    }
    const rows = q.canView(u) ? await q.listQuestionnaires(payload) : []
    return json(200, {
      ok: true, access: q.canView(u), enabled: q.questionnaireEnabled(), ready: q.questionnaireReady(), problems: q.questionnaireProblems(),
      toReview: await q.countUnreviewed(payload), rows,
    })
  } catch (err) {
    if ((err as { status?: number }).status === 403) return json(403, { ok: false, error: 'no_access' })
    console.error('questionnaires: error', (err as Error).message)
    return json(500, { ok: false, error: 'server_error' })
  }
}

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  const u = asUser(user)
  let body: Record<string, any>
  try { body = await req.json() } catch { return json(400, { ok: false, error: 'invalid' }) }
  const action = String(body.action || '')
  const id = String(body.id || '')
  try {
    if (action === 'welcome') {
      const d = db()
      if (!d) return json(503, { ok: false, error: 'no_database' })
      const ref = String(body.ref || '').toUpperCase()
      const rows = await d.query(`SELECT ref, name, email, slot_start, status FROM ape_bookings WHERE ref = $1`, [ref])
      if (!rows[0]) return json(404, { ok: false, error: 'not_found' })
      if (rows[0].status === 'cancelled') return json(400, { ok: false, error: 'cancelled' })
      const r = await q.sendWelcome(payload, rows[0] as q.BookingRow, { resend: true, by: u.email })
      return json(r.sent ? 200 : 400, { ok: r.sent, error: r.sent ? undefined : 'not_sent', reason: r.reason })
    }
    if (!id) return json(400, { ok: false, error: 'invalid' })
    if (action === 'delete') {
      if (u.role !== 'admin') return json(403, { ok: false, error: 'admin_only' })
      if (body.confirm !== 'DELETE') return json(400, { ok: false, error: 'confirm' })
      await q.deleteQuestionnaire(payload, id, u)
      return json(200, { ok: true })
    }
    if (!q.canView(u)) {
      await q.log(payload, { userEmail: u.email, userId: u.id, action: 'denied', questionnaire: id, note: action })
      return json(403, { ok: false, error: 'no_access' })
    }
    if (action === 'reviewed') { await q.setReviewed(payload, id, u, !!body.reviewed); return json(200, { ok: true }) }
    if (action === 'printed') { await q.log(payload, { userEmail: u.email, userId: u.id, action: 'printed', questionnaire: id }); return json(200, { ok: true }) }
    return json(400, { ok: false, error: 'unknown_action' })
  } catch (err) {
    console.error('questionnaires: error', action, (err as Error).message)
    return json(500, { ok: false, error: 'server_error' })
  }
}
