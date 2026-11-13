/**
 * The Team screen (v1.8.2): read the homepage's team cards, and save the list back into the team section.
 * Only the team section changes; the markup of each existing card is kept as it is.
 */
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { rowsWithTeam, teamFromDoc, TeamError, type TeamSave } from '@/dashboard/team'
import type { PageDoc } from '@/sitekit/sync'

export const dynamic = 'force-dynamic'

async function homeDoc(payload: Awaited<ReturnType<typeof routeUser>>['payload'], depth: number) {
  const r = await payload.find({ collection: 'pages', where: { pageSlug: { equals: 'home' } }, limit: 1, depth, overrideAccess: true })
  return (r.docs[0] ?? null) as unknown as (PageDoc & { id: number | string; updatedAt?: string }) | null
}

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Your session has ended. Please sign in again.' })
  const doc = await homeDoc(payload, 1)
  if (!doc) return json(404, { error: 'The homepage could not be found.' })
  return json(200, teamFromDoc(doc))
}

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Your session has ended. Please sign in again.' })
  let body: TeamSave
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }
  const doc = await homeDoc(payload, 0)
  if (!doc) return json(404, { error: 'The homepage could not be found.' })
  try {
    const sections = await rowsWithTeam(payload, doc, body)
    await payload.update({ collection: 'pages', id: doc.id, depth: 0, data: { sections } as never, user, overrideAccess: false })
  } catch (e) {
    if (e instanceof TeamError) return json(e.status, { error: e.message })
    return json(400, { error: (e as Error).message || 'The team could not be saved.' })
  }
  const fresh = await homeDoc(payload, 1)
  return json(200, fresh ? teamFromDoc(fresh) : { ok: true })
}
