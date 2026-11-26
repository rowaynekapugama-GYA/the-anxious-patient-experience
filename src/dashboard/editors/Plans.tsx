'use client'
/**
 * v1.18.0: Treatment plans in the dashboard. The list and the switches, the plan editor (draft, finalise, versions,
 * print, send, revoke), the form builder and the audit log. Every plan screen needs "Can create and view treatment
 * plans" and the feature on; the server checks both on every request (src/app/api/dashboard/plans).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useToast } from '../ui/Toast'
import { Modal, Notice, Toggle, Field, TextInput, TextArea } from '../ui/fields'
import { api } from '../lib/client'
import { FIELD_TYPES, isField, fmtMoney, rowsTotal, ESTIMATE_LINE, type Answers, type FormDef, type Item, type ItemType, type Row, type Section, type Column } from '@/plans/form'

const API = '/api/dashboard/plans'
type Condition = { key: string; ok: boolean; text: string; detail: string }
type Switches = { on: boolean; conditions: Condition[]; emergencyOff: boolean; emailReady: boolean; region: string; people: number }
type Settings = { sendMode: 'link' | 'password' | 'attachment'; linkDays: number; askDob: boolean; clinician: string; privacyLine: string }
type Me = { canPlans: boolean; canManage: boolean; canApprove: boolean; admin: boolean }
type FormInfo = { version: number; placeholder: boolean; approvedAt: string | null; approvedBy: string; createdBy: string; createdAt: string }
type SwitchData = { switches: Switches; settings: Settings; me: Me; form: FormInfo }
type Summary = { id: number; planNo: number; version: number; status: 'draft' | 'final'; bookingRef: string; patientName: string; appointmentAt: string | null; updatedAt: string; finalisedAt: string | null; versions: number; lastSentAt: string | null; liveLinks: number; retainUntil: string | null }
type Plan = {
  id: number; planNo: number; version: number; status: 'draft' | 'final'; bookingRef: string; formVersion: number; form: FormDef
  identity: { name: string; firstName: string; dob: string | null; ref: string; appointmentAt: string | null }; answers: Answers
  createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; finalisedAt: string | null; finalisedBy: string; retainUntil: string | null
  versions: { id: number; version: number; status: 'draft' | 'final'; finalisedAt: string | null; finalisedBy: string; createdAt: string; createdBy: string }[]
  links: { id: number; version: number; createdAt: string; createdBy: string; expiresAt: string; revokedAt: string | null; openedAt: string | null; openCount: number; live: boolean }[]
  sends: { at: string; by: string; to: string; method: string; version: number; ok: boolean }[]
  patientEmail: string; bookingHasDob: boolean
}

const MODE_LABEL: Record<Settings['sendMode'], string> = {
  link: 'Secure link (recommended)',
  ['password']: 'Password protected PDF attached (given by phone or SMS)',
  attachment: 'PDF attached, no password',
}
const ERR: Record<string, string> = {
  no_permission: 'Your login does not have "Can create and view treatment plans". The practice owner can tick it on the Users screen.',
  off: 'Treatment plans are switched off until everything on the Treatment plans screen is ticked.',
  final: 'This version is finalised, so it cannot be changed. Use "Change this plan" to start a new version.',
  required: 'Some required fields are still empty.',
  no_booking: 'That booking could not be found.',
  no_address: 'The booking has no email address, so the plan cannot be emailed. Print it instead, or add the address to the booking in Core Practice and contact GYA.',
  address_changed: 'The email address on the booking changed. Please check it and send again.',
  not_final: 'Only a finalised plan can be sent.',
  no_email: 'Email is not set up for the website yet.',
  admin_only: 'Only GYA administrators can delete a plan.',
}
const msg = (e: unknown) => { const m = (e as Error).message || ''; return ERR[m] || m || 'Something went wrong. Please try again.' }
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const dayOnly = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '')
const dobLabel = (iso: string | null) => { if (!iso) return 'Not on the booking'; const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }) }

async function call<T = any>(body: unknown): Promise<T> {
  const res = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await res.json().catch(() => ({ ok: false, error: 'server_error' }))
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Please sign in again.') }
  if (!res.ok || j.ok === false) throw new Error(j.message || j.error || 'server_error')
  return j as T
}
async function get<T = any>(qs: string): Promise<T> {
  const res = await fetch(`${API}?${qs}`, { credentials: 'include', cache: 'no-store' })
  const j = await res.json().catch(() => ({ ok: false, error: 'server_error' }))
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Please sign in again.') }
  if (!res.ok || j.ok === false) throw new Error(j.error || 'server_error')
  return j as T
}

/** Print the plan's PDF (the same file as the download), not the screen. */
function printPdf(id: number) {
  const url = `/api/dashboard/plans/pdf?id=${id}&print=1`
  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'
  f.src = url
  f.onload = () => {
    try { f.contentWindow?.focus(); f.contentWindow?.print() } catch { window.open(url, '_blank', 'noopener') }
    setTimeout(() => f.remove(), 60000)
  }
  document.body.appendChild(f)
}

