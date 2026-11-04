'use client'
/** Dashboard accounts. Only GYA administrators see this screen. */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { Modal, Select, TextInput } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

type U = { id: number | string; name?: string; email: string; role: 'admin' | 'editor'; mustChangePassword?: boolean; createdAt?: string }

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

  async function add() {
    if (!form.email.includes('@')) { toast('Please enter an email address.', 'bad'); return }
    if (form.password.length < 10) { toast('The temporary password must be at least 10 characters.', 'bad'); return }
    try {
      const r = await api<{ doc: U }>('/api/users?depth=0', { method: 'POST', body: { ...form, email: form.email.trim().toLowerCase(), mustChangePassword: true } })
      setUsers((x) => [...x, r.doc])
      setAdding(false)
      toast(`Account created for ${r.doc.email}. Send them the temporary password; they choose their own at first sign in.`, 'good')
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
      <div className="actions" style={{ marginBottom: 12 }}>
        <span className="help">Editors (practice staff) can change content and publish. Administrators (GYA) can also manage accounts, redirects and tracking.</span>
        <span style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => { setForm({ name: '', email: '', role: 'editor', password: tempPassword() }); setAdding(true) }}>{Icon.plus()} Add a user</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Password</th><th /></tr></thead>
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
                <td>{u.mustChangePassword ? <span className="chip warn">Temporary</span> : <span className="chip good">Set by the user</span>}</td>
                <td className="actions">
                  <button className="btn small" onClick={() => setReset({ u, password: tempPassword() })}>Reset password</button>
                  {String(u.id) !== String(me) ? <button className="btn small danger" onClick={() => remove(u)}>{Icon.trash()} Delete</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding ? (
        <Modal narrow title="Add a user" onClose={() => setAdding(false)} footer={<><button className="btn" onClick={() => setAdding(false)}>Cancel</button><button className="btn primary" onClick={add}>Create account</button></>}>
          <TextInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <TextInput label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Select label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[{ value: 'editor', label: 'Editor (practice staff)' }, { value: 'admin', label: 'Administrator (GYA)' }]} />
          <TextInput label="Temporary password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} help="Send this to the person separately from the sign-in link. They must choose their own password when they first sign in." />
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
