'use client'
/**
 * Site Settings > Booking terms (v1.10.0; v1.11.0 Lorna's deposit policy). The wording patients read and agree to in
 * the pop-up before the deposit (Book Now and the pay-later page), its tick box, the version number and Lorna's
 * approval. Data from /api/dashboard/booking-terms.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Notice, TextArea, TextInput, useUnsavedWarning } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { TermsView } from '@/booking/TermsView'

const API = '/api/dashboard/booking-terms'
type Terms = { text: string; version: number; date: string; label: string; consentLabel: string; readLabel: string; saved: boolean; approvedBy: string; approvedAt: string | null }
type Data = { ok: boolean; terms: Terms; fill?: { deposit: string; phone: string }; defaults: { text: string; consentLabel: string; readLabel: string } }
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
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  useUnsavedWarning(dirty)
  const take = useCallback((j: Data) => { setData(j); setText(j.terms.text); setConsent(j.terms.consentLabel); setDirty(false) }, [])
  useEffect(() => { call().then(take).catch((e) => setError((e as Error).message)) }, [take])
  if (error) return <Notice tone="warn" icon={Icon.warn()}><p>{error}</p></Notice>
  if (!data) return <div className="panel"><p className="empty">Loading...</p></div>
  const t = data.terms

  async function save() {
    setBusy(true)
    try { take(await call({ text, consentLabel: consent })); toast('Saved as a new version. The next booking shows it.', 'good') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
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
            ? <Notice tone="good" icon={Icon.check()}><p><b>Approved by Lorna.</b> {/email of/.test(t.approvedBy) ? <>From her {t.approvedBy.replace(/^.*\((email of [^)]*)\).*$/, '$1')}.</> : <>Recorded by {t.approvedBy}, {when(t.approvedAt)}.</>}</p></Notice>
            : <Notice tone="warn" icon={Icon.warn()}><p><b>Waiting for Lorna&apos;s approval.</b> This version has been changed since Lorna approved her wording.</p></Notice>}
          <TextArea label="Deposit policy" value={text} onChange={(v) => { setText(v); setDirty(true) }} rows={16}
            help={<>Patients read this in a pop-up when they go from their details to the deposit, and on the pay-later page. A line starting <code>## </code> is a heading (the first one is the pop-up&apos;s title). <code>{'{deposit}'}</code> is filled in with the deposit amount, so it always matches what is charged; <code>{'{phone}'}</code> with the phone number. It must mention 48 hours.</>} />
          <TextInput label="Tick box in the pop-up" value={consent} onChange={(v) => { setConsent(v); setDirty(true) }} help={<>Patients must tick it, then press <b>I Agree &amp; Continue</b>.</>} />
          <div className="actions">
            <button className="btn primary" disabled={busy || !dirty} onClick={save}>Save as version {t.version + 1}</button>
            {dirty ? <button className="btn" onClick={() => take(data)}>Undo changes</button> : null}
            {!dirty && !t.approvedBy ? <button className="btn" disabled={busy} onClick={() => approve(true)}>Lorna has approved version {t.version}</button> : null}
            {!dirty && t.approvedBy ? <button className="btn small" disabled={busy} onClick={() => approve(false)}>Clear approval</button> : null}
          </div>
          <p className="help">Each booking records the version the patient saw and when they agreed (Bookings, open a booking).</p>
        </div>
      </div>
      <div className="sticky">
        <div className="panel">
          <h2 style={{ marginBottom: 8 }}>Preview</h2>
          <TermsView text={text.replace(/\{deposit\}/g, data.fill?.deposit || '{deposit}').replace(/\{phone\}/g, data.fill?.phone || '{phone}')} className="terms-preview" />
          <p className="help"><input type="checkbox" disabled aria-hidden="true" /> {consent}</p>
          <p className="help"><span className="btn small" aria-hidden="true">I Agree &amp; Continue</span></p>
        </div>
      </div>
    </div>
  )
}
