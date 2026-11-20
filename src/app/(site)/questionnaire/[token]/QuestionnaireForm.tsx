'use client'
/**
 * Lorna's Pre-appointment Questionnaire on screen (v1.9.0): her intro, every question, helper line and shaded note in
 * her order and words. Nothing is required. "Save and finish later" keeps the answers (encrypted) for the same
 * private link; "Send my answers" sends them to the APE team. No analytics, nothing in the URL, nothing in storage.
 * v1.10.0: "Your details" at the top: full name and date of birth, filled in from the booking, needed to send (a draft
 * saves without them). They are sealed with the answers.
 */
import React, { useEffect, useRef, useState } from 'react'
import { FORM, QUESTIONS, ID, IDENTITY, optionsOf, type Answers, type Field, type Question } from '@/lib/ape-questionnaire'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const splitDob = (v: unknown) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')); return m ? { d: String(Number(m[3])), m: String(Number(m[2])), y: m[1] } : { d: '', m: '', y: '' } }
function dobCheck(p: { d: string; m: string; y: string }): string {
  if (!p.d && !p.m && !p.y.trim()) return 'Please enter your date of birth.'
  const d = Number(p.d), m = Number(p.m), y = Number(p.y)
  if (!d || !m || !/^\d{4}$/.test(p.y.trim())) return 'Please check your date of birth: choose the day and month and type the year, for example 1985.'
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1) return 'Please check your date of birth: that date does not exist.'
  if (dt.getTime() > Date.now()) return 'Your date of birth cannot be in the future.'
  if (y < new Date().getFullYear() - 120) return 'Please check the year of your date of birth.'
  return ''
}

type Props = { token: string; initial: Answers; savedAt: string | null; notice: string; consentLabel: string; phone: string }
type Phase = 'idle' | 'saving' | 'sending' | 'done' | 'gone'

const fmtSaved = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

