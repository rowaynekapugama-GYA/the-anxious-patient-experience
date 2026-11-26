/**
 * v1.18.0: sending a finalised treatment plan to the patient, one of three ways (Treatment plans > Settings):
 *
 *   link        a branded email with a button to a private link (the default). The PDF sits behind the link, which
 *               expires, can be revoked, and can ask for the patient's date of birth first.
 *   password    the PDF attached, protected with a password the team gives the patient by phone or SMS. The password
 *               is shown once on screen to the person sending, and is never stored, logged or emailed.
 *   attachment  the PDF attached, no password.
 *
 * Whichever is used, the email says only that a plan is ready: no findings, treatments or fees in the subject or the
 * body. The address is the one on the booking (shown on screen first, with a confirm step); it is never typed.
 * Every send is recorded: who, when, to which address, how, and which version.
 */
import type { Payload } from 'payload'
import { deliver } from '@/lib/mailer'
import { emailConfigured, siteOrigin } from '@/lib/email'
import { liveRecipients } from '@/lib/recipients'
import { getSettings } from '@/lib/site'
import { DEFAULTS } from '@/site.config'
import { shell, paragraphs, button, panel, small, patientFooter } from '@/email/layout'
import * as store from './store'
import { renderPlanPdf } from './pdf'

export const SUBJECT = 'Your treatment plan from The Anxious Patient Experience'

/** The patient email. No plan content: the first name, that a plan is ready, and how to open it. */
export function planEmail(o: { mode: store.SendMode; firstName: string; link?: string; expiresAt?: string; askDob?: boolean; privacyLine?: string; test?: boolean }) {
  const s = getSettings()
  const origin = siteOrigin(DEFAULTS.siteUrl)
  const until = o.expiresAt ? new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(o.expiresAt)) : ''
  const hi = `Hi ${o.firstName || 'there'},`
  const lead = 'Your treatment plan from The Anxious Patient Experience is ready.'
  const how = o.mode === 'link'
    ? `You can open it with the button below${o.askDob ? '. We will ask for your date of birth first, to check it is you' : ''}. For your privacy, the link works until ${until}. If it has stopped working, just reply to this email and we will send you a new one.`
    : o.mode === 'password'
      ? 'Your plan is attached to this email as a PDF. It is protected with a password, which we will give you by phone or text message. We never send the password by email.'
      : 'Your plan is attached to this email as a PDF.'
  const questions = `There is no rush to read it. If you have any questions, reply to this email or call us on ${s.phone}.`
  const lines = [...(o.test ? ['TEST EMAIL. No plan was sent to a patient.'] : []), hi, lead, how, questions, ...(o.privacyLine ? [o.privacyLine] : [])]
  const sections = [
    paragraphs([hi, lead].join('\n\n')),
    ...(o.mode === 'link' && o.link ? [paragraphs(how), button('Open your treatment plan', o.link)] : [paragraphs(how)]),
    paragraphs(questions),
    ...(o.privacyLine ? [small(o.privacyLine)] : []),
  ]
  const clinic = `${s.clinic.name}, ${s.clinic.street}, ${s.clinic.suburb} ${s.clinic.state} ${s.clinic.postcode}`
  const subject = `${o.test ? '[TEST] ' : ''}${SUBJECT}`
  const html = shell({
    origin, variant: 'patient', subject, preheader: lead, eyebrow: 'The Anxious Patient Experience', heading: 'Your treatment plan',
    sections: o.test ? [panel([['Test', 'No plan was sent to a patient.']]), ...sections] : sections,
    signoff: 'Warm regards,', sender: 'The APE team',
    footer: patientFooter({ clinicLine: clinic, email: s.apeEmail, phone: s.phone }),
  }).html
  return { subject, text: [...lines, 'Warm regards,\nThe APE team'].join('\n\n') + (o.link ? `\n\nOpen your treatment plan: ${o.link}` : ''), html }
}

export type SendResult = { ok: boolean; to: string; method: store.SendMode; version: number; error: string; password?: string; expiresAt?: string }

/**
 * Send the newest finalised version of a plan to the address on its booking. `expectTo` is the address the person
 * confirmed on screen: if the booking's address changed in between, nothing is sent.
 */
export async function sendPlan(payload: Payload, u: store.PlanUser, planNo: number, expectTo: string): Promise<SendResult> {
  if (!emailConfigured()) throw new store.PlanError(503, 'no_email')
  const fin = await store.latestFinal(planNo)
  if (!fin) throw new store.PlanError(409, 'not_final')
  const c = await store.contentFor(fin.id)
  const to = await store.bookingEmail(c.plan.booking_ref)
  if (!to) throw new store.PlanError(400, 'no_address')
  if (to.toLowerCase() !== String(expectTo || '').trim().toLowerCase()) throw new store.PlanError(409, 'address_changed')
  const s = await store.readSettings()
  const live = await liveRecipients()
  const filename = `APE-treatment-plan-v${fin.version}.pdf`
  let msg: { subject: string; text: string; html: string }
  let attachments: { filename: string; content: Buffer; mimetype: string }[] = []
  let password: string | undefined
  let expiresAt: string | undefined
  if (s.sendMode === 'link') {
    // a resend replaces the earlier link, so only one link to this plan works at a time
    await store.revokeLinks(u, planNo)
    const l = await store.issueLink(u, fin.id, s.linkDays)
    expiresAt = l.expiresAt
    const link = `${siteOrigin(DEFAULTS.siteUrl)}/plan/${l.token}/`
    msg = planEmail({ mode: 'link', firstName: c.identity.firstName, link, expiresAt, askDob: s.askDob && !!c.identity.dob, privacyLine: s.privacyLine })
  } else {
    if (s.sendMode === 'password') password = store.newPdfPassword()
    const pdf = await renderPlanPdf({ form: c.form, answers: c.answers, identity: c.identity, version: fin.version, finalisedAt: c.plan.finalised_at ? new Date(c.plan.finalised_at).toISOString() : null, clinician: s.clinician, password })
    attachments = [{ filename, content: pdf, mimetype: 'application/pdf' }]
    msg = planEmail({ mode: s.sendMode, firstName: c.identity.firstName, privacyLine: s.privacyLine })
  }
  const r = await deliver('plan', { to: [to], reply_to: live.apeInbox, ...msg, ...(attachments.length ? { attachments } : {}) }, { ref: c.plan.booking_ref })
  await store.recordSend({ planId: fin.id, by: u.email, to, method: s.sendMode, version: fin.version, ok: r.ok, id: r.id, error: r.ok ? '' : r.error })
  await store.logPlan({ by: u.email, action: r.ok ? 'sent' : 'send failed', planNo, version: fin.version, ref: c.plan.booking_ref, note: s.sendMode === 'link' ? 'secure link' : s.sendMode === 'password' ? 'password protected PDF attached' : 'PDF attached' })
  return { ok: r.ok, to, method: s.sendMode, version: fin.version, error: r.ok ? '' : 'The email could not be sent. Please try again in a minute, or contact GYA.', ...(r.ok && password ? { password } : {}), ...(expiresAt ? { expiresAt } : {}) }
}