// ================================================================ the switches (what is still missing)
export function Conditions({ data }: { data: SwitchData }) {
  const sw = data.switches
  return (
    <div className="panel">
      <div className="panel-head"><h2>Switches</h2>{sw.on ? <span className="chip good">On</span> : <span className="chip warn">Off</span>}</div>
      <p className="help" style={{ marginTop: 0 }}>Treatment plans switch on only when all four are ticked. Until then nobody can create, open or send a plan.</p>
      <ul className="list-plain plan-conds">
        {sw.conditions.map((c) => (
          <li key={c.key} data-cond={c.key} data-ok={c.ok ? '1' : '0'}>
            <span className={`chip ${c.ok ? 'good' : 'warn'}`}>{c.ok ? 'Done' : 'Still needed'}</span>
            <span className="grow"><b>{c.text}</b><br /><span className="help">{c.detail}</span></span>
          </li>
        ))}
      </ul>
      {sw.emergencyOff ? <Notice tone="bad">TREATMENT_PLANS_ENABLED is set to false in Vercel (the emergency off switch), so treatment plans stay off.</Notice> : null}
      {!sw.emailReady ? <Notice tone="warn">Email is not set up, so plans cannot be sent until it is (printing still works).</Notice> : null}
      <p className="help" style={{ margin: 0 }}>Database region: {sw.region}. Content is encrypted in the app before it is saved, on top of the database&apos;s own encryption.</p>
    </div>
  )
}

// ================================================================ settings
function SettingsPanel({ data, onSaved }: { data: SwitchData; onSaved: () => void }) {
  const toast = useToast()
  const [s, setS] = useState<Settings>(data.settings)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v })
  async function save() {
    setBusy(true)
    try { await call({ action: 'settings', ...s }); toast('Saved.', 'good'); onSaved() } catch (e) { toast(msg(e), 'bad') } finally { setBusy(false) }
  }
  return (
    <div className="panel" id="plan-settings">
      <h2>Settings</h2>
      <fieldset className="plan-modes">
        <legend className="lab">How plans are sent to patients</legend>
        {(['link', 'password', 'attachment'] as const).map((m) => (
          <label key={m} className="plan-mode"><input type="radio" name="sendMode" value={m} checked={s.sendMode === m} onChange={() => set('sendMode', m)} /> <span>{MODE_LABEL[m]}</span></label>
        ))}
        <p className="help">The email never contains anything from the plan, only that it is ready. See the guide for what each choice means if an email goes to the wrong address.</p>
      </fieldset>
      <div className="grid-2">
        <Field label="Secure link works for (days)" htmlFor="pl-days" help="From 1 to 60. After that the patient asks for a new link."><input id="pl-days" className="input" type="number" min={1} max={60} value={s.linkDays} onChange={(e) => set('linkDays', Number(e.target.value))} /></Field>
        <TextInput label="Clinician on the plan" value={s.clinician} onChange={(v) => set('clinician', v)} maxLength={80} />
      </div>
      <Toggle label="Ask for the patient's date of birth before the link opens the plan" checked={s.askDob} onChange={(v) => set('askDob', v)} help="Only for bookings that have a date of birth. Five wrong tries cancel the link." />
      <TextArea label="Privacy line in the patient email (optional)" value={s.privacyLine} onChange={(v) => set('privacyLine', v)} rows={2} help="Only once Lorna has approved the wording. Blank: no line." />
      <div className="actions"><button className="btn primary" disabled={busy} onClick={save}>Save settings</button></div>
    </div>
  )
}

