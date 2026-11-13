/**
 * The New Patient Information Pack (v1.7.0): the welcome email with the welcome pack and a private questionnaire
 * link, the questionnaire itself, and who may read the answers.
 *
 * How it works for a patient:
 *   1. The team presses Mark confirmed (or, if Site Settings says so, the moment a request arrives). The website
 *      emails the patient the welcome pack (attached and linked) and a private link to the questionnaire.
 *   2. The link carries a long random token tied to that one booking. It works until 7 days after the appointment,
 *      and once the questionnaire is submitted it shows a thank-you page instead.
 *   3. The answers are encrypted here (AES-256-GCM, QUESTIONNAIRE_ENCRYPTION_KEY) before they are saved in the
 *      site's own Neon database, and decrypted only for a signed-in person with "Can view patient questionnaires".
 *      Every view is logged. The team is told by email that a questionnaire has arrived (reference, first name and
 *      appointment date only, never answers).
 *
 * Switched on with QUESTIONNAIRE_ENABLED=true. Off, nothing is sent and the questionnaire pages say so politely.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import { seal, unseal, newToken, hashToken, encryptionReady, type Sealed } from './crypto'
import { emailConfigured, siteOrigin } from './email'
import { deliver } from './mailer'
import { liveRecipients } from './recipients'
import { DEFAULTS } from '@/site.config'
import { escHtml, fmtDateTime, TM, DEFAULT_NOTIFY_TO } from '@/booking/core'

export type QuestionType = 'text' | 'textarea' | 'yesno' | 'choice' | 'multi' | 'scale' | 'date' | 'dob' | 'signature' | 'note'
export type Question = { id: string; label: string; type: QuestionType; options: string[]; help: string; required: boolean }
export type Section = { id: string; heading: string; description: string; questions: Question[] }
export type Template = {
  title: string; intro: string; collectionNotice: string; consentLabel: string; thankYou: string
  sections: Section[]
  welcomeSubject: string; welcomeBody: string
  welcomePack: { url: string; filename: string; mimeType: string } | null
  placeholder: boolean
}
export type Answers = Record<string, string | string[]>

const TZ = 'Australia/Sydney'
const LINK_GRACE_DAYS = 7
const RETAIN_YEARS = 7
const RETAIN_UNTIL_AGE = 25

export const questionnaireEnabled = () => process.env.QUESTIONNAIRE_ENABLED === 'true'
/** On, with a key to encrypt with and a way to send email. */
export const questionnaireReady = () => questionnaireEnabled() && encryptionReady() && emailConfigured()
export function questionnaireProblems(): string[] {
  const out: string[] = []
  if (!questionnaireEnabled()) out.push('QUESTIONNAIRE_ENABLED is not true')
  if (!encryptionReady()) out.push('QUESTIONNAIRE_ENCRYPTION_KEY is missing or not 32 bytes of base64')
  if (!emailConfigured()) out.push('email is not set up (SMTP2GO_API_KEY or RESEND_API_KEY, and BOOKING_FROM)')
  return out
}

