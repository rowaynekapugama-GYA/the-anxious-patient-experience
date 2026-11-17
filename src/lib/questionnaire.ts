/**
 * The welcome pack and Lorna's online questionnaire (v1.9.0; first built in v1.7.0).
 *
 * Two switches in the dashboard (Site Settings > Welcome pack, GYA administrators only), both off until Lorna has
 * approved the wording:
 *   1. Welcome email. When the team presses Mark confirmed (or, if chosen, when a request arrives), the patient is
 *      emailed Lorna's Patient Guide and her Pre-appointment Questionnaire as PDF attachments, with where to go.
 *      Bookings confirmed before it was switched on are not emailed; Send welcome pack does one by hand.
 *   2. Online questionnaire. The welcome email also carries a private link to the questionnaire on the website. It
 *      only goes on with QUESTIONNAIRE_ENCRYPTION_KEY set and the collection notice marked approved.
 *      QUESTIONNAIRE_ENABLED=false in Vercel is an emergency off switch for it (nothing else turns it on).
 *
 * The private link carries a long random token for one booking (the database keeps only its hash). It works until
 * the answers are sent, or 7 days after the appointment. Answers, and answers saved to finish later, are encrypted
 * here (AES-256-GCM) before they reach the database, and decrypted only for a signed-in person with "Can view
 * patient questionnaires". Every view is logged. No email ever contains an answer.
 *
 * Test rows (from Email check) are marked test, go only to the address typed in, never appear with real responses
 * and are deleted after 24 hours.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Payload, Where } from 'payload'
import { seal, unseal, newToken, hashToken, encryptionReady, type Sealed } from './crypto'
import { emailConfigured, siteOrigin } from './email'
import { deliver, type Result } from './mailer'
import { liveRecipients, questionnaireRecipients } from './recipients'
import { DEFAULTS } from '@/site.config'
import { escHtml, fmtDateTime, db } from '@/booking/core'
import { FORM_ID, cleanAnswers, problems as answerProblems, identityProblems, identityDiffers, ID, type Answers } from './ape-questionnaire'
import { retainUntil, fullName } from '@/booking/patient'

export type { Answers } from './ape-questionnaire'

const TZ = 'Australia/Sydney'
const LINK_GRACE_DAYS = 7
const TEST_HOURS = 24
const str = (v: unknown) => String(v ?? '').trim()

// ---------------------------------------------------------------- the switches

export type Switches = {
  /** the welcome email goes out on its own (Mark confirmed, or on request if chosen) */
  welcome: boolean
  sendWhen: 'confirmed' | 'requested'
  /** the online questionnaire is live: switched on and everything it needs is in place */
  online: boolean
  onlineWanted: boolean
  keyReady: boolean
  noticeApproved: boolean
  noticeApprovedBy: string
  noticeApprovedAt: string | null
  emergencyOff: boolean
  emailReady: boolean
  /** why the online questionnaire is not live, in plain words (empty when it is) */
  blockers: string[]
}

export const emergencyOff = () => str(process.env.QUESTIONNAIRE_ENABLED).toLowerCase() === 'false'

export async function packSwitches(payload: Payload): Promise<Switches> {
  const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  const q = s?.questionnaire || {}
  const keyReady = encryptionReady()
  const off = emergencyOff()
  const emailReady = emailConfigured()
  const noticeApproved = !!q.noticeApproved
  const onlineWanted = !!q.onlineOn
  const blockers: string[] = []
  if (!onlineWanted) blockers.push('the Online questionnaire switch is off')
  if (!keyReady) blockers.push('QUESTIONNAIRE_ENCRYPTION_KEY is not set in Vercel (needed to encrypt the answers)')
  if (!noticeApproved) blockers.push('the collection notice is not marked approved')
  if (off) blockers.push('QUESTIONNAIRE_ENABLED is set to false in Vercel (the emergency off switch)')
  if (!emailReady) blockers.push('email is not set up (SMTP2GO_API_KEY and BOOKING_FROM)')
  return {
    welcome: !!q.welcomeEmailOn && emailReady,
    sendWhen: q.sendWhen === 'requested' ? 'requested' : 'confirmed',
    online: !blockers.length,
    onlineWanted, keyReady, noticeApproved,
    noticeApprovedBy: str(q.noticeApprovedBy), noticeApprovedAt: q.noticeApprovedAt || null,
    emergencyOff: off, emailReady, blockers,
  }
}

// ---------------------------------------------------------------- the words around the questionnaire