// ================================================================ the list
export function PlansScreen() {
  const toast = useToast()
  const [data, setData] = useState<SwitchData | null>(null)
  const [plans, setPlans] = useState<Summary[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [bookings, setBookings] = useState<{ ref: string; name: string; start: string; status: string }[] | null>(null)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      const d = await get<SwitchData>('switches=1')
      setData(d)
      if (d.switches.on && d.me.canPlans) setPlans((await get<{ plans: Summary[] }>('')).plans)
    } catch (e) { setErr(msg(e)) }
  }, [])
  useEffect(() => { void load() }, [load])
  async function openNew() {
    try {
      const j = await api<{ bookings: { ref: string; name: string; start: string; status: string }[] }>('/api/dashboard/bookings')
      setBookings(j.bookings.filter((b) => b.status !== 'cancelled').sort((a, b) => (a.start < b.start ? 1 : -1)))
    } catch (e) { toast(msg(e), 'bad') }
  }
  async function create() {
    if (!pick) return
    setBusy(true)
    try { const r = await call<{ id: number }>({ action: 'create', ref: pick }); window.location.href = `/admin/plans/${r.id}` } catch (e) { toast(msg(e), 'bad'); setBusy(false) }
  }
  if (!data) return <div className="panel"><p className="empty">{err || 'Loading...'}</p></div>
  const shown = (plans || []).filter((p) => !q || `${p.patientName} ${p.bookingRef}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <Conditions data={data} />
      {data.switches.on && data.me.canPlans ? (
        <div className="panel">
          <div className="panel-head"><h2>Plans</h2><button className="btn primary" onClick={openNew} data-new-plan>New plan from a booking</button></div>
          <input className="input search" aria-label="Search plans" placeholder="Search by patient or booking reference" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
          {!shown.length ? <p className="empty">{plans?.length ? 'No plans match.' : 'No plans yet. Open a booking under Bookings, or use New plan from a booking.'}</p> : (
            <div className="table-wrap"><table className="table plan-table">
              <thead><tr><th>Patient</th><th>Booking</th><th>Version</th><th>Status</th><th>Updated</th><th>Sent</th></tr></thead>
              <tbody>{shown.map((p) => (
                <tr key={p.planNo}>
                  <td><Link href={`/admin/plans/${p.id}`}><b>{p.patientName}</b></Link></td>
                  <td>{p.bookingRef}<br /><span className="help">{dayOnly(p.appointmentAt)}</span></td>
                  <td>{p.version}{p.versions > 1 ? <span className="help"> of {p.versions}</span> : null}</td>
                  <td>{p.status === 'final' ? <span className="chip good">Finalised</span> : <span className="chip warn">Draft</span>}</td>
                  <td>{when(p.updatedAt)}</td>
                  <td>{p.lastSentAt ? when(p.lastSentAt) : <span className="help">Not sent</span>}{p.liveLinks ? <><br /><span className="chip blue">Link live</span></> : null}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      ) : data.switches.on ? <Notice tone="info">Your login does not have &quot;Can create and view treatment plans&quot;. The practice owner can tick it on the Users screen.</Notice> : null}
      {data.me.canManage ? <SettingsPanel data={data} onSaved={load} /> : null}
      {bookings ? (
        <Modal title="New plan from a booking" onClose={() => setBookings(null)} narrow footer={<>
          <button className="btn" onClick={() => setBookings(null)}>Cancel</button>
          <button className="btn primary" disabled={!pick || busy} onClick={create}>Create plan</button>
        </>}>
          <p>The patient&apos;s name, date of birth and booking reference come from the booking.</p>
          <Field label="Booking" htmlFor="pl-book"><select id="pl-book" className="select" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose a booking</option>
            {bookings.map((b) => <option key={b.ref} value={b.ref}>{b.name}, {dayOnly(b.start)} ({b.ref})</option>)}
          </select></Field>
        </Modal>
      ) : null}
    </>
  )
}

// ================================================================ one field in the editor
function FieldInput({ it, value, onChange, locked }: { it: Item; value: Answers[string] | undefined; onChange: (v: Answers[string] | undefined) => void; locked: boolean }) {
  const id = `pf-${it.id}`
  const label = <>{it.label}{it.required ? <span className="req" aria-hidden="true"> *</span> : <span className="help inline">Optional</span>}</>
  const help = it.help ? <div className="help">{it.help}</div> : null
  const str = typeof value === 'string' ? value : ''
  switch (it.type) {
    case 'text': case 'number': case 'currency': case 'date':
      return <div className="field plan-field"><label htmlFor={id}>{label}</label>
        <div className={it.type === 'currency' ? 'plan-money' : ''}>{it.type === 'currency' ? <span aria-hidden="true">$</span> : null}
          <input id={id} className="input" disabled={locked} type={it.type === 'date' ? 'date' : 'text'} inputMode={it.type === 'number' || it.type === 'currency' ? 'decimal' : undefined}
            value={str} onChange={(e) => onChange(e.target.value)} required={it.required} /></div>{help}</div>
    case 'textarea':
      return <div className="field plan-field"><label htmlFor={id}>{label}</label><textarea id={id} className="textarea" rows={4} disabled={locked} value={str} onChange={(e) => onChange(e.target.value)} />{help}</div>
    case 'checkbox':
      return <div className="field plan-field"><label className="plan-tick"><input type="checkbox" disabled={locked} checked={value === true} onChange={(e) => onChange(e.target.checked || undefined)} /> {it.label}</label>{help}</div>
    case 'choice': {
      const opts = it.options || []
      if (it.multiple) {
        const cur = Array.isArray(value) ? value as string[] : []
        return <fieldset className="field plan-field"><legend className="lab">{label}</legend>{opts.map((o) => (
          <label key={o} className="plan-tick"><input type="checkbox" disabled={locked} checked={cur.includes(o)} onChange={(e) => onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} /> {o}</label>
        ))}{help}</fieldset>
      }
      return <div className="field plan-field"><label htmlFor={id}>{label}</label><select id={id} className="select" disabled={locked} value={str} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Choose</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>{help}</div>
    }
    case 'rows': {
      const rows = Array.isArray(value) ? value as Row[] : []
      const cols = it.columns || []
      const setRow = (n: number, c: Column, v: string) => onChange(rows.map((r, i) => (i === n ? { ...r, [c.id]: v } : r)))
      const total = rowsTotal(it, rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v).replace(/[$,\s]/g, '')]))))
      return <fieldset className="field plan-field plan-rows"><legend className="lab">{label}</legend>{help}
        {rows.map((r, n) => (
          <div className="plan-row" key={n} data-row={n}>
            {cols.map((c) => (
              <label key={c.id} className={`plan-cell t-${c.type}`}><span>{c.label}</span>
                <input className="input" disabled={locked} inputMode={c.type === 'text' ? undefined : 'decimal'} value={r[c.id] || ''} onChange={(e) => setRow(n, c, e.target.value)} />
              </label>
            ))}
            {!locked ? <button type="button" className="btn ghost small" aria-label={`Remove row ${n + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== n))}>Remove</button> : null}
          </div>
        ))}
        {!locked ? <button type="button" className="btn small" onClick={() => onChange([...rows, {}])}>Add a row</button> : null}
        {total !== null ? <p className="plan-total"><b>Estimated total: {fmtMoney(total)}</b><br /><span className="help">{ESTIMATE_LINE} The website never fills in or suggests a fee.</span></p> : null}
      </fieldset>
    }
    default: return null
  }
}

