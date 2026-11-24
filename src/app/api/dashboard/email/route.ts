/**
 * The email check screen (v1.8.3, GYA administrators only): how sending is set up, who gets each email, the recent
 * log, and test emails to one address.
 *
 * Test emails use sample details (Test Patient GYA, APE-TEST01), have [TEST] at the start of the subject and go only
 * to the address typed in: never to the booking list, the APE inbox or a patient, and no booking is made. At most
 * 3 test runs an hour. A test password reset is a real reset only when the address has a login; otherwise it is
 * the template with a dead sample link.
 */
import * as core from '@/booking/core'
import * as emails from '@/booking/emails'
import { json, routeUser } from '@/dashboard/lib/routeAuth'
import { origin, passwordChangedEmail, passwordEmail, sendPasswordLink } from '@/dashboard/lib/passwordLink'
import { emailConfigured, emailProvider } from '@/lib/email'
import { allow, deliver, failedCount, KINDS, kindLabel, recent, type Kind, type Result } from '@/lib/mailer'
import { liveRecipients, questionnaireRecipients, type Live } from '@/lib/recipients'
import { noticeEmail, sendWelcome } from '@/lib/questionnaire'
import { accessEmail } from '@/lib/access'
import { encryptionReady } from '@/lib/crypto'
import { depositEmails } from '@/booking/deposit'
import * as tpl from '@/email/patient'
import { loadTerms } from '@/booking/terms'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TESTABLE: Kind[] = ['invite', 'reset', 'password-changed', 'booking-patient', 'booking-team', 'gya-notice', 'deposit-patient', 'deposit-team', 'welcome', 'questionnaire-team', 'alert', 'access']
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

function who(kind: Kind, live: Live): { to: string; source: string } {
  const team = { to: live.team.list.join(', '), source: live.team.source }
  switch (kind) {
    case 'invite': case 'reset': case 'password-changed': return { to: 'the person whose login it is', source: 'their login email' }
    case 'booking-patient': case 'deposit-patient': case 'welcome': return { to: `the patient (Reply-To: ${live.apeInbox})`, source: 'Book Now' }
    case 'booking-team': case 'deposit-team': return { ...team, to: `${team.to}${live.bcc.length ? ` (bcc ${live.bcc.join(', ')})` : ''} (Reply-To: the patient)` }
    case 'questionnaire-team': { const r = questionnaireRecipients(live); return { to: r.list.join(', '), source: r.source } }
    case 'gya-notice': return { to: live.gya.on ? live.gya.to : 'switched off', source: live.gya.on ? live.gya.source : 'Site Settings' }
    case 'alert': return { to: live.gya.to, source: live.gya.source }
    case 'access': return { to: 'the person given questionnaire access', source: 'Users screen' }
  }
}

async function admin(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return { error: json(401, { error: 'Please sign in again.' }) }
  if (user.role !== 'admin') return { error: json(403, { error: 'Only a GYA administrator can see this.' }) }
  return { payload, user }
}

export async function GET(req: Request) {
  const a = await admin(req)
  if ('error' in a) return a.error
  const url = new URL(req.url)
  const d = core.db()
  if (d) await emails.retryDue(d, core.loadConfig(await core.readOverrides(d).catch(() => ({})))).catch(() => 0)
  const live = await liveRecipients()
  const from = process.env.BOOKING_FROM || ''
  return json(200, {
    ok: true,
    setup: {
      from,
      fromDomain: (/@([^>\s]+)/.exec(from)?.[1] || '').toLowerCase(),
      provider: emailProvider(),
      smtp2goKey: !!process.env.SMTP2GO_API_KEY,
      configured: emailConfigured(),
      serverUrl: process.env.NEXT_PUBLIC_SERVER_URL || '',
      linkOrigin: origin(),
    },
    recipients: KINDS.map((k) => ({ kind: k.kind, label: k.label, ...who(k.kind, live) })),
    failed7: await failedCount(7),
    log: await recent({ limit: 50, kind: url.searchParams.get('kind') || undefined, status: url.searchParams.get('status') || undefined }),
    testable: TESTABLE.map((k) => ({ kind: k, label: kindLabel(k) })),
  })
}

function sampleBooking(address: string): emails.BookingRow {
  const start = new Date(Date.now() + 7 * 86400000)
  start.setUTCHours(23, 20, 0, 0)
  return {
    ref: 'APE-TEST01', slot_start: start, name: 'Test Patient GYA', email: address, phone: '0400 000 000',
    notes: 'Sample note for a test email.', price: 250, special: true, status: 'requested', created_at: new Date(),
    first_name: 'Test', last_name: 'Patient GYA', dob: '1990-03-14', terms_version: '1 (2026-11-17)', terms_consent_at: new Date(), terms_read_at: new Date(),
  }
}

