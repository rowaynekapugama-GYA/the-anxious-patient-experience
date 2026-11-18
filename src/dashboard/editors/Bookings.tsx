'use client'
/**
 * Online booking in the dashboard: Bookings (requests from the Book Now page), Availability (weekly booking times,
 * leave and single times) and Opening special (how many of the $250 places are used). All three read and write
 * /api/dashboard/bookings with the dashboard sign-in.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { Modal, Notice, Toggle, Field, TextInput, TextArea } from '../ui/fields'
import { when } from '../lib/format'

const API = '/api/dashboard/bookings'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export type Booking = {
  ref: string; start: string; day: string; time: string; when: string; name: string; email: string; phone: string
  notes: string; price: number; special: boolean; status: 'requested' | 'confirmed' | 'cancelled'; depositPaid: boolean; createdAt: string
  deposit: { status: 'unpaid' | 'paid' | 'manual' | 'refunded' | 'failed'; label: string; amount: number | null; paidAt: string | null; note: string; captureId: string | null; paypalUrl: string | null; method?: string }
  /** v1.8.3: '' (before v1.8.3) | sent | retry | failed */
  emails: { patient: string; team: string }
  /** v1.9.0: the welcome pack email */
  welcome: { status: string; sentAt: string | null; count: number; by: string }
  /** v1.10.0: first and last name, date of birth (null before v1.10.0) with today's age, and the terms ticks */
  firstName: string; lastName: string; dob: string | null; age: number | null; ageAtAppointment: number | null
  terms: { version: string; consentAt: string | null; readAt: string | null; payReadAt: string | null }
  /** v1.11.0: where the visit came from */
  source?: { label: string; source: string; medium: string; campaign: string }
}

const dobText = (b: Pick<Booking, 'dob' | 'age'>) => (b.dob ? `${new Date(`${b.dob}T00:00:00Z`).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })} (age ${b.age})` : 'not given')
type Slot = { time: string; label: string; start: string; status: 'open' | 'booked' | 'blocked' | 'closed'; note: string; booking: { ref: string; name: string; status: string } | null }
type Day = { day: string; label: string; special: boolean; blocked: { note: string } | null; slots: Slot[] }
export type BookingData = {
  ok: boolean; database: boolean; email: boolean
  deposit: { mode: 'paypal' | 'later'; amount: number; env: 'sandbox' | 'live' | null }
  pricing: { appointment: number; deposit: number }
  booking: { startDate: string; minNoticeHours: number; weeksAhead: number; days: number[]; startTimes: string[]; dayNames: string[]; standard: { days: number[]; startTimes: string[] }; custom: boolean }
  bookings: Booking[]
  questionnaire: { welcome: boolean; online: boolean; byRef: Record<string, { status: string; submittedAt: string | null; sentAt: string | null; id: string }> }
  blocks: { day: string; time: string | null; note: string }[]
  special: {
    enabled: boolean; price: number; regular: number; from: string; to: string; max: number; used: number; showing: boolean
    popup: boolean; showAfter: number; heading: string; body: string
    standard: { enabled: boolean; popup: boolean; from: string; to: string; showAfter: number; heading: string; body: string }
    custom: boolean
  }
  schedule: Day[]
}