// ================================================================ the plan editor
export function PlanEditor({ id }: { id: number }) {
  const toast = useToast()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [admin, setAdmin] = useState(false)
  const [answers, setAnswers] = useState<Answers>({})
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
  const [savedAt, setSavedAt] = useState('')
  const [ask, setAsk] = useState<null | 'finalise' | 'send' | 'revoke' | 'version' | 'delete'>(null)
  const [password, setPassword] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<Answers>({})

  const load = useCallback(async () => {
    try {
      const j = await get<{ plan: Plan; settings: Settings }>(`id=${id}`)
      setPlan(j.plan); setSettings(j.settings); setAnswers(j.plan.answers); latest.current = j.plan.answers; setSavedAt(j.plan.updatedAt)
      const s = await get<SwitchData>('switches=1'); setAdmin(s.me.admin)
    } catch (e) { setErr(msg(e)) }
  }, [id])
  useEffect(() => { void load() }, [load])

  const save = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setSaving('saving')
    try { const r = await call<{ updatedAt: string }>({ action: 'save', id, answers: latest.current }); setSavedAt(r.updatedAt); setSaving('saved') } catch (e) { setSaving('dirty'); toast(msg(e), 'bad') }
  }, [id, toast])
  // the draft saves itself a couple of seconds after typing stops, and before the page is left
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (saving === 'dirty' || saving === 'saving') { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [saving])
  const change = (k: string, v: Answers[string] | undefined) => {
    const next = { ...latest.current }
    if (v === undefined || v === '') delete next[k]; else next[k] = v
    latest.current = next; setAnswers(next); setSaving('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void save() }, 2000)
  }

  async function act(kind: NonNullable<typeof ask>) {
    if (!plan) return
    setBusy(true)
    try {
      if (kind === 'finalise') { if (saving !== 'saved' && saving !== 'idle') await save(); await call({ action: 'finalise', id: plan.id }); toast('Finalised. It can now be printed or sent.', 'good'); setAsk(null); await load() }
      if (kind === 'version') { const r = await call<{ id: number }>({ action: 'version', id: plan.id }); window.location.href = `/admin/plans/${r.id}` }
      if (kind === 'revoke') { const r = await call<{ revoked: number }>({ action: 'revoke', planNo: plan.planNo }); toast(r.revoked ? 'The link no longer works.' : 'There was no live link to revoke.', 'good'); setAsk(null); await load() }
      if (kind === 'send') {
        const r = await call<{ ok: boolean; to: string; password?: string; expiresAt?: string }>({ action: 'send', planNo: plan.planNo, to: plan.patientEmail, confirm: true })
        toast(`Sent to ${r.to}.`, 'good'); setAsk(null)
        if (r.password) setPassword(r.password)
        await load()
      }
      if (kind === 'delete') { await call({ action: 'delete', planNo: plan.planNo, confirm: typed }); window.location.href = '/admin/plans' }
    } catch (e) { toast(msg(e), 'bad') } finally { setBusy(false) }
  }

  if (!plan || !settings) return <div className="panel"><p className="empty">{err || 'Loading...'}</p></div>
  const locked = plan.status !== 'draft'
  const latestVersion = Math.max(...plan.versions.map((v) => v.version))
  const latestFinal = plan.versions.filter((v) => v.status === 'final').sort((a, b) => b.version - a.version)[0]
  const isLatest = plan.version === latestVersion
  const liveLinks = plan.links.filter((l) => l.live)
  return (
    <>
      <div className="panel plan-head">
        <div className="plan-who">
          <h2>{plan.identity.name}</h2>
          <dl className="plan-facts">
            <div><dt>Date of birth</dt><dd>{dobLabel(plan.identity.dob)}</dd></div>
            <div><dt>Booking</dt><dd>{plan.bookingRef}</dd></div>
            <div><dt>Appointment</dt><dd>{dayOnly(plan.identity.appointmentAt) || 'Not recorded'}</dd></div>
            <div><dt>Version</dt><dd>{plan.version}{plan.versions.length > 1 ? ` of ${plan.versions.length}` : ''} {locked ? <span className="chip good">Finalised</span> : <span className="chip warn">Draft</span>}</dd></div>
          </dl>
          {plan.form.placeholder ? <Notice tone="warn">This plan uses the placeholder form, which is not approved wording.</Notice> : null}
          {locked ? <p className="help">Finalised {when(plan.finalisedAt)} by {plan.finalisedBy}. It cannot be changed; &quot;Change this plan&quot; starts version {latestVersion + 1} and keeps this one.</p>
            : <p className="help" aria-live="polite" data-save-state={saving}>{saving === 'saving' ? 'Saving...' : saving === 'dirty' ? 'Changes not saved yet' : `Draft saved ${when(savedAt)}`}</p>}
        </div>
        <div className="actions plan-actions">
          {!locked ? <>
            <button className="btn" onClick={() => void save()} disabled={saving === 'saving'}>Save draft</button>
            <a className="btn" href={`/api/dashboard/plans/pdf?id=${plan.id}&preview=1`} target="_blank" rel="noopener">Preview PDF</a>
            <button className="btn primary" onClick={() => setAsk('finalise')}>Finalise</button>
          </> : <>
            <button className="btn" onClick={() => printPdf(plan.id)} data-print>Print</button>
            <a className="btn" href={`/api/dashboard/plans/pdf?id=${plan.id}`} data-download>Download PDF</a>
            {isLatest ? <button className="btn" onClick={() => setAsk('version')}>Change this plan</button> : null}
          </>}
          {latestFinal ? <button className="btn primary" onClick={() => setAsk('send')} data-send>{plan.sends.length ? 'Send again' : 'Send to patient'}</button> : null}
          {liveLinks.length ? <button className="btn danger" onClick={() => setAsk('revoke')} data-revoke>Revoke access</button> : null}
        </div>
      </div>

      {plan.versions.length > 1 ? (
        <div className="panel"><h2>Versions</h2><ul className="list-plain">{plan.versions.map((v) => (
          <li key={v.id}><span className="grow">{v.id === plan.id ? <b>Version {v.version} (this one)</b> : <Link href={`/admin/plans/${v.id}`}>Version {v.version}</Link>}<br /><span className="help">{v.status === 'final' ? `Finalised ${when(v.finalisedAt)} by ${v.finalisedBy}` : `Draft, started ${when(v.createdAt)} by ${v.createdBy}`}</span></span></li>
        ))}</ul></div>
      ) : null}

      <form className="plan-form" onSubmit={(e) => e.preventDefault()}>
        <div className="panel"><h2 className="plan-title">{plan.form.title}</h2>{plan.form.subtitle ? <p className="help">{plan.form.subtitle}</p> : null}</div>
        {plan.form.sections.map((sec) => (
          <section className="panel plan-section" key={sec.id}>
            {sec.heading ? <h2>{sec.heading.split('{first_name}').join(plan.identity.firstName || 'there')}</h2> : null}
            {sec.items.map((it) => !isField(it.type)
              ? <div key={it.id} className={`plan-fixed ${it.type}`}>{it.type === 'callout' && it.label ? <b>{it.label}</b> : null}<p>{(it.text || '').split('{first_name}').join(plan.identity.firstName || 'there')}</p><span className="help">Printed as written</span></div>
              : <FieldInput key={it.id} it={it} value={answers[it.id]} onChange={(v) => change(it.id, v)} locked={locked} />)}
          </section>
        ))}
      </form>

      <div className="panel">
        <h2>Sent to the patient</h2>
        {!plan.sends.length ? <p className="empty">Not sent yet.</p> : <ul className="list-plain">{plan.sends.map((s, n) => (
          <li key={n}><span className="grow">{s.ok ? 'Sent' : 'Not sent (email failed)'} to {s.to}, version {s.version}, {s.method === 'link' ? 'secure link' : s.method === 'password' ? 'password protected PDF' : 'PDF attached'}<br /><span className="help">{when(s.at)} by {s.by}</span></span></li>
        ))}</ul>}
        {plan.links.length ? <><h3>Links</h3><ul className="list-plain">{plan.links.map((l) => (
          <li key={l.id}><span className="grow">Version {l.version}: {l.live ? <span className="chip good">Live</span> : l.revokedAt ? <span className="chip grey">Revoked</span> : <span className="chip grey">Expired</span>} {l.openCount ? `opened ${l.openCount} time${l.openCount > 1 ? 's' : ''}, first ${when(l.openedAt)}` : 'not opened yet'}<br /><span className="help">Made {when(l.createdAt)} by {l.createdBy}; {l.revokedAt ? `revoked ${when(l.revokedAt)}` : `works until ${when(l.expiresAt)}`}</span></span></li>
        ))}</ul></> : null}
        <p className="help">Kept until {plan.retainUntil ? dobLabel(plan.retainUntil) : 'n/a'} (7 years after the appointment, or until the patient turns 25 if they were under 18).</p>
        {admin ? <div className="actions"><Link className="btn small" href={`/admin/plans/log?plan=${plan.planNo}`}>Audit log for this plan</Link><button className="btn small danger" onClick={() => { setTyped(''); setAsk('delete') }}>Delete plan</button></div> : null}
      </div>

      {ask === 'finalise' ? <Modal title="Finalise this plan?" narrow onClose={() => setAsk(null)} footer={<><button className="btn" onClick={() => setAsk(null)}>Not yet</button><button className="btn primary" disabled={busy} onClick={() => act('finalise')}>Finalise version {plan.version}</button></>}>
        <p>Finalising locks version {plan.version} and records today&apos;s date and your name. After that it can be printed and sent, and any change starts a new version.</p>
      </Modal> : null}
      {ask === 'version' ? <Modal title="Change this plan?" narrow onClose={() => setAsk(null)} footer={<><button className="btn" onClick={() => setAsk(null)}>Cancel</button><button className="btn primary" disabled={busy} onClick={() => act('version')}>Start version {latestVersion + 1}</button></>}>
        <p>Version {plan.version} stays exactly as it is. Version {latestVersion + 1} starts as a draft copy for you to change and finalise.</p>
      </Modal> : null}
      {ask === 'revoke' ? <Modal title="Revoke access?" narrow onClose={() => setAsk(null)} footer={<><button className="btn" onClick={() => setAsk(null)}>Cancel</button><button className="btn danger" disabled={busy} onClick={() => act('revoke')}>Revoke the link</button></>}>
        <p>The link in the patient&apos;s email stops working straight away. A PDF already attached to an email cannot be taken back.</p>
      </Modal> : null}
      {ask === 'send' ? <Modal title="Send the plan to the patient" narrow onClose={() => setAsk(null)} footer={<><button className="btn" onClick={() => setAsk(null)}>Cancel</button><button className="btn primary" disabled={busy || !plan.patientEmail} onClick={() => act('send')} data-confirm-send>Send to {plan.patientEmail || 'the patient'}</button></>}>
        {plan.patientEmail ? <>
          <p>This sends <b>version {latestFinal?.version}</b> to the email address on the booking:</p>
          <p className="plan-to" data-send-to>{plan.patientEmail}</p>
          <p>How: <b>{MODE_LABEL[settings.sendMode]}</b>{settings.sendMode === 'link' ? <>, working for {settings.linkDays} days{settings.askDob && plan.bookingHasDob ? ', asking for their date of birth first' : ''}.{plan.links.some((l) => l.live) ? ' The earlier link stops working.' : ''}</> : '.'}</p>
          {settings.sendMode === 'link' && settings.askDob && !plan.bookingHasDob ? <Notice tone="warn">This booking has no date of birth, so the link will open without asking for one.</Notice> : null}
          {settings.sendMode === 'password' ? <Notice tone="info">After sending, the password shows here once. Give it to the patient by phone or SMS, never by email.</Notice> : null}
          <p className="help">The email says only that a plan is ready. Check the address is right before sending.</p>
        </> : <Notice tone="warn">{ERR.no_address}</Notice>}
      </Modal> : null}
      {password ? <Modal title="The password for this PDF" narrow onClose={() => setPassword('')} footer={<button className="btn primary" onClick={() => setPassword('')}>I have noted it</button>}>
        <p>Give this to the patient by phone or SMS. It is not saved anywhere and will not be shown again; a new send makes a new password.</p>
        <p className="plan-password" data-password>{password}</p>
      </Modal> : null}
      {ask === 'delete' ? <Modal title="Delete this plan?" narrow onClose={() => setAsk(null)} footer={<><button className="btn" onClick={() => setAsk(null)}>Cancel</button><button className="btn danger" disabled={busy || typed !== 'DELETE'} onClick={() => act('delete')}>Delete every version</button></>}>
        <p>This permanently deletes all {plan.versions.length} version{plan.versions.length > 1 ? 's' : ''} of the plan, its links and its send records. Plans are normally kept until {plan.retainUntil ? dobLabel(plan.retainUntil) : 'the retention date'}. The audit log keeps a line saying it was deleted.</p>
        <TextInput label='Type DELETE to confirm' value={typed} onChange={setTyped} />
      </Modal> : null}
    </>
  )
}

