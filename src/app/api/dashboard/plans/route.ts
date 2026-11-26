/**
 * v1.18.0: the Treatment plans screens of the dashboard. Signed-in users only. Plans themselves (list, open, write,
 * finalise, send, revoke) need "Can create and view treatment plans" and the feature on; every refusal is logged.
 *
 *   GET ?switches=1          the four conditions, the settings and the form summary (any signed-in user)
 *   GET                      the plans (no content)
 *   GET ?ref=APE-XXXXXX      the plans for one booking (no content)
 *   GET ?id=                 one plan version, decrypted (logged as viewed)
 *   GET ?form=1              the current form and its history (permission, practice owner or GYA)
 *   GET ?log=1               the audit log (administrators)
 *   POST {action:'create', ref} | {action:'save', id, answers} | {action:'finalise', id} | {action:'version', id}
 *        {action:'send', planNo, to} | {action:'revoke', planNo} | {action:'delete', planNo, confirm:'DELETE'}
 *        {action:'form', form} | {action:'approve', version, by} | {action:'settings', ...}
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import * as store from '@/plans/store'
import { sendPlan } from '@/plans/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function fail(err: unknown) {
  const e = err as store.PlanError
  if (e instanceof store.PlanError) return json(e.status, { ok: false, error: e.code, message: e.message !== e.code ? e.message : undefined })
  console.error('plans: error', (err as Error).message)
  return json(500, { ok: false, error: 'server_error' })
}

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  const u = await store.planUser(payload, user)
  if (!u) return json(401, { ok: false, error: 'signed_out' })
  const url = new URL(req.url)
  try {
    if (url.searchParams.get('switches') === '1') {
      const sw = await store.switches(payload)
      const form = await store.currentForm()
      return json(200, {
        ok: true, switches: sw, settings: await store.readSettings(), me: { canPlans: u.canPlans, canManage: store.canManage(u), canApprove: store.canApprove(u), admin: u.role === 'admin' },
        form: { version: form.version, placeholder: form.placeholder, approvedAt: form.approvedAt, approvedBy: form.approvedBy, createdBy: form.createdBy, createdAt: form.createdAt },
      })
    }
    if (url.searchParams.get('log') === '1') {
      if (u.role !== 'admin') return json(403, { ok: false, error: 'admin_only' })
      return json(200, { ok: true, log: await store.readLog({ planNo: Number(url.searchParams.get('plan')) || undefined }) })
    }
    if (url.searchParams.get('form') === '1') {
      if (!store.canManage(u)) return json(403, { ok: false, error: 'not_allowed' })
      return json(200, { ok: true, current: await store.currentForm(), history: await store.formHistory() })
    }
    await store.guard(payload, u, 'list or open plans')
    const id = Number(url.searchParams.get('id'))
    if (id) return json(200, { ok: true, plan: await store.openPlan(u, id), settings: await store.readSettings() })
    const ref = String(url.searchParams.get('ref') || '').trim().toUpperCase()
    return json(200, { ok: true, plans: await store.listPlans(ref ? { ref } : {}) })
  } catch (err) { return fail(err) }
}

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  const u = await store.planUser(payload, user)
  if (!u) return json(401, { ok: false, error: 'signed_out' })
  let b: Record<string, any>
  try { b = await req.json() } catch { return json(400, { ok: false, error: 'invalid' }) }
  const action = String(b.action || '')
  try {
    // the form, its approval and the settings work while the feature is still off (they are how it gets switched on)
    if (action === 'form') return json(200, { ok: true, form: await store.saveForm(u, b.form) })
    if (action === 'approve') return json(200, { ok: true, form: await store.approveForm(u, Number(b.version), String(b.by || '')) })
    if (action === 'settings') return json(200, { ok: true, settings: await store.saveSettings(u, b) })
    if (action === 'delete') {
      // administrators only, and only with the permission (they have to be able to see what they delete)
      await store.guard(payload, u, 'delete a plan', { allowOff: true })
      if (b.confirm !== 'DELETE') return json(400, { ok: false, error: 'confirm' })
      await store.deletePlan(u, Number(b.planNo))
      return json(200, { ok: true })
    }
    await store.guard(payload, u, `plan action: ${action || 'none'}`)
    switch (action) {
      case 'create': return json(200, { ok: true, id: await store.createPlan(u, String(b.ref || '')) })
      case 'save': return json(200, { ok: true, ...(await store.saveDraft(u, Number(b.id), b.answers)) })
      case 'finalise': await store.finalise(u, Number(b.id)); return json(200, { ok: true })
      case 'version': return json(200, { ok: true, id: await store.newVersion(u, Number(b.id)) })
      case 'send': {
        if (b.confirm !== true) return json(400, { ok: false, error: 'confirm' })
        const r = await sendPlan(payload, u, Number(b.planNo), String(b.to || ''))
        return json(r.ok ? 200 : 502, r)
      }
      case 'revoke': return json(200, { ok: true, revoked: await store.revokeLinks(u, Number(b.planNo)) })
      default: return json(400, { ok: false, error: 'unknown_action' })
    }
  } catch (err) { return fail(err) }
}
