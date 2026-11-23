/**
 * v1.14.0: the patient emails, branded, with wording the practice edits in the dashboard (Patient emails).
 *
 *   booking-patient  "We have received your booking request"   when a request arrives (or once the deposit is paid)
 *   welcome          "Your APE appointment is confirmed"       on Mark confirmed, with the Patient Guide and questionnaire
 *   deposit-patient  "Deposit received"                        when a deposit is paid after the booking (pay link)
 *
 * Each has an editable template (subject, preheader, eyebrow, heading, main and second message, button, banner photo,
 * sign-off). The parts that must stay right are added by the website and cannot be edited here: the appointment
 * details box, the deposit status, the deposit policy line (Lorna's approved wording), the under-18 line, the
 * questionnaire paragraph and "Where to go".
 *
 * The defaults are the wording the emails used before v1.14.0, word for word, so nothing changes for patients until
 * the wording is edited. Saved wording is in ape_email_templates; the last 10 saved versions of each email are kept in
 * ape_email_template_versions. Both tables are additive (src/booking/core.ts SCHEMA). Sending reads the saved wording
 * at send time: no rebuild or Publish needed.
 */
import * as core from '@/booking/core'
import { BANNERS, type BannerKey, type Section, button, esc, linkify, note, panel, patientFooter, shell } from './layout'

export const PATIENT_KINDS = ['booking-patient', 'welcome', 'deposit-patient'] as const
export type PatientKind = typeof PATIENT_KINDS[number]
export const isPatientKind = (k: unknown): k is PatientKind => PATIENT_KINDS.includes(k as PatientKind)

export const TARGETS = {
  none: 'No button',
  questionnaire: 'The patient\'s questionnaire link',
  book: 'Book Now page',
  home: 'APE homepage',
  contact: 'Contact the team (email)',
} as const
export type ButtonTarget = keyof typeof TARGETS

export type Template = {
  subject: string
  preheader: string
  eyebrow: string
  heading: string
  main: string
  second: string
  buttonLabel: string
  buttonTarget: ButtonTarget
  banner: BannerKey | 'none'
  signoff: string
  sender: string
}
export const TEMPLATE_KEYS: (keyof Template)[] = ['subject', 'preheader', 'eyebrow', 'heading', 'main', 'second', 'buttonLabel', 'buttonTarget', 'banner', 'signoff', 'sender']
export const LIMITS: Record<Exclude<keyof Template, 'buttonTarget' | 'banner'>, number> = {
  subject: 120, preheader: 90, eyebrow: 60, heading: 120, main: 4000, second: 4000, buttonLabel: 40, signoff: 80, sender: 80,
}

/** The merge fields, with what each becomes. */
export const FIELDS = {
  first_name: 'The patient\'s first name',
  reference: 'The booking reference, for example APE-4F2A9C',
  appointment_date: 'The appointment day, for example Wednesday 2 December 2026',
  appointment_time: 'The appointment time, for example 9:00 am',
  appointment_length: 'How long the appointment is (70 minutes)',
  location: 'Where the appointment is: the clinic name and address',
  deposit_amount: 'The deposit amount, for example $100',
  questionnaire_link: 'The patient\'s private questionnaire link (only while the online questionnaire is on)',
  contact_phone: 'The clinic phone number',
  contact_email: 'The APE email address',
} as const
export type FieldKey = keyof typeof FIELDS
/** Blocks the website fills in, placed on a line of their own. */
export const MARKERS = { where_to_go: 'The "Where to go" box: address, map link, train and parking directions' } as const
export type MarkerKey = keyof typeof MARKERS

export type EmailDef = {
  kind: PatientKind
  name: string
  when: string
  fields: FieldKey[]
  markers: MarkerKey[]
  /** what the website adds that cannot be edited here */
  locked: string[]
  /** plain words for the rules checked on save */
  rules: string[]
}

const T = core.TM
const BASE_FIELDS: FieldKey[] = ['first_name', 'reference', 'appointment_date', 'appointment_time', 'appointment_length', 'location', 'deposit_amount', 'contact_phone', 'contact_email']

