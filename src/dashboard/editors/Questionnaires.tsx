'use client'
/**
 * Patient questionnaires in the dashboard (v1.7.0, reworked in v1.9.0): the list, one questionnaire with an "At a
 * glance" strip and every answer in Lorna's order (with Print), and the access log (GYA). Answers are fetched only
 * when a questionnaire is opened, by a person with "Can view patient questionnaires". Test questionnaires from Email
 * check are listed apart (GYA only) and deleted after 24 hours.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { Modal, Notice, TextInput } from '../ui/fields'
import { when } from '../lib/format'
import type { ListRow, Opened } from '@/lib/questionnaire'
import { answerRows, glance, identityRows } from '@/lib/ape-questionnaire'

const API = '/api/dashboard/questionnaires'

const ERR: Record<string, string> = {
  signed_out: 'Your session has ended. Please sign in again.',
  no_access: 'Your login does not have access to patient questionnaires. Lorna (the practice owner) can give it to you on the Users screen.',
  admin_only: 'Only a GYA administrator can do this.',
  not_found: 'That questionnaire no longer exists.',
  not_sent: 'The welcome email could not be sent.',
  cancelled: 'That booking is cancelled.',
}
const errText = (e?: string, reason?: string) => ((e && ERR[e]) || 'Something went wrong. Please try again, or contact GYA if it keeps happening.') + (reason ? ` (${reason})` : '')

async function call(method: 'GET' | 'POST', body?: unknown, query = ''): Promise<any> {
  const res = await fetch(API + query, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const j = await res.json().catch(() => ({ ok: false, error: 'server_error' }))
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error(ERR.signed_out) }
  if (!res.ok || !j.ok) throw new Error(errText(j.error, j.reason))
  return j
}

type ListData = { ok: boolean; access: boolean; switches: { welcome: boolean; online: boolean; blockers: string[] }; toReview: number; rows: ListRow[]; tests: ListRow[] | null }

function StatusNotices({ data, admin }: { data: ListData; admin: boolean }) {
  if (data.switches.online) return null
  return <Notice tone="info" icon={Icon.info()}><p><b>The online questionnaire is switched off.</b> {data.switches.welcome ? 'Welcome emails carry the questionnaire as a PDF to bring along.' : 'Welcome emails are off too.'} It goes on once Lorna has approved the collection notice and the privacy wording and GYA has set the encryption key.{admin ? <> Still needed: {data.switches.blockers.join('; ')}. See <Link href="/admin/settings/welcome-pack">Welcome pack</Link>.</> : null}</p></Notice>
}

// ================================================================ the list
export function QuestionnairesScreen({ role }: { role: string }) {
  const [data, setData] = useState<ListData | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'toreview' | 'all' | 'waiting' | 'tests'>('toreview')
  // v1.14.0: the test notice email links to ?show=tests
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get('show') === 'tests') setFilter('tests') } catch { /* no address bar */ } }, [])
  const load = useCallback(async () => { try { setData(await call('GET')); setError('') } catch (e) { setError((e as Error).message) } }, [])
  useEffect(() => { void load() }, [load])
  const rows = useMemo(() => (filter === 'tests' ? data?.tests || [] : data?.rows || []).filter((r) => {
    const ok = filter === 'all' || filter === 'tests' ? true : filter === 'waiting' ? r.status !== 'submitted' : r.status === 'submitted' && !r.reviewed
    return ok && (!q || `${r.patientName} ${r.bookingRef}`.toLowerCase().includes(q.toLowerCase()))
  }), [data, filter, q])
  if (!data) return <div className="panel"><p className="empty">{error || 'Loading...'}</p></div>
  const submitted = data.rows.filter((r) => r.status === 'submitted')
  const admin = role === 'admin'
  return (
    <>
      <StatusNotices data={data} admin={admin} />
      {!data.access && !data.tests ? (
        <Notice tone="info" icon={Icon.info()}><p><b>Your login does not include access to patient questionnaires.</b> Only people ticked on the Users screen can open them; having a login is not enough. Lorna, as the practice owner, ticks who has access.</p></Notice>
      ) : (
        <>
          <div className="stat-row" style={{ marginBottom: 18 }}>
            <div className="stat"><b>{data.toReview}</b><span>To review</span></div>
            <div className="stat"><b>{submitted.length}</b><span>Received</span></div>
            <div className="stat"><b>{data.rows.length - submitted.length}</b><span>Sent, not yet received</span></div>
          </div>
          <div className="panel">
            <div className="actions" style={{ marginBottom: 12 }}>
              <div className="tabs bookings-filters" style={{ margin: 0, border: 0 }} role="tablist" aria-label="Which questionnaires">
                {([['toreview', 'To review'], ['all', 'All received and sent'], ['waiting', 'Not yet received'], ...(data.tests ? [['tests', `Tests (${data.tests.length})`]] : [])] as [typeof filter, string][]).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
                ))}
              </div>
              <span style={{ flex: 1 }} />
              <input className="input search" aria-label="Search by name or reference" placeholder="Search by name or reference" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Reference</th><th>Patient</th><th>Appointment</th><th>Submitted</th><th>Reviewed</th><th><span className="sr-only">Open</span></th></tr></thead>
                <tbody>
                  {!rows.length ? <tr><td colSpan={6} className="empty">{filter === 'toreview' ? 'Nothing to review.' : 'Nothing to show.'}</td></tr> : null}
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.bookingRef}</b>{r.test ? <><br /><span className="chip test-chip">TEST {r.testEmail}</span></> : null}</td>
                      <td>{r.patientName || <span className="muted">(name not recorded)</span>}{r.identityDiffers ? <><br /><span className="chip warn" title="The name or date of birth on the questionnaire is not the one on the booking">Name or DOB differs from the booking</span></> : null}</td>
                      <td>{r.appointmentAt ? when(r.appointmentAt) : ''}</td>
                      <td>{r.status === 'submitted' ? when(r.submittedAt || '') : <span className="chip grey">Not yet{r.draftSavedAt ? ', started' : ''}{r.sentAt ? `, link sent ${when(r.sentAt)}` : ''}</span>}</td>
                      <td>{r.status !== 'submitted' ? <span className="muted">-</span> : r.reviewed ? <span className="chip good" title={`${r.reviewedBy} ${r.reviewedAt ? when(r.reviewedAt) : ''}`}>{Icon.check()} Reviewed</span> : <span className="chip warn">To review</span>}</td>
                      <td className="row-actions">{r.status === 'submitted' ? <Link className="btn small primary" href={`/admin/questionnaires/${r.id}`}>Open</Link> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <div className="panel">
        <h2>How it works</h2>
        <ol className="steps-help">
          <li>When a booking is confirmed (or received, depending on Welcome pack settings), the patient is emailed Lorna&apos;s Patient Guide and questionnaire, with a private link to fill it in online. They can save and come back; the link works until they send it, or a week after the appointment.</li>
          <li>When they send it, the people under Welcome pack, Questionnaire received emails, get an email with the reference and appointment date. Never the answers.</li>
          <li>Open the questionnaire here, read it, then tick Reviewed. Print or Save as PDF if the clinical record needs a copy.</li>
        </ol>
        <p className="help" style={{ margin: 0 }}>Answers are encrypted and stored in Australia. Records are kept for at least 7 years after the appointment. Only GYA can delete one, and every view is logged.</p>
      </div>
    </>
  )
}

