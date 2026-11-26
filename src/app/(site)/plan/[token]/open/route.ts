/**
 * v1.18.0: the patient opens their treatment plan (a POST from /plan/<token>/, with their date of birth when it is
 * asked for). The PDF comes back to show in the browser. Rate limited per address and per link; five wrong dates of
 * birth revoke the link. A link that does not work sends the patient back to the same calm page as any other.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { allow } from '@/lib/mailer'
import * as store from '@/plans/store'
import { renderPlanPdf } from '@/plans/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const back = (req: Request, token: string, e?: string) => new Response(null, { status: 303, headers: { location: `/plan/${encodeURIComponent(token)}/${e ? `?e=${e}` : ''}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim()
  if (!(await allow(`plan-open:${ip}`, 20, 10))) return back(req, token, 'busy')
  const payload = await getPayload({ config })
  const found = await store.lookupLink(payload, token).catch(() => ({ state: 'gone' as const }))
  if (found.state !== 'ok') return back(req, token)
  if (!(await allow(`plan-open-link:${found.linkId}`, 10, 10))) return back(req, token, 'busy')
  if (found.askDob) {
    const f = await req.formData().catch(() => null)
    const d = Number(f?.get('d')), m = Number(f?.get('m')), y = Number(f?.get('y'))
    const typed = Number.isInteger(d) && Number.isInteger(m) && Number.isInteger(y) ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : ''
    if (typed !== found.dob) {
      const revoked = await store.dobFailed(found)
      return back(req, token, revoked ? undefined : 'dob')
    }
  }
  const c = await store.contentFor(found.planId)
  const s = await store.readSettings()
  const pdf = await renderPlanPdf({ form: c.form, answers: c.answers, identity: c.identity, version: found.version, finalisedAt: c.plan.finalised_at ? new Date(c.plan.finalised_at).toISOString() : null, clinician: s.clinician })
  await store.linkOpened(found)
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf', 'content-disposition': `inline; filename="APE-treatment-plan-v${found.version}.pdf"`,
      'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer',
    },
  })
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  return back(req, token)
}