export const DEFS: Record<PatientKind, EmailDef> = {
  'booking-patient': {
    kind: 'booking-patient',
    name: 'Booking request received',
    when: 'As soon as a patient books on the website (with online payment, once the deposit is paid).',
    fields: BASE_FIELDS,
    markers: [],
    locked: [
      'The appointment details box: requested time, location, fee and reference.',
      'The deposit line: paid, or how to pay it (with the pay link while online payment is on).',
      'The deposit policy line and the link to the full policy, from the approved Deposit policy in Site Settings.',
      'For patients under 18: "As you\'re under 18, please bring your parent or guardian to your first visit."',
    ],
    rules: ['A subject, a heading and a main message.'],
  },
  welcome: {
    kind: 'welcome',
    name: 'Appointment confirmed (welcome pack)',
    when: 'When you press Mark confirmed on a booking, with the Patient Guide and questionnaire PDFs attached.',
    fields: [...BASE_FIELDS, 'questionnaire_link'],
    markers: ['where_to_go'],
    locked: [
      'The appointment details box: date and time, length, location and reference.',
      'The questionnaire paragraph: the online link while the online questionnaire is on, otherwise "bring it with you", or a thank you once it has been received.',
      'For patients under 18: "As you\'re under 18, please bring your parent or guardian to your first visit."',
      'If a PDF could not be attached, links to download it.',
    ],
    rules: [
      'A subject, a heading and a main message.',
      'The questionnaire link must stay: either the button goes to "The patient\'s questionnaire link", or the wording includes {questionnaire_link}.',
    ],
  },
  'deposit-patient': {
    kind: 'deposit-patient',
    name: 'Deposit received',
    when: 'When a patient pays their deposit later, from the pay link in their email (with online payment).',
    fields: BASE_FIELDS,
    markers: [],
    locked: ['The details box: requested time, reference and the PayPal transaction.'],
    rules: ['A subject, a heading and a main message.'],
  },
}

// ---------------------------------------------------------------- defaults (the wording before v1.14.0)

/** The welcome email as one text, as it was edited in Site Settings > Welcome pack before v1.14.0. */
export const LEGACY_WELCOME = {
  subject: 'Your APE appointment is confirmed',
  body: `Hi {first},

Thank you for booking your first visit with The Anxious Patient Experience at The Cronulla Dentists. Your appointment is confirmed for {when}, and we're looking forward to meeting you.

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
Dr Lorna, Alex and the APE team`,
}

/**
 * Turn the old one-piece welcome wording into the new template, so whatever was saved in Welcome pack carries over.
 * Old tokens become merge fields: {first} {first_name}, {when} "{appointment_date}, {appointment_time} (Sydney time)",
 * {phone} {contact_phone}, {where} (and its "Where to go" line) the Where to go box. What comes before {questionnaire}
 * is the main message, what comes after is the second message, and a closing "line,\nname" is the sign-off.
 */
export function fromLegacyWelcome(subject: string, body: string): Template {
  const conv = (s: string) => s
    .replace(/\{first\}/g, '{first_name}')
    .replace(/\{when\}/g, '{appointment_date}, {appointment_time} (Sydney time)')
    .replace(/\{phone\}/g, '{contact_phone}')
    .replace(/(^|\n)Where to go\n\n\{where\}/, '$1{where_to_go}')
    .replace(/\{where\}/g, '{where_to_go}')
  const text = String(body || LEGACY_WELCOME.body).replace(/\r\n?/g, '\n').trim()
  const [before, after = ''] = text.split('{questionnaire}')
  const paras = after.trim().split(/\n{2,}/)
  const last = paras[paras.length - 1] || ''
  const lines = last.split('\n')
  const isSign = lines.length === 2 && lines[0].length <= 40 && /,$/.test(lines[0])
  const second = isSign ? paras.slice(0, -1).join('\n\n') : paras.join('\n\n')
  return {
    subject: (subject || LEGACY_WELCOME.subject).slice(0, LIMITS.subject),
    preheader: 'Your appointment is confirmed, and your Patient Guide and questionnaire are attached.',
    eyebrow: 'New Patient Appointment',
    heading: 'Your appointment is confirmed',
    main: conv(before.trim()),
    second: conv(second.trim()),
    buttonLabel: 'Fill in your questionnaire',
    buttonTarget: 'questionnaire',
    banner: 'armchair',
    signoff: isSign ? lines[0] : '',
    sender: isSign ? lines[1] : '',
  }
}

