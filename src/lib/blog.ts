import fs from 'node:fs'
import path from 'node:path'

export type Post = {
  slug: string
  title: string
  excerpt: string
  author: string
  publishedAt: string
  category: string | null
  categorySlug: string | null
  featuredImage: string | null
  featuredImageAlt: string
  /** clean article HTML, written by the dashboard's article editor */
  body: string
  meta: { title?: string; description?: string; ogImage?: string | null; noindex?: boolean }
}

let cache: Post[] | null = null

/** Published posts, newest first. An empty list means the blog stays hidden. */
export function getPosts(): Post[] {
  if (cache) return cache
  const file = path.join(process.cwd(), 'content', 'posts.json')
  if (!fs.existsSync(file)) {
    cache = []
    return cache
  }
  try {
    cache = JSON.parse(fs.readFileSync(file, 'utf8')) as Post[]
  } catch {
    cache = []
  }
  return cache
}

export function getPost(slug: string): Post | null {
  return getPosts().find((p) => p.slug === slug) ?? null
}

export function hasBlog(): boolean {
  return getPosts().length > 0
}

export function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}
