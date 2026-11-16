'use client'
/** Dashboard accounts. Only GYA administrators see this screen. */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { Modal, Select, TextInput } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

type U = { id: number | string; name?: string; email: string; role: 'admin' | 'editor'; mustChangePassword?: boolean; canViewQuestionnaires?: boolean; createdAt?: string; lastLoginAt?: string | null; lastEmail?: { at: string; status: string; kind: string } | null }

function tempPassword() {
  const words = ['Calm', 'Breathe', 'Gentle', 'Linen', 'Candle', 'Cronulla', 'Harbour', 'Willow']
  const a = new Uint32Array(3)
  crypto.getRandomValues(a)
  return `${words[a[0] % words.length]}-${words[a[1] % words.length]}-${1000 + (a[2] % 9000)}`
}

export function UsersEditor({ initial, me }: { initial: U[]; me: string | number }) {
  const toast = useToast()
  const [users, setUsers] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'editor', password: tempPassword() })
  const [reset, setReset] = useState<{ u: U; password: string } | null>(null)

  async function emailLink(u: { id: number | string; email: string }) {
    try {
      const r = await api<{ message: string; at: string; status: string }>('/api/dashboard/send-password-link', { method: 'POST', body: { id: u.id } })
      toast(r.message, 'good')
      setUsers((x) => x.map((y) => (y.id === u.id ? { ...y, lastEmail: { at: r.at, status: r.status, kind: 'invite' } } : y)))
    } catch (e) {
      toast((e as Error).message, 'bad')
      setUsers((x) => x.map((y) => (y.id === u.id ? { ...y, lastEmail: { at: new Date().toISOString(), status: 'failed', kind: 'invite' } } : y)))
    }
  }

  // v1.8.4: Add a user creates the login and emails the invite (it used to create it silently)
  const [exists, setExists] = useState<{ id: number | string; email: string } | null>(null)
  const [adding2, setAdding2] = useState(false)
  async function add() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { toast('Please enter an email address.', 'bad'); return }
    setAdding2(true)
    try {
      const res = await fetch('/api/dashboard/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, role: form.role }) })
      const j = await res.json().catch(() => ({}))
      if (res.status === 409 && j.exists) { setExists({ id: j.id, email: form.email.trim().toLowerCase() }); return }
      if (!res.ok) throw new Error(j.error || 'The login could not be created.')
      const doc: U = { ...j.doc, lastEmail: { at: j.invite?.at || new Date().toISOString(), status: j.invite?.ok ? 'accepted' : 'failed', kind: 'invite' } }
      setUsers((x) => [...x, doc])
      setAdding(false)
      if (j.invite?.ok) toast(`Login created for ${doc.email}. The invite has been emailed (link valid for 72 hours).`, 'good')
      else toast(`Login created for ${doc.email}, but the invite was not sent: ${j.invite?.error || 'unknown error'}. Press Send login email again.`, 'bad')
    } catch (e) { toast((e as Error).message, 'bad') } finally { setAdding2(false) }
  }
  async function setQuestionnaires(u: U, on: boolean) {
    try { const r = await api<{ doc: U }>(`/api/users/${u.id}?depth=0`, { method: 'PATCH', body: { canViewQuestionnaires: on } }); setUsers((x) => x.map((y) => (y.id === u.id ? r.doc : y))); toast(on ? `${u.email} can now open patient questionnaires.` : `${u.email} can no longer open patient questionnaires.`, 'good') } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function setRole(u: U, role: string) {
    try { const r = await api<{ doc: U }>(`/api/users/${u.id}?depth=0`, { method: 'PATCH', body: { role } }); setUsers((x) => x.map((y) => (y.id === u.id ? r.doc : y))); toast('Role changed.', 'good') } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function doReset() {
    if (!reset) return
    try {
      await api(`/api/users/${reset.u.id}?depth=0`, { method: 'PATCH', body: { password: reset.password, mustChangePassword: true } })
      toast(`New temporary password set for ${reset.u.email}.`, 'good')
      setUsers((x) => x.map((y) => (y.id === reset.u.id ? { ...y, mustChangePassword: true } : y)))
      setReset(null)
    } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function remove(u: U) {
    if (!window.confirm(`Delete the account for ${u.email}? They will no longer be able to sign in.`)) return
    try { await api(`/api/users/${u.id}`, { method: 'DELETE' }); setUsers((x) => x.filter((y) => y.id !== u.id)); toast('Account deleted.', 'good') } catch (e) { toast((e as Error).message, 'bad') }
  }
  return (
    <>
      <div className="actions" style={{ marginBottom: 12 }}>
        <span className="help">Editors (practice staff) can change content and publish. Administrators (GYA) can also manage accounts, redirects and tracking.</span>
        <span style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => { setForm({ name: '', email: '', role: 'editor', password: tempPassword() }); setAdding(true) }}>{Icon.plus()} Add a user</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Questionnaires</th><th>Password</th><th>Last login email</th><th>Signed in</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={String(u.id)}>
                <td><b>{u.name || '-'}</b>{String(u.id) === String(me) ? <span className="chip blue" style={{ marginLeft: 6 }}>You</span> : null}</td>
                <td>{u.email}</td>
                <td>
                  <select className="select" style={{ width: 'auto' }} value={u.role} disabled={String(u.id) === String(me)} onChange={(e) => setRole(u, e.target.value)}>
                    <option value="editor">Editor (practice)</option><option value="admin">Administrator (GYA)</option>
                  </select>
                </td>
                <td><label className="check" style={{ margin: 0 }} title="Can view patient questionnaires. Off for everyone until Lorna nominates them."><input type="checkbox" checked={!!u.canViewQuestionnaires} onChange={(e) => setQuestionnaires(u, e.target.checked)} /> <span>{u.canViewQuestionnaires ? 'Can view' : 'No access'}</span></label></td>
                <td>{u.mustChangePassword ? <span className="chip warn">Temporary</span> : <span className="chip good">Set by the user or by link</span>}</td>
                <td>{u.lastEmail
                  ? <><span className={`chip ${u.lastEmail.status === 'accepted' ? 'good' : 'warn'}`}>{u.lastEmail.status === 'accepted' ? 'Sent' : 'Not sent'}</span><br /><span className="help">{u.lastEmail.kind === 'reset' ? 'Password reset' : 'Login invite'}, {new Date(u.lastEmail.at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></>
                  : <span className="help">None recorded since 13 Nov 2026</span>}</td>
                <td>{u.lastLoginAt ? <span className="help">{new Date(u.lastLoginAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span> : <span className="help">Not yet{u.createdAt ? <><br />added {new Date(u.createdAt).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' })}</> : null}</span>}</td>
                <td className="actions">
                  <button className="btn small" onClick={() => emailLink(u)}>Send login email again</button>
                  <button className="btn small" onClick={() => setReset({ u, password: tempPassword() })}>Reset password</button>
                  {String(u.id) !== String(me) ? <button className="btn small danger" onClick={() => remove(u)}>{Icon.trash()} Delete</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding ? (
        <Modal narrow title="Add a user" onClose={() => { setAdding(false); setExists(null) }} footer={exists
          ? <><button className="btn" onClick={() => { setAdding(false); setExists(null) }}>Close</button><button className="btn primary" onClick={() => { const e = exists; setAdding(false); setExists(null); emailLink(e) }}>Send login email again</button></>
          : <><button className="btn" onClick={() => setAdding(false)}>Cancel</button><button className="btn primary" disabled={adding2} onClick={add}>{adding2 ? 'Creating...' : 'Create login and send invite'}</button></>}>
          {exists ? (
            <div className="notice info" role="status">{Icon.info()}<div className="grow"><p><b>This person already has a login</b> ({exists.email}), so nothing was created. To send them a fresh link to choose a password, press <b>Send login email again</b>.</p></div></div>
          ) : (
            <>
              <TextInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <TextInput label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Select label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[{ value: 'editor', label: 'Editor (practice staff)' }, { value: 'admin', label: 'Administrator (GYA)' }]} />
              <p className="help">They get an email straight away with a link to choose their own password (valid for 72 hours). The result shows under Last login email.</p>
            </>
          )}
        </Modal>
      ) : null}
      {reset ? (
        <Modal narrow title={`Reset password for ${reset.u.email}`} onClose={() => setReset(null)} footer={<><button className="btn" onClick={() => setReset(null)}>Cancel</button><button className="btn primary" onClick={doReset}>Set temporary password</button></>}>
          <TextInput label="Temporary password" value={reset.password} onChange={(v) => setReset({ ...reset, password: v })} help="They must choose a new password at their next sign in." />
        </Modal>
      ) : null}
    </>
  )
}
