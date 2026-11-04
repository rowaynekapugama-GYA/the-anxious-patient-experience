/**
 * GET /api/availability/  ->  the times patients can book now, each with its price, plus the opening special status.
 * Used by the Book Now page (times and prices) and the homepage (opening special ribbon and pop-up).
 * Blocked days and times (set in the dashboard) and times already requested are left out.
 */
import * as core from '@/booking/core'

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
  return core.send(200, { ok: true, bookable: r.state.db, ...(summary ? { special: out.special } : out) })
}