// ---------------------------------------------------------------- the placeholder questionnaire
/** Used until Lorna's original is loaded in the dashboard. Clearly marked as a placeholder on the page. */
export const PLACEHOLDER: Omit<Template, 'welcomePack' | 'placeholder'> = {
  title: 'New Patient Questionnaire',
  intro: 'Please take your time; there are no right or wrong answers, and you can leave anything you would rather talk about in person.',
  collectionNotice: 'The Anxious Patient Experience team at The Cronulla Dentists collects the information in this questionnaire to plan and provide your dental care safely and to prepare for your appointment. It is health information, so it is stored securely in Australia, encrypted, and seen only by the team members who look after your care. It is kept for as long as health records law requires. You can ask to see or correct it at any time. Our Privacy Policy explains more. If you choose not to answer something, we can talk it through at your appointment.',
  consentLabel: 'I have read the collection notice and I agree to the APE team using my answers to plan and provide my care.',
  thankYou: 'Thank you. Your questionnaire has reached the APE team and we will read it before your appointment. There is nothing else you need to do. If anything changes, simply reply to your booking email or call the clinic.',
  sections: [
    { id: 's1', heading: 'About you', description: '', questions: [
      { id: 'q1', label: 'Full name', type: 'text', options: [], help: '', required: true },
      { id: 'q2', label: 'Date of birth', type: 'dob', options: [], help: '', required: true },
      { id: 'q3', label: 'Phone number we can reach you on', type: 'text', options: [], help: '', required: false },
      { id: 'q4', label: 'Who would you like us to contact in an emergency?', type: 'text', options: [], help: 'Name and phone number', required: false },
    ] },
    { id: 's2', heading: 'Your experience of dental care', description: 'This helps us understand what would make your visit easier.', questions: [
      { id: 'q5', label: 'How do you feel about coming to the dentist at the moment?', type: 'scale', options: [], help: '1 is completely at ease, 10 is extremely anxious', required: false },
      { id: 'q6', label: 'Is there anything about past dental visits you would like us to know?', type: 'textarea', options: [], help: '', required: false },
      { id: 'q7', label: 'What tends to help you feel more comfortable?', type: 'multi', options: ['Knowing what will happen before it happens', 'Being able to pause with a hand signal', 'Quiet, with no small talk', 'Music or headphones', 'Having someone with me', 'Something else (tell us below)'], help: '', required: false },
      { id: 'q8', label: 'Anything else you would like us to know before you arrive?', type: 'textarea', options: [], help: '', required: false },
    ] },
    { id: 's3', heading: 'Your health', description: 'Please answer as fully as you can. Your dentist will go through this with you.', questions: [
      { id: 'q9', label: 'Are you currently taking any medications?', type: 'yesno', options: [], help: '', required: false },
      { id: 'q10', label: 'If yes, please list them', type: 'textarea', options: [], help: '', required: false },
      { id: 'q11', label: 'Do you have any allergies?', type: 'yesno', options: [], help: '', required: false },
      { id: 'q12', label: 'If yes, please list them', type: 'textarea', options: [], help: '', required: false },
      { id: 'q13', label: 'Are you under the care of a doctor for any condition at the moment?', type: 'yesno', options: [], help: '', required: false },
      { id: 'q14', label: 'Name of your GP or medical centre', type: 'text', options: [], help: '', required: false },
    ] },
    { id: 's4', heading: 'Confirmation', description: '', questions: [
      { id: 'q15', label: 'Please type your full name as your signature', type: 'signature', options: [], help: 'Typing your name confirms the answers above are accurate as far as you know.', required: true },
      { id: 'q16', label: 'Date', type: 'date', options: [], help: '', required: true },
    ] },
  ],
  welcomeSubject: `Welcome to ${TM}: your welcome pack and questionnaire`,
  welcomeBody: 'Hi {first},\n\nThank you for booking with The Anxious Patient Experience. Your appointment is on {when}.\n\nYour welcome pack is attached to this email (and here: {pack}). It explains what to expect, how to find us and what to bring.\n\nBefore you come in, please fill in your new patient questionnaire online, in your own time, using your private link:\n{link}\n\nIt helps us prepare properly for you. If you would rather talk anything through in person, that is completely fine too.\n\nIf anything changes or you have a question, simply reply to this email or call the clinic.\n\nWarm regards,\nThe Anxious Patient Experience team',
}
export const PLACEHOLDER_PACK = { url: '/downloads/ape-welcome-pack-PLACEHOLDER.pdf', filename: 'APE-welcome-pack-PLACEHOLDER.pdf', mimeType: 'application/pdf' }

const str = (v: unknown) => String(v ?? '').trim()
const lines = (v: unknown) => str(v).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

