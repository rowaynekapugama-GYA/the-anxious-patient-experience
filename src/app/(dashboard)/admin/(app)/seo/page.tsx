import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { SeoOverview } from '@/dashboard/editors/SeoOverview'
import { mediaUrl } from '@/sitekit/sync'
import { BRAND } from '@/dashboard/brand'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'SEO' }

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null) ?? null)

export default async function Seo() {
  await requireUser()
  const payload = await payloadClient()
  const g = await payload.findGlobal({ slug: 'seo', depth: 1, overrideAccess: true }) as unknown as Record<string, unknown>
  const defOg = mediaUrl(g?.defaultOgImage as never) || BRAND.defaultOg
  const pages = await payload.find({ collection: 'pages', where: { isChrome: { not_equals: true } }, limit: 1000, depth: 1, overrideAccess: true, sort: 'title', pagination: false,
    select: { title: true, path: true, pageSlug: true, meta: true } })
  const posts = await payload.find({ collection: 'posts', limit: 2000, depth: 1, overrideAccess: true, sort: 'title', pagination: false, draft: true,
    select: { title: true, slug: true, _status: true, featuredImage: true, meta: true } })
  const seoOf = (m: Record<string, unknown> | undefined) => ({
    title: String(m?.title || ''), description: String(m?.description || ''), ogImage: mediaUrl(m?.ogImage as never) ?? '',
    ogImageMedia: rel(m?.ogImage), canonical: String(m?.canonical || ''), noindex: !!m?.noindex,
  })
  const rows = [
    ...pages.docs.filter((d) => d.pageSlug !== 'not-found').map((d) => {
      const m = d.meta as Record<string, unknown> | undefined
      return { kind: 'page' as const, id: d.id, label: String(d.title), url: String(d.path), live: true, defaultOg: String(m?.ogImagePath || defOg), seo: seoOf(m) }
    }),
    ...posts.docs.map((d) => ({
      kind: 'post' as const, id: d.id, label: String(d.title), url: `/blog/${d.slug}`, live: d._status === 'published',
      defaultOg: mediaUrl(d.featuredImage as never) || defOg, seo: seoOf(d.meta as Record<string, unknown> | undefined),
    })),
  ]
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>SEO</h1><p className="pd-sub">How each page and post appears in Google. Titles work best between 30 and 60 characters, descriptions between 70 and 155.</p></div></div>
      <SeoOverview initial={rows} />
    </>
  )
}
