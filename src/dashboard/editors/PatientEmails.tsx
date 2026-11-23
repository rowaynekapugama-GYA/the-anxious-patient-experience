'use client'
/**
 * Patient emails (v1.14.0): the wording of the emails patients receive. One card per email; the editor has the
 * wording on the left and a live preview (desktop, mobile, plain text) on the right. Merge fields are chips that insert
 * where the cursor is. Saving checks the required parts and catches unknown merge fields; AHPRA words only warn.
 * Data from /api/dashboard/patient-emails.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Notice, useUnsavedWarning } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

const API = '/api/dashboard/patient-emails'
type Kind = 'booking-patient' | 'welcome' | 'deposit-patient'
type Template = {
  subject: string; preheader: string; eyebrow: string; heading: string; main: string; second: string
  buttonLabel: string; buttonTarget: string; banner: string; signoff: string; sender: string
}
type TextKey = Exclude<keyof Template, 'buttonTarget' | 'banner'>
type EmailItem = {
  kind: Kind; name: string; when: string; template: Template; saved: boolean; updatedAt: string | null; updatedBy: string
  defaults: Template; fields: { key: string; help: string }[]; markers: { key: string; help: string }[]
  locked: string[]; rules: string[]; policyLine: string
  versions: { id: string; savedAt: string; savedBy: string; note: string; subject: string }[]
}
type Data = {
  ok: boolean; emails: EmailItem[]; banners: { key: string; label: string; url?: string }[]
  targets: { key: string; label: string }[]; limits: Record<TextKey, number>; emailReady: boolean; warnings?: string[]
}
type Preview = { subject: string; html: string; text: string; bytes: number; errors: string[]; warnings: string[] }

const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

class CallError extends Error { constructor(m: string, public errors: string[] = [], public warnings: string[] = []) { super(m) } }
async function call<T>(body?: unknown): Promise<T> {
  const r = await fetch(API, { method: body ? 'POST' : 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) { window.location.href = '/admin/login'; throw new CallError('Please sign in again.') }
  if (!r.ok || !j.ok) throw new CallError(j.message || 'Something went wrong. Please try again.', j.errors || [], j.warnings || [])
  return j as T
}

const same = (a: Template, b: Template) => (Object.keys(a) as (keyof Template)[]).every((k) => a[k] === b[k])

export function PatientEmails() {
  const toast = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<Kind>('booking-patient')
  const [draft, setDraft] = useState<Template | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [view, setView] = useState<'desktop' | 'mobile' | 'text'>('desktop')
  const [saveErrors, setSaveErrors] = useState<string[]>([])
  const [ask, setAsk] = useState<'reset' | 'history' | null>(null)
  const refs = useRef<Partial<Record<TextKey, HTMLInputElement | HTMLTextAreaElement | null>>>({})
  const last = useRef<TextKey>('main')

  const item = data?.emails.find((e) => e.kind === kind) ?? null
  const dirty = !!(item && draft && !same(item.template, draft))
  useUnsavedWarning(dirty)

  const take = useCallback((j: Data, k: Kind) => {
    setData(j)
    const it = j.emails.find((e) => e.kind === k)
    if (it) setDraft({ ...it.template })
    setSaveErrors([])
  }, [])

  useEffect(() => {
    const h = (typeof window !== 'undefined' ? window.location.hash.slice(1) : '') as Kind
    const k: Kind = ['booking-patient', 'welcome', 'deposit-patient'].includes(h) ? h : 'booking-patient'
    setKind(k)
    call<Data>().then((j) => take(j, k)).catch((e) => setError((e as Error).message))
  }, [take])

  // live preview, a moment after typing stops
  useEffect(() => {
    if (!draft) return
    const t = setTimeout(() => {
      call<Preview>({ action: 'preview', kind, template: draft }).then(setPreview).catch(() => { /* keep the last preview */ })
    }, 450)
    return () => clearTimeout(t)
  }, [draft, kind])

  if (error) return <Notice tone="warn" icon={Icon.warn()}><p>{error}</p></Notice>
  if (!data || !item || !draft) return <div className="panel"><p className="empty">Loading...</p></div>

  function pick(k: Kind) {
    if (k === kind) return
    if (dirty && !window.confirm('You have unsaved changes to this email. Leave them?')) return
    setKind(k)
    try { window.history.replaceState(null, '', `#${k}`) } catch { /* fine */ }
    const it = data!.emails.find((e) => e.kind === k)
    if (it) setDraft({ ...it.template })
    setPreview(null)
    setSaveErrors([])
  }
  const set = (k: keyof Template, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  /** Put text where the cursor is in the last field used. */
  function insert(token: string, field: TextKey = last.current) {
    const el = refs.current[field]
    const cur = draft![field]
    const s = el?.selectionStart ?? cur.length
    const e = el?.selectionEnd ?? cur.length
    const next = cur.slice(0, s) + token + cur.slice(e)
    set(field, next)
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(s + token.length, s + token.length) } })
  }
  /** Simple formatting buttons for the two messages. */
  function format(field: 'main' | 'second', how: 'bold' | 'italic' | 'link' | 'list') {
    const el = refs.current[field] as HTMLTextAreaElement | null
    const cur = draft![field]
    const s = el?.selectionStart ?? cur.length
    const e = el?.selectionEnd ?? cur.length
    const sel = cur.slice(s, e)
    let rep = sel
    if (how === 'bold') rep = `**${sel || 'bold words'}**`
    if (how === 'italic') rep = `*${sel || 'italic words'}*`
    if (how === 'link') rep = `[${sel || 'words to click'}](https://)`
    if (how === 'list') rep = (sel || 'First point\nSecond point').split('\n').map((l) => (l.startsWith('- ') ? l : `- ${l}`)).join('\n')
    set(field, cur.slice(0, s) + rep + cur.slice(e))
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(s, s + rep.length) } })
  }

  async function save() {
    setBusy(true)
    try {
      const j = await call<Data>({ action: 'save', kind, template: draft })
      take(j, kind)
      toast(j.warnings?.length ? `Saved. ${j.warnings[0]}` : 'Saved. The next email uses this wording.', j.warnings?.length ? 'bad' : 'good')
    } catch (e) {
      const ce = e as CallError
      setSaveErrors(ce.errors?.length ? ce.errors : [ce.message])
      toast('Not saved yet. See the message above the Save button.', 'bad')
    } finally { setBusy(false) }
  }
  async function test() {
    setBusy(true)
    try {
      const j = await call<{ to: string }>({ action: 'test', kind, template: draft })
      toast(`Test email sent to ${j.to}. Check your inbox (and junk).`, 'good')
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function reset() {
    setBusy(true)
    try { take(await call<Data>({ action: 'reset', kind }), kind); setAsk(null); toast('Back to the default wording.', 'good') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function restore(id: string) {
    setBusy(true)
    try { take(await call<Data>({ action: 'restore', kind, id }), kind); setAsk(null); toast('That version is the wording in use again.', 'good') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  const lim = data.limits
  const count = (k: TextKey) => <span className={`pe-count${draft[k].length > lim[k] ? ' over' : ''}`}>{draft[k].length}/{lim[k]}</span>
  const input = (k: TextKey, label: string, help?: React.ReactNode, placeholder?: string) => (
    <div className="field">
      <label htmlFor={`pe-${k}`}>{label} {count(k)}</label>
      <input id={`pe-${k}`} className="input" value={draft[k]} placeholder={placeholder} maxLength={lim[k] + 20}
        ref={(el) => { refs.current[k] = el }} onFocus={() => { last.current = k }} onChange={(e) => set(k, e.target.value)} />
      {help ? <div className="help">{help}</div> : null}
    </div>
  )
  const area = (k: 'main' | 'second', label: string, help: React.ReactNode) => (
    <div className="field">
      <label htmlFor={`pe-${k}`}>{label} {count(k)}</label>
      <div className="pe-toolbar" role="toolbar" aria-label={`Formatting for ${label}`}>
        <button type="button" className="btn small" onClick={() => format(k, 'bold')}><b>B</b> Bold</button>
        <button type="button" className="btn small" onClick={() => format(k, 'italic')}><i>I</i> Italic</button>
        <button type="button" className="btn small" onClick={() => format(k, 'link')}>Link</button>
        <button type="button" className="btn small" onClick={() => format(k, 'list')}>Bullet list</button>
      </div>
      <textarea id={`pe-${k}`} className="textarea pe-area" rows={k === 'main' ? 9 : 7} value={draft[k]}
        ref={(el) => { refs.current[k] = el }} onFocus={() => { last.current = k }} onChange={(e) => set(k, e.target.value)} />
      <div className="help">{help}</div>
    </div>
  )
  const errors = [...new Set([...(saveErrors.length ? saveErrors : []), ...(preview?.errors ?? [])])]
  const frameW = view === 'mobile' ? 375 : 640

  return (
    <>
      <div className="pe-cards" role="tablist" aria-label="Patient emails">
        {data.emails.map((e) => (
          <button key={e.kind} role="tab" aria-selected={e.kind === kind} className={`pe-card${e.kind === kind ? ' on' : ''}`} onClick={() => pick(e.kind)}>
            <span className="pe-card-name">{e.name}</span>
            <span className="pe-card-when">{e.when}</span>
            <span className="pe-card-meta">{e.saved ? `Edited ${when(e.updatedAt)}${e.updatedBy ? ` by ${e.updatedBy}` : ''}` : 'Default wording'}</span>
          </button>
        ))}
      </div>

      <div className="cols pe-cols">
        <div>
          <div className="panel">
            <div className="panel-head"><h2>{item.name}</h2>{dirty ? <span className="chip warn">Unsaved changes</span> : item.saved ? <span className="chip grey">Edited</span> : <span className="chip grey">Default wording</span>}</div>
            <p className="help" style={{ marginTop: -4 }}>{item.when}</p>
            <Notice tone="info" icon={Icon.info()}><p>Please keep to plain, factual wording. Avoid words like pain-free, guaranteed, best or expert (AHPRA), and never put health details in an email.</p></Notice>

            {input('subject', 'Subject', 'What the patient sees in their inbox.')}
            {input('preheader', 'Preheader', 'The short line some inboxes show after the subject.')}
            <div className="field">
              <label>Photo at the top</label>
              <div className="pe-banners">
                {data.banners.map((b) => (
                  <label key={b.key} className={`pe-banner${draft.banner === b.key ? ' on' : ''}`}>
                    <input type="radio" name="pe-banner" value={b.key} checked={draft.banner === b.key} onChange={() => set('banner', b.key)} />
                    {b.url ? <img src={b.url} alt="" /> : <span className="pe-nophoto">No photo</span>}
                    <span>{b.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {input('eyebrow', 'Eyebrow (optional)', 'The small capitals line above the heading.')}
            {input('heading', 'Heading')}
            {area('main', 'Main message', <>Blank lines make new paragraphs. A line starting with &quot;- &quot; is a bullet point.</>)}

            <div className="pe-locked">
              <p><b>Added by the website here (not editable):</b></p>
              <ul>{item.locked.map((l) => <li key={l}>{l}</li>)}</ul>
              {item.policyLine ? <p className="pe-policy"><span className="chip grey">Locked</span> {item.policyLine}</p> : null}
              {item.policyLine ? <p className="help">The deposit policy line comes from the approved policy in <a href="/admin/settings/booking-terms">Site Settings &gt; Deposit policy</a>, so the email always matches it.</p> : null}
            </div>

            {area('second', 'Second message (optional)', item.markers.length ? <>{item.markers.map((m) => <span key={m.key}><code>{`{${m.key}}`}</code> on a line of its own adds {m.help.charAt(0).toLowerCase() + m.help.slice(1)}. </span>)}</> : 'Shown after the details and the button.')}

            <div className="pe-row">
              {input('buttonLabel', 'Button label', 'Leave empty with "No button".')}
              <div className="field">
                <label htmlFor="pe-target">Button goes to</label>
                <select id="pe-target" className="select" value={draft.buttonTarget} onChange={(e) => set('buttonTarget', e.target.value)}>
                  {data.targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="pe-row">
              {input('signoff', 'Sign-off line', undefined, 'Warm regards,')}
              {input('sender', 'Sender name')}
            </div>
          </div>

          <div className="panel">
            <h2>Merge fields</h2>
            <p className="help" style={{ marginTop: -6 }}>Click one to put it where your cursor is (in the last box you clicked). It is filled in for each patient.</p>
            <div className="pe-chips">
              {item.fields.map((f) => <button key={f.key} type="button" className="pe-chip" title={f.help} onClick={() => insert(`{${f.key}}`)}>{`{${f.key}}`}</button>)}
              {item.markers.map((f) => <button key={f.key} type="button" className="pe-chip block" title={f.help} onClick={() => insert(`\n\n{${f.key}}\n\n`, last.current === 'main' ? 'main' : 'second')}>{`{${f.key}}`}</button>)}
            </div>
            <dl className="pe-fieldhelp">
              {[...item.fields, ...item.markers].map((f) => <div key={f.key}><dt><code>{`{${f.key}}`}</code></dt><dd>{f.help}</dd></div>)}
            </dl>
            <p className="help"><b>Required for this email:</b> {item.rules.join(' ')}</p>
          </div>
        </div>

        <div className="sticky">
          <div className="panel pe-preview">
            <div className="panel-head">
              <h2>Preview</h2>
              <div className="seg" role="group" aria-label="Preview size">
                {(['desktop', 'mobile', 'text'] as const).map((v) => <button key={v} className={`btn small${view === v ? ' primary' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'desktop' ? 'Desktop' : v === 'mobile' ? 'Mobile' : 'Plain text'}</button>)}
              </div>
            </div>
            <p className="help" style={{ marginTop: -6 }}>Sample details: Test Patient GYA, APE-TEST01.</p>
            {preview ? <p className="pe-subject"><b>Subject:</b> {preview.subject}</p> : null}
            <div className="pe-frame-wrap">
              {!preview ? <p className="empty">Loading the preview...</p>
                : view === 'text' ? <pre className="pe-text">{preview.text}</pre>
                : <iframe title="Email preview" className="pe-frame" style={{ width: frameW }} srcDoc={preview.html} sandbox="allow-popups" />}
            </div>
            {errors.length ? <Notice tone="bad" icon={Icon.warn()}><p><b>Please fix before saving:</b></p><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></Notice> : null}
            {preview?.warnings?.length ? <Notice tone="warn" icon={Icon.info()}>{preview.warnings.map((w) => <p key={w}>{w}</p>)}</Notice> : null}
            <div className="actions pe-actions">
              <button className="btn primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Working...' : 'Save'}</button>
              {dirty ? <button className="btn" disabled={busy} onClick={() => { setDraft({ ...item.template }); setSaveErrors([]) }}>Undo changes</button> : null}
              <button className="btn" disabled={busy || !data.emailReady} onClick={test} title={data.emailReady ? '' : 'Email is not set up yet'}>Send me a test</button>
            </div>
            <div className="actions pe-actions">
              <button className="btn small ghost" disabled={busy} onClick={() => setAsk('history')}>Version history ({item.versions.length})</button>
              <button className="btn small ghost" disabled={busy || (!item.saved && !dirty)} onClick={() => setAsk('reset')}>Reset to default</button>
            </div>
            <p className="help">Saving applies to the next email straight away; no Publish needed. &quot;Send me a test&quot; goes only to your own email address, with [TEST] in the subject.</p>
          </div>
        </div>
      </div>

      {ask === 'reset' ? (
        <Modal narrow title="Reset to the default wording?" onClose={() => setAsk(null)} footer={<>
          <button className="btn" onClick={() => setAsk(null)}>Keep my wording</button>
          <button className="btn danger" disabled={busy} onClick={reset}>Reset</button>
        </>}>
          <p>The &quot;{item.name}&quot; email goes back to the wording it had before it was edited. Your current wording stays in the version history, so you can restore it.</p>
        </Modal>
      ) : null}
      {ask === 'history' ? (
        <Modal title={`Version history: ${item.name}`} onClose={() => setAsk(null)}>
          {item.versions.length ? (
            <table className="table">
              <thead><tr><th>Saved</th><th>By</th><th>Subject</th><th /></tr></thead>
              <tbody>{item.versions.map((v, n) => (
                <tr key={v.id}>
                  <td>{when(v.savedAt)}{v.note ? <><br /><span className="muted">{v.note}</span></> : null}</td>
                  <td>{v.savedBy}</td>
                  <td>{v.subject}</td>
                  <td>{n === 0 ? <span className="muted">In use</span> : <button className="btn small" disabled={busy} onClick={() => { if (window.confirm('Use this version again? The current wording stays in the history.')) void restore(v.id) }}>Restore</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="empty">No saved versions yet. Each save is kept here (the last 10).</p>}
        </Modal>
      ) : null}
    </>
  )
}

export default PatientEmails