export function defaultTemplate(kind: PatientKind): Template {
  switch (kind) {
    case 'booking-patient': return {
      subject: `We have received your booking request | ${T}`,
      preheader: `Thank you for your booking request for ${T} New Patient Appointment.`.slice(0, LIMITS.preheader),
      eyebrow: 'New Patient Appointment',
      heading: 'We have received your booking request',
      main: `Hi {first_name},\n\nThank you for your booking request for ${T} New Patient Appointment.`,
      second: `The APE team will be in touch to confirm your appointment and send your new patient information pack.\n\nIf anything changes or you have a question, simply reply to this email or call us on {contact_phone}.`,
      buttonLabel: '',
      buttonTarget: 'none',
      banner: 'candle',
      signoff: 'Warm regards,',
      sender: `${T} team`,
    }
    case 'deposit-patient': return {
      subject: `Deposit received | ${T}`,
      preheader: 'Thank you, your deposit has been received.',
      eyebrow: 'New Patient Appointment',
      heading: 'Deposit received',
      main: `Hi {first_name},\n\nThank you, your {deposit_amount} deposit has been received for your ${T} New Patient Appointment.`,
      second: 'The APE team will be in touch to confirm your appointment. If anything changes, simply reply to this email.',
      buttonLabel: '',
      buttonTarget: 'none',
      banner: 'none',
      signoff: 'Warm regards,',
      sender: `${T} team`,
    }
    case 'welcome': return fromLegacyWelcome(LEGACY_WELCOME.subject, LEGACY_WELCOME.body)
  }
}

/** Anything missing or unknown in a saved template falls back to the default. */
export function normalise(kind: PatientKind, raw: unknown, base = defaultTemplate(kind)): Template {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const s = (k: keyof typeof LIMITS) => (typeof r[k] === 'string' ? String(r[k]).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, LIMITS[k]) : base[k])
  return {
    subject: s('subject').replace(/\n/g, ' '),
    preheader: s('preheader').replace(/\n/g, ' '),
    eyebrow: s('eyebrow').replace(/\n/g, ' '),
    heading: s('heading').replace(/\n/g, ' '),
    main: s('main'),
    second: s('second'),
    buttonLabel: s('buttonLabel').replace(/\n/g, ' '),
    buttonTarget: (typeof r.buttonTarget === 'string' && r.buttonTarget in TARGETS ? r.buttonTarget : base.buttonTarget) as ButtonTarget,
    banner: (typeof r.banner === 'string' && (r.banner === 'none' || r.banner in BANNERS) ? r.banner : base.banner) as BannerKey | 'none',
    signoff: s('signoff').replace(/\n/g, ' '),
    sender: s('sender').replace(/\n/g, ' '),
  }
}

// ---------------------------------------------------------------- checks on save

const AHPRA = /\b(pain[- ]?free|painless|guarantee[sd]?|best|expert|experts|miracle|perfect)\b/i

export type Check = { errors: string[]; warnings: string[] }

