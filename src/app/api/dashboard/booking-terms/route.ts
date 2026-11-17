/**
 * Site Settings > Booking terms (v1.10.0). Any signed-in user.
 *
 *   GET   the terms in use (saved, or the drafted default), the two tick box labels, the version and approval
 *   POST  { text?, consentLabel?, readLabel?, approved? }  Saving changed wording gives the next version number and
 *         clears the approval. "approved" records who confirmed Lorna approved this version, and when.
 * Applies to the next booking straight away; no Publish needed.
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import * as terms from '@/booking/terms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const s = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').slice(0, max).trim()

async function state(payload: Awaited<ReturnType<typeof routeUser>>['payload']) {
  const t = await terms.loadTerms(payload)
  return { ok: true, terms: t, defaults: { text: terms.DEFAULT_TERMS, consentLabel: terms.DEFAULT_CONSENT, readLabel: terms.DEFAULT_READ } }
}

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  return json(200, await state(payload))
}

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json(400, { ok: false, error: 'invalid' }) }
  const g = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as Record<string, any>
  const cur = { ...(g?.bookingTerms || {}) } as Record<string, any>
  const before = terms.fromSettings(cur)
  const next: Record<string, any> = { ...cur }
  if (b.text !== undefined) {
    const text = s(b.text, 12000)
    if (text && !/48/.test(text)) return json(400, { ok: false, error: 'needs_48', message: 'The terms must still say 48 hours (the cancellation notice period).' })
    // the drafted default typed back in counts as no change
    next.text = text === terms.DEFAULT_TERMS ? '' : text
  }
  if (b.consentLabel !== undefined) next.consentLabel = s(b.consentLabel, 300)
  if (b.readLabel !== undefined) next.readLabel = s(b.readLabel, 300)
  const after = terms.fromSettings({ ...next, version: before.version })
  const changed = after.text !== before.text || after.consentLabel !== before.consentLabel || after.readLabel !== before.readLabel
  if (changed) {
    next.version = before.version + 1
    next.changedAt = new Date().toISOString()
    next.changedBy = String(user.email)
    next.approvedBy = ''
    next.approvedAt = null
    // a saved version needs its own text, even when it is the drafted default with only a label changed
    if (!next.text) next.text = before.text
  }
  if (b.approved !== undefined && !changed) {
    next.approvedBy = b.approved ? String(user.email) : ''
    next.approvedAt = b.approved ? new Date().toISOString() : null
    if (b.approved && !next.text) { next.text = before.text; next.version = before.version; next.changedAt = `${before.date}T00:00:00.000Z` }
  }
  await payload.updateGlobal({ slug: 'site-settings', data: { bookingTerms: next }, overrideAccess: true, context: { noPublishNeeded: true } })
  return json(200, await state(payload))
}