/** The questionnaire as loaded in the dashboard, or the placeholder when nothing is loaded yet. */
export async function loadTemplate(payload: Payload): Promise<Template> {
  const g = await payload.findGlobal({ slug: 'questionnaire', depth: 1, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  const sections: Section[] = ((g?.sections as any[]) || []).map((s, i) => ({
    id: `s${i + 1}`, heading: str(s.heading), description: str(s.description),
    questions: ((s.questions as any[]) || []).map((q, j) => ({
      id: `s${i + 1}q${j + 1}`, label: str(q.label), type: (str(q.type) || 'text') as QuestionType, options: lines(q.options), help: str(q.help), required: !!q.required,
    })).filter((q) => q.label),
  })).filter((s) => s.heading)
  const placeholder = !sections.length
  const pack = g?.welcomePack && typeof g.welcomePack === 'object' && g.welcomePack.url
    ? { url: String(g.welcomePack.url), filename: String(g.welcomePack.filename || 'welcome-pack.pdf'), mimeType: String(g.welcomePack.mimeType || 'application/pdf') }
    : null
  return {
    title: str(g?.title) || PLACEHOLDER.title,
    intro: placeholder ? PLACEHOLDER.intro : str(g?.intro),
    collectionNotice: str(g?.collectionNotice) || PLACEHOLDER.collectionNotice,
    consentLabel: str(g?.consentLabel) || PLACEHOLDER.consentLabel,
    thankYou: str(g?.thankYou) || PLACEHOLDER.thankYou,
    sections: placeholder ? PLACEHOLDER.sections : sections,
    welcomeSubject: str(g?.welcomeSubject) || PLACEHOLDER.welcomeSubject,
    welcomeBody: str(g?.welcomeBody) || PLACEHOLDER.welcomeBody,
    welcomePack: pack,
    placeholder,
  }
}

/** Site Settings as saved now (not as last published), for the send rule and the notification list. */
export async function liveSettings(payload: Payload): Promise<{ sendWhen: 'confirmed' | 'requested'; notify: string[]; phone: string; apeEmail: string; reviewLink: string }> {
  const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  const q = s?.questionnaire || {}
  const notify = ((q.notifyEmails as { address?: string }[] | undefined) ?? []).map((r) => str(r.address)).filter(Boolean)
  const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean)
  return {
    sendWhen: q.sendWhen === 'requested' ? 'requested' : 'confirmed',
    notify: notify.length ? notify : list(process.env.BOOKING_NOTIFY_EMAIL || process.env.BOOKING_NOTIFY_TO || DEFAULT_NOTIFY_TO),
    phone: str(s?.phone) || DEFAULTS.phone,
    apeEmail: str(s?.apeEmail) || DEFAULTS.apeEmail,
    reviewLink: str(s?.googleReviewLink),
  }
}

// ---------------------------------------------------------------- the welcome email
export type BookingRow = { ref: string; name: string; email: string; slot_start: string | Date; status?: string }

async function packBytes(t: Template): Promise<{ filename: string; content: Buffer; mimetype: string } | null> {
  const pack = t.welcomePack || PLACEHOLDER_PACK
  try {
    if (/^https?:\/\//i.test(pack.url)) {
      const r = await fetch(pack.url)
      if (!r.ok) return null
      return { filename: pack.filename, content: Buffer.from(await r.arrayBuffer()), mimetype: pack.mimeType }
    }
    const local = path.join(process.cwd(), 'public', pack.url.replace(/^\/+/, ''))
    if (fs.existsSync(local)) return { filename: pack.filename, content: fs.readFileSync(local), mimetype: pack.mimeType }
    const r = await fetch(`${siteOrigin(DEFAULTS.siteUrl)}${pack.url}`)
    if (!r.ok) return null
    return { filename: pack.filename, content: Buffer.from(await r.arrayBuffer()), mimetype: pack.mimeType }
  } catch {
    return null
  }
}

const para = (l: string) => `<p style="font:16px/1.6 Arial,sans-serif;color:#284858">${escHtml(l).replace(/\n/g, '<br>')}</p>`
const linkify = (html: string) => html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#284858">$1</a>')

/**
 * Send (or resend) the welcome email for a booking. Makes the questionnaire row and its private link the first time;
 * a resend gives the patient a fresh link (the old one stops working) unless they have already submitted.
 */
export async function sendWelcome(payload: Payload, b: BookingRow, opts: { resend?: boolean; by?: string } = {}): Promise<{ sent: boolean; reason?: string }> {
  if (!questionnaireEnabled()) return { sent: false, reason: 'off' }
  const problems = questionnaireProblems()
  if (problems.length) return { sent: false, reason: problems.join('; ') }
  const t = await loadTemplate(payload)
  const settings = await liveSettings(payload)
  const start = new Date(b.slot_start)
  const expires = new Date(start.getTime() + LINK_GRACE_DAYS * 86400000)
  const existing = await payload.find({ collection: 'questionnaires', where: { bookingRef: { equals: b.ref } }, limit: 1, overrideAccess: true, depth: 0 })
  const row = existing.docs[0] as Record<string, any> | undefined
  if (row && !opts.resend) return { sent: false, reason: 'already sent' }
  let token = ''
  if (row?.status === 'submitted') {
    // nothing to fill in again: the pack is resent without a link
  } else {
    token = newToken()
    const data = { bookingRef: b.ref, patientName: b.name, appointmentAt: start.toISOString(), tokenHash: hashToken(token), expiresAt: expires.toISOString(), status: 'sent' as const, sentAt: new Date().toISOString() }
    if (row) await payload.update({ collection: 'questionnaires', id: row.id, data: { ...data, sentCount: Number(row.sentCount || 1) + 1 }, overrideAccess: true })
    else await payload.create({ collection: 'questionnaires', data: { ...data, sentCount: 1 }, overrideAccess: true })
  }
  const origin = siteOrigin(DEFAULTS.siteUrl)
  const link = token ? `${origin}/questionnaire/${token}` : ''
  const packUrl = (t.welcomePack || PLACEHOLDER_PACK).url
  const packLink = /^https?:\/\//i.test(packUrl) ? packUrl : `${origin}${packUrl}`
  const first = b.name.split(' ')[0] || 'there'
  const when = `${fmtDateTime(start, TZ, true)} (Sydney time)`
  let body = t.welcomeBody.split('{first}').join(first).split('{when}').join(when).split('{pack}').join(packLink)
  body = body.split('{link}').join(link || 'Your questionnaire has already been received, thank you.')
  if (t.placeholder) body = `[PLACEHOLDER WELCOME EMAIL: the practice's wording is still to come]\n\n${body}`
  const attachment = await packBytes(t)
  const sent = await deliver('welcome', {
    to: [b.email],
    reply_to: settings.apeEmail,
    subject: t.welcomeSubject,
    text: body,
    html: body.split(/\n{2,}/).map((p) => linkify(para(p))).join(''),
    ...(attachment ? { attachments: [attachment] } : {}),
  }, { ref: b.ref })
  if (!sent.ok) throw new Error(`the welcome email could not be sent: ${sent.error}`)
  if (opts.resend && opts.by) await log(payload, { userEmail: opts.by, action: 'resent', bookingRef: b.ref })
  return { sent: true }
}

/** The booking just arrived: send the pack now if Site Settings says so. */
export async function onBookingRequested(payload: Payload, b: BookingRow): Promise<void> {
  if (!questionnaireEnabled()) return
  const s = await liveSettings(payload)
  if (s.sendWhen !== 'requested') return
  await sendWelcome(payload, b).catch((err) => console.error('questionnaire: welcome email failed', b.ref, (err as Error).message))
}
/** The team confirmed the booking: send the pack now unless it went out at request time. */
export async function onBookingConfirmed(payload: Payload, b: BookingRow): Promise<{ sent: boolean; reason?: string }> {
  if (!questionnaireEnabled()) return { sent: false, reason: 'off' }
  const s = await liveSettings(payload)
  if (s.sendWhen !== 'confirmed') return { sent: false, reason: 'sent at request time' }
  return sendWelcome(payload, b).catch((err) => { console.error('questionnaire: welcome email failed', b.ref, (err as Error).message); return { sent: false, reason: (err as Error).message } })
}

// ---------------------------------------------------------------- the private link
export type TokenState = 'ok' | 'submitted' | 'expired' | 'invalid' | 'off'
export async function lookupToken(payload: Payload, token: string): Promise<{ state: TokenState; row?: Record<string, any> }> {
  if (!questionnaireEnabled()) return { state: 'off' }
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return { state: 'invalid' }
  const r = await payload.find({ collection: 'questionnaires', where: { tokenHash: { equals: hashToken(token) } }, limit: 1, overrideAccess: true, depth: 0 })
  const row = r.docs[0] as Record<string, any> | undefined
  if (!row) return { state: 'invalid' }
  if (row.status === 'submitted') return { state: 'submitted', row }
  if (new Date(row.expiresAt).getTime() < Date.now()) return { state: 'expired', row }
  return { state: 'ok', row }
}

/** Check the answers against the questions: returns the problems, empty when fine. */
export function validateAnswers(t: Template, answers: Answers): Record<string, string> {
  const problems: Record<string, string> = {}
  for (const s of t.sections) for (const q of s.questions) {
    if (q.type === 'note') continue
    const v = answers[q.id]
    const empty = v === undefined || v === null || (Array.isArray(v) ? !v.length : !String(v).trim())
    if (q.required && empty) { problems[q.id] = 'Please answer this one.'; continue }
    if (empty) continue
    if (q.type === 'multi') { if (!Array.isArray(v) || v.some((x) => !q.options.includes(x))) problems[q.id] = 'Please choose from the options.' }
    else if (q.type === 'choice') { if (!q.options.includes(String(v))) problems[q.id] = 'Please choose from the options.' }
    else if (q.type === 'yesno') { if (!['Yes', 'No'].includes(String(v))) problems[q.id] = 'Please choose Yes or No.' }
    else if (q.type === 'scale') { const n = Number(v); if (!(Number.isInteger(n) && n >= 1 && n <= 10)) problems[q.id] = 'Please choose a number from 1 to 10.' }
    else if (q.type === 'date' || q.type === 'dob') { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) problems[q.id] = 'Please enter a date.' }
    else if (String(v).length > (q.type === 'textarea' ? 4000 : 300)) problems[q.id] = 'That answer is too long.'
  }
  return problems
}

