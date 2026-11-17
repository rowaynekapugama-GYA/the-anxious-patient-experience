'use client'
/**
 * Dashboard accounts. Only GYA administrators see this screen.
 * v1.9.1: one card per person instead of an eight-column table, so nothing is squeezed: who they are, what they can
 * do, how their login is going, and the buttons, each in its own area. Same actions as before.
 * v1.10.0: the practice owner (Lorna) also sees this screen, in 'owner' mode: the list of logins and the "Can view
 * patient questionnaires" tick only. Ticking goes through /api/dashboard/questionnaire-access, which checks who is
 * asking, logs the change and emails the person given access. GYA also sees the Practice owner tick.
 */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { Modal, Select, TextInput } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

type U = { id: number | string; name?: string; email: string; role: 'admin' | 'editor'; mustChangePassword?: boolean; canViewQuestionnaires?: boolean; practiceOwner?: boolean; createdAt?: string; lastLoginAt?: string | null; lastEmail?: { at: string; status: string; kind: string } | null }

function tempPassword() {
  const words = ['Calm', 'Breathe', 'Gentle', 'Linen', 'Candle', 'Cronulla', 'Harbour', 'Willow']
  const a = new Uint32Array(3)
  crypto.getRandomValues(a)
  return `${words[a[0] % words.length]}-${words[a[1] % words.length]}-${1000 + (a[2] % 9000)}`
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' })
const initials = (u: U) => {
  const base = (u.name || u.email.split('@')[0]).replace(/[^A-Za-z ]+/g, ' ').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || ''))).toUpperCase()
}

type LogEntry = { at: string; by: string; for: string; change: string; note: string }

export const ACCESS_LINE = 'Only people ticked here can open patient questionnaires. Having a login is not enough.'