const ERR: Record<string, string> = {
  signed_out: 'Your session has ended. Please sign in again.',
  no_database: 'The booking database is not connected yet, so changes cannot be saved. Please contact GYA.',
  taken: 'Another booking already has that time, so this one cannot be restored.',
  invalid_dates: 'Please choose a valid first day (and a last day on or after it).',
  invalid_time: 'That time is not one of the booking times.',
  no_ape_days: 'There are no booking days between those dates.',
  no_days: 'Please tick at least one day.',
  no_times: 'Please add at least one start time (up to 12).',
  invalid_delay: 'Show after must be a number of seconds between 0 and 60.',
  already_paid: 'This deposit was paid through PayPal, so there is nothing to mark.',
  paid_by_paypal: 'This deposit was paid through PayPal. Refunds are done in PayPal and show here by themselves.',
}
const errText = (e?: string) => (e && ERR[e]) || 'Something went wrong. Please try again, or contact GYA if it keeps happening.'
const money = (n: number) => `$${Number(n).toLocaleString('en-AU')}`
const timeLabel = (hm: string) => { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}` }
const dayLabel = (day: string) => { const [y, m, d] = day.split('-').map(Number); return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d))) }
const joinList = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)

async function call(method: 'GET' | 'POST', body?: unknown): Promise<any> {
  const res = await fetch(API, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const j = await res.json().catch(() => ({ ok: false, error: 'server_error' }))
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error(ERR.signed_out) }
  if (!res.ok || !j.ok) throw new Error(errText(j.error))
  return j
}

function useBookingData(initial: BookingData | null) {
  const [data, setData] = useState<BookingData | null>(initial)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try { setData(await call('GET')); setError('') } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { if (!initial) void reload() }, [initial, reload])
  return { data, error, reload }
}

function SetupNotices({ data }: { data: BookingData }) {
  return (
    <>
      {!data.database ? (
        <Notice tone="warn" icon={Icon.warn()}><p><b>The booking database is not connected yet.</b> The website shows times, but patients cannot send a request and nothing here can be saved until GYA connects it.</p></Notice>
      ) : null}
      {data.database && !data.email ? (
        <Notice tone="warn" icon={Icon.warn()}><p><b>Booking emails are not set up yet.</b> Until GYA adds them, the last step of booking on the website shows a message with the clinic phone number instead of taking the request.</p></Notice>
      ) : null}
    </>
  )
}

function Confirm({ title, children, yes, danger, onYes, onClose }: { title: string; children: React.ReactNode; yes: string; danger?: boolean; onYes: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} narrow footer={<>
      <button className="btn" onClick={onClose}>Keep it</button>
      <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onClose(); onYes() }}>{yes}</button>
    </>}>{children}</Modal>
  )
}

// ================================================================ Bookings
type Filter = 'upcoming' | 'todo' | 'unpaid' | 'past' | 'cancelled' | 'all'

export function BookingsScreen({ initial }: { initial: BookingData | null }) {
  const toast = useToast()
  const { data, error, reload } = useBookingData(initial)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [ask, setAsk] = useState<Booking | null>(null)
  const [manual, setManual] = useState<{ b: Booking; note: string } | null>(null)
  const [busy, setBusy] = useState('')
  const now = Date.now()

  const counts = useMemo(() => {
    const b = data?.bookings ?? []
    const future = b.filter((x) => new Date(x.start).getTime() >= now)
    return {
      upcoming: future.filter((x) => x.status !== 'cancelled').length,
      todo: future.filter((x) => x.status === 'requested').length,
      past: b.filter((x) => new Date(x.start).getTime() < now && x.status !== 'cancelled').length,
      cancelled: b.filter((x) => x.status === 'cancelled').length,
      all: b.length,
      unpaid: future.filter((x) => x.status !== 'cancelled' && !x.depositPaid).length,
      deposits: future.filter((x) => x.status !== 'cancelled' && !x.depositPaid).length,
    }
  }, [data, now])

  const shown = useMemo(() => (data?.bookings ?? []).filter((b) => {
    const future = new Date(b.start).getTime() >= now
    const ok = filter === 'all' ? true
      : filter === 'cancelled' ? b.status === 'cancelled'
        : filter === 'past' ? !future && b.status !== 'cancelled'
          : filter === 'todo' ? future && b.status === 'requested'
            : filter === 'unpaid' ? future && b.status !== 'cancelled' && !b.depositPaid
              : future && b.status !== 'cancelled'
    return ok && (!q || `${b.name} ${b.email} ${b.phone} ${b.ref} ${b.notes}`.toLowerCase().includes(q.toLowerCase()))
  }).sort((a, b) => (filter === 'past' || filter === 'cancelled' ? (a.start < b.start ? 1 : -1) : (a.start < b.start ? -1 : 1))), [data, filter, q, now])

  async function update(b: Booking, change: { status?: Booking['status']; depositPaid?: boolean; note?: string }, done: string) {
    setBusy(b.ref)
    try {
      const r = await call('POST', { action: 'booking', ref: b.ref, ...change })
      let msg = done
      const quiet = (why?: string) => !why || why === 'off' || why === 'already sent' || why === 'sent at request time'
      if (change.status === 'confirmed' && r.welcome) msg += r.welcome.sent ? ' The welcome pack has been emailed to the patient.' : quiet(r.welcome.reason) ? '' : ` The welcome pack email was not sent (${r.welcome.reason}).`
      toast(msg, r.welcome && !r.welcome.sent && !quiet(r.welcome.reason) ? 'bad' : 'good'); await reload()
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy('') }
  }
  async function resendEmail(b: Booking, to: 'patient' | 'team') {
    setBusy(b.ref)
    try {
      const res = await fetch('/api/dashboard/bookings', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resend-email', ref: b.ref, to }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) throw new Error(j.detail ? `The email still could not be sent: ${j.detail}` : errText(j.error))
      toast(to === 'team' ? 'The booking email has been sent to the team.' : `The booking email has been sent to ${b.name}.`, 'good'); await reload()
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy('') }
  }
  async function resendWelcome(b: Booking) {
    if (b.welcome.sentAt && !window.confirm(`Send the welcome pack to ${b.name} again?${data?.questionnaire?.online ? ' The questionnaire link in the earlier email will stop working (anything they saved is kept).' : ''}`)) return
    setBusy(b.ref)
    try {
      const res = await fetch('/api/dashboard/questionnaires', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'welcome', ref: b.ref }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) throw new Error(j.reason ? `The welcome email could not be sent (${j.reason}).` : errText(j.error))
      toast(`The welcome pack has been emailed to ${b.name}${j.link ? ', with a fresh questionnaire link' : ''}.`, 'good'); await reload()
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy('') }
  }

  function csv() {
    const rows = [['Reference', 'Appointment', 'First name', 'Last name', 'Date of birth', 'Age', 'Email', 'Phone', 'Fee', 'Opening special', 'Status', 'Deposit received', 'Paid by', 'Deposit policy version', 'Deposit policy agreed', 'Source', 'Campaign', 'Note from patient', 'Requested on']]
    for (const b of shown) rows.push([b.ref, b.when, b.firstName || b.name, b.lastName, b.dob || 'not given', b.age === null ? '' : String(b.age), b.email, b.phone, money(b.price), b.special ? 'Yes' : 'No', b.status, b.depositPaid ? 'Yes' : 'No', b.deposit.method || '', b.terms.version, b.terms.consentAt || b.terms.payReadAt ? when((b.terms.consentAt || b.terms.payReadAt)!) : '', b.source?.label || '', b.source?.campaign || '', b.notes, when(b.createdAt)])
    const text = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
    a.download = `ape-bookings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!data) return <div className="panel"><p className="empty">{error || 'Loading bookings...'}</p></div>
  const depositChip = (b: Booking) => b.deposit.status === 'paid' ? <span className="chip good" title={b.deposit.captureId || ''}>Received</span>
    : b.deposit.status === 'manual' ? <span className="chip good" title={b.deposit.note}>Received (manual)</span>
      : b.deposit.status === 'refunded' ? <span className="chip grey">Refunded</span>
        : b.deposit.status === 'failed' ? <span className="chip warn" title={b.deposit.note}>Failed</span>
          : <span className="chip grey">Not paid</span>
  const tick = (state: string, who: string) => state === 'sent' ? <span className="tick ok" title={`Email to ${who} sent`}>{Icon.check()}<span className="sr-only">{who} sent</span></span>
    : state === 'failed' ? <span className="tick bad" title={`Email to ${who} not sent`}>!<span className="sr-only">{who} not sent</span></span>
      : state === 'retry' ? <span className="tick wait" title={`Email to ${who} failed once, trying again`}>...<span className="sr-only">{who} retrying</span></span>
        : <span className="tick none" title="Sent before email tracking began">-</span>
  // v1.9.0: the welcome pack column shows once the welcome email is on (or any booking has had one)
  const showWelcome = !!data.questionnaire?.welcome || data.bookings.some((b) => !!b.welcome.status)
  const welcomeCell = (b: Booking) => {
    if (b.status === 'cancelled' && !b.welcome.sentAt) return <span className="muted">-</span>
    const qs = data.questionnaire?.byRef?.[b.ref]
    const sent = b.welcome.sentAt ? <span className="chip good" title={`${b.welcome.count} sent, last by ${b.welcome.by}`}>{Icon.check()} Sent {new Date(b.welcome.sentAt).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' })}</span> : null
    return <>
      {b.welcome.status === 'failed' ? <span className="chip warn">Not sent: failed</span> : sent || <span className="chip grey">Not sent</span>}
      {qs ? <><br /><span className={`chip ${qs.status === 'submitted' ? 'good' : 'grey'}`}>{qs.status === 'submitted' ? 'Questionnaire received' : 'Questionnaire not yet received'}</span></> : null}
    </>
  }
  const emailCell = (b: Booking) => <span className="ticks">{tick(b.emails.patient, 'patient')}<small>Patient</small>{tick(b.emails.team, 'team')}<small>Team</small></span>
  const statusChip = (b: Booking) => b.status === 'confirmed' ? <span className="chip good">Confirmed</span>
    : b.status === 'cancelled' ? <span className="chip grey">Cancelled</span> : <span className="chip warn">To confirm</span>

  return (
    <>
      <SetupNotices data={data} />
      <div className="stat-row" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{counts.todo}</b><span>To confirm</span></div>
        <div className="stat"><b>{counts.upcoming}</b><span>Upcoming</span></div>
        <div className="stat"><b>{counts.deposits}</b><span>Deposits to come</span></div>
        <div className="stat"><b>{data.special.used} of {data.special.max}</b><span>Opening special places used</span></div>
      </div>

      <div className="panel">
        <div className="actions" style={{ marginBottom: 12 }}>
          <div className="tabs bookings-filters" style={{ margin: 0, border: 0 }} role="tablist" aria-label="Which bookings">
            {([['upcoming', 'Upcoming'], ['todo', 'To confirm'], ['unpaid', 'Deposit not paid'], ['past', 'Past'], ['cancelled', 'Cancelled'], ['all', 'All']] as [Filter, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l} ({counts[k]})</button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <input className="input search" aria-label="Search bookings" placeholder="Search bookings" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" onClick={csv}>{Icon.download()} Download for Excel (CSV)</button>
        </div>
        <div className="table-wrap">
          <table className="table bookings-table">
            <thead><tr><th>Appointment</th><th>Patient</th><th>Contact</th><th>Fee</th><th>Status</th><th>Deposit</th><th>Source</th><th>Emails</th>{showWelcome ? <th>Welcome pack</th> : null}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {!shown.length ? <tr><td colSpan={10} className="empty">{filter === 'todo' ? 'Nothing to confirm. New requests from the Book Now page appear here.' : 'No bookings to show.'}</td></tr> : null}
              {shown.map((b) => (
                <React.Fragment key={b.ref}>
                  <tr>
                    <td><b>{b.when}</b><br /><span className="muted">{b.ref}</span></td>
                    <td><button className="btn ghost small t-title" aria-expanded={open === b.ref} onClick={() => setOpen(open === b.ref ? null : b.ref)}>{b.name}</button>
                      <br /><span className="muted">DOB {dobText(b)}</span>{b.ageAtAppointment !== null && b.ageAtAppointment < 18 ? <> <span className="chip warn" title="Under 18 at the appointment">Under 18</span></> : null}</td>
                    <td>{b.phone ? <><a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>{b.phone}</a><br /></> : null}<a href={`mailto:${b.email}`}>{b.email}</a></td>
                    <td>{money(b.price)}{b.special ? <><br /><span className="chip blue">Opening special</span></> : null}</td>
                    <td>{statusChip(b)}</td>
                    <td>{b.status === 'cancelled' && !b.depositPaid ? <span className="muted">-</span> : depositChip(b)}</td>
                    <td className="t-source">{b.source ? <span title={[b.source.source, b.source.medium, b.source.campaign].filter(Boolean).join(' / ')}><span className="phone-only muted">Came from: </span>{b.source.label}</span> : <span className="muted">-</span>}</td>
                    <td className="email-ticks">{emailCell(b)}</td>
                    {showWelcome ? <td>{welcomeCell(b)}</td> : null}
                    <td className="row-actions">
                      {b.status === 'requested' ? <button className="btn small primary" disabled={busy === b.ref} onClick={() => update(b, { status: 'confirmed' }, `${b.name}'s booking is marked confirmed.`)}>{Icon.check()} Mark confirmed</button> : null}
                      {b.status !== 'cancelled' && !b.depositPaid ? <button className="btn small" disabled={busy === b.ref} onClick={() => setManual({ b, note: '' })}>Mark received manually</button> : null}
                      {b.status !== 'cancelled' ? <button className="btn small danger" disabled={busy === b.ref} onClick={() => setAsk(b)}>Cancel booking</button> : null}
                      {b.status === 'cancelled' ? <button className="btn small" disabled={busy === b.ref} onClick={() => update(b, { status: 'requested' }, 'Booking restored. Please confirm it again.')}>Restore</button> : null}
                      {data.questionnaire?.welcome && b.status === 'confirmed' ? <button className="btn small ghost" disabled={busy === b.ref} onClick={() => resendWelcome(b)}>{b.welcome.sentAt ? 'Send welcome pack again' : 'Send welcome pack'}</button> : null}
                    </td>
                  </tr>
                  {b.emails.patient === 'failed' || b.emails.team === 'failed' ? (
                    <tr className="email-flag-row"><td colSpan={10}>
                      <div className="email-flag" role="alert">{Icon.warn()}<span><b>Email not sent:</b> {[b.emails.team === 'failed' ? 'the new booking email to the team' : '', b.emails.patient === 'failed' ? `the booking email to ${b.name}` : ''].filter(Boolean).join(' and ')} could not be sent, even after trying again. The booking itself is saved.</span>
                        {b.emails.patient === 'failed' ? <button className="btn small" disabled={busy === b.ref} onClick={() => resendEmail(b, 'patient')}>Resend to patient</button> : null}
                        {b.emails.team === 'failed' ? <button className="btn small" disabled={busy === b.ref} onClick={() => resendEmail(b, 'team')}>Resend to team</button> : null}
                      </div>
                    </td></tr>
                  ) : null}
                  {open === b.ref ? (
                    <tr><td colSpan={10} style={{ background: '#fafbfc' }}>
                      <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 6px' }}><b>Note from the patient:</b> {b.notes || 'None'}</p>
                      <dl className="booking-facts">
                        <div><dt>First name</dt><dd>{b.firstName || <span className="muted">not given (booked as {b.name})</span>}</dd></div>
                        <div><dt>Last name</dt><dd>{b.lastName || <span className="muted">not given</span>}</dd></div>
                        <div><dt>Date of birth</dt><dd>{dobText(b)}{b.ageAtAppointment !== null && b.ageAtAppointment < 18 ? ' (under 18 at the appointment)' : ''}</dd></div>
                        <div><dt>Phone</dt><dd>{b.phone || <span className="muted">not given</span>}</dd></div>
                      </dl>
                      <p className="help" style={{ margin: 0 }}>Requested {when(b.createdAt)}.{' '}
                        {b.terms.consentAt || b.terms.payReadAt
                          ? <>Deposit policy agreed: {when((b.terms.consentAt || b.terms.payReadAt)!)}, version {b.terms.version || 'not recorded'}{b.terms.consentAt && b.terms.payReadAt ? ` (and again on the pay-later page, ${when(b.terms.payReadAt)})` : ''}.</>
                          : <>Booked before 17 November 2026: the deposit and cancellation policy was accepted (no time recorded).</>}
                        {b.source ? <> Came from: {b.source.label}{b.source.campaign ? ` (${b.source.campaign})` : ''}.</> : null}</p>
                      <p className="help" style={{ margin: '6px 0 0' }}><b>Deposit:</b> {b.deposit.label}{b.deposit.amount ? `, ${money(b.deposit.amount)}` : ''}{b.deposit.paidAt ? `, ${when(b.deposit.paidAt)}` : ''}{b.deposit.method ? `, paid by ${b.deposit.method}` : ''}{b.deposit.captureId ? `, PayPal transaction ${b.deposit.captureId}` : ''}{b.deposit.note ? `. ${b.deposit.note}` : ''}
                        {b.deposit.paypalUrl ? <> <a href={b.deposit.paypalUrl} target="_blank" rel="noopener">View in PayPal</a></> : null}</p>
                      {b.deposit.status === 'manual' && b.status !== 'cancelled' ? <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => update(b, { depositPaid: false }, 'Deposit marked as not received.')}>Undo manual mark</button> : null}
                    </td></tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>When a booking request comes in</h2>
        <ol className="steps-help">
          <li>You get an email at the APE inbox, and the request shows here as <b>To confirm</b>. The time is held, so nobody else can book it online.</li>
          <li>Block the time in Core Practice and enter the patient.</li>
          <li>Reply to the patient to confirm and send the new patient information pack.</li>
          <li>Press <b>Mark confirmed</b>.{data.questionnaire?.welcome ? ' The website then emails the patient the welcome pack (Lorna\'s Patient Guide and questionnaire).' : ''} When the deposit is paid online, Deposit received ticks itself; otherwise press <b>Deposit received</b>.</li>
        </ol>
        <p className="help" style={{ margin: 0 }}>{data.deposit.mode === 'paypal'
          ? `Patients pay the ${money(data.deposit.amount)} deposit by card (no PayPal account needed) or with PayPal in the booking flow, or later through the private link in their email. When it is paid, the deposit column ticks itself and you get a "Deposit received" email. Nothing needs checking in PayPal; refunds are done there and show here as Refunded.${data.deposit.env === 'sandbox' ? ' (PayPal is in sandbox mode: test payments only.)' : ''}`
          : `There is no online payment set up yet, so patients are told the ${money(data.deposit.amount)} deposit details will come with their confirmation.`}
        {' '}If a patient cancels, press Cancel booking and the time opens up on the website again.</p>
      </div>

      {manual ? (
        <Modal title="Mark the deposit as received by hand" onClose={() => setManual(null)} narrow footer={<>
          <button className="btn" onClick={() => setManual(null)}>Back</button>
          <button className="btn primary" disabled={busy === manual.b.ref} onClick={() => { const m = manual; setManual(null); update(m.b, { depositPaid: true, note: m.note }, 'Deposit marked as received.') }}>Mark received</button>
        </>}>
          <p><b>{manual.b.name}</b>, {manual.b.when}. Use this only for a deposit taken another way (bank transfer, phone, in person). PayPal payments tick themselves.</p>
          <TextInput label="How it was paid (optional note)" value={manual.note} onChange={(v) => setManual({ ...manual, note: v })} maxLength={200} />
        </Modal>
      ) : null}
      {ask ? (
        <Confirm title="Cancel this booking?" yes="Cancel booking" danger onClose={() => setAsk(null)}
          onYes={() => update(ask, { status: 'cancelled' }, `${ask.name}'s booking is cancelled and the time is open again.`)}>
          <p><b>{ask.name}</b>, {ask.when}.</p>
          <p className="help">The time opens up on the website again{ask.special ? ', and the opening special place is freed' : ''}. Please let the patient know yourself; the website does not email them.{ask.deposit.status === 'paid' ? ' Their deposit was paid through PayPal: refund it in PayPal if the policy allows, and it will show here as Refunded.' : ''}</p>
        </Confirm>
      ) : null}
    </>
  )
}

// ================================================================ Availability
export function AvailabilityScreen({ initial }: { initial: BookingData | null }) {
  const toast = useToast()
  const { data, error, reload } = useBookingData(initial)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [clashes, setClashes] = useState<{ ref: string; name: string; when: string }[]>([])
  const [days, setDays] = useState<number[] | null>(null)
  const [times, setTimes] = useState<string[] | null>(null)
  const [newTime, setNewTime] = useState('')
  const [askDay, setAskDay] = useState<Day | null>(null)

  useEffect(() => { if (data) { setDays(data.booking.days); setTimes(data.booking.startTimes) } }, [data])
  const dirtySchedule = !!data && !!days && !!times && (days.join() !== data.booking.days.join() || times.join() !== data.booking.startTimes.join())

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true)
    try {
      const r = await call('POST', body)
      toast(done, 'good')
      setClashes(r.clashes ?? [])
      await reload()
      return r
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  async function block(ev: React.FormEvent) {
    ev.preventDefault()
    if (!from) { toast('Please choose the first day.', 'bad'); return }
    const r = await act({ action: 'block', from, to: to || from, note }, 'Those days are now closed to online bookings.')
    if (r) { setFrom(''); setTo(''); setNote('') }
  }

  async function saveSchedule() {
    if (!days || !times) return
    await act({ action: 'schedule', days, startTimes: times }, 'Booking times saved. The website shows them straight away.')
  }

  if (!data || !days || !times) return <div className="panel"><p className="empty">{error || 'Loading availability...'}</p></div>
  const standard = data.booking.standard

  return (
    <>
      <SetupNotices data={data} />
      <div className="cols">
        <div>
          <section className="panel" id="block">
            <h2>Block time off</h2>
            <p className="help" style={{ marginTop: -6 }}>For leave or a day the clinic is closed. Every booking day in that period is closed to online bookings. Blocking does not cancel bookings already made.</p>
            <form onSubmit={block}>
              <div className="grid-2">
                <div className="field"><label htmlFor="b-from">First day</label><input id="b-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="field"><label htmlFor="b-to">Last day</label><input id="b-to" className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                  <p className="help">Leave empty for a single day.</p></div>
              </div>
              <div className="field"><label htmlFor="b-note">Note</label><input id="b-note" className="input" value={note} maxLength={200} placeholder="For example: Annual leave" onChange={(e) => setNote(e.target.value)} />
                <p className="help">Only the team sees this. Patients just see no times that day.</p></div>
              <button className="btn primary" disabled={busy || !data.database}>{busy ? 'Saving...' : 'Block these days'}</button>
            </form>
            {clashes.length ? (
              <div style={{ marginTop: 14 }}><Notice tone="warn" icon={Icon.warn()}>
                <p><b>{clashes.length === 1 ? 'Someone has already booked in that period.' : `${clashes.length} people have already booked in that period.`}</b> Their bookings are not cancelled. Please contact them, then cancel under Bookings if needed:</p>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{clashes.map((c) => <li key={c.ref}>{c.name}, {c.when} ({c.ref})</li>)}</ul>
              </Notice></div>
            ) : null}
          </section>

          <section className="panel" id="schedule">
            <div className="panel-head"><h2>The next {Math.round(data.schedule.length / Math.max(1, data.booking.days.length))} weeks</h2></div>
            <p className="help" style={{ marginTop: -6 }}>Tap an open time to block just that time, or a blocked time to open it again. Booked times show who booked.</p>
            <div className="avail-list">
              {data.schedule.map((d) => (
                <div key={d.day} className={`avail-day${d.blocked ? ' is-blocked' : ''}`}>
                  <div className="avail-head">
                    <b>{d.label}</b>
                    {d.special ? <span className="chip blue">Opening special</span> : null}
                    {d.blocked ? <span className="chip warn">Blocked{d.blocked.note ? `: ${d.blocked.note}` : ''}</span> : null}
                    <span style={{ flex: 1 }} />
                    {d.blocked
                      ? <button className="btn small" disabled={busy} onClick={() => act({ action: 'unblock', day: d.day }, `${d.label} is open for bookings again.`)}>Open this day</button>
                      : <button className="btn small" disabled={busy || !data.database} onClick={() => setAskDay(d)}>Block this day</button>}
                  </div>
                  {!d.blocked ? (
                    <div className="avail-slots">
                      {d.slots.map((s) => {
                        const label = s.status === 'booked' ? `${s.label}: ${s.booking?.name}` : s.status === 'blocked' ? `${s.label}: blocked` : s.status === 'closed' ? `${s.label}: too soon` : `${s.label}: open`
                        const can = s.status === 'open' || s.status === 'blocked'
                        return (
                          <button key={s.time} className={`avail-slot ${s.status}`} disabled={!can || busy || !data.database}
                            title={s.status === 'open' ? 'Block this time' : s.status === 'blocked' ? 'Open this time again' : undefined}
                            onClick={() => s.status === 'open'
                              ? act({ action: 'block', from: d.day, time: s.time }, `${s.label} on ${d.label} is blocked.`)
                              : act({ action: 'unblock', day: d.day, time: s.time }, `${s.label} on ${d.label} is open again.`)}>{label}</button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky">
          <section className="panel" id="times">
            <h2>Booking times</h2>
            <p className="help" style={{ marginTop: -6 }}>The days and start times patients can choose online, each week. Each appointment is 70 minutes.</p>
            <div className="field"><span className="label-like">Days</span>
              <div className="day-picks">
                {DAYS.map((name, n) => (
                  <label key={n} className="check"><input type="checkbox" checked={days.includes(n)} onChange={(e) => setDays(e.target.checked ? [...days, n].sort() : days.filter((x) => x !== n))} /> {name}</label>
                ))}
              </div>
            </div>
            <div className="field"><span className="label-like">Start times</span>
              <ul className="list-plain">
                {times.map((t) => (
                  <li key={t}><span className="grow">{timeLabel(t)}</span>
                    <button className="btn small ghost" onClick={() => setTimes(times.filter((x) => x !== t))} aria-label={`Remove ${timeLabel(t)}`}>{Icon.trash()} Remove</button></li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="input" type="time" aria-label="New start time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                <button className="btn small" onClick={() => { if (/^\d{2}:\d{2}$/.test(newTime) && !times.includes(newTime)) { setTimes([...times, newTime].sort()); setNewTime('') } }}>{Icon.plus()} Add</button>
              </div>
            </div>
            <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <button className="btn primary" disabled={!dirtySchedule || busy || !data.database} onClick={saveSchedule}>{busy ? 'Saving...' : 'Save booking times'}</button>
              {data.booking.custom ? (
                <button className="btn" disabled={busy} onClick={() => act({ action: 'schedule', days: null }, 'The standard booking times are back.')}>
                  Use the standard times ({joinList(standard.days.map((n) => `${DAYS[n]}s`))}, {joinList(standard.startTimes.map(timeLabel))})
                </button>
              ) : null}
            </div>
            <p className="help" style={{ marginTop: 10 }}>Changes show on the website straight away; there is no need to publish. Bookings already made keep their time. Online bookings need at least {data.booking.minNoticeHours} hours notice and open {data.booking.weeksAhead} weeks ahead{data.booking.startDate ? `, from ${dayLabel(data.booking.startDate)}` : ''}.</p>
          </section>
          {data.blocks.length ? (
            <section className="panel">
              <h2>Blocked</h2>
              <ul className="list-plain">
                {data.blocks.map((b) => (
                  <li key={b.day + (b.time || '')}><span className="grow">{dayLabel(b.day)}{b.time ? `, ${timeLabel(b.time)}` : ''}<br /><span className="help">{b.note || (b.time ? 'Single time' : 'Whole day')}</span></span>
                    <button className="btn small" disabled={busy} onClick={() => act({ action: 'unblock', day: b.day, time: b.time || '' }, 'Open for bookings again.')}>Open</button></li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {askDay ? (
        <Confirm title="Block this day?" yes="Block this day" onClose={() => setAskDay(null)}
          onYes={() => act({ action: 'block', from: askDay.day }, `${askDay.label} is closed to online bookings.`)}>
          <p><b>{askDay.label}</b> will show no times on the website.</p>
          {askDay.slots.some((s) => s.status === 'booked') ? <p className="help">Someone has already booked this day. Their booking stays; please contact them if they need to move.</p> : null}
        </Confirm>
      ) : null}
    </>
  )
}

// ================================================================ Opening special
export function SpecialScreen({ initial }: { initial: BookingData | null }) {
  const toast = useToast()
  const { data, error, reload } = useBookingData(initial)
  const [form, setForm] = useState<{ enabled: boolean; popup: boolean; from: string; to: string; showAfter: string; heading: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (data && !form) setForm({ enabled: data.special.enabled, popup: data.special.popup, from: data.special.from, to: data.special.to, showAfter: String(data.special.showAfter), heading: data.special.heading, body: data.special.body })
  }, [data, form])
  if (!data || !form) return <div className="panel"><p className="empty">{error || 'Loading...'}</p></div>
  const s = data.special
  const specials = data.bookings.filter((b) => b.special)
  const left = Math.max(0, s.max - s.used)
  const set = (k: keyof typeof form, v: string | boolean) => setForm({ ...form, [k]: v })
  async function save() {
    setBusy(true)
    try {
      await call('POST', { action: 'special', enabled: form!.enabled, popup: form!.popup, from: form!.from, to: form!.to, showAfter: form!.showAfter, heading: form!.heading, body: form!.body })
      toast('Saved. The website uses it straight away.', 'good'); await reload()
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function standard() {
    setBusy(true)
    try { await call('POST', { action: 'special', enabled: null }); toast('Back to the standard settings.', 'good'); setForm(null); await reload() } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  const preview = form.body.replace('{price}', money(s.price)).replace('{regular}', money(s.regular)).replace('{dates}', 'the special dates')
  return (
    <>
      <SetupNotices data={data} />
      <div className="stat-row" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{s.used} of {s.max}</b><span>Places used</span></div>
        <div className="stat"><b>{left}</b><span>Places left</span></div>
        <div className="stat"><b>{money(s.price)}</b><span>Special price (usually {money(s.regular)})</span></div>
        <div className="stat"><b>{s.showing ? 'Showing' : 'Hidden'}</b><span>On the website now</span></div>
      </div>
      <div className="panel">
        <h2>How it works</h2>
        {s.enabled ? (
          <p>The {money(s.price)} opening special applies to the first {s.max} New Patient Appointments booked online for {dayLabel(s.from)} to {dayLabel(s.to)}. The $100 deposit still applies.</p>
        ) : <p>The opening special is switched off.</p>}
        <p>{s.showing
          ? 'The ribbon on the homepage, the pop-up, the note in the FAQs and the price labels on Book Now are showing, because a special time is still free.'
          : 'The ribbon, pop-up and special price labels are hidden on the website, because no special time is free (all places are used, the times are taken or blocked, the dates are less than 24 hours away, or the special is switched off).'}</p>
        <p className="help" style={{ margin: 0 }}>It switches itself off once {s.max} are booked or the special dates have passed. A cancelled special booking frees its place. To change the price or the number of places, please contact GYA (an offer on a dental website must state its price, what is included and its dates exactly).</p>
      </div>

      <div className="panel">
        <h2>Settings and the pop-up</h2>
        <p className="help">Saved changes apply on the website straight away (no Publish needed). The pop-up shows once per visit on the homepage, about {form.showAfter || '0.8'} seconds after it opens, and not again for 7 days after someone closes it.</p>
        <div className="grid-2">
          <Toggle label="Opening special on" checked={form.enabled} onChange={(v) => set('enabled', v)} help="Off hides the special everywhere and every time is the usual price." />
          <Toggle label="Show the pop-up on the homepage" checked={form.popup} onChange={(v) => set('popup', v)} help="The ribbon and the price labels still show while the special is on." />
          <Field label="Special dates: first day" htmlFor="sp-from"><input id="sp-from" className="input" type="date" value={form.from} onChange={(e) => set('from', e.target.value)} /></Field>
          <Field label="Special dates: last day" htmlFor="sp-to"><input id="sp-to" className="input" type="date" value={form.to} onChange={(e) => set('to', e.target.value)} /></Field>
          <Field label="Show the pop-up after (seconds)" htmlFor="sp-delay" help="0.8 is the standard. 0 shows it at once."><input id="sp-delay" className="input" type="number" min={0} max={60} step={0.1} value={form.showAfter} onChange={(e) => set('showAfter', e.target.value)} /></Field>
          <TextInput label="Pop-up heading" value={form.heading} onChange={(v) => set('heading', v)} maxLength={120} />
          <div style={{ gridColumn: '1 / -1' }}>
            <TextArea label="Pop-up wording" value={form.body} onChange={(v) => set('body', v)} rows={4}
              help={<>Write {'{price}'}, {'{regular}'} and {'{dates}'} where the special price, the usual price and the dates should go, so they always match the booking system. The wording must state the price, what is included and the dates, with nothing that hurries people. Preview: <i>{preview}</i></>} />
          </div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={busy} onClick={save}>Save</button>
          {s.custom ? <button className="btn" disabled={busy} onClick={standard}>Use the standard settings</button> : null}
        </div>
      </div>

      <div className="panel">
        <h2>Special bookings</h2>
        {!specials.length ? <p className="empty">None yet.</p> : (
          <ul className="list-plain">
            {specials.map((b) => (
              <li key={b.ref}><span className="grow"><b>{b.name}</b><br /><span className="help">{b.when} &middot; {b.ref}</span></span>
                {b.status === 'cancelled' ? <span className="chip grey">Cancelled</span> : b.status === 'confirmed' ? <span className="chip good">Confirmed</span> : <span className="chip warn">To confirm</span>}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