function retainUntil(appointment: Date, t: Template, answers: Answers): Date {
  let until = new Date(appointment.getTime()); until.setFullYear(until.getFullYear() + RETAIN_YEARS)
  for (const s of t.sections) for (const q of s.questions) {
    if (q.type !== 'dob') continue
    const dob = new Date(String(answers[q.id] || ''))
    if (isNaN(dob.getTime())) continue
    const eighteen = new Date(dob); eighteen.setFullYear(dob.getFullYear() + 18)
    if (appointment < eighteen) { const t25 = new Date(dob); t25.setFullYear(dob.getFullYear() + RETAIN_UNTIL_AGE); if (t25 > until) until = t25 }
  }
  return until
}

/** Save the patient's answers (encrypted) and tell the team. */
export async function submitAnswers(payload: Payload, token: string, answers: Answers): Promise<{ ok: true } | { ok: false; state: TokenState } | { ok: false; state: 'invalid_answers'; problems: Record<string, string> }> {
  const found = await lookupToken(payload, token)
  if (found.state !== 'ok' || !found.row) return { ok: false, state: found.state }
  const t = await loadTemplate(payload)
  // keep only answers to questions that exist
  const clean: Answers = {}
  for (const s of t.sections) for (const q of s.questions) {
    const v = answers[q.id]
    if (v === undefined || v === null) continue
    clean[q.id] = Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).slice(0, 50) : str(v)
  }
  const problems = validateAnswers(t, clean)
  if (Object.keys(problems).length) return { ok: false, state: 'invalid_answers', problems }
  const row = found.row
  const appointment = new Date(row.appointmentAt)
  const sealed = seal(JSON.stringify({ answers: clean, questions: t.sections, title: t.title, submittedAt: new Date().toISOString() }))
  await payload.update({
    collection: 'questionnaires', id: row.id, overrideAccess: true,
    data: { status: 'submitted', submittedAt: new Date().toISOString(), sealed: JSON.stringify(sealed), retainUntil: retainUntil(appointment, t, clean).toISOString() },
  })
  await notifyTeam(payload, row).catch((err) => console.error('questionnaire: notification failed', row.bookingRef, (err as Error).message))
  return { ok: true }
}

