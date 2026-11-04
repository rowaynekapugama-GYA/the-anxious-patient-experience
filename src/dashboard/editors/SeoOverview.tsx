'use client'
/** Every page and post with its Google title and description, checked for length. */
import React, { useMemo, useState } from 'react'
import { api } from '../lib/client'
import { seoVerdict } from '../lib/text'
import { tokensToFriendly } from '../util'
import { Modal } from '../ui/fields'
import { SeoPanel, type SeoState } from '../ui/SeoPanel'
import { PublishButton } from '../ui/PublishButton'
import { useToast } from '../ui/Toast'

export type SeoRow = { kind: 'page' | 'post'; id: number | string; label: string; url: string; seo: SeoState; defaultOg: string; live: boolean }

export function SeoOverview({ initial }: { initial: SeoRow[] }) {
  const toast = useToast()
  const [rows, setRows] = useState(initial)
  const [edit, setEdit] = useState<SeoRow | null>(null)
  const [draft, setDraft] = useState<SeoState | null>(null)
  const [only, setOnly] = useState<'all' | 'fix'>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const verdicts = (r: SeoRow) => ({
    t: seoVerdict(tokensToFriendly(r.seo.title).length, 30, 60),
    d: seoVerdict(tokensToFriendly(r.seo.description).length, 70, 155),
  })
  const shown = useMemo(() => rows.filter((r) => {
    const v = verdicts(r)
    if (only === 'fix' && v.t.tone === 'good' && v.d.tone === 'good') return false
    return !q || `${r.label} ${r.url}`.toLowerCase().includes(q.toLowerCase())
  }), [rows, only, q])
  const needs = rows.filter((r) => { const v = verdicts(r); return v.t.tone !== 'good' || v.d.tone !== 'good' }).length

  async function save() {
    if (!edit || !draft) return
    setBusy(true)
    try {
      if (edit.kind === 'page') {
        await api(`/api/dashboard/pages/${edit.id}`, { method: 'POST', body: { seo: draft } })
      } else {
        await api(`/api/posts/${edit.id}?depth=0`, { method: 'PATCH', body: { meta: { title: draft.title, description: draft.description, ogImage: draft.ogImageMedia ?? null, noindex: draft.noindex } } })
      }
      setRows((x) => x.map((r) => (r.kind === edit.kind && r.id === edit.id ? { ...r, seo: draft } : r)))
      setEdit(null)
      toast('SEO saved. Press Publish website to put it live.', 'good')
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  return (
    <>
      <div className="actions" style={{ marginBottom: 12 }}>
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          <button className={only === 'all' ? 'on' : ''} onClick={() => setOnly('all')}>Everything ({rows.length})</button>
          <button className={only === 'fix' ? 'on' : ''} onClick={() => setOnly('fix')}>Worth a look ({needs})</button>
        </div>
        <span style={{ flex: 1 }} />
        <input className="input search" placeholder="Search pages and posts" value={q} onChange={(e) => setQ(e.target.value)} />
        <PublishButton />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Page or post</th><th>Title in Google</th><th>Description</th><th>Listed in Google</th><th /></tr></thead>
          <tbody>
            {shown.map((r) => {
              const v = verdicts(r)
              return (
                <tr key={`${r.kind}-${r.id}`}>
                  <td><b>{r.label}</b><div className="muted">{r.kind === 'post' ? 'Blog post' : 'Page'} &middot; {r.url}{r.live ? '' : ' (draft)'}</div></td>
                  <td><span className={`chip ${v.t.tone}`}>{v.t.label}</span><div className="muted">{tokensToFriendly(r.seo.title)}</div></td>
                  <td><span className={`chip ${v.d.tone}`}>{v.d.label}</span><div className="muted">{tokensToFriendly(r.seo.description).slice(0, 110)}{r.seo.description.length > 110 ? '...' : ''}</div></td>
                  <td>{r.seo.noindex ? <span className="chip warn">Hidden</span> : <span className="chip good">Yes</span>}</td>
                  <td><button className="btn small" onClick={() => { setEdit(r); setDraft(r.seo) }}>Edit</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="help" style={{ marginTop: 10 }}>Defaults for every page (the share image and the description used when a page has none) are under <a href="/admin/settings#seo">Site Settings</a>.</p>
      {edit && draft ? (
        <Modal title={`SEO: ${edit.label}`} onClose={() => setEdit(null)} footer={<>
          <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button>
        </>}>
          <SeoPanel seo={draft} onChange={setDraft} url={edit.url} defaultOg={edit.defaultOg} />
        </Modal>
      ) : null}
    </>
  )
}
