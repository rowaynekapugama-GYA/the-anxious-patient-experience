'use client'
/** Sign in, and the forced password change on first sign in. */
import React, { useState } from 'react'
import { api } from '../lib/client'

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const r = await api<{ user: { mustChangePassword?: boolean } }>('/api/users/login', { method: 'POST', body: { email: email.trim(), password } })
      const dest = r.user?.mustChangePassword ? '/admin/change-password' : (next && /^\/admin(\/|\?|$)/.test(next) && !next.includes('//') ? next : '/admin')
      window.location.href = dest
    } catch (e2) {
      const m = (e2 as Error).message
      setErr(/locked/i.test(m) ? 'Too many attempts. The account is locked for 15 minutes.' : 'That email and password do not match. Please try again.')
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      {err ? <div className="notice bad" role="alert"><div className="grow">{err}</div></div> : null}
      <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      <p className="help" style={{ marginTop: 12, textAlign: 'center' }}><a href="/admin/forgot-password">Forgotten your password?</a></p>
    </form>
  )
}

/** The one-off first login, only while ALLOW_FIRST_USER=true and nobody has an account yet. */
export function FirstUserForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { setErr('Use at least 10 characters with letters and numbers.'); return }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return }
    setBusy(true)
    try {
      await api('/api/users/first-register', { method: 'POST', body: { name: name.trim(), email: email.trim(), password: pw } })
      await api('/api/users/login', { method: 'POST', body: { email: email.trim(), password: pw } }).catch(() => null)
      window.location.href = '/admin'
    } catch (e2) {
      setErr((e2 as Error).message)
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <div className="notice info"><div className="grow">Create the first login. It is always a GYA administrator. Remove ALLOW_FIRST_USER in Vercel afterwards.</div></div>
      {err ? <div className="notice bad" role="alert"><div className="grow">{err}</div></div> : null}
      <div className="field"><label htmlFor="fu-name">Full name</label><input id="fu-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label htmlFor="fu-email">Email</label><input id="fu-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="fu-pw">Password</label><input id="fu-pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <div className="help">At least 10 characters, with letters and numbers.</div></div>
      <div className="field"><label htmlFor="fu-pw2">Password again</label><input id="fu-pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create the first login'}</button>
    </form>
  )
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const strongEnough = pw.length >= 10 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!strongEnough) { setErr('Use at least 10 characters with letters and numbers.'); return }
    if (pw !== pw2) { setErr('The two new passwords do not match.'); return }
    if (pw === current) { setErr('Choose a password that is different from the temporary one.'); return }
    setBusy(true)
    try {
      await api('/api/dashboard/change-password', { method: 'POST', body: { current, password: pw } })
      window.location.href = '/admin'
    } catch (e2) {
      setErr((e2 as Error).message)
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      {forced ? <div className="notice info"><div className="grow">Welcome. Before you start, please choose your own password.</div></div> : null}
      {err ? <div className="notice bad" role="alert"><div className="grow">{err}</div></div> : null}
      <div className="field"><label htmlFor="cur">Current password</label><input id="cur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
      <div className="field"><label htmlFor="pw">New password</label><input id="pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <div className="help">At least 10 characters, with letters and numbers.</div></div>
      <div className="field"><label htmlFor="pw2">New password again</label><input id="pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save my new password'}</button>
    </form>
  )
}


/** "Forgotten your password?": emails a link to choose a new one. */
export function ForgotForm() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Please enter your email address.'); return }
    setBusy(true)
    try {
      const r = await api<{ message: string }>('/api/dashboard/forgot-password', { method: 'POST', body: { email: email.trim() } })
      setMsg(r.message)
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (msg) return <><div className="notice good" role="status"><div className="grow">{msg}</div></div><p className="help" style={{ textAlign: 'center' }}><a href="/admin/login">Back to sign in</a></p></>
  return (
    <form onSubmit={submit} noValidate>
      {err ? <div className="notice bad" role="alert"><div className="grow">{err}</div></div> : null}
      <div className="field"><label htmlFor="fp-email">Email</label><input id="fp-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Email me a link'}</button>
      <p className="help" style={{ marginTop: 12, textAlign: 'center' }}><a href="/admin/login">Back to sign in</a></p>
    </form>
  )
}

/** The page the emailed link opens: choose a password, then straight into the dashboard. */
export function ResetForm({ token }: { token: string }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { setErr('Use at least 10 characters with letters and numbers.'); return }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return }
    setBusy(true)
    try {
      await api('/api/users/reset-password', { method: 'POST', body: { token, password: pw } })
      window.location.href = '/admin'
    } catch {
      setErr('This link has expired or has already been used. Ask for a new one below.')
      setBusy(false)
    }
  }
  if (!token) return <div className="notice bad" role="alert"><div className="grow">This link is not complete. Please use the button in the email, or <a href="/admin/forgot-password">ask for a new link</a>.</div></div>
  return (
    <form onSubmit={submit} noValidate>
      {err ? <div className="notice bad" role="alert"><div className="grow">{err} <a href="/admin/forgot-password">Ask for a new link</a></div></div> : null}
      <div className="field"><label htmlFor="rp-pw">New password</label><input id="rp-pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <p className="help">At least 10 characters, with letters and numbers.</p></div>
      <div className="field"><label htmlFor="rp-pw2">New password again</label><input id="rp-pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save my password'}</button>
    </form>
  )
}
