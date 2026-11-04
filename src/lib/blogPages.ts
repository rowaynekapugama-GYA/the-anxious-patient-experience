/**
 * The blog, once the first post is published: /blog/ lists the posts and /blog/<slug>/ shows each one.
 * Built in the layout of the Privacy Policy page (same header, footer and type), so it needs no new design.
 * While there are no posts there is no blog at all, and no Blog link in the menus.
 */
import type { Chrome, Page, Part } from '@/lib/parts'
import type { Post } from '@/lib/blog'
import { formatDate } from '@/lib/blog'
import { pageTokens } from '@/lib/site'
import { renderPageHtml, type SeoDefaults, type SeoInfo } from '@/dashboard/render'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg>'

const part = (key: string, label: string, cls: string, inner: string): Part => ({
  key, kind: 'content', label, tag: 'section', attrs: { class: cls }, template: inner, fields: [],
})

function pageFrom(shell: Page, slug: string, path: string, name: string, sections: Part[], meta: Page['meta']): Page {
  return { ...shell, slug, path, name, meta, sections, order: sections.map((_s, i) => `section:${i}`), tail: shell.tail }
}

export function renderBlog(
  posts: Post[],
  shell: Page,
  o: { chrome: Chrome; tokens: Record<string, string>; seo: SeoDefaults; seoInfo: SeoInfo },
): [string, string][] {
  const out: [string, string][] = []
  const opts = (p: string) => ({ ...o, pageTokens: pageTokens(p) })

  const cards = posts.map((p) => `<a class="path post-card" href="/blog/${esc(p.slug)}/"><div>${p.category ? `<p class="post-meta">${esc(p.category)}</p>` : ''}<h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></div><span class="go">${ARROW}</span></a>`).join('')
  const index = pageFrom(shell, 'blog', '/blog/', 'Blog', [
    part('blog-hero', 'Blog', 'hero-simple', '<div class="wrap"><p class="eyebrow">Blog</p><h1>Articles from The Anxious Patient Experience™</h1></div>'),
    part('blog-list', 'Posts', 'section blog-list', `<div class="wrap"><div class="path-grid">${cards}</div></div>`),
  ], { title: 'Blog | The Anxious Patient Experience™', description: 'Articles about dental anxiety and a nervous-system-aware approach to dental care.' })
  out.push(['/blog/', renderPageHtml(index, opts('/blog/'))])

  for (const p of posts) {
    const date = formatDate(p.publishedAt)
    const meta = [date, p.author].filter(Boolean).map(esc).join(' | ')
    const photo = p.featuredImage
      ? `<div class="frame landscape post-photo"><img src="${esc(p.featuredImage)}" alt="${esc(p.featuredImageAlt)}" loading="eager" decoding="async"/></div>`
      : ''
    const page = pageFrom(shell, `blog-${p.slug}`, `/blog/${p.slug}/`, p.title, [
      part('post-hero', 'Post', 'hero-simple', `<div class="wrap prose"><p class="eyebrow">${esc(p.category || 'Blog')}</p><h1>${esc(p.title)}</h1>${meta ? `<p class="post-meta">${meta}</p>` : ''}</div>`),
      part('post-body', 'Article', 'section post', `<div class="wrap prose post-body">${photo}${p.body}<p class="post-back"><a class="link-arrow" href="/blog/">All articles${ARROW}</a></p></div>`),
    ], {
      title: p.meta?.title || `${p.title} | The Anxious Patient Experience™`,
      description: p.meta?.description || p.excerpt,
      ogImage: p.meta?.ogImage || p.featuredImage || undefined,
      noindex: !!p.meta?.noindex,
    })
    out.push([`/blog/${p.slug}/`, renderPageHtml(page, opts(`/blog/${p.slug}/`))])
  }
  return out
}
