/**
 * A page as it is saved in the dashboard, before it is published.
 * Signed in users only; never indexed.
 */
import { routeUser } from '@/dashboard/lib/routeAuth'
import { chromeFor, pageWithEdits, renderContext } from '@/dashboard/pages'
import { renderPageHtml } from '@/dashboard/render'
import type { PageDoc } from '@/sitekit/sync'
import { pageTokens } from '@/lib/site'

export const dynamic = 'force-dynamic'

const BAR = '<div style="position:fixed;z-index:99999;left:50%;bottom:16px;transform:translateX(-50%);background:#0B1112;color:#fff;font:600 14px/1.3 system-ui,sans-serif;padding:10px 16px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.3)">Preview: this is what will go live when you press Publish website</div>'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await routeUser(req)
  if (!user) return new Response('Not found', { status: 404 })
  const { id } = await params
  const doc = await payload.findByID({ collection: 'pages', id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!doc) return new Response('Not found', { status: 404 })
  const page = pageWithEdits(doc as unknown as PageDoc)
  const html = renderPageHtml(page, {
    chrome: await chromeFor(payload),
    ...(await renderContext(payload)),
    pageTokens: pageTokens(page.path),
    head: '<base target="_blank">',
  }).replace('</body>', `${BAR}</body>`)
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' },
  })
}
