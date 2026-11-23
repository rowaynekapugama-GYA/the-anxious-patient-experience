/**
 * Patient emails (v1.14.0): the wording of the emails patients receive, edited in the dashboard. Any signed-in user
 * (Lorna and editors, and GYA).
 *
 *   GET                                  every patient email: its wording, defaults, merge fields, locked parts, versions
 *   POST { action: 'preview', kind, template }   the email with sample details (HTML and plain text), plus the checks
 *   POST { action: 'save', kind, template }      checked, then saved (errors block; AHPRA words only warn)
 *   POST { action: 'reset', kind }               back to the default wording
 *   POST { action: 'restore', kind, id }         a saved version becomes the wording in use
 *   POST { action: 'test', kind, template? }     a [TEST] copy to the signed-in person's own address only
 *
 * Sending reads the saved wording at send time, so nothing needs a rebuild or Publish.
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import * as tpl from '@/email/patient'
import { BANNERS } from '@/email/layout'
import * as core from '@/booking/core'
import * as emails from '@/booking/emails'
import { depositEmails } from '@/booking/deposit'
import * as q from '@/lib/questionnaire'
import { allow, deliver } from '@/lib/mailer'
import { emailConfigured, siteOrigin } from '@/lib/email'
import { liveRecipients } from '@/lib/recipients'
import { policyReminder, loadTerms } from '@/booking/terms'
import { DEFAULTS } from '@/site.config'
import type { Payload } from 'payload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type P = Payload

async function legacy(payload: P): Promise<tpl.Legacy> {
  return q.legacyWelcome(await q.loadWords(payload))
}

function sampleBooking(address: string): emails.BookingRow {
  const start = new Date(Date.now() + 7 * 86400000)
  start.setUTCHours(23, 20, 0, 0)
  return {
    ref: 'APE-TEST01', slot_start: start, name: 'Test Patient GYA', email: address, phone: '0400 000 000',
    notes: '', price: 250, special: true, status: 'requested', created_at: new Date(),
    first_name: 'Test', last_name: 'Patient GYA', dob: '1990-03-14',
  }
}

/** One patient email with sample details: Test Patient GYA, APE-TEST01, a week from now at 10:20 am. */
async function sample(payload: P, kind: tpl.PatientKind, template: tpl.Template, o: { test?: boolean; to?: string } = {}): Promise<core.Email> {
  const d = core.db()
  const cfg = d ? core.loadConfig(await core.readOverrides(d).catch(() => ({}))) : core.loadConfig()
  const live = await liveRecipients()
  const b = sampleBooking(o.to || 'test.patient@example.com')
  if (kind === 'booking-patient') {
    const terms = await loadTerms(payload)
    return emails.patientEmail(cfg, b, live.apeInbox, { test: o.test, template, policyText: terms.saved ? terms.text : null })
  }
  if (kind === 'deposit-patient') return depositEmails(cfg, b, cfg.pricing.deposit, 'TEST-CAPTURE', live.apeInbox, [], { test: o.test, template }).patient
  const where = await q.place(payload)
  const sw = await q.packSwitches(payload)
  const m = q.welcomeEmail({
    words: { subject: '', body: '' }, template, ref: b.ref, name: b.name, slotStart: new Date(b.slot_start), where, test: o.test,
    link: sw.online ? `${siteOrigin(DEFAULTS.siteUrl)}/questionnaire/sample-private-link` : null,
  })
  return { to: [b.email], reply_to: where.apeEmail, ...m }
}

