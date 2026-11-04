'use client'
/** Write, edit, publish, unpublish and delete a blog post. */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { plain } from '../util'
import { AutoTextarea, Notice, TextInput, useUnsavedWarning } from '../ui/fields'
import { ImageSlot } from '../ui/MediaPicker'
import { SeoPanel, type SeoState } from '../ui/SeoPanel'
import { PublishButton } from '../ui/PublishButton'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { BodyEditor } from './BodyEditor'
import { BRAND } from '../brand'

export type PostDoc = {
  id?: number | string
  slug: string
  title: string
  status: 'published' | 'draft'
  publishedAt: string
  author: string
  category: number | string | null
  excerpt: string
  image: string
  imageMedia: number | string | null
  body: string
  seo: SeoState
}

type Cat = { id: number | string; title: string }

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export function AhpraReminder() {
  return (
    <div className="panel ahpra">
      <h3 style={{ marginBottom: 6 }}>Before you publish: advertising rules for dental practices (AHPRA)</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>No testimonials or patient reviews about clinical care.</li>
        <li>No claims such as &ldquo;pain-free&rdquo;, &ldquo;guaranteed&rdquo;, &ldquo;best&rdquo; or &ldquo;expert&rdquo;, and no wording that pressures people to act quickly.</li>
        <li>Any offer must state the exact price, what is included and the dates it runs.</li>
        <li>Posts about surgical or invasive treatment need a line on the risks, for example: &ldquo;Any surgical or invasive procedure carries risks. Before proceeding, you should seek a second opinion from an appropriately qualified health practitioner.&rdquo;</li>
      </ul>
    </div>
  )
}

