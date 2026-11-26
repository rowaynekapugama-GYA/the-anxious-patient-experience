/**
 * v1.18.0: a treatment plan as a PDF, for the dashboard. The permission and the feature on, as for every plan route.
 *
 *   GET ?id=            a finalised version: the PDF, downloaded (logged as downloaded)
 *   GET ?id=&print=1    the same PDF shown in the browser to print (logged as printed)
 *   GET ?id=&preview=1  a draft, marked "draft preview, not for the patient" (logged as viewed)
 * Never cached. The patient's own copy comes through their private link (/plan/<token>/), not from here.
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import * as store from '@/plans/store'
import { renderPlanPdf } from '@/plans/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  const u = await store.planUser(payload, user)
  if (!u) return json(401, { ok: false, error: 'signed_out' })
  const url = new URL(req.url)
  try {
    await store.guard(payload, u, 'plan PDF')
    const id = Number(url.searchParams.get('id'))
    const c = await store.contentFor(id)
    const draft = c.plan.status !== 'final'
    const print = url.searchParams.get('print') === '1'
    if (draft && url.searchParams.get('preview') !== '1') return json(409, { ok: false, error: 'draft' })
    const s = await store.readSettings()
    const pdf = await renderPlanPdf({ form: c.form, answers: c.answers, identity: c.identity, version: c.plan.version, finalisedAt: c.plan.finalised_at ? new Date(c.plan.finalised_at).toISOString() : null, clinician: s.clinician, mark: draft ? 'draft' : null })
    await store.logPlan({ by: u.email, action: draft ? 'viewed' : print ? 'printed' : 'downloaded', planNo: c.plan.plan_no, version: c.plan.version, ref: c.plan.booking_ref, note: draft ? 'draft preview PDF' : '' })
    const name = `APE-treatment-plan-${c.plan.booking_ref}-v${c.plan.version}${draft ? '-draft' : ''}.pdf`
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow',
        'content-disposition': `${print || draft ? 'inline' : 'attachment'}; filename="${name}"`,
      },
    })
  } catch (err) {
    const e = err as store.PlanError
    if (e instanceof store.PlanError) return json(e.status, { ok: false, error: e.code })
    console.error('plans: pdf error', (err as Error).message)
    return json(500, { ok: false, error: 'server_error' })
  }
}
