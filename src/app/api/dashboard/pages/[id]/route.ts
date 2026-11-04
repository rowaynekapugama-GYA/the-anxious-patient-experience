/**
 * Save changes from the page editor. Only words, links, photo choices, the
 * section order, hidden flags and the SEO settings are taken from the request;
 * the section markup is whatever the database already holds.
 */
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { rowsWithEdits, saveChromeEdits } from '@/dashboard/pages'
import type { SectionDoc } from '@/sitekit/sync'

export const dynamic = 'force-dynamic'

type Seo = { title?: string; description?: string; ogImageMedia?: number | string | null; noindex?: boolean; canonical?: string }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Your session has ended. Please sign in again.' })
  const { id } = await params
  let body: { sections?: unknown; seo?: Seo; shared?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }

  const doc = await payload.findByID({ collection: 'pages', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!doc) return json(404, { error: 'This page no longer exists.' })
  const meta = { ...((doc as { meta?: Record<string, unknown> }).meta ?? {}) }
  if (body.seo) {
    meta.title = String(body.seo.title ?? '')
    meta.description = String(body.seo.description ?? '')
    meta.ogImage = body.seo.ogImageMedia ?? null
    meta.noindex = !!body.seo.noindex
    if (user.role === 'admin' && typeof body.seo.canonical === 'string') meta.canonical = body.seo.canonical.trim()
  } else if (meta.ogImage && typeof meta.ogImage === 'object') {
    meta.ogImage = (meta.ogImage as { id: number }).id
  }
  const sections = body.sections === undefined
    ? undefined
    : rowsWithEdits(doc as unknown as { sections: (SectionDoc & { id?: string })[] }, body.sections)
  try {
    await payload.update({
      collection: 'pages',
      id,
      depth: 0,
      data: { ...(sections ? { sections } : {}), meta } as never,
      user,
      overrideAccess: false,
    })
    if (body.shared !== undefined) await saveChromeEdits(payload, user, body.shared)
  } catch (e) {
    return json(400, { error: (e as Error).message || 'The page could not be saved.' })
  }
  return json(200, { ok: true })
}