export function UsersEditor({ initial, me, mode = 'admin', log: initialLog = [] }: { initial: U[]; me: string | number; mode?: 'admin' | 'owner'; log?: LogEntry[] }) {
  const toast = useToast()
  const admin = mode === 'admin'
  const [users, setUsers] = useState(initial)
  const [log, setLog] = useState(initialLog)
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
  async function refreshLog() {
    try { const r = await api<{ log: LogEntry[] }>('/api/dashboard/questionnaire-access'); setLog(r.log) } catch { /* the list stays as it was */ }
  }
  async function setQuestionnaires(u: U, on: boolean) {
    try {
      const r = await api<{ user: Partial<U>; emailed: boolean | null }>('/api/dashboard/questionnaire-access', { method: 'POST', body: { id: u.id, canViewQuestionnaires: on } })
      setUsers((x) => x.map((y) => (y.id === u.id ? { ...y, ...r.user } : y)))
      toast(on ? `${u.email} can now open patient questionnaires.${r.emailed ? ' They have been emailed.' : r.emailed === false ? ' The email to them did not go; please let them know.' : ''}` : `${u.email} can no longer open patient questionnaires.`, 'good')
      refreshLog()
    } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function setOwner(u: U, on: boolean) {
    try {
      const r = await api<{ user: Partial<U> }>('/api/dashboard/questionnaire-access', { method: 'POST', body: { id: u.id, practiceOwner: on } })
      setUsers((x) => x.map((y) => (y.id === u.id ? { ...y, ...r.user } : y)))
      toast(on ? `${u.email} is now the practice owner and can choose who opens questionnaires.` : `${u.email} is no longer a practice owner.`, 'good')
      refreshLog()
    } catch (e) { toast((e as Error).message, 'bad') }
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
      <div className="notice info access-line" role="note" id="access-line">{Icon.info()}<div className="grow"><p><b>{ACCESS_LINE}</b> {admin ? 'The practice owner (Lorna) chooses who has it, and GYA can too. Every change is logged and the person given access gets an email.' : 'Tick a person to let them open questionnaires, or untick to stop them. You can tick yourself. Every change is logged and the person given access gets an email.'}</p></div></div>
      {admin ? (
        <div className="actions" style={{ marginBottom: 12 }}>
          <span className="help">Editors (practice staff) can change content and publish. Administrators (GYA) can also manage accounts, redirects and tracking.</span>
          <span style={{ flex: 1 }} />
          <button className="btn primary" onClick={() => { setForm({ name: '', email: '', role: 'editor', password: tempPassword() }); setAdding(true) }}>{Icon.plus()} Add a user</button>
        </div>
      ) : null}
      <div className="user-summary" aria-label="Summary">
        <span><b>{users.length}</b> {users.length === 1 ? 'login' : 'logins'}</span>
        <span><b>{users.filter((u) => u.lastLoginAt).length}</b> signed in</span>
        <span><b>{users.filter((u) => !u.lastLoginAt).length}</b> not signed in yet</span>
        <span><b>{users.filter((u) => u.canViewQuestionnaires).length}</b> with questionnaire access</span>
      </div>
      <ul className="user-list">
        {users.map((u) => {
          const mine = String(u.id) === String(me)
          const sent = u.lastEmail?.status === 'accepted'
          return (
            <li key={String(u.id)} className="user-card">
              <div className="user-who">
                <span className="user-avatar" aria-hidden="true">{initials(u)}</span>
                <div className="user-id">
                  <div className="user-name">{u.name || <span className="muted">No name yet</span>}{mine ? <span className="chip blue">You</span> : null}</div>
                  <div className="user-email">{u.email}</div>
                  <div className="user-chips">
                    <span className={`chip ${u.role === 'admin' ? 'grey' : 'blue'}`}>{u.role === 'admin' ? 'Administrator (GYA)' : 'Editor (practice)'}</span>
                    {u.practiceOwner ? <span className="chip blue">Practice owner</span> : null}
                    {u.canViewQuestionnaires ? <span className="chip good">Can view questionnaires</span> : null}
                  </div>
                </div>
              </div>

              {admin ? <dl className="user-facts">
                <div>
                  <dt>Signed in</dt>
                  <dd>{u.lastLoginAt ? fmt(u.lastLoginAt) : <><span className="chip grey">Not yet</span>{u.createdAt ? <span className="help"> Added {day(u.createdAt)}</span> : null}</>}</dd>
                </div>
                <div>
                  <dt>Last login email</dt>
                  <dd>{u.lastEmail
                    ? <><span className={`chip ${sent ? 'good' : 'warn'}`}>{sent ? 'Sent' : 'Not sent'}</span> <span className="help">{u.lastEmail.kind === 'reset' ? 'Password reset' : 'Login invite'}, {fmt(u.lastEmail.at)}</span></>
                    : <span className="help">None recorded since 13 Nov 2026</span>}</dd>
                </div>
                <div>
                  <dt>Password</dt>
                  <dd>{u.mustChangePassword ? <span className="chip warn">Temporary</span> : <span className="help">Chosen by them, or set by link</span>}</dd>
                </div>
              </dl> : <dl className="user-facts"><div><dt>Signed in</dt><dd>{u.lastLoginAt ? fmt(u.lastLoginAt) : <span className="chip grey">Not yet</span>}</dd></div></dl>}

              <div className="user-settings">
                {admin ? (
                  <label className="user-field">
                    <span>Role</span>
                    <select className="select" value={u.role} disabled={mine} onChange={(e) => setRole(u, e.target.value)}>
                      <option value="editor">Editor (practice)</option><option value="admin">Administrator (GYA)</option>
                    </select>
                  </label>
                ) : null}
                <label className="toggle user-toggle" title="Off for everyone until the practice owner ticks it.">
                  <input type="checkbox" checked={!!u.canViewQuestionnaires} onChange={(e) => setQuestionnaires(u, e.target.checked)} aria-describedby="access-line" />
                  <span className="track" aria-hidden="true" />
                  <span>Can view patient questionnaires</span>
                </label>
                {admin ? (
                  <label className="toggle user-toggle" title="The practice owner chooses who can open questionnaires. GYA only.">
                    <input type="checkbox" checked={!!u.practiceOwner} onChange={(e) => setOwner(u, e.target.checked)} />
                    <span className="track" aria-hidden="true" />
                    <span>Practice owner</span>
                  </label>
                ) : null}
              </div>

              {admin ? (
                <div className="user-actions">
                  <button className="btn small" onClick={() => emailLink(u)}>Send login email again</button>
                  <button className="btn small" onClick={() => setReset({ u, password: tempPassword() })}>Reset password</button>
                  {!mine ? <button className="btn small danger" onClick={() => remove(u)} aria-label={`Delete ${u.email}`}>{Icon.trash()} Delete</button> : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      <details className="access-log">
        <summary>Questionnaire access changes ({log.length})</summary>
        {log.length ? (
          <ul>{log.map((e, i) => <li key={i}><b>{fmt(e.at)}</b>: {e.by} changed <b>{e.change}</b> for {e.for}{e.note ? ` (${e.note})` : ''}</li>)}</ul>
        ) : <p className="help">No changes yet.</p>}
      </details>
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
