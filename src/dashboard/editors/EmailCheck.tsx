'use client'
/** The email check screen (v1.8.3, GYA only). The data comes from /api/dashboard/email. */
import React, { useCallback, useEffect, useState } from 'react'
import { Notice } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

type Row = { id: string; at: string; kind: string; recipient: string; ref: string | null; status: string; message_id: string; error: string; test: boolean }
type Data = {
  setup: { from: string; fromDomain: string; provider: string | null; smtp2goKey: boolean; configured: boolean; serverUrl: string; linkOrigin: string }
  recipients: { kind: string; label: string; to: string; source: string }[]
  failed7: number
  log: Row[]
  testable: { kind: string; label: string }[]
}
type TestResult = { kind: string; label: string; ok: boolean; id: string; error: string; note?: string }

const at = (s: string) => new Date(s).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit' })
const Yes = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => <span className={ok ? 'ok-text' : 'bad-text'}>{ok ? Icon.check() : '!'} {children}</span>

export function EmailCheck({ me }: { me: string }) {
  const toast = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [to, setTo] = useState('rowayne@gyaclients.com')
  const [pick, setPick] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<TestResult[] | null>(null)

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ ...(kind ? { kind } : {}), ...(status ? { status } : {}) })
      const r = await fetch(`/api/dashboard/email?${q}`, { credentials: 'include' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not load')
      setData(j)
      setPick((p) => (p.size ? p : new Set((j as Data).testable.map((t) => t.kind))))
    } catch (e) { setErr((e as Error).message) }
  }, [kind, status])
  useEffect(() => { void load() }, [load])

  async function sendTests() {
    setBusy(true); setResults(null)
    try {
      const r = await fetch('/api/dashboard/email', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, kinds: [...pick] }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'The tests could not be sent')
      setResults(j.results)
      const bad = (j.results as TestResult[]).filter((x) => !x.ok).length
      toast(bad ? `${bad} test email${bad > 1 ? 's' : ''} failed. See below.` : `All ${j.results.length} test emails were accepted. Check ${to} (and junk).`, bad ? 'bad' : 'good')
      void load()
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  if (err) return <Notice tone="bad" icon={Icon.warn()}><p>{err}</p></Notice>
  if (!data) return <div className="panel"><p className="help">Loading...</p></div>
  const s = data.setup
  const allGreen = s.configured && s.smtp2goKey && !!s.serverUrl && /^https:\/\/theanxiouspatientexperience\.com\.au$/.test(s.linkOrigin)
  return (
    <>
      {data.failed7 ? <Notice tone="warn" icon={Icon.warn()}><p><b>{data.failed7} email{data.failed7 > 1 ? 's' : ''} failed in the last 7 days.</b> Filter the log below by Failed to see which.</p></Notice> : null}
      <div className="grid-2">
        <section className="panel">
          <h2>Sending set up {allGreen ? <span className="chip good">All good</span> : <span className="chip warn">Check</span>}</h2>
          <dl className="kv">
            <dt>Sends from</dt><dd><Yes ok={!!s.from}>{s.from || 'BOOKING_FROM is not set'}</Yes></dd>
            <dt>SMTP2GO key</dt><dd><Yes ok={s.smtp2goKey}>{s.smtp2goKey ? 'Set (hidden)' : 'Not set'}</Yes></dd>
            <dt>Provider</dt><dd>{s.provider === 'smtp2go' ? 'SMTP2GO' : s.provider === 'resend' ? 'Resend' : 'None'}</dd>
            <dt>Links in emails</dt><dd><Yes ok={/^https:\/\/theanxiouspatientexperience\.com\.au$/.test(s.linkOrigin)}>{s.linkOrigin}</Yes></dd>
            <dt>NEXT_PUBLIC_SERVER_URL</dt><dd><Yes ok={!!s.serverUrl}>{s.serverUrl || 'Not set'}</Yes></dd>
          </dl>
          <p className="help" style={{ marginTop: 12 }}>The From domain ({s.fromDomain || 'none'}) must show DKIM and Return-path verified in SMTP2GO, Sending &gt; Verified Senders, or Outlook and Hotmail may put emails in junk.</p>
        </section>
        <section className="panel">
          <h2>Who gets what</h2>
          <table className="table compact">
            <thead><tr><th>Email</th><th>Goes to</th><th>From</th></tr></thead>
            <tbody>{data.recipients.map((r) => <tr key={r.kind}><td>{r.label}</td><td>{r.to}</td><td className="help">{r.source}</td></tr>)}</tbody>
          </table>
        </section>
      </div>

      <section className="panel" id="tests">
        <h2>Send test emails</h2>
        <p className="help" style={{ marginTop: -6 }}>Sample details (Test Patient GYA, APE-TEST01) with [TEST] at the start of the subject. They go only to the address below: never to the booking list, the APE inbox or a patient, and no booking is made. 3 runs an hour.</p>
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="test-to">Send to</label>
          <input id="test-to" className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          {to.toLowerCase() !== me.toLowerCase() ? <div className="help">Signed in as {me}.</div> : null}
        </div>
        <div className="test-types">
          {data.testable.map((t) => (
            <label key={t.kind}><input type="checkbox" checked={pick.has(t.kind)} onChange={(e) => setPick((p) => { const n = new Set(p); if (e.target.checked) n.add(t.kind); else n.delete(t.kind); return n })} /> {t.label}</label>
          ))}
        </div>
        <div className="actions">
          <button className="btn small ghost" onClick={() => setPick(new Set(data.testable.map((t) => t.kind)))}>Tick all</button>
          <button className="btn small ghost" onClick={() => setPick(new Set())}>Untick all</button>
          <span style={{ flex: 1 }} />
          <button className="btn primary" disabled={busy || !pick.size} onClick={sendTests}>{busy ? 'Sending...' : `Send ${pick.size} test email${pick.size === 1 ? '' : 's'}`}</button>
        </div>
        {results ? (
          <table className="table compact" style={{ marginTop: 14 }}>
            <thead><tr><th>Email</th><th>Result</th><th>Note</th></tr></thead>
            <tbody>{results.map((r) => <tr key={r.kind}><td>{r.label}</td><td>{r.ok ? <span className="ok-text">{Icon.check()} Accepted {r.id ? <span className="help">({r.id})</span> : null}</span> : <span className="bad-text">Failed: {r.error}</span>}</td><td className="help">{r.note || ''}</td></tr>)}</tbody>
          </table>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent emails</h2>
          <select className="select" style={{ width: 'auto' }} aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All types</option>{data.recipients.map((r) => <option key={r.kind} value={r.kind}>{r.label}</option>)}
          </select>
          <select className="select" style={{ width: 'auto' }} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any result</option><option value="accepted">Accepted</option><option value="failed">Failed</option><option value="retrying">Failed once, retried</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table compact">
            <thead><tr><th>When</th><th>Email</th><th>To</th><th>Booking</th><th>Result</th></tr></thead>
            <tbody>
              {!data.log.length ? <tr><td colSpan={5} className="empty">No emails recorded yet. Every email from 13 Nov 2026 (v1.8.3) is listed here for 90 days.</td></tr> : null}
              {data.log.map((r) => (
                <tr key={r.id}>
                  <td>{at(r.at)}</td>
                  <td>{data.recipients.find((x) => x.kind === r.kind)?.label ?? r.kind}{r.test ? <> <span className="chip grey">Test</span></> : null}</td>
                  <td>{r.recipient}</td>
                  <td>{r.ref || '-'}</td>
                  <td>{r.status === 'accepted' ? <span className="ok-text">{Icon.check()} Accepted</span> : r.status === 'retrying' ? <span className="help">Failed, retried: {r.error}</span> : <span className="bad-text">Failed: {r.error}</span>}{r.message_id ? <div className="help">{r.message_id}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