async function state(payload: P) {
  const lg = await legacy(payload)
  const terms = await loadTerms(payload)
  const d = core.db()
  const cfg = d ? core.loadConfig(await core.readOverrides(d).catch(() => ({}))) : core.loadConfig()
  const policyLine = policyReminder(terms.saved ? terms.text : null, { phone: cfg.contact.phone, deposit: core.money(cfg.pricing.deposit) })
  const list = []
  for (const kind of tpl.PATIENT_KINDS) {
    const def = tpl.DEFS[kind]
    const cur = await tpl.load(kind, lg)
    list.push({
      kind,
      name: def.name,
      when: def.when,
      template: cur.template,
      saved: cur.saved,
      updatedAt: cur.updatedAt,
      updatedBy: cur.updatedBy,
      defaults: tpl.baseFor(kind, lg),
      fields: def.fields.map((k) => ({ key: k, help: tpl.FIELDS[k] })),
      markers: def.markers.map((k) => ({ key: k, help: tpl.MARKERS[k] })),
      locked: def.locked,
      rules: def.rules,
      policyLine: kind === 'booking-patient' ? `${policyLine} You can read the full deposit policy here: ${siteOrigin(DEFAULTS.siteUrl)}/book-now/terms/` : '',
      versions: (await tpl.versions(kind)).map((v) => ({ id: v.id, savedAt: v.savedAt, savedBy: v.savedBy, note: v.note, subject: v.template.subject })),
    })
  }
  return {
    ok: true,
    emails: list,
    banners: [{ key: 'none', label: 'No photo' }, ...Object.entries(BANNERS).map(([key, b]) => ({ key, label: b.label, url: `/email/${b.file}` }))],
    targets: Object.entries(tpl.TARGETS).map(([key, label]) => ({ key, label })),
    limits: tpl.LIMITS,
    emailReady: emailConfigured(),
  }
}

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  return json(200, await state(payload))
}

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json(400, { ok: false, error: 'invalid' }) }
  const kind = b.kind
  if (!tpl.isPatientKind(kind)) return json(400, { ok: false, error: 'invalid', message: 'Unknown email.' })
  const lg = await legacy(payload)
  const by = String(user.email || '')

  switch (b.action) {
    case 'preview': {
      const t = tpl.normalise(kind, b.template, tpl.baseFor(kind, lg))
      const c = tpl.check(kind, t)
      const m = await sample(payload, kind, t)
      // in the dashboard the photos and fonts load from the address the dashboard is open on (the email itself uses the live address)
      const o = siteOrigin(DEFAULTS.siteUrl)
      const html = m.html.split(`src="${o}/`).join('src="/').split(`url('${o}/`).join("url('/")
      return json(200, { ok: true, subject: m.subject, html, text: m.text, bytes: Buffer.byteLength(m.html), ...c })
    }
    case 'save': {
      const t = tpl.normalise(kind, b.template, tpl.baseFor(kind, lg))
      const c = tpl.check(kind, t)
      if (c.errors.length) return json(400, { ok: false, error: 'invalid', message: c.errors[0], ...c })
      await tpl.save(kind, t, by)
      return json(200, { ...(await state(payload)), warnings: c.warnings })
    }
    case 'reset': {
      await tpl.reset(kind, by, lg)
      return json(200, await state(payload))
    }
    case 'restore': {
      const v = await tpl.version(kind, String(b.id || ''))
      if (!v) return json(404, { ok: false, error: 'not_found', message: 'That version is no longer kept.' })
      const c = tpl.check(kind, v.template)
      if (c.errors.length) return json(400, { ok: false, error: 'invalid', message: c.errors[0], ...c })
      await tpl.save(kind, v.template, by, `Restored the version from ${new Date(v.savedAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`)
      return json(200, await state(payload))
    }
    case 'test': {
      if (!emailConfigured()) return json(503, { ok: false, error: 'not_configured', message: 'Email is not set up yet (GYA).' })
      const to = String(user.email || '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json(400, { ok: false, error: 'invalid', message: 'Your login has no email address to send to.' })
      if (!(await allow(`patient-email-test:${to}`, 6, 60))) return json(429, { ok: false, error: 'busy', message: 'Test emails can be sent 6 times an hour. Please try again a little later.' })
      const cur = await tpl.load(kind, lg)
      const t = b.template ? tpl.normalise(kind, b.template, cur.template) : cur.template
      const c = tpl.check(kind, t)
      if (c.errors.length) return json(400, { ok: false, error: 'invalid', message: c.errors[0], ...c })
      const m = await sample(payload, kind, t, { test: true, to })
      const attachments = kind === 'welcome' ? (await q.packAttachments(payload)).attachments : []
      const r = await deliver(kind, { ...m, to: [to], bcc: undefined, ...(attachments.length ? { attachments } : {}) }, { ref: 'APE-TEST01', test: true })
      if (!r.ok) return json(502, { ok: false, error: 'send_failed', message: 'The test email was not accepted. GYA can see why on the email check screen.' })
      return json(200, { ok: true, to, id: r.id })
    }
  }
  return json(400, { ok: false, error: 'invalid' })
}