/** Required fields, unknown merge fields, safe links. AHPRA words only warn. */
export function check(kind: PatientKind, t: Template): Check {
  const def = DEFS[kind]
  const errors: string[] = []
  const warnings: string[] = []
  if (!t.subject.trim()) errors.push('The subject is required.')
  if (!t.heading.trim()) errors.push('The heading is required.')
  if (!t.main.trim()) errors.push('The main message is required.')
  if (t.buttonTarget !== 'none' && !t.buttonLabel.trim()) errors.push('The button needs a label, or choose "No button".')
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) if (t[k].length > LIMITS[k]) errors.push(`${label(k)} is too long (${LIMITS[k]} characters at most).`)
  const allowed = new Set<string>(def.fields)
  const markers = new Set<string>(def.markers)
  const all = Object.keys(FIELDS)
  for (const k of ['subject', 'preheader', 'eyebrow', 'heading', 'main', 'second', 'buttonLabel', 'signoff', 'sender'] as const) {
    for (const m of t[k].matchAll(/\{([^{}\n]{0,40})\}/g)) {
      const name = m[1]
      if (allowed.has(name)) continue
      if (markers.has(name)) {
        if (k !== 'main' && k !== 'second') errors.push(`{${name}} can only go in the main or second message.`)
        else if (!new RegExp(`(^|\\n)\\{${name}\\}(\\n|$)`).test(t[k].trim())) errors.push(`{${name}} needs a line of its own.`)
        continue
      }
      const guess = all.find((f) => f.replace(/_/g, '') === name.toLowerCase().replace(/[^a-z]/g, ''))
      if (all.includes(name)) errors.push(`{${name}} has no information in this email. Use one of the fields listed for it.`)
      else errors.push(`${label(k)}: {${name}} is not a merge field.${guess ? ` Did you mean {${guess}}?` : ''}`)
    }
    if (/[{}]/.test(t[k].replace(/\{[^{}\n]{0,40}\}/g, ''))) errors.push(`${label(k)} has a curly bracket that is not part of a merge field.`)
  }
  for (const k of ['main', 'second'] as const) {
    for (const m of t[k].matchAll(/\[([^\]\n]*)\]\(([^)\s]*)\)/g)) {
      if (!m[1].trim()) errors.push(`${label(k)}: a link has no words to click.`)
      if (!/^(https:\/\/|mailto:|\{(questionnaire_link)\}$)/.test(m[2])) errors.push(`${label(k)}: the link "${m[2] || '(empty)'}" must start with https:// or mailto:.`)
    }
  }
  if (kind === 'welcome' && t.buttonTarget !== 'questionnaire' && !/\{questionnaire_link\}/.test(`${t.main}\n${t.second}`)) {
    errors.push('This email must keep the questionnaire link: set the button to "The patient\'s questionnaire link", or put {questionnaire_link} in the wording.')
  }
  const words = TEMPLATE_KEYS.filter((k) => k !== 'buttonTarget' && k !== 'banner').map((k) => t[k]).join(' ')
  const hit = AHPRA.exec(words)
  if (hit) warnings.push(`"${hit[0]}" can be a problem under AHPRA's advertising rules. Words like pain-free, guaranteed, best or expert are best avoided.`)
  if (/\u2014/.test(words)) warnings.push('The wording has a long dash. A comma or a full stop reads better.')
  return { errors: [...new Set(errors)], warnings }
}
const LABELS: Record<string, string> = { subject: 'Subject', preheader: 'Preheader', eyebrow: 'Eyebrow', heading: 'Heading', main: 'Main message', second: 'Second message', buttonLabel: 'Button label', signoff: 'Sign-off line', sender: 'Sender name' }
const label = (k: string) => LABELS[k] || k

// ---------------------------------------------------------------- rendering

export type Context = {
  origin: string
  test?: boolean
  /** the line at the top of a test email (a default one when not given) */
  testNote?: string
  merge: Partial<Record<FieldKey, string>>
  /** the details box */
  panel: [string, string][]
  /** locked blocks after the main message and the details box; '{{button}}' marks where the button goes */
  system: (Section | '{{button}}')[]
  /** blocks for markers such as {where_to_go} */
  markers: Partial<Record<MarkerKey, Section>>
  /** locked blocks at the very end, before the sign-off */
  tail?: Section[]
  footer: { clinicLine: string; email: string; phone: string }
}

/** Simple formatting: **bold**, *italic*, [words](https://...), web addresses, and merge fields. */
function inline(raw: string, c: Context): Section {
  let html = ''
  let text = ''
  const re = /\[([^\]\n]+)\]\(([^)\s]+)\)/g
  let last = 0
  const plain = (s: string) => {
    const filled = s.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in FIELDS ? `\u0000${k}\u0001` : m))
    const parts = filled.split(/(\u0000[a-z_]+\u0001)/)
    for (const p of parts) {
      const f = /^\u0000([a-z_]+)\u0001$/.exec(p)
      if (f) {
        const v = c.merge[f[1] as FieldKey] ?? ''
        html += f[1] === 'questionnaire_link' && v ? `<a href="${esc(v)}" style="color:#284858;text-decoration:underline;word-break:break-all;">${esc(v)}</a>` : esc(v)
        text += v
      } else {
        html += linkify(esc(p)).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        text += p.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
      }
    }
  }
  for (const m of raw.matchAll(re)) {
    plain(raw.slice(last, m.index))
    const url = m[2] === '{questionnaire_link}' ? (c.merge.questionnaire_link || '') : m[2]
    const words = m[1]
    if (url && /^(https:\/\/|mailto:)/.test(url)) {
      html += `<a href="${esc(url)}" style="color:#284858;text-decoration:underline;">${esc(words).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')}</a>`
      text += `${words.replace(/\*/g, '')} (${url.replace(/^mailto:/, '')})`
    } else {
      html += esc(words)
      text += words
    }
    last = (m.index ?? 0) + m[0].length
  }
  plain(raw.slice(last))
  return { html, text }
}