async function alertQuestionnaire(ref: string) {
  const { alertGya } = await import('@/booking/emails')
  await alertGya('questionnaire received email to the team', ref).catch(() => {})
}

/** "A questionnaire has arrived": reference and appointment date only (v1.8.3: no name). */
async function notifyTeam(_payload: Payload, row: Record<string, any>): Promise<void> {
  const when = fmtDateTime(new Date(row.appointmentAt), TZ, true)
  const link = `${siteOrigin(DEFAULTS.siteUrl)}/admin/questionnaires/${row.id}`
  const text = `A new patient questionnaire has been completed for booking ${row.bookingRef} (appointment ${when}).\n\nRead it in the dashboard (sign in needed, and only people with questionnaire access can open it):\n${link}\n\nThe answers are never included in email.`
  // v1.8.3: the questionnaire list if one is set, else the same team list as the booking emails
  const live = await liveRecipients()
  const r = await deliver('questionnaire-team', {
    to: live.questionnaire.length ? live.questionnaire : live.team.list,
    subject: `Questionnaire received ${row.bookingRef}, ${fmtDateTime(new Date(row.appointmentAt), TZ, false)}`,
    text,
    html: text.split(/\n{2,}/).map((p) => linkify(para(p))).join(''),
  }, { ref: row.bookingRef })
  if (!r.ok) await alertQuestionnaire(row.bookingRef)
}

// ---------------------------------------------------------------- reading answers (dashboard)
export type DashUser = { id: string | number; email: string; role: string; canViewQuestionnaires?: boolean }
export const canView = (u: DashUser | null | undefined) => !!u && !!u.canViewQuestionnaires