// ================================================================ one questionnaire
const show = (v: string | string[] | null | undefined) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) ? <span className="muted">No answer</span> : Array.isArray(v) ? <ul className="q-answer-list">{v.map((x) => <li key={x}>{x}</li>)}</ul> : <span style={{ whiteSpace: 'pre-wrap' }}>{String(v)}</span>

const dobLong = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }) : '')

/** v1.10.0: the name and date of birth the patient entered, with the booking's beside them when they differ. */
function Identity({ a, booking, differs }: { a: Opened['answers']; booking?: { name: string; dob: string | null } | null; differs: boolean }) {
  const rows = identityRows(a)
  return (
    <div className="q-identity">
      {differs ? <p className="q-differs" role="note"><span aria-hidden="true">!</span> <b>Name or DOB differs from the booking.</b> Please check with the patient before entering it in Core Practice.</p> : null}
      <dl>
        {rows.map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.value || <span className="muted">Not given</span>}</dd></div>)}
        {booking && differs ? <div className="q-booking"><dt>On the booking</dt><dd>{booking.name}{booking.dob ? `, ${dobLong(booking.dob)}` : ', no date of birth (booked before v1.10.0)'}</dd></div> : null}
      </dl>
    </div>
  )
}

function Glance({ a, booking, differs }: { a: Opened['answers']; booking?: { name: string; dob: string | null } | null; differs: boolean }) {
  const g = glance(a)
  return (
    <div className="panel">
      <h2>At a glance</h2>
      <Identity a={a} booking={booking} differs={differs} />
      <div className="glance">
        <div className="score"><b>{g.score ?? '-'}</b><span>{g.score ? 'anxiety out of 10' : 'no score given'}</span></div>
        <div><h3>What makes them anxious</h3>{g.anxious.length ? <ul>{g.anxious.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">Nothing ticked</p>}</div>
        <div><h3>How they would like it to feel</h3>{g.prefs.some((p) => p.picked.length) ? g.prefs.filter((p) => p.picked.length).map((p) => <div key={p.heading}><b>{p.heading}</b><ul>{p.picked.map((x) => <li key={x}>{x}</li>)}</ul></div>) : <p className="muted">Nothing ticked</p>}</div>
      </div>
    </div>
  )
}

export function QuestionnaireView({ id, role }: { id: string; role: string }) {
  const toast = useToast()
  const [data, setData] = useState<Opened | null>(null)
  const [error, setError] = useState('')
  const [askDelete, setAskDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { setData(await call('GET', undefined, `?id=${encodeURIComponent(id)}`)); setError('') } catch (e) { setError((e as Error).message) } }, [id])
  useEffect(() => { void load() }, [load])
  if (error) return <Notice tone="warn" icon={Icon.warn()}><p>{error}</p></Notice>
  if (!data) return <div className="panel"><p className="empty">Loading...</p></div>
  const r = data.row
  async function reviewed(v: boolean) {
    setBusy(true)
    try { await call('POST', { action: 'reviewed', id, reviewed: v }); toast(v ? 'Marked as reviewed.' : 'Marked as not reviewed.', 'good'); await load() } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function print() {
    try { await call('POST', { action: 'printed', id }) } catch { /* the log must never stop a print */ }
    window.print()
  }
  async function remove() {
    setBusy(true)
    try { await call('POST', { action: 'delete', id, confirm: confirmText }); toast('Questionnaire deleted.', 'good'); window.location.href = '/admin/questionnaires' } catch (e) { toast((e as Error).message, 'bad'); setBusy(false) }
  }
  const submitted = r.status === 'submitted'
  return (
    <>
      <div className="panel q-print-head">
        <div className="panel-head">
          <div className="grow">
            <h2 style={{ margin: 0 }}>{r.patientName || 'Patient'} <span className="muted">{r.bookingRef}</span>{r.test ? <> <span className="chip test-chip">TEST</span></> : null}</h2>
            <p className="help" style={{ margin: '4px 0 0' }}>Appointment {r.appointmentAt ? when(r.appointmentAt) : ''}. {submitted ? `Sent ${r.submittedAt ? when(r.submittedAt) : ''}.` : 'Not sent yet.'}{r.reviewed ? ` Reviewed by ${r.reviewedBy}${r.reviewedAt ? ` ${when(r.reviewedAt)}` : ''}.` : ''}</p>
          </div>
          <div className="actions no-print">
            <Link className="btn" href="/admin/questionnaires">Back to the list</Link>
            {submitted ? <button className="btn" onClick={print}>{Icon.download()} Print / Save as PDF</button> : null}
            {submitted ? (r.reviewed ? <button className="btn" disabled={busy} onClick={() => reviewed(false)}>Undo reviewed</button> : <button className="btn primary" disabled={busy} onClick={() => reviewed(true)}>{Icon.check()} Mark reviewed</button>) : null}
            {role === 'admin' ? <button className="btn danger" disabled={busy} onClick={() => setAskDelete(true)}>Delete</button> : null}
          </div>
        </div>
      </div>
      {!submitted ? <div className="panel"><p className="empty">The patient has not sent this questionnaire yet. Answers saved to finish later stay private until they press Send.</p></div> : data.legacy ? (
        <div className="panel q-print">
          <h1 className="q-print-title">{data.legacy.title}</h1>
          {data.legacy.questions.map((sec) => (
            <section key={sec.id} className="q-print-section"><h2>{sec.heading}</h2>
              <dl className="q-answers">{sec.questions.filter((qq) => qq.type !== 'note').map((qq) => <div key={qq.id} className="q-answer"><dt>{qq.label}</dt><dd>{show(data.answers[qq.id])}</dd></div>)}</dl>
            </section>
          ))}
        </div>
      ) : (
        <>
          <Glance a={data.answers} booking={data.booking} differs={!!r.identityDiffers} />
          <div className="panel q-print">
            <h1 className="q-print-title">Pre-appointment Questionnaire</h1>
            <section className="qa-q q-print-identity"><h3>Your details</h3><Identity a={data.answers} booking={data.booking} differs={!!r.identityDiffers} /></section>
            {answerRows(data.answers).map((qq) => (
              <section key={qq.num} className="qa-q">
                <h3><span className="num">{qq.num}</span>{qq.title}{qq.optional ? <span className="muted"> (optional)</span> : null}</h3>
                <dl>{qq.items.map((it, n) => <div key={n}>{it.label ? <dt>{it.label}</dt> : null}<dd>{show(it.value)}</dd></div>)}</dl>
              </section>
            ))}
            <p className="help no-print" style={{ margin: '14px 0 0' }}>This view was recorded in the access log. Kept until {r.retainUntil ? new Date(r.retainUntil).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'the retention date is set'}.{data.form ? ` Form version ${data.form}.` : ''}</p>
          </div>
        </>
      )}
      {askDelete ? (
        <Modal title="Delete this questionnaire?" onClose={() => setAskDelete(false)} narrow footer={<>
          <button className="btn" onClick={() => setAskDelete(false)}>Keep it</button>
          <button className="btn danger" disabled={busy || confirmText !== 'DELETE'} onClick={remove}>Delete permanently</button>
        </>}>
          {r.test ? <p>This is a test questionnaire. It would be deleted automatically 24 hours after it was made.</p> : <p>This removes <b>{r.patientName || r.bookingRef}</b>&apos;s answers for good. Health records must normally be kept for 7 years after the last appointment (or until age 25 for a child), so only do this if the practice has decided to, for example at the patient&apos;s request after the retention period.</p>}
          <TextInput label='Type DELETE to confirm' value={confirmText} onChange={setConfirmText} />
        </Modal>
      ) : null}
    </>
  )
}

// ================================================================ the access log (GYA)
export function QuestionnaireLogScreen() {
  const [rows, setRows] = useState<Record<string, any>[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { call('GET', undefined, '?log=1').then((j) => setRows(j.log)).catch((e) => setError((e as Error).message)) }, [])
  if (error) return <Notice tone="warn" icon={Icon.warn()}><p>{error}</p></Notice>
  if (!rows) return <div className="panel"><p className="empty">Loading...</p></div>
  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Reference</th><th>Questionnaire</th><th>Note</th></tr></thead>
          <tbody>
            {!rows.length ? <tr><td colSpan={6} className="empty">Nothing yet.</td></tr> : null}
            {rows.map((r) => <tr key={String(r.id)}><td>{when(String(r.at))}</td><td>{String(r.userEmail)}</td><td><span className={`chip ${r.action === 'denied' ? 'warn' : r.action === 'deleted' ? 'grey' : 'blue'}`}>{String(r.action)}</span></td><td>{String(r.bookingRef || '')}</td><td className="muted">{String(r.questionnaire || '')}</td><td className="muted">{String(r.note || '')}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
