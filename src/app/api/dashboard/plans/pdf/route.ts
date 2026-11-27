/**
 * v1.18.0: a treatment plan as a PDF, for the dashboard. The permission and the feature on, as for every plan route.
 *
 *   GET ?id=            a finalised version: the PDF, downloaded (logged as downloaded), as a practice copy (v1.19.0)
 *   GET ?id=&print=1    the same PDF shown in the browser to print (logged as printed)
 *   GET ?id=&preview=1  a draft, marked "draft preview, not for the patient" (logged as viewed)
 * Never cached. The patient's own copy comes through their private link (/plan/<token>/), not from here.
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import * as store from '@/plans/store'
import { renderPlanPdf } from '@/plans/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * v1.19.0: a name the practice can file in Core Practice without opening it: surname, first name, "treatment plan",
 * the plan date and the version. Nothing clinical.
 */
function fileName(id: { name: string; firstName: string }, plan: Record<string, any>, draft: boolean) {
  const first = String(id.firstName || '').trim()
  const full = String(id.name || '').trim()
  const last = first && full.toLowerCase().startsWith(first.toLowerCase()) ? full.slice(first.length).trim() : full
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(plan.finalised_at ? new Date(plan.finalised_at) : new Date())
  const clean = (x: string) => x.replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  const base = clean([last || full, first, 'treatment plan', day, `v${plan.version}`, draft ? 'DRAFT' : ''].filter(Boolean).join(' ')) || `treatment plan ${day}`
  const name = `${base}.pdf`
  return { ascii: name.normalize('NFKD').replace(/[^\x20-\x7e]/g, ''), utf8: encodeURIComponent(name) }
}

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  const u = await store.planUser(payload, user)
  if (!u) return json(401, { ok: false, error: 'signed_out' })
  const url = new URL(req.url)
  try {
    const id = Number(url.searchParams.get('id')) || 0
    await store.guard(payload, u, `plan PDF (plan record ${id})`)
    const c = await store.contentFor(id)
    const draft = c.plan.status !== 'final'
    const print = url.searchParams.get('print') === '1'
    if (draft && url.searchParams.get('preview') !== '1') return json(409, { ok: false, error: 'draft' })
    const s = await store.readSettings()
    // v1.19.0: a practice copy (download or print) says so, and when and by whom it was made
    const stamp = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date())
    const copyLine = draft ? undefined : `Practice copy, ${print ? 'printed' : 'downloaded'} ${stamp} by ${u.name || u.email}. The patient's own copy is the one at their secure link.`
    const pdf = await renderPlanPdf({ form: c.form, answers: c.answers, identity: c.identity, version: c.plan.version, finalisedAt: c.plan.finalised_at ? new Date(c.plan.finalised_at).toISOString() : null, clinician: s.clinician, practice: store.practiceLines(s.practice), mark: draft ? 'draft' : null, copyLine })
    await store.logPlan({ by: u.email, action: draft ? 'viewed' : print ? 'printed' : 'downloaded', planNo: c.plan.plan_no, version: c.plan.version, ref: c.plan.booking_ref, note: draft ? 'draft preview PDF' : print ? 'practice copy, printed' : 'practice copy, downloaded' })
    const { ascii, utf8 } = fileName(c.identity, c.plan, draft)
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow',
        'content-disposition': `${print || draft ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${utf8}`,
      },
    })
  } catch (err) {
    const e = err as store.PlanError
    if (e instanceof store.PlanError) return json(e.status, { ok: false, error: e.code })
    console.error('plans: pdf error', (err as Error).message)
    return json(500, { ok: false, error: 'server_error' })
  }
}