const PS = 'margin:0 0 16px;font-family:Figtree,Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#284858;'

/** The editable messages: paragraphs, bullet lists ("- "), formatting, merge fields and marker blocks. */
export function message(src: string, c: Context): Section {
  const out: Section[] = []
  const blocks = src.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((b) => b.replace(/^\n+|\n+$/g, '')).filter((b) => b.trim())
  for (const blk of blocks) {
    const mk = /^\{([a-z_]+)\}$/.exec(blk.trim())
    if (mk && mk[1] in MARKERS) {
      const s = c.markers[mk[1] as MarkerKey]
      if (s) out.push(s)
      continue
    }
    const lines = blk.split('\n')
    const items = lines.filter((l) => /^\s*[-*•] /.test(l))
    const lead = lines.filter((l) => !/^\s*[-*•] /.test(l))
    if (lead.length) {
      const parts = lead.map((l) => inline(l, c))
      out.push({ html: `<p class="t" style="${PS}">${parts.map((p) => p.html).join('<br>')}</p>`, text: parts.map((p) => p.text).join('\n') })
    }
    if (items.length) {
      const parts = items.map((l) => inline(l.replace(/^\s*[-*•] /, ''), c))
      out.push({
        html: `<ul style="margin:0 0 16px;padding:0 0 0 22px;">${parts.map((p) => `<li class="t" style="margin:0 0 6px;font-family:Figtree,Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#284858;">${p.html}</li>`).join('')}</ul>`,
        text: parts.map((p) => `- ${p.text}`).join('\n'),
      })
    }
  }
  return { html: out.map((s) => s.html).join(''), text: out.map((s) => s.text).join('\n\n') }
}

/** Fill merge fields in a one-line field (subject, heading and so on). */
export const fill = (s: string, c: Context) => s.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in FIELDS ? c.merge[k as FieldKey] ?? '' : m))

export function targetUrl(t: ButtonTarget, c: Context): string {
  const o = c.origin.replace(/\/+$/, '')
  switch (t) {
    case 'questionnaire': return c.merge.questionnaire_link || ''
    case 'book': return `${o}/book-now/`
    case 'home': return `${o}/`
    case 'contact': return c.merge.contact_email ? `mailto:${c.merge.contact_email}` : ''
    default: return ''
  }
}

export function render(kind: PatientKind, t: Template, c: Context): { subject: string; html: string; text: string } {
  const sections: Section[] = []
  if (c.test) sections.push(note(c.testNote || (kind === 'deposit-patient' ? 'TEST EMAIL with sample details, no payment was made.' : 'TEST EMAIL with sample details, no booking was made.')))
  sections.push(message(t.main, c))
  sections.push(panel(c.panel))
  const url = targetUrl(t.buttonTarget, c)
  const btn = t.buttonTarget !== 'none' && url && t.buttonLabel.trim() ? button(fill(t.buttonLabel, c), url) : null
  let placed = false
  for (const s of c.system) {
    if (s === '{{button}}') { if (btn) { sections.push(btn); placed = true } continue }
    sections.push(s)
  }
  if (btn && !placed) sections.push(btn)
  if (t.second.trim()) sections.push(message(t.second, c))
  for (const s of c.tail || []) sections.push(s)
  const subject = `${c.test ? '[TEST] ' : ''}${fill(t.subject, c)}`
  const out = shell({
    origin: c.origin,
    variant: 'patient',
    subject,
    preheader: fill(t.preheader, c),
    eyebrow: fill(t.eyebrow, c),
    heading: fill(t.heading, c),
    banner: t.banner,
    sections: sections.filter((s) => s.html || s.text),
    signoff: fill(t.signoff, c),
    sender: fill(t.sender, c),
    footer: patientFooter(c.footer),
  })
  return { subject, ...out }
}