export async function POST(req: Request) {
  const a = await admin(req)
  if ('error' in a) return a.error
  let body: { to?: string; kinds?: string[] }
  try { body = await req.json() } catch { return json(400, { error: 'Bad request' }) }
  const to = String(body.to || '').trim().toLowerCase()
  if (!EMAIL.test(to)) return json(400, { error: 'Please enter one email address.' })
  const kinds = (Array.isArray(body.kinds) ? body.kinds : []).filter((k): k is Kind => TESTABLE.includes(k as Kind))
  if (!kinds.length) return json(400, { error: 'Tick at least one email to test.' })
  if (!emailConfigured()) return json(503, { error: 'Email is not set up (SMTP2GO_API_KEY and BOOKING_FROM).' })
  if (!(await allow('email-test', 3, 60))) return json(429, { error: 'Test emails can be sent 3 times an hour. Please try again a little later.' })

  const d = core.db()
  const cfg = d ? core.loadConfig(await core.readOverrides(d).catch(() => ({}))) : core.loadConfig()
  const live = await liveRecipients()
  const b = sampleBooking(to)
  const dead = `${origin()}/admin/reset-password?token=TEST-SAMPLE-LINK-DOES-NOT-WORK`
  const results: { kind: Kind; label: string; ok: boolean; id: string; error: string; note?: string }[] = []
  for (const kind of kinds) {
    let r: Result | null = null
    let note = ''
    const send = (msg: core.Email) => deliver(kind, { ...msg, to: [to], bcc: undefined }, { ref: 'APE-TEST01', test: true })
    switch (kind) {
      case 'invite': r = await send(passwordEmail(to, 'invite', dead, { test: true })); note = 'Sample link (does not work)'; break
      case 'reset': {
        const has = await a.payload.find({ collection: 'users', where: { email: { equals: to } }, limit: 1, depth: 0, overrideAccess: true })
        if (has.docs[0]) { r = await sendPasswordLink(a.payload, to, 'reset', { test: true }); note = 'A real reset link (this address has a login), valid 1 hour' }
        else { r = await send(passwordEmail(to, 'reset', dead, { test: true })); note = 'No login for this address, so a sample link' }
        break
      }
      case 'password-changed': r = await send(passwordChangedEmail(to, { test: true })); break
      // v1.14.0: the branded email with the wording saved in Patient emails
      case 'booking-patient': {
        const terms = await loadTerms(a.payload)
        r = await send(emails.patientEmail(cfg, b, live.apeInbox, { test: true, template: await tpl.loadTemplate('booking-patient'), policyText: terms.saved ? terms.text : null }))
        break
      }
      case 'booking-team': r = await send(emails.teamEmail(cfg, b, { team: { list: [to], source: 'Site Settings' }, bcc: [] }, { test: true })); break
      case 'gya-notice': r = await send(emails.gyaNoticeEmail(cfg, b, [
        { label: 'New booking email to the team', ok: true, id: 'sample-id', error: '' },
        { label: 'Booking request received, to the patient', ok: true, id: 'sample-id', error: '' },
      ], to, { test: true })); break
      case 'deposit-patient': case 'deposit-team': {
        const m = depositEmails(cfg, { ref: b.ref, slot_start: b.slot_start, name: b.name, email: to }, 100, 'TEST-CAPTURE', live.apeInbox, [to], { test: true, template: await tpl.loadTemplate('deposit-patient') })
        r = await send(kind === 'deposit-patient' ? m.patient : m.team)
        break
      }
      case 'welcome': {
        // v1.9.0: the real email with both PDFs attached; the link opens a TEST questionnaire (deleted after 24 hours)
        const withLink = encryptionReady()
        const w = await sendWelcome(a.payload, { ref: 'APE-TEST01', name: 'Test Patient GYA', email: to, slot_start: b.slot_start }, { test: { email: to, withLink } })
        r = w.result ?? { ok: false, id: '', error: w.reason || 'not sent' }
        note = withLink ? 'Both PDFs attached, with a TEST questionnaire link (deleted after 24 hours)' : 'Both PDFs attached. No questionnaire link: QUESTIONNAIRE_ENCRYPTION_KEY is not set'
        break
      }
      case 'questionnaire-team': {
        r = await send({ to: [to], ...noticeEmail({ id: 'test', bookingRef: 'APE-TEST01', appointmentAt: new Date(b.slot_start).toISOString() }, true) })
        break
      }
      // v1.17.0: the last two, so every email the team, GYA or a login receives can be seen
      case 'alert': {
        const subject = '[TEST] APE email failed: booking request received, to the patient APE-TEST01'
        r = await send({ to: [to], subject, text: 'TEST EMAIL, nothing failed.\n\nAn email from The Anxious Patient Experience website could not be sent: booking request received, to the patient (booking APE-TEST01).', html: emails.alertHtml(subject, 'booking request received, to the patient', 'APE-TEST01', { test: true }) })
        break
      }
      case 'access': r = await send({ to: [to], ...accessEmail({ email: to, name: '' }, a.user.email || 'GYA', { test: true }) }); break
    }
    results.push({ kind, label: kindLabel(kind), ok: !!r?.ok, id: r?.id ?? '', error: r ? r.error : 'not sent', note })
  }
  return json(200, { ok: true, to, results })
}