export function PostEditor({ initial, categories: initialCats, isNew }: { initial: PostDoc; categories: Cat[]; isNew: boolean }) {
  const toast = useToast()
  const [p, setP] = useState<PostDoc>(initial)
  const [cats, setCats] = useState<Cat[]>(initialCats)
  const [dirty, setDirty] = useState(isNew)
  const [busy, setBusy] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  useUnsavedWarning(dirty)
  const set = (patch: Partial<PostDoc>) => { setP((x) => ({ ...x, ...patch })); setDirty(true) }

  const live = p.status === 'published'
  const url = `/blog/${p.slug}`

  async function addCategory() {
    const title = newCat.trim()
    if (!title) return
    try {
      const r = await api<{ doc: Cat }>('/api/categories?depth=0', { method: 'POST', body: { title, slug: slugify(title) } })
      setCats((c) => [...c, r.doc])
      set({ category: r.doc.id })
      setNewCat('')
    } catch (e) { toast((e as Error).message, 'bad') }
  }

  async function save(nextStatus?: 'published' | 'draft') {
    if (!p.title.trim()) { toast('Please add a title.', 'bad'); return }
    if (!p.slug.trim()) { toast('Please add a web address for the post.', 'bad'); return }
    const status = nextStatus ?? p.status
    if (status === 'published') {
      if (!plain(p.body)) { toast('The post has no words yet.', 'bad'); return }
      if (!p.imageMedia) { toast('Please add a featured photo before publishing.', 'bad'); return }
    }
    setBusy(true)
    const data = {
      title: p.title.trim(),
      slug: p.slug,
      _status: status,
      publishedAt: status === 'published' ? (p.publishedAt || new Date().toISOString()) : (p.publishedAt || null),
      author: p.author || BRAND.defaultAuthor,
      category: p.category ?? null,
      excerpt: p.excerpt,
      featuredImage: p.imageMedia ?? null,
      body: p.body,
      meta: { title: p.seo.title, description: p.seo.description, ogImage: p.seo.ogImageMedia ?? null, noindex: p.seo.noindex },
    }
    try {
      if (isNew && !p.id) {
        const r = await api<{ doc: { id: number } }>('/api/posts?depth=0', { method: 'POST', body: data })
        setDirty(false)
        toast(status === 'published' ? 'Post saved and set to published. Press Publish website to put it live.' : 'Draft saved.', 'good')
        window.location.href = `/admin/posts/${r.doc.id}`
        return
      }
      await api(`/api/posts/${p.id}?depth=0`, { method: 'PATCH', body: data })
      setP((x) => ({ ...x, status, publishedAt: data.publishedAt || '' }))
      setDirty(false)
      toast(status === 'published'
        ? 'Saved. Press Publish website to put it live.'
        : nextStatus === 'draft' ? 'The post is now a draft. Press Publish website to take it off the site.' : 'Draft saved.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!p.id) return
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone. If it is on the website, it disappears the next time you publish.`)) return
    setBusy(true)
    try {
      await api(`/api/posts/${p.id}`, { method: 'DELETE' })
      setDirty(false)
      toast('Post deleted.', 'good')
      window.location.href = '/admin/posts'
    } catch (e) {
      toast((e as Error).message, 'bad')
      setBusy(false)
    }
  }

  return (
    <div className="cols">
      <div>
        <AhpraReminder />
        <div className="panel">
          <TextInput label="Title" value={p.title} onChange={(v) => {
            const patch: Partial<PostDoc> = { title: v }
            if (!slugTouched) patch.slug = slugify(v)
            set(patch)
          }} />
          <div className="field">
            <label htmlFor="post-slug">Web address</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="help" style={{ margin: 0 }}>{BRAND.domain}/blog/</span>
              <input id="post-slug" className="input" style={{ flex: 1 }} value={p.slug}
                onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) || '' }) }} />
            </div>
            <div className="help">{live && !isNew ? 'Changing the address of a published post moves it. Ask GYA to add a redirect from the old address.' : 'Lower case words joined with hyphens. Filled in from the title.'}</div>
          </div>
        </div>
        <div className="panel">
          <h2 style={{ marginBottom: 10 }}>Post</h2>
          <BodyEditor value={p.body} onChange={(html) => set({ body: html })} />
          <p className="help" style={{ marginTop: 8 }}>Use Heading for each main part of the post and Subheading inside it. Words in curly brackets, like <span className="kbd">{'{phone}'}</span>, fill in from Site Settings.</p>
        </div>
        <div className="panel">
          <h2 style={{ marginBottom: 10 }}>SEO</h2>
          <SeoPanel seo={p.seo} onChange={(s) => set({ seo: s })} url={url} defaultOg={p.image || BRAND.defaultOg} titleHint={`${p.title} | ${BRAND.name}`} />
        </div>
      </div>

      <div className="sticky">
        <div className="panel">
          <h2 style={{ marginBottom: 8 }}>Publish</h2>
          <p>Status: {live ? <span className="chip good">Published</span> : <span className="chip grey">Draft</span>}</p>
          <p className={dirty ? '' : 'help'} style={{ color: dirty ? 'var(--pd-warn)' : undefined, fontWeight: dirty ? 600 : 400 }}>{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
          <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {live ? (
              <>
                <button className="btn primary" disabled={busy} onClick={() => save('published')}>{busy ? 'Saving...' : 'Save changes'}</button>
                <button className="btn" disabled={busy} onClick={() => save('draft')}>Unpublish (make it a draft)</button>
              </>
            ) : (
              <>
                <button className="btn primary" disabled={busy} onClick={() => save('published')}>{busy ? 'Saving...' : 'Publish this post'}</button>
                <button className="btn" disabled={busy} onClick={() => save('draft')}>Save draft</button>
              </>
            )}
            {p.id && live ? <a className="btn" href={url} target="_blank" rel="noopener">{Icon.external()} View live post</a> : null}
            <PublishButton />
            {p.id ? <button className="btn danger" disabled={busy} onClick={remove}>{Icon.trash()} Delete post</button> : null}
          </div>
          <p className="help" style={{ marginTop: 10 }}>A published post goes on the Blog page, the sitemap and Google&apos;s article listing the next time you press Publish website. The Blog link in the footer appears with the first post.</p>
        </div>
        <div className="panel">
          <ImageSlot label="Featured photo" value={p.image} original={initial.image || undefined}
            onChange={(v) => set({ image: v.value, imageMedia: v.media })} />
          <p className="help" style={{ marginTop: -6 }}>The photo&apos;s description comes from the Media Library.</p>
        </div>
        <div className="panel">
          <div className="field"><span className="lab">Date</span>
            <input className="input" type="date" value={p.publishedAt ? p.publishedAt.slice(0, 10) : ''}
              onChange={(e) => set({ publishedAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : '' })} />
            <div className="help">Shown on the post. Set automatically when you publish.</div></div>
          <TextInput label="Author" value={p.author} onChange={(v) => set({ author: v })} help={`Usually ${BRAND.defaultAuthor}. Use a dentist's name only with their approval.`} />
          <div className="field"><label htmlFor="post-cat">Category</label>
            <select id="post-cat" className="select" value={p.category == null ? '' : String(p.category)}
              onChange={(e) => set({ category: e.target.value ? (cats.find((c) => String(c.id) === e.target.value)?.id ?? null) : null })}>
              <option value="">None</option>
              {cats.map((c) => <option key={c.id} value={String(c.id)}>{c.title}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input className="input" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <button className="btn small" onClick={addCategory}>Add</button>
            </div>
          </div>
          <div className="field"><label htmlFor="post-ex">Summary for the blog list</label>
            <AutoTextarea id="post-ex" value={p.excerpt} onChange={(v) => set({ excerpt: v })} />
            <div className="help">One or two sentences, shown on the Blog page and under the title.</div></div>
          {!isNew && !live ? <Notice tone="info" icon={Icon.info()}><p>Drafts are never on the website.</p></Notice> : null}
        </div>
      </div>
    </div>
  )
}
