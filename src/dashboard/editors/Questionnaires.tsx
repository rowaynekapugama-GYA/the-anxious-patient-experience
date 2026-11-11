'use client'
/**
 * Patient questionnaires in the dashboard (v1.7.0): the list of everyone who has submitted, one questionnaire laid
 * out like the form (with Print), the access log (GYA), and the editor for the questions, notices and emails.
 * Answers are fetched only when a questionnaire is opened, by a person with "Can view patient questionnaires".
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { Modal, Notice, TextInput, TextArea, Toggle, Field, Select } from '../ui/fields'
import { when } from '../lib/format'
import { uploadMedia } from '../lib/client'
import type { ListRow, Section, Answers } from '@/lib/questionnaire'

const API = '/api/dashboard/questionnaires'
const CONTENT_API = '/api/dashboard/questionnaire-content'

const ERR: Record<string, string> = {
  signed_out: 'Your session has ended. Please sign in again.',
  no_access: 'Your login does not have access to patient questionnaires. GYA can give it to you if Lorna has nominated you.',
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

type ListData = { ok: boolean; access: boolean; enabled: boolean; ready: boolean; problems: string[]; toReview: number; rows: ListRow[] }

function StatusNotices({ data, admin }: { data: ListData; admin: boolean }) {
  if (!data.enabled) {
    return <Notice tone="info" icon={Icon.info()}><p><b>The questionnaire and welcome email are switched off.</b> They start once Lorna has approved the questions, the collection notice and the privacy wording, and GYA switches them on. The questions can be loaded in the meantime under Questions and emails.</p></Notice>
  }
  if (!data.ready) {
    return <Notice tone="warn" icon={Icon.warn()}><p><b>Switched on, but not ready.</b> {admin ? data.problems.join('. ') + '.' : 'Please contact GYA.'}</p></Notice>
  }
  return null
}

// ================================================================ the list
export function QuestionnairesScreen({ role }: { role: string }) {
  const [data, setData] = useState<ListData | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'toreview' | 'all' | 'waiting'>('toreview')
  const load = useCallback(async () => { try { setData(await call('GET')); setError('') } catch (e) { setError((e as Error).message) } }, [])
  useEffect(() => { void load() }, [load])
  const rows = useMemo(() => (data?.rows || []).filter((r) => {
    const ok = filter === 'all' ? true : filter === 'waiting' ? r.status !== 'submitted' : r.status === 'submitted' && !r.reviewed
    return ok && (!q || `${r.patientName} ${r.bookingRef}`.toLowerCase().includes(q.toLowerCase()))
  }), [data, filter, q])
  if (!data) return <div className="panel"><p className="empty">{error || 'Loading...'}</p></div>
  const submitted = data.rows.filter((r) => r.status === 'submitted')
  const admin = role === 'admin'
  return (
    <>
      <StatusNotices data={data} admin={admin} />
      {!data.access ? (
        <Notice tone="info" icon={Icon.info()}><p><b>Your login does not include access to patient questionnaires.</b> Lorna nominates who can read them and GYA switches it on for each person. The questions themselves can still be edited under <Link href="/admin/questionnaires/content">Questions and emails</Link>.</p></Notice>
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
                {([['toreview', 'To review'], ['all', 'All received and sent'], ['waiting', 'Not yet received']] as const).map(([k, l]) => (
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
                      <td><b>{r.bookingRef}</b></td>
                      <td>{r.patientName || <span className="muted">(name not recorded)</span>}</td>
                      <td>{r.appointmentAt ? when(r.appointmentAt) : ''}</td>
                      <td>{r.status === 'submitted' ? when(r.submittedAt || '') : <span className="chip grey">Not yet{r.sentAt ? `, link sent ${when(r.sentAt)}` : ''}</span>}</td>
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
          <li>When a booking is confirmed (or received, depending on Site Settings), the patient is emailed the welcome pack and a private link to the questionnaire. The link works once, until a week after the appointment.</li>
          <li>When they submit, the people under Site Settings, Questionnaire notifications, get an email with the reference, first name and appointment date. Never the answers.</li>
          <li>Open the questionnaire here, read it, then tick Reviewed. Print or Save as PDF if the clinical record needs a copy.</li>
        </ol>
        <p className="help" style={{ margin: 0 }}>Answers are encrypted and stored in Australia. Records are kept for 7 years after the appointment (or until the patient turns 25 if they were under 18). Only GYA can delete one, and every view is logged.</p>
      </div>
    </>
  )
}

// ================================================================ one questionnaire
type Opened = { row: ListRow; answers: Answers; questions: Section[]; title: string }

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
  const show = (v: string | string[] | undefined) => v === undefined || v === '' || (Array.isArray(v) && !v.length) ? <span className="muted">No answer</span> : Array.isArray(v) ? <ul className="q-answer-list">{v.map((x) => <li key={x}>{x}</li>)}</ul> : <span style={{ whiteSpace: 'pre-wrap' }}>{String(v)}</span>
  return (
    <>
      <div className="panel q-print-head">
        <div className="panel-head">
          <div className="grow">
            <h2 style={{ margin: 0 }}>{r.patientName || 'Patient'} <span className="muted">{r.bookingRef}</span></h2>
            <p className="help" style={{ margin: '4px 0 0' }}>Appointment {r.appointmentAt ? when(r.appointmentAt) : ''}. Submitted {r.submittedAt ? when(r.submittedAt) : ''}.{r.reviewed ? ` Reviewed by ${r.reviewedBy}${r.reviewedAt ? ` ${when(r.reviewedAt)}` : ''}.` : ''}</p>
          </div>
          <div className="actions no-print">
            <Link className="btn" href="/admin/questionnaires">Back to the list</Link>
            <button className="btn" onClick={print}>{Icon.download()} Print / Save as PDF</button>
            {r.reviewed ? <button className="btn" disabled={busy} onClick={() => reviewed(false)}>Undo reviewed</button> : <button className="btn primary" disabled={busy} onClick={() => reviewed(true)}>{Icon.check()} Mark reviewed</button>}
            {role === 'admin' ? <button className="btn danger" disabled={busy} onClick={() => setAskDelete(true)}>Delete</button> : null}
          </div>
        </div>
      </div>
      <div className="panel q-print">
        <h1 className="q-print-title">{data.title}</h1>
        {data.questions.map((s) => (
          <section key={s.id} className="q-print-section">
            <h2>{s.heading}</h2>
            <dl className="q-answers">
              {s.questions.filter((qq) => qq.type !== 'note').map((qq) => (
                <div key={qq.id} className="q-answer"><dt>{qq.label}</dt><dd>{show(data.answers[qq.id])}</dd></div>
              ))}
            </dl>
          </section>
        ))}
        <p className="help no-print" style={{ margin: 0 }}>This view was recorded in the access log. Retained until {r.retainUntil ? new Date(r.retainUntil).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'the retention date is set'}.</p>
      </div>
      {askDelete ? (
        <Modal title="Delete this patient's questionnaire?" onClose={() => setAskDelete(false)} narrow footer={<>
          <button className="btn" onClick={() => setAskDelete(false)}>Keep it</button>
          <button className="btn danger" disabled={busy || confirmText !== 'DELETE'} onClick={remove}>Delete permanently</button>
        </>}>
          <p>This removes <b>{r.patientName || r.bookingRef}</b>&apos;s answers for good. Health records must normally be kept for 7 years after the last appointment (or until age 25 for a child), so only do this if the practice has decided to, for example at the patient&apos;s request after the retention period.</p>
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

// ================================================================ questions, notices and emails
type QEdit = { label: string; type: string; options: string; help: string; required: boolean }
type SEdit = { heading: string; description: string; questions: QEdit[] }
type Content = { title: string; intro: string; collectionNotice: string; consentLabel: string; thankYou: string; welcomeSubject: string; welcomeBody: string; sections: SEdit[]; welcomePack: { id: string | number; filename: string; url: string } | null }
const TYPE_OPTIONS = [
  { value: 'text', label: 'Short answer' }, { value: 'textarea', label: 'Longer answer' }, { value: 'yesno', label: 'Yes or No' }, { value: 'choice', label: 'Choose one' },
  { value: 'multi', label: 'Tick all that apply' }, { value: 'scale', label: 'Scale 1 to 10' }, { value: 'date', label: 'Date' }, { value: 'dob', label: 'Date of birth' },
  { value: 'signature', label: 'Signature (typed name)' }, { value: 'note', label: 'Heading only' },
]

export function QuestionnaireContentEditor() {
  const toast = useToast()
  const [c, setC] = useState<Content | null>(null)
  const [defaults, setDefaults] = useState<any>(null)
  const [placeholder, setPlaceholder] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch(CONTENT_API, { credentials: 'include' }).then((r) => r.json()).then((j) => { if (!j.ok) throw new Error(errText(j.error)); setC(j.saved); setDefaults(j.defaults); setPlaceholder(j.placeholder) }).catch((e) => setError((e as Error).message))
  }, [])
  if (error) return <Notice tone="warn" icon={Icon.warn()}><p>{error}</p></Notice>
  if (!c) return <div className="panel"><p className="empty">Loading...</p></div>
  const set = (k: keyof Content, v: any) => setC({ ...c, [k]: v })
  const setSection = (i: number, s: Partial<SEdit>) => set('sections', c.sections.map((x, n) => (n === i ? { ...x, ...s } : x)))
  const setQuestion = (i: number, j: number, qq: Partial<QEdit>) => setSection(i, { questions: c.sections[i].questions.map((x, n) => (n === j ? { ...x, ...qq } : x)) })
  const move = <T,>(arr: T[], from: number, to: number) => { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a }
  async function save() {
    setBusy(true)
    try {
      const r = await fetch(CONTENT_API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...c, welcomePack: c!.welcomePack ? c!.welcomePack.id : null }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(errText(j.error))
      toast('Saved. The questionnaire uses it straight away.', 'good'); setPlaceholder(!c!.sections.length)
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  function loadDefaults() {
    if (!defaults) return
    setC({ ...c!, title: defaults.title, intro: '', collectionNotice: defaults.collectionNotice, consentLabel: defaults.consentLabel, thankYou: defaults.thankYou, welcomeSubject: defaults.welcomeSubject, welcomeBody: defaults.welcomeBody, sections: defaults.sections })
  }
  return (
    <>
      {placeholder ? <Notice tone="warn" icon={Icon.warn()}><p><b>The placeholder questionnaire is showing.</b> No sections have been saved here yet, so the website uses GYA&apos;s placeholder questions. Load Lorna&apos;s original questionnaire below: same sections, same order, same wording.</p></Notice> : null}
      <div className="panel">
        <h2>Questionnaire</h2>
        <div className="grid-2">
          <TextInput label="Title" value={c.title} onChange={(v) => set('title', v)} placeholder={defaults?.title} />
          <TextInput label="Consent tick wording" value={c.consentLabel} onChange={(v) => set('consentLabel', v)} placeholder={defaults?.consentLabel} />
        </div>
        <TextArea label="Introduction" value={c.intro} onChange={(v) => set('intro', v)} rows={3} help="Shown under the title. Leave empty for none." />
        <TextArea label="Collection notice" value={c.collectionNotice} onChange={(v) => set('collectionNotice', v)} rows={5} help="Shown above the consent tick. For Lorna to approve. Leave empty to use GYA's standard wording." placeholder={defaults?.collectionNotice} />
        <TextArea label="Thank-you message" value={c.thankYou} onChange={(v) => set('thankYou', v)} rows={3} placeholder={defaults?.thankYou} />
      </div>

      {c.sections.map((s, i) => (
        <div className="panel" key={i}>
          <div className="panel-head">
            <h2 style={{ margin: 0 }}>Section {i + 1}</h2>
            <div className="actions">
              <button className="btn small" disabled={i === 0} onClick={() => set('sections', move(c.sections, i, i - 1))} aria-label="Move section up">Up</button>
              <button className="btn small" disabled={i === c.sections.length - 1} onClick={() => set('sections', move(c.sections, i, i + 1))} aria-label="Move section down">Down</button>
              <button className="btn small danger" onClick={() => set('sections', c.sections.filter((_, n) => n !== i))}>Remove section</button>
            </div>
          </div>
          <div className="grid-2">
            <TextInput label="Section heading" value={s.heading} onChange={(v) => setSection(i, { heading: v })} />
            <TextInput label="Line under the heading (optional)" value={s.description} onChange={(v) => setSection(i, { description: v })} />
          </div>
          {s.questions.map((qq, j) => (
            <div key={j} className="q-edit">
              <div className="grid-2">
                <TextInput label={`Question ${j + 1}`} value={qq.label} onChange={(v) => setQuestion(i, j, { label: v })} />
                <Select label="Answer type" value={qq.type} onChange={(v) => setQuestion(i, j, { type: v })} options={TYPE_OPTIONS} />
              </div>
              {qq.type === 'choice' || qq.type === 'multi' ? <TextArea label="Choices, one per line" value={qq.options} onChange={(v) => setQuestion(i, j, { options: v })} rows={3} /> : null}
              <div className="grid-2">
                <TextInput label="Small print under the question (optional)" value={qq.help} onChange={(v) => setQuestion(i, j, { help: v })} />
                <Field label="Required"><Toggle label="Must be answered" checked={qq.required} onChange={(v) => setQuestion(i, j, { required: v })} /></Field>
              </div>
              <div className="actions">
                <button className="btn small" disabled={j === 0} onClick={() => setSection(i, { questions: move(s.questions, j, j - 1) })}>Up</button>
                <button className="btn small" disabled={j === s.questions.length - 1} onClick={() => setSection(i, { questions: move(s.questions, j, j + 1) })}>Down</button>
                <button className="btn small danger" onClick={() => setSection(i, { questions: s.questions.filter((_, n) => n !== j) })}>Remove question</button>
              </div>
            </div>
          ))}
          <button className="btn small" onClick={() => setSection(i, { questions: [...s.questions, { label: '', type: 'text', options: '', help: '', required: false }] })}>{Icon.plus ? Icon.plus() : null} Add a question</button>
        </div>
      ))}
      <div className="panel">
        <div className="actions">
          <button className="btn" onClick={() => set('sections', [...c.sections, { heading: '', description: '', questions: [] }])}>Add a section</button>
          {!c.sections.length && defaults ? <button className="btn ghost" onClick={loadDefaults}>Start from the placeholder questions</button> : null}
        </div>
      </div>

      <div className="panel">
        <h2>Welcome email and welcome pack</h2>
        <TextInput label="Email subject" value={c.welcomeSubject} onChange={(v) => set('welcomeSubject', v)} placeholder={defaults?.welcomeSubject} />
        <TextArea label="Email wording" value={c.welcomeBody} onChange={(v) => set('welcomeBody', v)} rows={10} placeholder={defaults?.welcomeBody}
          help={<>Write {'{first}'} for the patient&apos;s first name, {'{when}'} for the appointment, {'{link}'} for the questionnaire link and {'{pack}'} for the welcome pack link. No health details in the email. For Lorna to write.</>} />
        <Field label="Welcome pack (PDF)" help={c.welcomePack ? <>Attached to every welcome email and offered as a download: <a href={c.welcomePack.url} target="_blank" rel="noopener">{c.welcomePack.filename}</a>. Choose another PDF to replace it, then Save.</> : <>No welcome pack uploaded yet, so the email carries GYA&apos;s placeholder PDF. Upload Lorna&apos;s original (PDF), then Save.</>}>
          <input type="file" accept="application/pdf" disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            if (f.type !== 'application/pdf') { toast('Please choose a PDF.', 'bad'); return }
            setBusy(true)
            try { const doc = await uploadMedia(f, 'APE welcome pack'); set('welcomePack', { id: doc.id, filename: doc.filename, url: doc.url }); toast('Uploaded. Press Save to use it.', 'good') } catch (err) { toast((err as Error).message, 'bad') } finally { setBusy(false) }
          }} />
        </Field>
      </div>
      <div className="panel"><div className="actions"><button className="btn primary" disabled={busy} onClick={save}>Save</button></div></div>
    </>
  )
}