export function QuestionnaireForm({ token, initial, savedAt, notice, consentLabel, phone }: Props) {
  const [a, setA] = useState<Answers>(initial)
  const [consent, setConsent] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState(savedAt ? `Your saved answers from ${fmtSaved(savedAt)} are filled in below.` : '')
  const [error, setError] = useState('')
  const [consentErr, setConsentErr] = useState('')
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [dob, setDob] = useState(() => splitDob(initial[ID.dob]))
  const setDobPart = (k: 'd' | 'm' | 'y', v: string) => {
    const next = { ...dob, [k]: v }
    setDob(next)
    const ok = next.d && next.m && /^\d{4}$/.test(next.y.trim())
    set(ID.dob, ok ? `${next.y.trim()}-${String(next.m).padStart(2, '0')}-${String(next.d).padStart(2, '0')}` : undefined)
  }
  const dirty = useRef(false)
  const top = useRef<HTMLDivElement>(null)

  // once sent, bring the thank-you into view and move focus to it (screen readers announce it)
  useEffect(() => { if (phase === 'done' && top.current) { top.current.scrollIntoView({ block: 'center' }); top.current.focus({ preventScroll: true }) } }, [phase])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const set = (id: string, v: string | string[] | undefined) => {
    dirty.current = true
    setA((cur) => { const n = { ...cur }; if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete n[id]; else n[id] = v; return n })
  }
  const toggle = (id: string, opt: string) => {
    const cur = Array.isArray(a[id]) ? (a[id] as string[]) : []
    set(id, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt])
  }

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { r, j: await r.json().catch(() => ({})) as Record<string, any> }
  }

  async function save() {
    setError(''); setPhase('saving')
    try {
      const { r, j } = await post('/api/questionnaire/save', { token, answers: a })
      if (r.ok && j.ok) {
        dirty.current = false
        window.dispatchEvent(new Event('ape-q-saved'))
        setStatus(`Saved ${fmtSaved(j.savedAt)}. You can close this page and come back any time before your appointment using the link in your email.`)
        setPhase('idle'); return
      }
      if (j.state === 'busy') throw new Error('busy')
      if (j.state && !['error', 'no_key'].includes(j.state)) { setPhase('gone'); return }
      throw new Error('failed')
    } catch (e) {
      setPhase('idle')
      setError((e as Error).message === 'busy' ? 'You have saved a lot in a short time. Please wait a few minutes and try again.' : 'Sorry, your answers could not be saved just now. Nothing on this page has been lost, so please try again in a moment.')
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // v1.10.0: name and date of birth first
    const idProblems: Record<string, string> = {}
    if (!String(a[ID.name] || '').trim()) idProblems[ID.name] = 'Please enter your full name.'
    const dobErr = dobCheck(dob)
    if (dobErr) idProblems[ID.dob] = dobErr
    if (Object.keys(idProblems).length) {
      setProblems(idProblems)
      const first = document.getElementById(idProblems[ID.name] ? 'q-name' : 'q-dob-day')
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' }); first?.focus({ preventScroll: true })
      return
    }
    setProblems({})
    if (!consent) { setConsentErr('Please tick this box so we can use your answers.'); document.getElementById('q-consent')?.focus(); return }
    setConsentErr(''); setPhase('sending')
    try {
      const { r, j } = await post('/api/questionnaire/submit', { token, answers: a, consent: true })
      if (r.ok && j.ok) { dirty.current = false; setPhase('done'); window.dispatchEvent(new Event('ape-q-done')); return }
      if (j.state === 'invalid_answers' && j.problems) {
        setProblems(j.problems); setPhase('idle')
        const k = Object.keys(j.problems)[0]
        document.getElementById(k === ID.name || k === ID.dob ? 'f-identity' : `f-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      if (j.state === 'busy') throw new Error('busy')
      if (j.state && !['error', 'no_key', 'consent'].includes(j.state)) { setPhase('gone'); return }
      throw new Error('failed')
    } catch (err) {
      setPhase('idle')
      setError((err as Error).message === 'busy' ? 'Please wait a few minutes and try again.' : 'Sorry, your answers could not be sent just now. Nothing on this page has been lost, so please try again in a moment, or press Save and finish later.')
    }
  }

  if (phase === 'done') {
    return (
      <div className="qn-thanks" ref={top} tabIndex={-1} role="status">
        <h2>{FORM.thanksHeading}</h2>
        {FORM.thanks.map((p) => <p key={p}>{p}</p>)}
        <p className="qn-small">Your answers have reached the APE team. If anything changes, just reply to your booking email or call {phone}.</p>
      </div>
    )
  }
  if (phase === 'gone') {
    return (
      <div className="qn-thanks" role="status">
        <h2>This link is no longer active.</h2>
        <p>It may have been replaced by a newer link, or your answers have already been sent. Please reply to your booking email or call {phone} and we will help.</p>
      </div>
    )
  }

  const busy = phase === 'saving' || phase === 'sending'
  return (
    <form className="qn-form" onSubmit={send} noValidate>
      <section className="qn-card qn-identity" id="f-identity" aria-labelledby="t-identity">
        <div className="qn-head"><div>
          <h2 className="qn-title" id="t-identity">{IDENTITY.heading}</h2>
          <p className="qn-helper">{IDENTITY.lead}</p>
        </div></div>
        <div className="qn-field">
          <label className="qn-label" htmlFor="q-name">{IDENTITY.name} <span className="qn-req">(needed to send)</span></label>
          <input id="q-name" className="qn-input" type="text" autoComplete="name" maxLength={120} value={String(a[ID.name] ?? '')} onChange={(e) => set(ID.name, e.target.value)}
            aria-invalid={problems[ID.name] ? true : undefined} aria-describedby={problems[ID.name] ? 'q-name-err' : undefined} />
          {problems[ID.name] ? <p className="qn-err" id="q-name-err" role="alert"><span className="sr-only">Error: </span>{problems[ID.name]}</p> : null}
        </div>
        <fieldset className="qn-field qn-dob" aria-describedby={problems[ID.dob] ? 'q-dob-err' : undefined}>
          <legend className="qn-label">{IDENTITY.dob} <span className="qn-req">(needed to send)</span></legend>
          <div className="qn-dob-parts">
            <label><span>Day</span>
              <select id="q-dob-day" className="qn-input" autoComplete="bday-day" value={dob.d} onChange={(e) => setDobPart('d', e.target.value)} aria-invalid={problems[ID.dob] ? true : undefined}>
                <option value="">Day</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
              </select></label>
            <label><span>Month</span>
              <select id="q-dob-month" className="qn-input" autoComplete="bday-month" value={dob.m} onChange={(e) => setDobPart('m', e.target.value)} aria-invalid={problems[ID.dob] ? true : undefined}>
                <option value="">Month</option>{MONTHS.map((mo, i) => <option key={mo} value={String(i + 1)}>{mo}</option>)}
              </select></label>
            <label><span>Year (4 digits)</span>
              <input id="q-dob-year" className="qn-input" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="bday-year" value={dob.y} onChange={(e) => setDobPart('y', e.target.value.replace(/\D/g, ''))} aria-invalid={problems[ID.dob] ? true : undefined} /></label>
          </div>
          {problems[ID.dob] ? <p className="qn-err" id="q-dob-err" role="alert"><span className="sr-only">Error: </span>{problems[ID.dob]}</p> : null}
        </fieldset>
      </section>
      {QUESTIONS.map((q) => <QuestionCard key={q.id} q={q} a={a} set={set} toggle={toggle} problems={problems} />)}

      <section className="qn-end" aria-labelledby="qn-notice-h">
        <h2 id="qn-notice-h" className="qn-end-h">Before you send</h2>
        <div className="qn-notice">{notice.split(/\n{2,}/).map((p) => <p key={p}>{p}</p>)}</div>
        <label className="qn-consent" htmlFor="q-consent">
          <input id="q-consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setConsentErr('') }} aria-describedby={consentErr ? 'q-consent-err' : undefined} aria-invalid={!!consentErr} />
          <span>{consentLabel}</span>
        </label>
        {consentErr ? <p id="q-consent-err" className="qn-err" role="alert">{consentErr}</p> : null}
        <div className="qn-actions">
          <button type="submit" className="btn" disabled={busy}>{phase === 'sending' ? 'Sending...' : 'Send my answers'}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={save}>{phase === 'saving' ? 'Saving...' : 'Save and finish later'}</button>
        </div>
        <p className="qn-status" role="status" aria-live="polite">{status}</p>
        {error ? <p className="qn-err" role="alert">{error}</p> : null}
        <p className="qn-small">Your name and date of birth are needed to send. Every question is optional, but we kindly request you fill out as much as possible to get the most out of your experience. Your answers are only sent when you press Send my answers.</p>
      </section>
    </form>
  )
}

function QuestionCard({ q, a, set, toggle, problems }: { q: Question; a: Answers; set: (id: string, v: string | string[] | undefined) => void; toggle: (id: string, opt: string) => void; problems: Record<string, string> }) {
  const fieldsHere = q.blocks.filter((b) => b.kind === 'field')
  const single = fieldsHere.length === 1 && fieldsHere[0].kind === 'field' && !fieldsHere[0].field.ask ? fieldsHere[0].field : null
  const titleId = `t-${q.id}`
  const helpId = q.helper ? `h-${q.id}` : undefined
  return (
    <section className="qn-card" id={`f-${q.id}`} aria-labelledby={titleId}>
      <div className="qn-head">
        <span className="qn-num" aria-hidden="true">{q.num}</span>
        <div>
          <h2 className="qn-title" id={titleId}><span className="sr-only">Question {Number(q.num)}. </span>{q.title}</h2>
          {q.optional ? <span className="qn-optional">Optional</span> : null}
          {q.helper ? <p className="qn-helper" id={helpId}>{q.helper}</p> : null}
        </div>
      </div>
      {q.blocks.map((b, i) => {
        if (b.kind !== 'field') return b.kind === 'note' ? <p key={i} className="qn-note">{b.text}</p> : b.kind === 'shaded' ? <p key={i} className="qn-shaded">{b.text}</p> : <h3 key={i} className="qn-sub">{b.text}</h3>
        return <FieldControl key={b.field.id} f={b.field} a={a} set={set} toggle={toggle} labelledBy={single === b.field ? titleId : undefined} describedBy={single === b.field ? helpId : undefined} problem={problems[b.field.id]} />
      })}
    </section>
  )
}

function Clear({ show, onClick, what }: { show: boolean; onClick: () => void; what: string }) {
  return show ? <button type="button" className="qn-clear" onClick={onClick}>Clear <span className="sr-only">the answer to {what}</span></button> : null
}

function FieldControl({ f, a, set, toggle, labelledBy, describedBy, problem }: { f: Field; a: Answers; set: (id: string, v: string | string[] | undefined) => void; toggle: (id: string, opt: string) => void; labelledBy?: string; describedBy?: string; problem?: string }) {
  const err = problem ? <p className="qn-err" role="alert">{problem}</p> : null
  const labelId = `l-${f.id}`
  const groupLabel = labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-labelledby': labelId }
  const ownLabel = labelledBy ? null : <p className="qn-label" id={labelId}>{f.label}</p>

  if (f.type === 'scale') {
    const v = String(a[f.id] ?? '')
    return (
      <div className="qn-field">
        {ownLabel}
        <div className="qn-scale" role="radiogroup" {...groupLabel} aria-describedby={[describedBy, `sc-${f.id}`].filter(Boolean).join(' ')}>
          {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
            <label key={n} className={`qn-dot${v === n ? ' on' : ''}`}>
              <input type="radio" name={f.id} value={n} checked={v === n} onChange={() => set(f.id, n)} aria-label={n === '1' ? `1, ${f.low}` : n === '10' ? `10, ${f.high}` : n} />
              <span aria-hidden="true">{n}</span>
            </label>
          ))}
        </div>
        <p className="qn-ends" id={`sc-${f.id}`}><span>1 {f.low}</span><span>10 {f.high}</span></p>
        <Clear show={!!v} onClick={() => set(f.id, undefined)} what="this question" />
        {err}
      </div>
    )
  }

  if (f.type === 'multi') {
    const picked = (a[f.id] as string[] | undefined) ?? []
    const box = (o: string) => (
      <label key={o} className={`qn-opt${picked.includes(o) ? ' on' : ''}`}>
        <input type="checkbox" checked={picked.includes(o)} onChange={() => toggle(f.id, o)} />
        <span>{o}</span>
      </label>
    )
    return (
      <div className="qn-field">
        {ownLabel}
        {f.groups ? (
          f.groups.map((g, gi) => (
            <div key={g.heading} className="qn-group" role="group" aria-labelledby={`g-${f.id}-${gi}`}>
              <h3 className="qn-sub" id={`g-${f.id}-${gi}`}>{g.heading}</h3>
              <div className="qn-opts">{g.options.map(box)}</div>
            </div>
          ))
        ) : (
          <div className="qn-opts" role="group" {...groupLabel} aria-describedby={describedBy}>{optionsOf(f).map(box)}</div>
        )}
        {f.other && picked.includes(f.other.option) ? (
          <div className="qn-follow">
            <label className="qn-label" htmlFor={f.other.id}>{f.other.label}</label>
            <input id={f.other.id} className="qn-input" type="text" maxLength={500} value={String(a[f.other.id] ?? '')} onChange={(e) => set(f.other!.id, e.target.value)} autoComplete="off" />
          </div>
        ) : null}
        {err}
      </div>
    )
  }

  if (f.type === 'yesno' || f.type === 'choice') {
    const v = String(a[f.id] ?? '')
    const yesno = f.type === 'yesno'
    return (
      <div className="qn-field">
        {ownLabel}
        <div className={`qn-opts${yesno ? ' qn-inline' : ''}`} role="radiogroup" {...groupLabel} aria-describedby={describedBy}>
          {optionsOf(f).map((o) => (
            <label key={o} className={`qn-opt${v === o ? ' on' : ''}`}>
              <input type="radio" name={f.id} value={o} checked={v === o} onChange={() => set(f.id, o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        <Clear show={!!v} onClick={() => set(f.id, undefined)} what={f.label} />
        {f.follow && v === 'Yes' ? (
          <div className="qn-follow">
            <label className="qn-label" htmlFor={f.follow.id}>{f.follow.label}</label>
            <textarea id={f.follow.id} className="qn-input" rows={3} maxLength={4000} value={String(a[f.follow.id] ?? '')} onChange={(e) => set(f.follow!.id, e.target.value)} />
          </div>
        ) : null}
        {err}
      </div>
    )
  }

  return (
    <div className="qn-field">
      {labelledBy ? null : <label className="qn-label" htmlFor={f.id}>{f.label}</label>}
      <textarea id={f.id} className="qn-input" rows={f.rows ?? 3} maxLength={4000} value={String(a[f.id] ?? '')} onChange={(e) => set(f.id, e.target.value)} aria-labelledby={labelledBy} aria-describedby={describedBy} />
      {err}
    </div>
  )
}
