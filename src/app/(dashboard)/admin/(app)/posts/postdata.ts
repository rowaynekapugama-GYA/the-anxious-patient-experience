import type { Payload } from 'payload'

export async function postOptions(payload: Payload) {
  const cats = await payload.find({ collection: 'categories', limit: 500, depth: 0, overrideAccess: true, sort: 'title', pagination: false })
  return { categories: cats.docs.map((c) => ({ id: c.id, title: String(c.title) })) }
}

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null) ?? null)
const url = (v: unknown) => {
  const u = v && typeof v === 'object' ? (v as { url?: string }).url : null
  if (!u) return ''
  try { return new URL(u, 'http://x').pathname } catch { return u }
}

/** A post document (read at depth 1) as the post editor takes it. */
export function postFromDoc(d: Record<string, unknown>) {
  const meta = (d.meta ?? {}) as Record<string, unknown>
  return {
    id: d.id as number,
    slug: String(d.slug ?? ''),
    title: String(d.title ?? ''),
    status: d._status === 'published' ? 'published' as const : 'draft' as const,
    publishedAt: String(d.publishedAt ?? ''),
    author: String(d.author ?? ''),
    category: rel(d.category),
    excerpt: String(d.excerpt ?? ''),
    image: url(d.featuredImage),
    imageMedia: rel(d.featuredImage),
    body: String(d.body ?? ''),
    seo: {
      title: String(meta.title ?? ''), description: String(meta.description ?? ''), ogImage: url(meta.ogImage),
      ogImageMedia: rel(meta.ogImage), canonical: '', noindex: !!meta.noindex,
    },
  }
}