// ================================================================ the plan box on a booking (Bookings screen)
export function BookingPlans({ bookingRef }: { bookingRef: string }) {
  const toast = useToast()
  const [plans, setPlans] = useState<Summary[] | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    fetch(`${API}?ref=${encodeURIComponent(bookingRef)}`, { credentials: 'include', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j?.ok) setPlans(j.plans) }).catch(() => {})
    return () => { live = false }
  }, [bookingRef])
  if (!plans) return null   // no permission, or treatment plans are off: nothing shows
  async function create() {
    setBusy(true)
    try { const r = await call<{ id: number }>({ action: 'create', ref: bookingRef }); window.location.href = `/admin/plans/${r.id}` } catch (e) { toast(msg(e), 'bad'); setBusy(false) }
  }
  return (
    <div className="follow-block plan-on-booking" data-plans={plans.length}>
      <b>Treatment plans</b>
      {plans.length ? <ul className="list-plain">{plans.map((p) => <li key={p.planNo}><Link href={`/admin/plans/${p.id}`}>Plan {p.planNo}, version {p.version}</Link> {p.status === 'final' ? <span className="chip good">Finalised</span> : <span className="chip warn">Draft</span>}</li>)}</ul> : null}
      <button className="btn small" disabled={busy} onClick={create} data-create-plan>Create treatment plan</button>
    </div>
  )
}

