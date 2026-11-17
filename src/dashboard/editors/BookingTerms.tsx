'use client'
/**
 * Site Settings > Booking terms (v1.10.0). The terms and cancellation policy patients read and tick on Book Now and
 * the pay-later page, the two tick box labels, the version number and Lorna's approval. Data from
 * /api/dashboard/booking-terms.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Notice, TextArea, TextInput, useUnsavedWarning } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { TermsView } from '@/booking/TermsView'

const API = '/api/dashboard/booking-terms'
type Terms = { text: string; version: number; date: string; label: string; consentLabel: string; readLabel: string; saved: boolean; approvedBy: string; approvedAt: string | null }
type Data = { ok: boolean; terms: Terms; defaults: { text: string; consentLabel: string; readLabel: string } }
const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const dateLong = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })

async function call(body?: unknown): Promise<Data> {
  const r = await fetch(API, { method: body ? 'POST' : 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) { window.location.href = '/admin/login'; throw new Error('Please sign in again.') }
  if (!r.ok || !j.ok) throw new Error(j.message || 'Something went wrong. Please try again.')
  return j
}

export function BookingTerms() {
  const toast = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [consent, setConsent] = useState('')
  const [read, setRead] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  useUnsavedWarning(dirty)
  const take = useCallback((j: Data) => { setData(j); setText(j.terms.text); setConsent(j.terms.consentLabel); setRead(j.terms.readLabel); setDirty(false) }, [])
  useEffect(() => { call().then(take).catch((e) => setError((e as Error).message)) }, [take])
  if (error) return <Notice tone="warn" icon={Icon.warn()}><p>{error}</p></Notice>
  if (!data) return <div className="panel"><p className="empty">Loading...</p></div>
  const t = data.terms

  async function save() {
    setBusy(true)
    try { take(await call({ text, consentLabel: consent, readLabel: read })); toast('Saved as a new version. The next booking shows it.', 'good') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function approve(on: boolean) {
    setBusy(true)
    try { take(await call({ approved: on })); toast(on ? 'Recorded: Lorna has approved this version.' : 'Approval cleared.', 'good') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  return (
    <div className="cols">
      <div>
        <div className="panel">
          <h2>Version {t.version}, {dateLong(t.date)}</h2>
          {t.approvedBy
            ? <Notice tone="good" icon={Icon.check()}><p><b>Approved.</b> {t.approvedBy} recorded Lorna&apos;s approval of this version on {when(t.approvedAt)}.</p></Notice>
            : <Notice tone="warn" icon={Icon.warn()}><p><b>Draft: waiting for Lorna&apos;s approval.</b> {t.saved ? 'This version has not been approved yet.' : 'This is the wording GYA drafted. The three cancellation lines are the policy already on Book Now.'} Lorna, please also confirm the line &quot;Less than 48 hours&apos; notice or non-attendance&quot;: is the deposit kept, moved to a new time, or refunded?</p></Notice>}
          <TextArea label="Terms and cancellation policy" value={text} onChange={(v) => { setText(v); setDirty(true) }} rows={16}
            help={<>A line starting <code>## </code> is a heading and a line starting <code>- </code> is a bullet. <code>{'{phone}'}</code> and <code>{'{deposit}'}</code> are filled in. It must mention 48 hours.</>} />
          <TextInput label="Tick box on the terms step" value={consent} onChange={(v) => { setConsent(v); setDirty(true) }} help={`Draft: "${data.defaults.consentLabel}"`} />
          <TextInput label="Tick box before paying the deposit" value={read} onChange={(v) => { setRead(v); setDirty(true) }} help={`It replaces the old tick "I have read and understand the deposit and cancellation policy."`} />
          <div className="actions">
            <button className="btn primary" disabled={busy || !dirty} onClick={save}>Save as version {t.version + 1}</button>
            {dirty ? <button className="btn" onClick={() => take(data)}>Undo changes</button> : null}
            {!dirty && !t.approvedBy ? <button className="btn" disabled={busy} onClick={() => approve(true)}>Lorna has approved version {t.version}</button> : null}
            {!dirty && t.approvedBy ? <button className="btn small" disabled={busy} onClick={() => approve(false)}>Clear approval</button> : null}
          </div>
          <p className="help">Each booking records the version the patient saw and when they ticked each box (Bookings, open a booking).</p>
        </div>
      </div>
      <div className="sticky">
        <div className="panel">
          <h2 style={{ marginBottom: 8 }}>Preview</h2>
          <TermsView text={text} className="terms-preview" />
          <p className="help"><input type="checkbox" disabled aria-hidden="true" /> {consent}</p>
          <p className="help"><input type="checkbox" disabled aria-hidden="true" /> {read}</p>
        </div>
      </div>
    </div>
  )
}
