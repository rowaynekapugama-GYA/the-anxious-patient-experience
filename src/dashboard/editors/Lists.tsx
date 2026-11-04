'use client'
/** The Pages and Blog Posts lists. */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '../lib/client'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

export type PageRow = { id: number | string; label: string; url: string; group: string; noindex: boolean; updatedAt: string }

const GROUP_ORDER = ['Main pages', 'Treatments and services', 'Team', 'Suburb pages', 'Legal and practice information', 'Other']

export function PagesList({ rows }: { rows: PageRow[] }) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const m = new Map<string, PageRow[]>()
    for (const r of rows) {
      if (q && !`${r.label} ${r.url}`.toLowerCase().includes(q.toLowerCase())) continue
      const g = r.group || 'Other'
      m.set(g, [...(m.get(g) || []), r])
    }
    return [...m.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
  }, [rows, q])
  return (
    <>
      <input className="input search" placeholder="Find a page" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a page" />
      {groups.map(([g, list]) => (
        <div key={g}>
          <div className="group-title">{g} ({list.length})</div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {list.map((r) => (
                  <tr key={String(r.id)}>
                    <td style={{ width: '45%' }}><Link className="t-title" href={`/admin/pages/${r.id}`}>{r.label}</Link>
                      {r.noindex ? <span className="chip warn" style={{ marginLeft: 8 }}>Hidden from Google</span> : null}</td>
                    <td className="muted">{r.url || '(shown for addresses that do not exist)'}</td>
                    <td className="muted">Updated {new Date(r.updatedAt).toLocaleDateString('en-AU')}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link className="btn small" href={`/admin/pages/${r.id}`}>Edit</Link>{' '}
                      {r.url ? <a className="btn small ghost" href={r.url} target="_blank" rel="noopener">{Icon.external()} View</a> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!groups.length ? <p className="empty">No pages match.</p> : null}
    </>
  )
}

export type PostRow = { id: number | string; title: string; slug: string; status: string; published: string; category: string; updatedAt: string }

export function PostsList({ rows: initial }: { rows: PostRow[] }) {
  const toast = useToast()
  const [rows, setRows] = useState(initial)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all')
  const shown = rows.filter((r) => (status === 'all' || r.status === status) && (!q || `${r.title} ${r.slug} ${r.category}`.toLowerCase().includes(q.toLowerCase())))
  async function setLive(r: PostRow, live: boolean) {
    try {
      await api(`/api/posts/${r.id}?depth=0`, { method: 'PATCH', body: { _status: live ? 'published' : 'draft' } })
      setRows((x) => x.map((y) => (y.id === r.id ? { ...y, status: live ? 'published' : 'draft' } : y)))
      toast(live ? 'Set to published. Press Publish website to put it live.' : 'Now a draft. Press Publish website to take it off the site.', 'good')
    } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function remove(r: PostRow) {
    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return
    try { await api(`/api/posts/${r.id}`, { method: 'DELETE' }); setRows((x) => x.filter((y) => y.id !== r.id)); toast('Post deleted.', 'good') } catch (e) { toast((e as Error).message, 'bad') }
  }
  return (
    <>
      <div className="actions" style={{ marginBottom: 12 }}>
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          {(['all', 'published', 'draft'] as const).map((s) => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : s === 'published' ? 'Published' : 'Drafts'} ({s === 'all' ? rows.length : rows.filter((r) => r.status === s).length})
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <input className="input search" placeholder="Search posts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search posts" />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Status</th><th /></tr></thead>
          <tbody>
            {!shown.length ? <tr><td colSpan={5} className="empty">No posts match.</td></tr> : null}
            {shown.map((r) => (
              <tr key={String(r.id)}>
                <td><Link className="t-title" href={`/admin/posts/${r.id}`}>{r.title}</Link><div className="muted">/blog/{r.slug}</div></td>
                <td className="muted">{r.category}</td>
                <td className="muted">{r.published ? new Date(r.published).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                <td>{r.status === 'published' ? <span className="chip good">Published</span> : <span className="chip grey">Draft</span>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Link className="btn small" href={`/admin/posts/${r.id}`}>Edit</Link>{' '}
                  {r.status === 'published'
                    ? <button className="btn small ghost" onClick={() => setLive(r, false)}>Unpublish</button>
                    : <button className="btn small ghost" onClick={() => setLive(r, true)}>Publish</button>}{' '}
                  <button className="btn small ghost" aria-label={`Delete ${r.title}`} onClick={() => remove(r)}>{Icon.trash()}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
