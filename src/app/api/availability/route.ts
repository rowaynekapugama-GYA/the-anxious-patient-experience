/**
 * GET /api/availability/  ->  the times patients can book now, each with its price, plus the opening special status.
 * Used by the Book Now page (times and prices) and the homepage (opening special ribbon and pop-up).
 * Blocked days and times (set in the dashboard) and times already requested are left out.
 */
import * as core from '@/booking/core'
import * as terms from '@/booking/terms'

/** The deposit policy for the Book Now pop-up (v1.10.0 as booking terms; v1.11.0 Lorna's wording), filled in, with its version and tick label. */
async function currentTerms(cfg: core.Cfg) {
  try {
    const { getPayload } = await import('payload')
    const { default: config } = await import('@payload-config')
    const payload = await getPayload({ config })
    const t = await terms.loadTerms(payload)
    const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
    const phone = String(s?.phone || '').trim() || cfg.contact.phone
    return { text: terms.fill(t.text, { phone, deposit: core.money(cfg.pricing.deposit) }), version: t.label, consentLabel: t.consentLabel, readLabel: t.readLabel }
  } catch (err) {
    console.error('availability: could not read the booking terms, using the draft', (err as Error).message)
    const t = terms.fromSettings(null)
    return { text: terms.fill(t.text, { phone: cfg.contact.phone, deposit: core.money(cfg.pricing.deposit) }), version: t.label, consentLabel: t.consentLabel, readLabel: t.readLabel }
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  let r
  try {
    r = await core.readState()
  } catch (err) {
    console.error('availability: database error', (err as Error).message)
    return core.send(503, { ok: false, error: 'unavailable' })
  }
  const out = core.availability(r.cfg, r.state, Date.now())
  const summary = new URL(req.url).searchParams.get('summary') === '1'
  return core.send(200, { ok: true, bookable: r.state.db, ...(summary ? { special: out.special } : { ...out, terms: await currentTerms(r.cfg) }) })
}
