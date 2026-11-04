'use client'
/** Send an old address to a new one, for example after renaming a page. */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { PublishButton } from '../ui/PublishButton'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

type R = { id?: number | string; from: string; to: string; type: 'permanent' | 'temporary' }

export function RedirectsEditor({ initial }: { initial: R[] }) {
  const toast = useToast()
  const [rows, setRows] = useState<R[]>(initial)
  const [draft, setDraft] = useState<R>({ from: '', to: '', type: 'permanent' })
  async function add() {
    const from = draft.from.trim(); const to = draft.to.trim()
    if (!from.startsWith('/')) { toast('The old address must start with /, for example /old-page', 'bad'); return }
    if (!to) { toast('Please add where it should go.', 'bad'); return }
    try {
      const r = await api<{ doc: R }>('/api/redirects?depth=0', { method: 'POST', body: { from, to, type: draft.type } })
      setRows((x) => [...x, r.doc])
      setDraft({ from: '', to: '', type: 'permanent' })
      toast('Redirect added. It starts working when you publish.', 'good')
    } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function remove(r: R) {
    if (!window.confirm(`Remove the redirect from ${r.from}?`)) return
    try { await api(`/api/redirects/${r.id}`, { method: 'DELETE' }); setRows((x) => x.filter((y) => y.id !== r.id)); toast('Removed.', 'good') } catch (e) { toast((e as Error).message, 'bad') }
  }
  return (
    <>
      <div className="panel">
        <h2>Add a redirect</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field"><label htmlFor="r-from">Old address</label><input id="r-from" className="input" placeholder="/old-page" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></div>
          <div className="field"><label htmlFor="r-to">Send visitors to</label><input id="r-to" className="input" placeholder="/new-page or https://..." value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></div>
          <div className="field" style={{ flex: '0 0 auto' }}><label className="check"><input type="checkbox" checked={draft.type === 'permanent'} onChange={(e) => setDraft({ ...draft, type: e.target.checked ? 'permanent' : 'temporary' })} /><span>Permanent</span></label></div>
          <div className="field" style={{ flex: '0 0 auto' }}><button className="btn primary" onClick={add}>{Icon.plus()} Add</button></div>
        </div>
        <p className="help">Use Permanent for pages that have moved for good. Google then moves its listing to the new address.</p>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Old address</th><th>Goes to</th><th>Type</th><th /></tr></thead>
          <tbody>
            {!rows.length ? <tr><td colSpan={4} className="empty">No redirects yet.</td></tr> : null}
            {rows.map((r) => (
              <tr key={String(r.id)}><td>{r.from}</td><td>{r.to}</td><td>{r.type === 'temporary' ? 'Temporary (307)' : 'Permanent (308)'}</td>
                <td><button className="btn small danger" onClick={() => remove(r)}>{Icon.trash()} Remove</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 14 }}><PublishButton /></p>
    </>
  )
}