// ================================================================ the form builder
const blankItem = (type: ItemType, n: number): Item => ({
  id: `f${Date.now().toString(36)}${n}`, type, label: '',
  ...(type === 'choice' ? { options: ['Option 1'] } : {}),
  ...(type === 'rows' ? { columns: [{ id: 'c1', label: 'Item', type: 'text' as const }] } : {}),
  ...(type === 'paragraph' || type === 'callout' ? { text: '' } : {}),
})
function move<T>(a: T[], i: number, d: number): T[] { const j = i + d; if (j < 0 || j >= a.length) return a; const b = [...a]; [b[i], b[j]] = [b[j], b[i]]; return b }

export function FormBuilder() {
  const toast = useToast()
  const [form, setForm] = useState<FormDef | null>(null)
  const [cur, setCur] = useState<{ version: number; placeholder: boolean; approvedAt: string | null; approvedBy: string } | null>(null)
  const [history, setHistory] = useState<{ version: number; placeholder: boolean; createdAt: string; createdBy: string; approvedAt: string | null; approvedBy: string }[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState('')
  const [dirty, setDirty] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [approving, setApproving] = useState<{ version: number; by: string } | null>(null)
  const load = useCallback(async () => {
    try {
      const s = await get<SwitchData>('switches=1'); setMe(s.me)
      const j = await get<{ current: { version: number; form: FormDef; placeholder: boolean; approvedAt: string | null; approvedBy: string }; history: typeof history }>('form=1')
      setForm(j.current.form); setCur(j.current); setHistory(j.history); setDirty(false)
    } catch (e) { setErr(msg(e)) }
  }, [])
  useEffect(() => { void load() }, [load])
  if (!form || !me) return <div className="panel"><p className="empty">{err || 'Loading...'}</p></div>
  const up = (f: FormDef) => { setForm(f); setDirty(true) }
  const setSec = (i: number, s: Section) => up({ ...form, sections: form.sections.map((x, n) => (n === i ? s : x)) })
  const setItem = (si: number, ii: number, it: Item) => setSec(si, { ...form.sections[si], items: form.sections[si].items.map((x, n) => (n === ii ? it : x)) })
  async function save() {
    try { const r = await call<{ form: { version: number } }>({ action: 'form', form }); toast(`Saved as form version ${r.form.version}. Plans already written keep their own version.`, 'good'); await load() } catch (e) { toast(msg(e), 'bad') }
  }
  async function approve() {
    if (!approving) return
    try { await call({ action: 'approve', version: approving.version, by: approving.by }); toast('Approval recorded.', 'good'); setApproving(null); await load() } catch (e) { toast(msg(e), 'bad') }
  }
  function doImport() {
    try { const f = JSON.parse(importing || '') as FormDef; if (!f || !Array.isArray(f.sections)) throw new Error('That is not a form file.'); up({ ...f, placeholder: false }); setImporting(null); toast('Loaded. Check it, then press Save as a new version.', 'good') } catch (e) { toast((e as Error).message || 'That is not a form file.', 'bad') }
  }
  return (
    <>
      <div className="panel">
        <div className="panel-head"><h2>Form version {cur?.version}</h2>
          {cur?.placeholder ? <span className="chip warn">Placeholder</span> : cur?.approvedAt ? <span className="chip good">Approved</span> : <span className="chip warn">Waiting for approval</span>}</div>
        <p className="help" style={{ marginTop: 0 }}>Saving makes a new numbered version. Plans already written keep the version they were written on, so a sent plan never changes shape. Saved by the practice owner, a new version counts as approved by her.</p>
        <div className="grid-2">
          <TextInput label="Title (top of the plan)" value={form.title} onChange={(v) => up({ ...form, title: v })} maxLength={120} />
          <TextInput label="Line under the title" value={form.subtitle || ''} onChange={(v) => up({ ...form, subtitle: v })} maxLength={160} />
        </div>
        <div className="actions">
          <button className="btn primary" disabled={!dirty} onClick={save} data-save-form>Save as a new version</button>
          <button className="btn" onClick={() => setImporting('')}>Load a form file</button>
          <button className="btn" onClick={() => { const b = new Blob([JSON.stringify(form, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `ape-treatment-plan-form-v${cur?.version}.json`; a.click() }}>Download this form</button>
          {dirty ? <button className="btn ghost" onClick={() => void load()}>Discard changes</button> : null}
        </div>
      </div>
      {form.sections.map((sec, si) => (
        <section className="panel fb-section" key={sec.id}>
          <div className="fb-row">
            <TextInput label={`Section ${si + 1} heading`} value={sec.heading} onChange={(v) => setSec(si, { ...sec, heading: v })} maxLength={160} />
            <div className="actions fb-move">
              <button className="btn small" onClick={() => up({ ...form, sections: move(form.sections, si, -1) })} aria-label={`Move section ${si + 1} up`}>Up</button>
              <button className="btn small" onClick={() => up({ ...form, sections: move(form.sections, si, 1) })} aria-label={`Move section ${si + 1} down`}>Down</button>
              <button className="btn small danger" onClick={() => up({ ...form, sections: form.sections.filter((_, n) => n !== si) })}>Remove section</button>
            </div>
          </div>
          {sec.items.map((it, ii) => (
            <div className="fb-item" key={it.id}>
              <div className="fb-row">
                <Field label="Type" htmlFor={`t-${it.id}`}><select id={`t-${it.id}`} className="select" value={it.type} onChange={(e) => setItem(si, ii, { ...blankItem(e.target.value as ItemType, ii), id: it.id, label: it.label, help: it.help })}>{FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select></Field>
                <TextInput label={it.type === 'paragraph' ? 'Name (only in the dashboard)' : it.type === 'callout' ? 'Box heading' : 'Label'} value={it.label} onChange={(v) => setItem(si, ii, { ...it, label: v })} maxLength={200} />
                <div className="actions fb-move">
                  <button className="btn small" onClick={() => setSec(si, { ...sec, items: move(sec.items, ii, -1) })} aria-label="Move up">Up</button>
                  <button className="btn small" onClick={() => setSec(si, { ...sec, items: move(sec.items, ii, 1) })} aria-label="Move down">Down</button>
                  <button className="btn small danger" onClick={() => setSec(si, { ...sec, items: sec.items.filter((_, n) => n !== ii) })}>Remove</button>
                </div>
              </div>
              {it.type === 'paragraph' || it.type === 'callout'
                ? <TextArea label="Wording (printed as written; {first_name} becomes the patient's first name)" value={it.text || ''} onChange={(v) => setItem(si, ii, { ...it, text: v })} rows={3} />
                : <div className="grid-2">
                    <TextInput label="Help (only in the dashboard)" value={it.help || ''} onChange={(v) => setItem(si, ii, { ...it, help: v })} maxLength={300} />
                    <Toggle label="Required before finalising" checked={!!it.required} onChange={(v) => setItem(si, ii, { ...it, required: v })} />
                  </div>}
              {it.type === 'choice' ? <div className="grid-2">
                <TextArea label="Options, one per line" value={(it.options || []).join('\n')} onChange={(v) => setItem(si, ii, { ...it, options: v.split('\n') })} rows={3} />
                <Toggle label="Can tick more than one" checked={!!it.multiple} onChange={(v) => setItem(si, ii, { ...it, multiple: v })} />
              </div> : null}
              {it.type === 'rows' ? <div className="fb-cols">
                {(it.columns || []).map((c, ci) => (
                  <div className="fb-row" key={ci}>
                    <TextInput label={`Column ${ci + 1}`} value={c.label} onChange={(v) => setItem(si, ii, { ...it, columns: (it.columns || []).map((x, n) => (n === ci ? { ...x, label: v } : x)) })} maxLength={80} />
                    <Field label="Kind" htmlFor={`c-${it.id}-${ci}`}><select id={`c-${it.id}-${ci}`} className="select" value={c.type} onChange={(e) => setItem(si, ii, { ...it, columns: (it.columns || []).map((x, n) => (n === ci ? { ...x, type: e.target.value as Column['type'] } : x)) })}><option value="text">Text</option><option value="number">Number</option><option value="currency">Currency</option></select></Field>
                    <button className="btn small danger" onClick={() => setItem(si, ii, { ...it, columns: (it.columns || []).filter((_, n) => n !== ci) })}>Remove column</button>
                  </div>
                ))}
                <div className="actions"><button className="btn small" onClick={() => setItem(si, ii, { ...it, columns: [...(it.columns || []), { id: `c${(it.columns || []).length + 1}${Date.now().toString(36)}`, label: '', type: 'text' }] })}>Add a column</button>
                  <Toggle label="Total the currency column (printed as an estimate for this patient)" checked={!!it.total} onChange={(v) => setItem(si, ii, { ...it, total: v })} /></div>
              </div> : null}
            </div>
          ))}
          <div className="actions">
            <select className="select fb-add" aria-label="Add to this section" value="" onChange={(e) => { if (e.target.value) setSec(si, { ...sec, items: [...sec.items, blankItem(e.target.value as ItemType, sec.items.length)] }) }}>
              <option value="">Add to this section...</option>{FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </div>
        </section>
      ))}
      <div className="actions" style={{ marginBottom: 18 }}><button className="btn" onClick={() => up({ ...form, sections: [...form.sections, { id: `s${Date.now().toString(36)}`, heading: '', items: [] }] })}>Add a section</button>
        <button className="btn primary" disabled={!dirty} onClick={save}>Save as a new version</button></div>

      <div className="panel">
        <h2>Versions and approval</h2>
        <ul className="list-plain">{history.map((h) => (
          <li key={h.version}><span className="grow"><b>Version {h.version}</b> {h.placeholder ? <span className="chip warn">Placeholder</span> : h.approvedAt ? <span className="chip good">Approved</span> : <span className="chip warn">Not approved</span>}<br />
            <span className="help">Saved {when(h.createdAt)} by {h.createdBy}{h.approvedAt ? `; approved ${when(h.approvedAt)}: ${h.approvedBy}` : ''}</span></span>
            {me.canApprove && !h.placeholder && !h.approvedAt && h.version === history[0]?.version ? <button className="btn small primary" onClick={() => setApproving({ version: h.version, by: '' })}>Record approval</button> : null}</li>
        ))}</ul>
      </div>
      {importing !== null ? <Modal title="Load a form file" onClose={() => setImporting(null)} footer={<><button className="btn" onClick={() => setImporting(null)}>Cancel</button><button className="btn primary" onClick={doImport}>Load</button></>}>
        <p>Choose the form file GYA sent (a .json file), or paste its contents. Nothing is saved until you press Save as a new version.</p>
        <input type="file" accept="application/json,.json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImporting(await f.text()) }} />
        <TextArea label="Or paste it here" value={importing} onChange={setImporting} rows={6} />
      </Modal> : null}
      {approving ? <Modal title={`Record approval of form version ${approving.version}`} narrow onClose={() => setApproving(null)} footer={<><button className="btn" onClick={() => setApproving(null)}>Cancel</button><button className="btn primary" disabled={!approving.by.trim()} onClick={approve}>Record approval</button></>}>
        <p>Record who approved the wording on this form and how, for example &quot;Dr Lorna Gladwin, email 27 Nov 2026&quot;. Today&apos;s date and your login are added.</p>
        <TextInput label="Approved by" value={approving.by} onChange={(v) => setApproving({ ...approving, by: v })} maxLength={160} />
      </Modal> : null}
    </>
  )
}

// ================================================================ the audit log (administrators)
export function PlanLog({ planNo }: { planNo?: number }) {
  const [rows, setRows] = useState<{ at: string; by: string; action: string; planNo: number | null; version: number | null; ref: string; note: string; times: number }[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { get<{ log: NonNullable<typeof rows> }>(`log=1${planNo ? `&plan=${planNo}` : ''}`).then((j) => setRows(j.log)).catch((e) => setErr(msg(e))) }, [planNo])
  const list = useMemo(() => rows || [], [rows])
  if (!rows) return <div className="panel"><p className="empty">{err || 'Loading...'}</p></div>
  return (
    <div className="panel"><div className="table-wrap"><table className="table">
      <thead><tr><th>When</th><th>Who</th><th>What</th><th>Plan</th><th>Booking</th><th>Note</th></tr></thead>
      <tbody>{list.map((r, n) => <tr key={n}><td>{when(r.at)}</td><td>{r.by}</td><td>{r.action}{r.times > 1 ? ` (${r.times} saves)` : ''}</td><td>{r.planNo ? `${r.planNo}${r.version ? `, v${r.version}` : ''}` : ''}</td><td>{r.ref}</td><td>{r.note}</td></tr>)}</tbody>
    </table></div>{!list.length ? <p className="empty">Nothing yet.</p> : null}</div>
  )
}