export const DEFAULT_NOTICE = 'The Anxious Patient Experience team at The Cronulla Dentists asks these questions so we can get to know you and plan an appointment that feels calm and in your control. Some answers are health information. They are encrypted, stored in Australia and read only by the team members who look after your care, and they are never sent by email. Every question is optional: you can leave anything blank and talk it through with us instead. We keep your answers with your dental records for at least 7 years. You can ask to see or correct them at any time. Our Privacy Policy (section 14) explains more.'
export const DEFAULT_CONSENT = 'I have read this notice and I am happy for the APE team to use my answers to plan my care.'

export const DEFAULT_SUBJECT = 'Your APE welcome pack and questionnaire'
export const DEFAULT_BODY = `Hi {first},

Thank you for booking your first visit with The Anxious Patient Experience at The Cronulla Dentists. We're looking forward to meeting you on {when}.

Attached to this email are two things to read in your own time:
- Your Patient Guide, which explains what to expect before and during your appointment, and how to find us.
- A short pre-appointment questionnaire, so we can get to know you and tailor your appointment to you.

{questionnaire}

There's no pressure to answer everything, and there are no wrong answers.

Where to go

{where}

Please aim to arrive at least 10 minutes early so you have time to settle in. If you need a hand finding us on the day, call us on {phone} and we'll talk you through it.

If anything changes, or there's something you'd like us to know before your visit, just reply to this email.

See you soon,
Dr Lorna, Alex and the APE team`

/** What {questionnaire} becomes in the welcome email. */
export const QUESTIONNAIRE_LINES = {
  online: 'The easiest way to fill in the questionnaire is online, using your own private link below. You can save your answers and come back to finish them later.\n{link}\n\nIf you would rather use the attached copy, you are welcome to fill it in and bring it with you.',
  pdf: 'If you would like to, please fill in the questionnaire and bring it with you to your appointment.',
  received: 'Thank you, we have already received your questionnaire.',
}

/** From Lorna's Patient Guide, Finding Us (the address and phone come from Site Settings). */
export const DIRECTIONS = {
  train: 'By train: Cronulla station is about a ten-minute walk from the clinic. Follow the main road towards the beach and we\'re on the left, just past the library.',
  car: 'By car: There\'s no patient parking at the clinic. A good place to try first is the Croydon Street council car park near Cronulla Library. Enter from Croydon Street and look for a free two- or four-hour bay.',
}

export type Words = { notice: string; consent: string; subject: string; body: string; noticeSaved: boolean; subjectSaved: boolean; bodySaved: boolean }