export async function log(payload: Payload, e: { userEmail: string; userId?: string | number; action: 'viewed' | 'printed' | 'reviewed' | 'unreviewed' | 'deleted' | 'denied' | 'resent'; bookingRef?: string; questionnaire?: string | number; note?: string }): Promise<void> {
  await payload.create({
    collection: 'questionnaire-log', overrideAccess: true,
    data: { at: new Date().toISOString(), userEmail: e.userEmail, userId: e.userId === undefined ? undefined : String(e.userId), action: e.action, bookingRef: e.bookingRef, questionnaire: e.questionnaire === undefined ? undefined : String(e.questionnaire), note: e.note },
  }).catch((err) => console.error('questionnaire: log failed', (err as Error).message))
}

export type ListRow = { id: string; bookingRef: string; patientName: string; appointmentAt: string; status: string; sentAt: string | null; submittedAt: string | null; reviewed: boolean; reviewedBy: string; reviewedAt: string | null; retainUntil: string | null; sentCount: number }
const listRow = (d: Record<string, any>): ListRow => ({
  id: String(d.id), bookingRef: String(d.bookingRef), patientName: String(d.patientName || ''), appointmentAt: String(d.appointmentAt || ''), status: String(d.status),
  sentAt: d.sentAt || null, submittedAt: d.submittedAt || null, reviewed: !!d.reviewed, reviewedBy: String(d.reviewedBy || ''), reviewedAt: d.reviewedAt || null, retainUntil: d.retainUntil || null, sentCount: Number(d.sentCount || 1),
})

/** Every questionnaire row (no answers), newest first. The list itself is for people with access. */
export async function listQuestionnaires(payload: Payload): Promise<ListRow[]> {
  const r = await payload.find({ collection: 'questionnaires', limit: 500, sort: '-submittedAt', overrideAccess: true, depth: 0 })
  return (r.docs as Record<string, any>[]).map(listRow).sort((a, b) => ((b.submittedAt || b.sentAt || '') > (a.submittedAt || a.sentAt || '') ? 1 : -1))
}

/** Status per booking reference, for the Bookings screen. */
export async function statusByRef(payload: Payload): Promise<Record<string, { status: string; submittedAt: string | null; sentAt: string | null; id: string }>> {
  const out: Record<string, { status: string; submittedAt: string | null; sentAt: string | null; id: string }> = {}
  try {
    const r = await payload.find({ collection: 'questionnaires', limit: 1000, overrideAccess: true, depth: 0, select: { bookingRef: true, status: true, submittedAt: true, sentAt: true } })
    for (const d of r.docs as Record<string, any>[]) out[String(d.bookingRef)] = { status: String(d.status), submittedAt: d.submittedAt || null, sentAt: d.sentAt || null, id: String(d.id) }
  } catch { /* no table yet */ }
  return out
}

export async function countUnreviewed(payload: Payload): Promise<number> {
  try {
    return (await payload.count({ collection: 'questionnaires', where: { and: [{ status: { equals: 'submitted' } }, { reviewed: { not_equals: true } }] }, overrideAccess: true })).totalDocs
  } catch {
    return 0
  }
}

/** Decrypt one questionnaire for a person with access, and log it. */
export async function openQuestionnaire(payload: Payload, id: string, user: DashUser): Promise<{ row: ListRow; answers: Answers; questions: Section[]; title: string } | null> {
  const d = await payload.findByID({ collection: 'questionnaires', id, overrideAccess: true, depth: 0 }).catch(() => null) as Record<string, any> | null
  if (!d) return null
  if (!canView(user)) {
    await log(payload, { userEmail: user.email, userId: user.id, action: 'denied', bookingRef: d.bookingRef, questionnaire: id })
    throw Object.assign(new Error('no access'), { status: 403 })
  }
  await log(payload, { userEmail: user.email, userId: user.id, action: 'viewed', bookingRef: d.bookingRef, questionnaire: id })
  if (d.status !== 'submitted' || !d.sealed) return { row: listRow(d), answers: {}, questions: [], title: '' }
  const plain = JSON.parse(unseal(JSON.parse(d.sealed) as Sealed)) as { answers: Answers; questions: Section[]; title: string }
  return { row: listRow(d), answers: plain.answers, questions: plain.questions, title: plain.title }
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
  await log(payload, { userEmail: user.email, userId: user.id, action: 'deleted', bookingRef: d.bookingRef, questionnaire: id, note: `retain until ${d.retainUntil || 'n/a'}` })
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