// ---------------------------------------------------------------- storage

export type Saved = { template: Template; updatedAt: string | null; updatedBy: string; saved: boolean }
export type Version = { id: string; savedAt: string; savedBy: string; note: string; template: Template }

/** The welcome default carries over wording saved in Site Settings > Welcome pack before v1.14.0. */
export type Legacy = { welcomeSubject?: string; welcomeBody?: string }
export function baseFor(kind: PatientKind, legacy?: Legacy): Template {
  if (kind === 'welcome' && (legacy?.welcomeSubject || legacy?.welcomeBody)) return fromLegacyWelcome(legacy.welcomeSubject || LEGACY_WELCOME.subject, legacy.welcomeBody || LEGACY_WELCOME.body)
  return defaultTemplate(kind)
}

async function ready(): Promise<core.Db | null> {
  const d = core.db()
  if (!d) return null
  try { await core.ensureSchema(d, core.loadConfig()); return d } catch { return null }
}

/** The wording in use: saved, or the default. Never throws (falls back to the default). */
export async function load(kind: PatientKind, legacy?: Legacy): Promise<Saved> {
  const base = baseFor(kind, legacy)
  const d = await ready()
  if (!d) return { template: base, updatedAt: null, updatedBy: '', saved: false }
  const r = await d.query<{ data: unknown; updated_at: string; updated_by: string }>(`SELECT data, updated_at, updated_by FROM ape_email_templates WHERE kind = $1`, [kind]).catch(() => [])
  if (!r[0]) return { template: base, updatedAt: null, updatedBy: '', saved: false }
  return { template: normalise(kind, r[0].data, base), updatedAt: new Date(r[0].updated_at).toISOString(), updatedBy: r[0].updated_by, saved: true }
}
export const loadTemplate = async (kind: PatientKind, legacy?: Legacy) => (await load(kind, legacy)).template

export const KEEP_VERSIONS = 10

async function addVersion(d: core.Db, kind: PatientKind, t: Template, by: string, noteText: string) {
  await d.query(`INSERT INTO ape_email_template_versions (kind, data, saved_by, note) VALUES ($1, $2, $3, $4)`, [kind, JSON.stringify(t), by, noteText])
  await d.query(`DELETE FROM ape_email_template_versions WHERE kind = $1 AND id NOT IN (SELECT id FROM ape_email_template_versions WHERE kind = $1 ORDER BY saved_at DESC, id DESC LIMIT ${KEEP_VERSIONS})`, [kind])
}

/** Save new wording (already checked). The previous wording stays in the version history. */
export async function save(kind: PatientKind, t: Template, by: string, noteText = ''): Promise<void> {
  const d = await ready()
  if (!d) throw new Error('The database is not available.')
  await d.query(
    `INSERT INTO ape_email_templates (kind, data, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (kind) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [kind, JSON.stringify(t), by])
  await addVersion(d, kind, t, by, noteText)
}

/** Back to the default wording (recorded in the version history). */
export async function reset(kind: PatientKind, by: string, legacy?: Legacy): Promise<void> {
  const d = await ready()
  if (!d) throw new Error('The database is not available.')
  await d.query(`DELETE FROM ape_email_templates WHERE kind = $1`, [kind])
  await addVersion(d, kind, baseFor(kind, legacy), by, 'Reset to default')
}

export async function versions(kind: PatientKind): Promise<Version[]> {
  const d = await ready()
  if (!d) return []
  const r = await d.query<{ id: string; data: unknown; saved_at: string; saved_by: string; note: string }>(
    `SELECT id::text, data, saved_at, saved_by, note FROM ape_email_template_versions WHERE kind = $1 ORDER BY saved_at DESC, id DESC LIMIT ${KEEP_VERSIONS}`, [kind]).catch(() => [])
  return r.map((v) => ({ id: v.id, savedAt: new Date(v.saved_at).toISOString(), savedBy: v.saved_by, note: v.note, template: normalise(kind, v.data) }))
}

export async function version(kind: PatientKind, id: string): Promise<Version | null> {
  return (await versions(kind)).find((v) => v.id === String(id)) ?? null
}