export async function loadWords(payload: Payload): Promise<Words> {
  const g = await payload.findGlobal({ slug: 'questionnaire', depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  return {
    notice: str(g?.collectionNotice) || DEFAULT_NOTICE,
    consent: str(g?.consentLabel) || DEFAULT_CONSENT,
    subject: str(g?.welcomeSubject) || DEFAULT_SUBJECT,
    body: str(g?.welcomeBody) || DEFAULT_BODY,
    noticeSaved: !!str(g?.collectionNotice), subjectSaved: !!str(g?.welcomeSubject), bodySaved: !!str(g?.welcomeBody),
  }
}

// ---------------------------------------------------------------- the two PDFs

export type PackFile = { key: 'guide' | 'questionnaire'; url: string; filename: string; attachName: string; source: 'original' | 'media'; mediaId: string | number | null }
export const ORIGINALS: Record<'guide' | 'questionnaire', { url: string; attachName: string; label: string }> = {
  guide: { url: '/downloads/ape-patient-guide.pdf', attachName: 'APE-Patient-Guide.pdf', label: 'Patient Guide' },
  questionnaire: { url: '/downloads/ape-pre-appointment-questionnaire.pdf', attachName: 'APE-Pre-appointment-Questionnaire.pdf', label: 'Pre-appointment Questionnaire' },
}

export async function packFiles(payload: Payload): Promise<Record<'guide' | 'questionnaire', PackFile>> {
  const s = await payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  const q = s?.questionnaire || {}
  const pick = (key: 'guide' | 'questionnaire', m: any): PackFile => {
    const o = ORIGINALS[key]
    if (m && typeof m === 'object' && m.url && /pdf/i.test(String(m.mimeType || m.filename))) {
      return { key, url: String(m.url), filename: String(m.filename || o.attachName), attachName: o.attachName, source: 'media', mediaId: m.id }
    }
    return { key, url: o.url, filename: path.basename(o.url), attachName: o.attachName, source: 'original', mediaId: null }
  }
  return { guide: pick('guide', q.guidePdf), questionnaire: pick('questionnaire', q.questionnairePdf) }
}

async function fileBytes(f: PackFile): Promise<Buffer | null> {
  try {
    if (!/^https?:\/\//i.test(f.url)) {
      const local = path.join(process.cwd(), 'public', f.url.replace(/^\/+/, ''))
      if (fs.existsSync(local)) return fs.readFileSync(local)
    }
    const r = await fetch(/^https?:\/\//i.test(f.url) ? f.url : `${siteOrigin(DEFAULTS.siteUrl)}${f.url}`)
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null
  } catch {
    return null
  }
}

/** The attachments, plus a download link for any file that could not be read (so the email still helps). */
export async function packAttachments(payload: Payload): Promise<{ attachments: { filename: string; content: Buffer; mimetype: string }[]; missing: PackFile[] }> {
  const files = await packFiles(payload)
  const attachments: { filename: string; content: Buffer; mimetype: string }[] = []
  const missing: PackFile[] = []
  for (const f of [files.guide, files.questionnaire]) {
    const b = await fileBytes(f)
    if (b && b.length) attachments.push({ filename: f.attachName, content: b, mimetype: 'application/pdf' })
    else missing.push(f)
  }
  return { attachments, missing }
}

// ---------------------------------------------------------------- the welcome email

export type BookingRow = { ref: string; name: string; email: string; slot_start: string | Date; status?: string; dob?: string | Date | null }

/** v1.10.0: the name and date of birth on a booking (no date of birth on bookings made before v1.10.0). */
export type BookingIdentity = { name: string; dob: string | null }
export async function bookingIdentity(ref: string): Promise<BookingIdentity | null> {
  const d = db()
  if (!d) return null
  const r = await d.query<{ name: string; first_name: string; last_name: string; dob: string | Date | null }>(`SELECT name, first_name, last_name, to_char(dob, 'YYYY-MM-DD') AS dob FROM ape_bookings WHERE ref = $1`, [ref]).catch(() => [])
  if (!r[0]) return null
  const b = r[0]
  return { name: b.first_name ? fullName(b.first_name, b.last_name) : String(b.name || ''), dob: isoDay(b.dob) }
}
export const isoDay = (v: unknown): string | null => {
  if (!v) return null
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  return m ? m[1] : null
}
type Place = { clinic: string; address: string; mapsUrl: string; phone: string; apeEmail: string }

export async function place(payload: Payload): Promise<Place> {
  const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  const c = { ...DEFAULTS.clinic, ...Object.fromEntries(Object.entries(s?.clinic || {}).filter(([, v]) => str(v))) } as Record<string, string>
  return {
    clinic: str(c.name), address: [str(c.street), `${str(c.suburb)} ${str(c.state)} ${str(c.postcode)}`.trim()].filter(Boolean).join(', '),
    mapsUrl: str(c.mapsUrl), phone: str(s?.phone) || DEFAULTS.phone, apeEmail: str(s?.apeEmail) || DEFAULTS.apeEmail,
  }
}

const para = (inner: string) => `<p style="margin:0 0 16px;font:16px/1.6 Arial,sans-serif;color:#2A3C4E;overflow-wrap:anywhere">${inner}</p>`
/** Links become clickable; a long map link shows as "Open the map" instead of the whole address. */
const linkify = (html: string) => html
  .replace(/Map: (https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2A3C4E">Open the map</a>')
  .replace(/(^|[^"])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" style="color:#2A3C4E">$2</a>')

/** Plain-text wording to email HTML: blank lines make paragraphs, "- " lines a list, a short line on its own a heading. */
export function toHtml(text: string): string {
  const blocks = text.split(/\n{2,}/)
  const out = blocks.map((blk) => {
    const lines = blk.split('\n')
    if (lines.length === 1 && lines[0].length < 40 && !/[.,:;!?)]$/.test(lines[0]) && !/^https?:/.test(lines[0])) {
      return `<h2 style="margin:24px 0 8px;font:bold 18px/1.3 Georgia,serif;color:#2A3C4E">${escHtml(lines[0])}</h2>`
    }
    const items = lines.filter((l) => /^- /.test(l))
    const lead = lines.filter((l) => !/^- /.test(l))
    let html = lead.length ? para(linkify(lead.map((l) => escHtml(l)).join('<br>'))) : ''
    if (items.length) html += `<ul style="margin:0 0 16px;padding-left:22px;font:16px/1.6 Arial,sans-serif;color:#2A3C4E">${items.map((l) => `<li style="margin:0 0 6px">${linkify(escHtml(l.slice(2)))}</li>`).join('')}</ul>`
    return html
  }).join('')
  return `<div style="max-width:600px">${out}</div>`
}

/** Builds the welcome email (no sending). The link is only there while the online questionnaire is on. */
export function welcomeEmail(o: {
  words: Pick<Words, 'subject' | 'body'>; name: string; slotStart: Date; link: string | null; received?: boolean; where: Place
  missing?: PackFile[]; test?: boolean
}): { subject: string; text: string; html: string } {
  const first = str(o.name).split(/\s+/)[0] || 'there'
  const when = `${fmtDateTime(o.slotStart, TZ, true)} (Sydney time)`
  const qLine = o.received ? QUESTIONNAIRE_LINES.received : o.link ? QUESTIONNAIRE_LINES.online.split('{link}').join(o.link) : QUESTIONNAIRE_LINES.pdf
  const where = [o.where.clinic, o.where.address, o.where.mapsUrl ? `Map: ${o.where.mapsUrl}` : '', '', DIRECTIONS.train, '', DIRECTIONS.car].join('\n').replace(/\n{3,}/g, '\n\n')
  let text = o.words.body
    .split('{first}').join(first).split('{when}').join(when).split('{phone}').join(o.where.phone)
    .split('{questionnaire}').join(qLine).split('{where}').join(where)
  if (o.missing?.length) text += `\n\nIf an attachment is missing, you can also download it here:\n${o.missing.map((m) => `- ${ORIGINALS[m.key].label}: ${/^https?:/.test(m.url) ? m.url : siteOrigin(DEFAULTS.siteUrl) + m.url}`).join('\n')}`
  if (o.test) text = `TEST EMAIL with sample details. Nothing was booked.${o.link ? ' The questionnaire link opens a TEST questionnaire that is deleted after 24 hours.' : ''}\n\n${text}`
  return { subject: `${o.test ? '[TEST] ' : ''}${o.words.subject}`, text, html: toHtml(text) }
}

async function bookingWelcome(ref: string, status: 'sent' | 'failed', by: string): Promise<void> {
  const d = db()
  if (!d) return
  await d.query(
    `UPDATE ape_bookings SET welcome_status = $2, welcome_by = $3, welcome_count = welcome_count + CASE WHEN $2 = 'sent' THEN 1 ELSE 0 END,
       welcome_sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE welcome_sent_at END WHERE ref = $1`, [ref, status, by]).catch((err) => console.error('welcome: could not record', ref, (err as Error).message))
}

/** The private link: a new token on the booking's questionnaire row (made the first time). Saved answers are kept. */
async function issueLink(payload: Payload, b: BookingRow, test?: { email: string }): Promise<{ link: string | null; received: boolean }> {
  const start = new Date(b.slot_start)
  const expires = new Date(start.getTime() + LINK_GRACE_DAYS * 86400000)
  const where: Where = test ? { and: [{ bookingRef: { equals: b.ref } }, { test: { equals: true } }, { testEmail: { equals: test.email } }] } : { and: [{ bookingRef: { equals: b.ref } }, { test: { not_equals: true } }] }
  const existing = test ? { docs: [] } : await payload.find({ collection: 'questionnaires', where, limit: 1, overrideAccess: true, depth: 0 })
  const row = existing.docs[0] as Record<string, any> | undefined
  if (row?.status === 'submitted') return { link: null, received: true }
  const token = newToken()
  const data = { bookingRef: b.ref, patientName: b.name, appointmentAt: start.toISOString(), tokenHash: hashToken(token), expiresAt: expires.toISOString(), status: 'sent' as const, sentAt: new Date().toISOString(), form: FORM_ID }
  if (row) await payload.update({ collection: 'questionnaires', id: row.id, data: { ...data, sentCount: Number(row.sentCount || 1) + 1 }, overrideAccess: true })
  else await payload.create({ collection: 'questionnaires', data: { ...data, sentCount: 1, ...(test ? { test: true, testEmail: test.email } : {}) }, overrideAccess: true })
  return { link: `${siteOrigin(DEFAULTS.siteUrl)}/questionnaire/${token}`, received: false }
}

/**
 * Send the welcome email for one booking. `manual` is Send welcome pack (any number of times; each gives a fresh
 * questionnaire link and the old one stops). `test` sends a [TEST] copy to one address with a test questionnaire link.
 */
export async function sendWelcome(payload: Payload, b: BookingRow, opts: { by?: string; manual?: boolean; test?: { email: string; withLink: boolean }; link?: string | null } = {}): Promise<{ sent: boolean; reason?: string; link?: boolean; result?: Result }> {
  const sw = await packSwitches(payload)
  if (!sw.emailReady) return { sent: false, reason: 'email is not set up' }
  if (!opts.test && !opts.manual && !sw.welcome) return { sent: false, reason: 'off' }
  if (!opts.test && opts.manual && !sw.welcome) return { sent: false, reason: 'the welcome email is switched off' }
  const words = await loadWords(payload)
  const where = await place(payload)
  let link: string | null = null
  let received = false
  if (opts.link) link = opts.link // v1.9.3: the link the booking page already shows (sent at request time)
  else if (opts.test ? opts.test.withLink : sw.online) ({ link, received } = await issueLink(payload, b, opts.test ? { email: opts.test.email } : undefined))
  const { attachments, missing } = await packAttachments(payload)
  const m = welcomeEmail({ words, name: b.name, slotStart: new Date(b.slot_start), link, received, where, missing, test: !!opts.test })
  const r = await deliver('welcome', { to: [opts.test ? opts.test.email : b.email], reply_to: where.apeEmail, subject: m.subject, text: m.text, html: m.html, ...(attachments.length ? { attachments } : {}) }, { ref: b.ref, test: !!opts.test })
  if (!opts.test) await bookingWelcome(b.ref, r.ok ? 'sent' : 'failed', opts.by || 'automatic')
  if (!r.ok && !opts.test) {
    const { alertGya } = await import('@/booking/emails')
    await alertGya('welcome pack email to the patient', b.ref).catch(() => {})
  }
  return { sent: r.ok, reason: r.ok ? undefined : r.error, link: !!link, result: r }
}

async function alreadyWelcomed(ref: string): Promise<boolean> {
  const d = db()
  if (!d) return false
  const r = await d.query(`SELECT welcome_sent_at FROM ape_bookings WHERE ref = $1`, [ref]).catch(() => [])
  return !!r[0]?.welcome_sent_at
}

/** A request just arrived: send the pack now if Site Settings says so. */
/**
 * A request just arrived. v1.9.3: while the online questionnaire is live, the booking gets its private link now, so
 * the Book Now page can offer the questionnaire straight away (optional). If the welcome email also goes at request
 * time, it carries that same link. Returns the link for the patient's own browser only; it is never logged.
 */
export async function onBookingRequested(payload: Payload, b: BookingRow): Promise<{ link: string | null }> {
  const sw = await packSwitches(payload)
  const link = sw.online ? (await issueLink(payload, b)).link : null
  if (sw.welcome && sw.sendWhen === 'requested') {
    await sendWelcome(payload, b, { link }).catch((err) => console.error('welcome: failed', b.ref, (err as Error).message))
  }
  return { link }
}
/** Mark confirmed: send the pack now, once, unless it is switched off or went out at request time. */
export async function onBookingConfirmed(payload: Payload, b: BookingRow): Promise<{ sent: boolean; reason?: string }> {
  const sw = await packSwitches(payload)
  if (!sw.welcome) return { sent: false, reason: 'off' }
  if (sw.sendWhen !== 'confirmed') return { sent: false, reason: 'sent at request time' }
  if (await alreadyWelcomed(b.ref)) return { sent: false, reason: 'already sent' }
  return sendWelcome(payload, b).catch((err) => ({ sent: false, reason: (err as Error).message }))
}

// ---------------------------------------------------------------- the private link (public pages)

export type TokenState = 'ok' | 'submitted' | 'expired' | 'invalid' | 'off'

async function purgeTests(payload: Payload): Promise<void> {
  await payload.delete({ collection: 'questionnaires', overrideAccess: true, where: { and: [{ test: { equals: true } }, { createdAt: { less_than: new Date(Date.now() - TEST_HOURS * 3600_000).toISOString() } }] } }).catch(() => {})
}

export async function lookupToken(payload: Payload, token: string): Promise<{ state: TokenState; row?: Record<string, any>; test?: boolean }> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return { state: 'invalid' }
  await purgeTests(payload)
  const r = await payload.find({ collection: 'questionnaires', where: { tokenHash: { equals: hashToken(token) } }, limit: 1, overrideAccess: true, depth: 0 })
  const row = r.docs[0] as Record<string, any> | undefined
  if (!row) return { state: 'invalid' }
  const test = !!row.test
  if (!test && !(await packSwitches(payload)).online) return { state: 'off', test }
  if (row.status === 'submitted') return { state: 'submitted', row, test }
  if (new Date(row.expiresAt).getTime() < Date.now()) return { state: 'expired', row, test }
  return { state: 'ok', row, test }
}

/** Answers saved to finish later, decrypted for the patient's own private link. */
export function readDraft(row: Record<string, any>): Answers {
  if (!row?.draft || !encryptionReady()) return {}
  try {
    const plain = JSON.parse(unseal(JSON.parse(row.draft) as Sealed)) as { answers: Answers }
    return cleanAnswers(plain.answers)
  } catch {
    return {}
  }
}

export async function saveDraft(payload: Payload, token: string, raw: unknown): Promise<{ ok: true; savedAt: string } | { ok: false; state: TokenState | 'no_key' }> {
  const found = await lookupToken(payload, token)
  if (found.state !== 'ok' || !found.row) return { ok: false, state: found.state }
  if (!encryptionReady()) return { ok: false, state: 'no_key' }
  const answers = cleanAnswers(raw)
  const savedAt = new Date().toISOString()
  await payload.update({ collection: 'questionnaires', id: found.row.id, overrideAccess: true, data: { draft: JSON.stringify(seal(JSON.stringify({ form: FORM_ID, answers, savedAt }))), draftSavedAt: savedAt } })
  return { ok: true, savedAt }
}

export async function submitAnswers(payload: Payload, token: string, raw: unknown, consent: boolean): Promise<{ ok: true } | { ok: false; state: TokenState | 'no_key' | 'consent' } | { ok: false; state: 'invalid_answers'; problems: Record<string, string> }> {
  const found = await lookupToken(payload, token)
  if (found.state !== 'ok' || !found.row) return { ok: false, state: found.state }
  if (!encryptionReady()) return { ok: false, state: 'no_key' }
  if (!consent) return { ok: false, state: 'consent' }
  // v1.10.0: the full name and date of birth at the top are needed to send (a draft saves without them)
  const bad = { ...answerProblems(raw), ...identityProblems(raw) }
  if (Object.keys(bad).length) return { ok: false, state: 'invalid_answers', problems: bad }
  const answers = cleanAnswers(raw)
  const row = found.row
  const appointment = new Date(row.appointmentAt)
  // kept 7 years after the appointment, or until the patient turns 25 if they were under 18 at the appointment
  const booking = row.test ? null : await bookingIdentity(String(row.bookingRef))
  const until = retainUntil(appointment, booking?.dob || String(answers[ID.dob] || '') || null)
  const differs = booking ? identityDiffers(answers, booking) : false
  const submittedAt = new Date().toISOString()
  await payload.update({
    collection: 'questionnaires', id: row.id, overrideAccess: true,
    data: { status: 'submitted', submittedAt, form: FORM_ID, sealed: JSON.stringify(seal(JSON.stringify({ form: FORM_ID, answers, submittedAt }))), draft: null, draftSavedAt: null, retainUntil: until.toISOString(), identityDiffers: differs },
  })
  await notifyTeam(row).catch((err) => console.error('questionnaire: notification failed', row.bookingRef, (err as Error).message))
  return { ok: true }
}

/** "A questionnaire has arrived": the reference and appointment date only. A test goes only to the test address. */
export function noticeEmail(row: { id: string | number; bookingRef: string; appointmentAt: string }, test = false): { subject: string; text: string; html: string } {
  const when = fmtDateTime(new Date(row.appointmentAt), TZ, true)
  const link = `${siteOrigin(DEFAULTS.siteUrl)}/admin/questionnaires/${row.id}`
  const text = `${test ? 'TEST EMAIL. This is a test questionnaire, deleted after 24 hours.\n\n' : ''}A patient questionnaire has been completed for booking ${row.bookingRef} (appointment ${when}).\n\nRead it in the dashboard (sign in needed; only people with questionnaire access can open it):\n${link}\n\nThe answers are never included in email.`
  return { subject: `${test ? '[TEST] ' : ''}Questionnaire received ${row.bookingRef}, ${fmtDateTime(new Date(row.appointmentAt), TZ, false)}`, text, html: toHtml(text) }
}

async function notifyTeam(row: Record<string, any>): Promise<void> {
  const m = noticeEmail({ id: row.id, bookingRef: row.bookingRef, appointmentAt: row.appointmentAt }, !!row.test)
  if (row.test) {
    if (row.testEmail) await deliver('questionnaire-team', { to: [String(row.testEmail)], ...m }, { ref: row.bookingRef, test: true })
    return
  }
  const live = await liveRecipients()
  const r = await deliver('questionnaire-team', { to: questionnaireRecipients(live).list, ...m }, { ref: row.bookingRef })
  if (!r.ok) {
    const { alertGya } = await import('@/booking/emails')
    await alertGya('questionnaire received email to the team', row.bookingRef).catch(() => {})
  }
}

/** A sample booking's TEST questionnaire row and link, for Email check. */
export async function testLink(payload: Payload, email: string, b: BookingRow): Promise<string | null> {
  return (await issueLink(payload, b, { email })).link
}

// ---------------------------------------------------------------- reading answers (dashboard)

export type DashUser = { id: string | number; email: string; role: string; canViewQuestionnaires?: boolean }
export const canView = (u: DashUser | null | undefined) => !!u && !!u.canViewQuestionnaires
/** Test rows can also be opened by a GYA administrator (they hold no patient's answers). */
export const canViewRow = (u: DashUser | null | undefined, row: { test?: boolean }) => canView(u) || (!!row.test && u?.role === 'admin')

export async function log(payload: Payload, e: { userEmail: string; userId?: string | number; action: 'viewed' | 'printed' | 'reviewed' | 'unreviewed' | 'deleted' | 'denied' | 'resent'; bookingRef?: string; questionnaire?: string | number; note?: string }): Promise<void> {
  await payload.create({
    collection: 'questionnaire-log', overrideAccess: true,
    data: { at: new Date().toISOString(), userEmail: e.userEmail, userId: e.userId === undefined ? undefined : String(e.userId), action: e.action, bookingRef: e.bookingRef, questionnaire: e.questionnaire === undefined ? undefined : String(e.questionnaire), note: e.note },
  }).catch((err) => console.error('questionnaire: log failed', (err as Error).message))
}

export type ListRow = { id: string; bookingRef: string; patientName: string; appointmentAt: string; status: string; sentAt: string | null; submittedAt: string | null; draftSavedAt: string | null; reviewed: boolean; reviewedBy: string; reviewedAt: string | null; retainUntil: string | null; sentCount: number; test: boolean; testEmail: string; identityDiffers: boolean }
const listRow = (d: Record<string, any>): ListRow => ({
  id: String(d.id), bookingRef: String(d.bookingRef), patientName: String(d.patientName || ''), appointmentAt: String(d.appointmentAt || ''), status: String(d.status),
  sentAt: d.sentAt || null, submittedAt: d.submittedAt || null, draftSavedAt: d.draftSavedAt || null, reviewed: !!d.reviewed, reviewedBy: String(d.reviewedBy || ''), reviewedAt: d.reviewedAt || null,
  retainUntil: d.retainUntil || null, sentCount: Number(d.sentCount || 1), test: !!d.test, testEmail: d.test ? String(d.testEmail || '') : '', identityDiffers: !!d.identityDiffers,
})

/** Real questionnaires (no answers), newest first; or only the test ones. */
export async function listQuestionnaires(payload: Payload, o: { tests?: boolean } = {}): Promise<ListRow[]> {
  await purgeTests(payload)
  const r = await payload.find({ collection: 'questionnaires', where: o.tests ? { test: { equals: true } } : { test: { not_equals: true } }, limit: 500, overrideAccess: true, depth: 0 })
  return (r.docs as Record<string, any>[]).map(listRow).sort((a, b) => ((b.submittedAt || b.sentAt || '') > (a.submittedAt || a.sentAt || '') ? 1 : -1))
}

/** Status per booking reference, for the Bookings screen (real rows only). */
export async function statusByRef(payload: Payload): Promise<Record<string, { status: string; submittedAt: string | null; sentAt: string | null; id: string }>> {
  const out: Record<string, { status: string; submittedAt: string | null; sentAt: string | null; id: string }> = {}
  try {
    const r = await payload.find({ collection: 'questionnaires', where: { test: { not_equals: true } }, limit: 1000, overrideAccess: true, depth: 0, select: { bookingRef: true, status: true, submittedAt: true, sentAt: true } })
    for (const d of r.docs as Record<string, any>[]) out[String(d.bookingRef)] = { status: String(d.status), submittedAt: d.submittedAt || null, sentAt: d.sentAt || null, id: String(d.id) }
  } catch { /* no table yet */ }
  return out
}

export async function countUnreviewed(payload: Payload): Promise<number> {
  try {
    return (await payload.count({ collection: 'questionnaires', where: { and: [{ status: { equals: 'submitted' } }, { reviewed: { not_equals: true } }, { test: { not_equals: true } }] }, overrideAccess: true })).totalDocs
  } catch {
    return 0
  }
}

export type Opened = { row: ListRow; answers: Answers; form: string; booking?: BookingIdentity | null; legacy?: { title: string; questions: { id: string; heading: string; questions: { id: string; label: string; type: string }[] }[] } }

/** Decrypt one questionnaire for a person allowed to see it, and log it. */
export async function openQuestionnaire(payload: Payload, id: string, user: DashUser): Promise<Opened | null> {
  const d = await payload.findByID({ collection: 'questionnaires', id, overrideAccess: true, depth: 0 }).catch(() => null) as Record<string, any> | null
  if (!d) return null
  if (!canViewRow(user, d)) {
    await log(payload, { userEmail: user.email, userId: user.id, action: 'denied', bookingRef: d.bookingRef, questionnaire: id })
    throw Object.assign(new Error('no access'), { status: 403 })
  }
  await log(payload, { userEmail: user.email, userId: user.id, action: 'viewed', bookingRef: d.bookingRef, questionnaire: id, note: d.test ? 'test' : undefined })
  const booking = d.test ? null : await bookingIdentity(String(d.bookingRef))
  if (d.status !== 'submitted' || !d.sealed) return { row: listRow(d), answers: {}, form: String(d.form || FORM_ID), booking }
  const plain = JSON.parse(unseal(JSON.parse(d.sealed) as Sealed)) as { form?: string; answers: Answers; questions?: any[]; title?: string }
  if (!plain.form && plain.questions) return { row: listRow(d), answers: plain.answers, form: 'v1.7.0', booking, legacy: { title: String(plain.title || ''), questions: plain.questions } }
  const answers = cleanAnswers(plain.answers)
  // worked out again on opening, in case the booking was corrected since
  const row = listRow(d)
  if (booking) row.identityDiffers = identityDiffers(answers, booking)
  return { row, answers, form: String(plain.form || FORM_ID), booking }
}

export async function setReviewed(payload: Payload, id: string, user: DashUser, reviewed: boolean): Promise<void> {
  const d = await payload.findByID({ collection: 'questionnaires', id, overrideAccess: true, depth: 0 }) as Record<string, any>
  await payload.update({ collection: 'questionnaires', id, overrideAccess: true, data: { reviewed, reviewedBy: reviewed ? user.email : '', reviewedAt: reviewed ? new Date().toISOString() : null } })
  await log(payload, { userEmail: user.email, userId: user.id, action: reviewed ? 'reviewed' : 'unreviewed', bookingRef: d.bookingRef, questionnaire: id })
}

/** Administrators only, after a confirmation step in the dashboard. Permanent. */
export async function deleteQuestionnaire(payload: Payload, id: string, user: DashUser): Promise<void> {
  const d = await payload.findByID({ collection: 'questionnaires', id, overrideAccess: true, depth: 0 }) as Record<string, any>
  await payload.delete({ collection: 'questionnaires', id, overrideAccess: true })
  await log(payload, { userEmail: user.email, userId: user.id, action: 'deleted', bookingRef: d.bookingRef, questionnaire: id, note: d.test ? 'test' : `retain until ${d.retainUntil || 'n/a'}` })
}

/** Who can read answers (for the Welcome pack screen). */
export async function readers(payload: Payload): Promise<{ email: string; name: string; role: string }[]> {
  const r = await payload.find({ collection: 'users', where: { canViewQuestionnaires: { equals: true } }, limit: 100, overrideAccess: true, depth: 0 })
  return (r.docs as Record<string, any>[]).map((u) => ({ email: String(u.email), name: String(u.name || ''), role: String(u.role || '') }))
}

// ---------------------------------------------------------------- a small rate limit for the public routes
const hits = new Map<string, number[]>()
export function tooMany(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) for (const k of hits.keys()) { if (hits.size <= 2500) break; hits.delete(k) }
  return list.length > limit
}
