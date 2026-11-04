/**
 * The live preview inside the page editor: the page as it would go live with the
 * editor's unsaved changes, with every editable spot marked (src/dashboard/render.ts).
 * Signed in users only; nothing is saved. Section markup always comes from the
 * database; only words, links, photos, order and hidden state come from the editor.
 */
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { chromeFieldEditable, chromeFor, chromeWithEdits, pageWithEdits, renderContext } from '@/dashboard/pages'
import { EDIT_CSS, renderPageHtml } from '@/dashboard/render'
import type { PageDoc } from '@/sitekit/sync'
import { pageTokens } from '@/lib/site'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { error: 'Please sign in again.' })
  let body: { id?: number | string; sections?: unknown; shared?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }
  if (body.id === undefined || body.id === null) return json(400, { error: 'Bad request' })

  const doc = await payload.findByID({ collection: 'pages', id: body.id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!doc) return json(404, { error: 'This page no longer exists.' })
  const page = pageWithEdits(doc as unknown as PageDoc, body.sections)
  const html = renderPageHtml(page, {
    chrome: chromeWithEdits(await chromeFor(payload), body.shared),
    ...(await renderContext(payload)),
    pageTokens: pageTokens(page.path),
    editable: true,
    editableChrome: { footer: chromeFieldEditable },
    head: EDIT_CSS,
  })
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' },
  })
}
