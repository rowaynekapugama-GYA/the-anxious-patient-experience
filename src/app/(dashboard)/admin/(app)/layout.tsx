import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { Shell } from '@/dashboard/ui/Shell'
import { db } from '@/booking/core'
import { countUnreviewed } from '@/lib/questionnaire'

/** Booking requests still to confirm, for the count beside Bookings. */
async function toConfirm(): Promise<number> {
  const d = db()
  if (!d) return 0
  try {
    const r = await d.query(`SELECT count(*)::int AS n FROM ape_bookings WHERE status = 'requested' AND slot_start >= now()`)
    return Number(r[0]?.n) || 0
  } catch {
    return 0
  }
}

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  const payload = await payloadClient()
  // the review page (/review/) is edited like any page; its link lives in Site Settings
  const review = await payload.find({ collection: 'pages', where: { pageSlug: { equals: 'review' } }, limit: 1, depth: 0, overrideAccess: true, select: { pageSlug: true } })
  const reviewHref = review.docs[0] ? `/admin/pages/${review.docs[0].id}` : '/admin/pages'
  const canView = !!(u as { canViewQuestionnaires?: boolean }).canViewQuestionnaires
  const toReview = canView ? await countUnreviewed(payload) : 0
  return <Shell user={{ name: u.name, email: u.email, role: u.role }} toConfirm={await toConfirm()} toReview={toReview} reviewHref={reviewHref}>{children}</Shell>
}
