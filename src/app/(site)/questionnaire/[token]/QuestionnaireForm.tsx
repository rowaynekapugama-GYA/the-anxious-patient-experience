'use client'
/** The questionnaire itself: the sections and questions as loaded in the dashboard, in the website's own style. */
import React, { useState } from 'react'
import type { Section, Answers } from '@/lib/questionnaire'

type Props = { token: string; template: { sections: Section[]; collectionNotice: string; consentLabel: string; thankYou: string } }

export function QuestionnaireForm({ token, template }: Props) {
  const [answers, setAnswers] = useState<Answers>({})
  const [consent, setConsent] = useState(false)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'gone'>('idle')
  const [error, setError] = useState('')
  const set = (id: string, v: string | string[]) => setAnswers((a) => ({ ...a, [id]: v }))
  const toggle = (id: string, opt: string) => setAnswers((a) => {
    const cur = Array.isArray(a[id]) ? (a[id] as string[]) : []
    return { ...a, [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] }
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!consent) { setProblems({ consent: 'Please tick this box so we can use your answers.' }); document.getElementById('q-consent')?.focus(); return }
    setState('sending')
    try {
      const r = await fetch('/api/questionnaire/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, answers, consent: true }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.ok) { setState('done'); window.scrollTo({ top: 0 }); return }
      if (j.state === 'invalid_answers' && j.problems) {
        setProblems(j.problems); setState('idle')
        const first = Object.keys(j.problems)[0]
        document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      if (j.state && j.state !== 'ok') { setState('gone'); return }
      throw new Error('failed')
    } catch {
      setState('idle')
      setError('Sorry, your answers could not be sent just now. Nothing has been lost on this page, so please try again in a moment.')
    }
  }

  if (state === 'done') {
    return <div className="confirm" role="status"><h3>Thank you.</h3><p>{template.thankYou}</p></div>
  }
  if (state === 'gone') {
    return <div className="confirm" role="status"><h3>This link is no longer active.</h3><p>If you have already sent your questionnaire, thank you, it has reached the team. Otherwise please reply to your booking email and we will send you a fresh link.</p></div>
  }

  return (
    <form onSubmit={submit} noValidate className="q-sections">
      {template.sections.map((s) => (
        <fieldset key={s.id} className="q-section">
          <legend><h2>{s.heading}</h2></legend>
          {s.description ? <p className="q-desc">{s.description}</p> : null}
          {s.questions.map((q) => {
            const id = `q-${q.id}`
            const err = problems[q.id]
            const errId = err ? `${id}-err` : undefined
            const label = <>{q.label}{q.required ? <span className="q-req" aria-hidden="true"> *</span> : null}</>
            const help = q.help ? <span className="q-help" id={`${id}-help`}>{q.help}</span> : null
            const described = [q.help ? `${id}-help` : '', errId || ''].filter(Boolean).join(' ') || undefined
            const v = answers[q.id]
            let control: React.ReactNode = null
            if (q.type === 'note') return <h3 key={q.id} className="q-note">{q.label}</h3>
            if (q.type === 'text' || q.type === 'signature') control = <input id={id} type="text" value={String(v || '')} onChange={(e) => set(q.id, e.target.value)} aria-describedby={described} aria-invalid={!!err} autoComplete={q.type === 'signature' ? 'name' : 'off'} maxLength={300} />
            else if (q.type === 'textarea') control = <textarea id={id} value={String(v || '')} onChange={(e) => set(q.id, e.target.value)} aria-describedby={described} aria-invalid={!!err} maxLength={4000} />
            else if (q.type === 'date' || q.type === 'dob') control = <input id={id} type="date" value={String(v || '')} onChange={(e) => set(q.id, e.target.value)} aria-describedby={described} aria-invalid={!!err} autoComplete={q.type === 'dob' ? 'bday' : 'off'} />
            else if (q.type === 'yesno' || q.type === 'choice') {
              const opts = q.type === 'yesno' ? ['Yes', 'No'] : q.options
              control = <div className="q-options" role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={described}>
                {opts.map((o) => <label key={o} className="check q-opt"><input type="radio" name={q.id} checked={v === o} onChange={() => set(q.id, o)} /><span>{o}</span></label>)}
              </div>
            } else if (q.type === 'multi') {
              control = <div className="q-options" role="group" aria-labelledby={`${id}-label`} aria-describedby={described}>
                {q.options.map((o) => <label key={o} className="check q-opt"><input type="checkbox" checked={Array.isArray(v) && v.includes(o)} onChange={() => toggle(q.id, o)} /><span>{o}</span></label>)}
              </div>
            } else if (q.type === 'scale') {
              control = <div className="q-scale" role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={described}>
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => <label key={n} className={`q-scale-opt${v === n ? ' on' : ''}`}><input type="radio" name={q.id} value={n} checked={v === n} onChange={() => set(q.id, n)} /><span>{n}</span></label>)}
              </div>
            }
            const grouped = ['yesno', 'choice', 'multi', 'scale'].includes(q.type)
            return (
              <div key={q.id} className="field q-field">
                {grouped ? <span className="q-label" id={`${id}-label`}>{label}</span> : <label htmlFor={id}>{label}</label>}
                {help}
                {control}
                {err ? <div className="err" id={errId} role="alert">{err}</div> : null}
              </div>
            )
          })}
        </fieldset>
      ))}
      <div className="policy" role="region" aria-label="Collection notice">
        <p style={{ margin: 0 }}><strong>How we use your answers.</strong> {template.collectionNotice}</p>
      </div>
      <label className="check consent" htmlFor="q-consent">
        <input id="q-consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setProblems((p) => { const { consent: _c, ...rest } = p; return rest }) }} aria-invalid={!!problems.consent} aria-describedby={problems.consent ? 'q-consent-err' : undefined} />
        <span>{template.consentLabel}</span>
      </label>
      {problems.consent ? <div className="err" id="q-consent-err" role="alert">{problems.consent}</div> : null}
      {error ? <p className="err send-err" role="alert">{error}</p> : null}
      <div className="row-actions">
        <button type="submit" className="btn" disabled={state === 'sending'} aria-busy={state === 'sending'}>{state === 'sending' ? 'Sending your answers' : 'Send my questionnaire'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>Print a blank copy</button>
      </div>
      <p className="q-help" style={{ marginTop: 16 }}>Your answers are sent securely, stored in Australia and read only by the team looking after your care. You can leave any question you would rather talk about in person.</p>
    </form>
  )
}
