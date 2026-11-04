import Link from 'next/link'
import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { PostsList } from '@/dashboard/editors/Lists'
import { Icon } from '@/dashboard/ui/icons'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Blog Posts' }

export default async function Posts() {
  await requireUser()
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'posts', limit: 2000, depth: 1, overrideAccess: true, sort: '-publishedAt', pagination: false, draft: true,
    select: { title: true, slug: true, _status: true, publishedAt: true, category: true, updatedAt: true },
  })
  const rows = res.docs.map((d) => ({
    id: d.id, title: String(d.title), slug: String(d.slug), status: String(d._status || 'draft'), published: String(d.publishedAt || ''),
    category: d.category && typeof d.category === 'object' ? String((d.category as { title?: string }).title ?? '') : '', updatedAt: String(d.updatedAt),
  }))
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Blog Posts</h1><p className="pd-sub">News and articles from the practice. Published posts appear on the Blog page, in the sitemap and in Google&apos;s article listings.</p></div>
        <Link className="btn primary" href="/admin/posts/new">{Icon.plus()} Write a new post</Link>
      </div>
      <PostsList rows={rows} />
    </>
  )
}
