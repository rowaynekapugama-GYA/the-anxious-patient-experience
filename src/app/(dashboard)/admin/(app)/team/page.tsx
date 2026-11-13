import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { TeamEditor } from '@/dashboard/editors/TeamEditor'
import { teamFromDoc } from '@/dashboard/team'
import type { PageDoc } from '@/sitekit/sync'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Team' }

export default async function Team() {
  await requireUser()
  const payload = await payloadClient()
  const r = await payload.find({ collection: 'pages', where: { pageSlug: { equals: 'home' } }, limit: 1, depth: 1, overrideAccess: true })
  const doc = (r.docs[0] ?? null) as unknown as (PageDoc & { id: number | string; updatedAt?: string }) | null
  return <TeamEditor initial={doc ? teamFromDoc(doc) : null} />
}
