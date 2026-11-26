/**
 * v1.18.0: treatment plans, the server side. Built the same way as the questionnaire (v1.9.0, v1.11.0):
 *
 * - Content (the patient's name, date of birth and every answer) is encrypted here with AES-256-GCM before it reaches
 *   the database, with its own key, TREATMENT_PLAN_ENCRYPTION_KEY. A database row on its own gives nothing away.
 * - Only a signed-in person with "Can create and view treatment plans" can list, open, write, print or send a plan.
 *   It is off for everyone by default, GYA administrators included. It is read from the database on every request,
 *   so taking it away works at once.
 * - Every create, edit, finalise, view, print, send, revoke and delete is written to ape_plan_log (who, when, which
 *   plan and version, never any content). Administrators can read it.
 * - The feature is off until all four conditions hold (see switches()). TREATMENT_PLANS_ENABLED=false in Vercel is an
 *   emergency off switch; nothing in the environment turns it on.
 * - The tables are created here with IF NOT EXISTS (additive), like the booking tables, so an earlier release still
 *   runs on the same database after a rollback.
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'
import { db, type Db } from '@/booking/core'
import { seal, unseal, newToken, hashToken, planKey, planKeyReady, type Sealed } from '@/lib/crypto'
import { emailConfigured } from '@/lib/email'
import { retainUntil, fullName } from '@/booking/patient'
import { PLACEHOLDER_FORM, cleanForm, cleanAnswers, missingRequired, type Answers, type FormDef } from './form'

export type SendMode = 'link' | 'password' | 'attachment'
export const SEND_MODES: { mode: SendMode; label: string }[] = [
  { mode: 'link', label: 'Secure link (recommended)' },
  { mode: 'password', label: 'Password protected PDF attached, password by phone or SMS' },
  { mode: 'attachment', label: 'PDF attached (no password)' },
]
export type Settings = { sendMode: SendMode; linkDays: number; askDob: boolean; clinician: string
  /** one line about privacy in the patient email, once Lorna has approved it (blank: none) */
  privacyLine: string }
/** v1.18.1: the line under the patient email (Settings > Privacy line), published by GYA on 25 Nov 2026. */
export const PRIVACY_LINE = 'For your privacy, this email does not contain any details of your treatment plan. Please do not forward it.'
export const DEFAULT_SETTINGS: Settings = { sendMode: 'link', linkDays: 14, askDob: true, clinician: 'Dr Lorna Gladwin', privacyLine: '' }

export class PlanError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message || code) }
}

const str = (v: unknown) => String(v ?? '').trim()

// ---------------------------------------------------------------- tables

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ape_meta (key text PRIMARY KEY, value text NOT NULL DEFAULT '');
CREATE SEQUENCE IF NOT EXISTS ape_plan_no_seq START 1001;
CREATE TABLE IF NOT EXISTS ape_plan_forms (
  version integer PRIMARY KEY,
  definition text NOT NULL,
  placeholder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT '',
  approved_at timestamptz,
  approved_by text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS ape_plans (
  id serial PRIMARY KEY,
  plan_no integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  booking_ref text NOT NULL,
  form_version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  sealed text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT '',
  finalised_at timestamptz,
  finalised_by text NOT NULL DEFAULT '',
  retain_until date,
  UNIQUE (plan_no, version)
);
CREATE INDEX IF NOT EXISTS ape_plans_ref ON ape_plans (booking_ref);
CREATE TABLE IF NOT EXISTS ape_plan_links (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL REFERENCES ape_plans(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by text NOT NULL DEFAULT '',
  opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  dob_fails integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ape_plan_sends (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL REFERENCES ape_plans(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  by_email text NOT NULL,
  to_email text NOT NULL,
  method text NOT NULL,
  version integer NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  provider_id text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS ape_plan_log (
  id serial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  by_email text NOT NULL,
  action text NOT NULL,
  plan_no integer,
  version integer,
  booking_ref text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  times integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ape_plan_log_at ON ape_plan_log (at DESC);
`

let ready: Promise<void> | null = null
/** The plan tables (IF NOT EXISTS, safe to run any number of times), and the placeholder form as version 1. */
export async function ensurePlanSchema(d: Db): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const stmt of SCHEMA.split(';').map((x) => x.trim()).filter(Boolean)) await d.query(stmt)
      await d.query(`INSERT INTO ape_plan_forms (version, definition, placeholder, created_by) VALUES (1, $1, true, 'GYA (placeholder)') ON CONFLICT (version) DO NOTHING`, [JSON.stringify(PLACEHOLDER_FORM)])
    })().catch((err) => { ready = null; throw err })
  }
  return ready
}
async function need(): Promise<Db> {
  const d = db()
  if (!d) throw new PlanError(503, 'no_database')
  await ensurePlanSchema(d)
  return d
}

// ---------------------------------------------------------------- encryption

type Identity = { name: string; firstName: string; dob: string | null; ref: string; appointmentAt: string | null }
type Content = { identity: Identity; answers: Answers }

function sealContent(c: Content): string {
  const key = planKey()
  if (!key) throw new PlanError(503, 'no_key')
  return JSON.stringify(seal(JSON.stringify(c), key))
}
function openContent(sealed: string): Content {
  const key = planKey()
  if (!key) throw new PlanError(503, 'no_key')
  return JSON.parse(unseal(JSON.parse(sealed) as Sealed, key)) as Content
}

// ---------------------------------------------------------------- the audit log

export type LogAction = 'created' | 'edited' | 'finalised' | 'new version' | 'viewed' | 'printed' | 'downloaded' | 'sent' | 'send failed' | 'revoked'
  | 'deleted' | 'denied' | 'patient opened' | 'patient date of birth wrong' | 'form saved' | 'form approved' | 'settings changed'

/** One line per action: who, when, which plan and version. Never any content. Repeated edits by one person within 10 minutes are counted on one line. */
export async function logPlan(e: { by: string; action: LogAction; planNo?: number | null; version?: number | null; ref?: string; note?: string }): Promise<void> {
  const d = await need()
  if (e.action === 'edited' && e.planNo) {
    const r = await d.query(`UPDATE ape_plan_log SET at = now(), times = times + 1 WHERE id = (SELECT id FROM ape_plan_log ORDER BY id DESC LIMIT 1)
      AND action = 'edited' AND by_email = $1 AND plan_no = $2 AND version = $3 AND at > now() - interval '10 minutes' RETURNING id`, [e.by, e.planNo, e.version ?? null])
    if (r.length) return
  }
  await d.query(`INSERT INTO ape_plan_log (by_email, action, plan_no, version, booking_ref, note) VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.by, e.action, e.planNo ?? null, e.version ?? null, e.ref || '', (e.note || '').slice(0, 300)])
}
export type LogRow = { at: string; by: string; action: string; planNo: number | null; version: number | null; ref: string; note: string; times: number }
export async function readLog(o: { planNo?: number; limit?: number } = {}): Promise<LogRow[]> {
  const d = await need()
  const r = await d.query(`SELECT at, by_email, action, plan_no, version, booking_ref, note, times FROM ape_plan_log ${o.planNo ? 'WHERE plan_no = $2' : ''} ORDER BY at DESC, id DESC LIMIT $1`,
    o.planNo ? [o.limit || 500, o.planNo] : [o.limit || 500])
  return r.map((x) => ({ at: new Date(x.at).toISOString(), by: x.by_email, action: x.action, planNo: x.plan_no, version: x.version, ref: x.booking_ref, note: x.note, times: Number(x.times) || 1 }))
}

// ---------------------------------------------------------------- who may do what

export type PlanUser = { id: string | number; email: string; role: string; practiceOwner: boolean; canPlans: boolean }

/** The signed-in person, read fresh from the database (so a removed permission counts straight away). */
export async function planUser(payload: Payload, user: Record<string, any> | null): Promise<PlanUser | null> {
  if (!user) return null
  const u = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  if (!u) return null
  return { id: u.id, email: String(u.email), role: String(u.role), practiceOwner: !!u.practiceOwner, canPlans: !!u.canTreatmentPlans }
}
/** Change the form and the settings: anyone with the permission, the practice owner, or GYA. */
export const canManage = (u: PlanUser) => u.canPlans || u.practiceOwner || u.role === 'admin'
/** Record Lorna's approval of the form: the practice owner, or GYA on her written word. */
export const canApprove = (u: PlanUser) => u.practiceOwner || u.role === 'admin'

// ---------------------------------------------------------------- settings and switches

export async function readSettings(): Promise<Settings> {
  const d = await need()
  const r = await d.query<{ value: string }>(`SELECT value FROM ape_meta WHERE key = 'plans'`)
  let v: Partial<Settings> = {}
  try { v = r[0] ? JSON.parse(r[0].value) : {} } catch { v = {} }
  return {
    sendMode: (['link', 'password', 'attachment'] as const).includes(v.sendMode as SendMode) ? v.sendMode as SendMode : DEFAULT_SETTINGS.sendMode,
    linkDays: Number.isInteger(v.linkDays) && (v.linkDays as number) >= 1 && (v.linkDays as number) <= 60 ? v.linkDays as number : DEFAULT_SETTINGS.linkDays,
    askDob: v.askDob === undefined ? DEFAULT_SETTINGS.askDob : !!v.askDob,
    clinician: str(v.clinician).slice(0, 80) || DEFAULT_SETTINGS.clinician,
    privacyLine: str(v.privacyLine).slice(0, 400),
  }
}
export async function saveSettings(u: PlanUser, raw: Record<string, unknown>): Promise<Settings> {
  if (!canManage(u)) throw new PlanError(403, 'not_allowed')
  const cur = await readSettings()
  const days = Number(raw.linkDays)
  const next: Settings = {
    sendMode: (['link', 'password', 'attachment'] as const).includes(raw.sendMode as SendMode) ? raw.sendMode as SendMode : cur.sendMode,
    linkDays: Number.isInteger(days) && days >= 1 && days <= 60 ? days : cur.linkDays,
    askDob: raw.askDob === undefined ? cur.askDob : !!raw.askDob,
    clinician: str(raw.clinician).replace(/[\u2013\u2014]/g, ', ').slice(0, 80) || cur.clinician,
    privacyLine: raw.privacyLine === undefined ? cur.privacyLine : str(raw.privacyLine).replace(/[\u2013\u2014]/g, ', ').replace(/\s+/g, ' ').slice(0, 400),
  }
  const d = await need()
  await d.query(`INSERT INTO ape_meta (key, value) VALUES ('plans', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(next)])
  const changed = (Object.keys(next) as (keyof Settings)[]).filter((k) => next[k] !== cur[k])
  if (changed.length) await logPlan({ by: u.email, action: 'settings changed', note: changed.map((k) => `${k}: ${k === 'clinician' || k === 'privacyLine' ? 'changed' : String(next[k])}`).join(', ') })
  return next
}

export const emergencyOff = () => str(process.env.TREATMENT_PLANS_ENABLED).toLowerCase() === 'false'

export type Condition = { key: 'key' | 'approved' | 'privacy' | 'people'; ok: boolean; text: string; detail: string }
export type Switches = { on: boolean; conditions: Condition[]; emergencyOff: boolean; emailReady: boolean; region: string; people: number }

/** Does the published privacy policy have its own numbered section on treatment plans? */
export async function privacyCoversPlans(payload: Payload): Promise<boolean> {
  const r = await payload.find({ collection: 'pages', where: { pageSlug: { equals: 'privacy-policy' } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => null)
  const doc = r?.docs?.[0]
  // a numbered section heading about treatment plans, such as "15. Your treatment plan" (section 2 already mentions
  // treatment plans in passing, which is not enough)
  return !!doc && /\b\d{1,2}\.\s+(your\s+)?treatment\s+plans?\b/i.test(JSON.stringify(doc))
}
/** The database's region, from its address (no password or user name), so the screen can show it is in Sydney. */
export function databaseRegion(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  try {
    const host = new URL(url).hostname
    const m = /\b((?:ap|us|eu|sa|ca|me|af)-[a-z]+-\d)\b/.exec(host)
    if (m) return m[1] === 'ap-southeast-2' ? 'ap-southeast-2 (Sydney)' : m[1]
    return /localhost|127\.0\.0\.1|^\//.test(host || url) ? 'local test database' : 'not shown in the database address'
  } catch { return 'not shown in the database address' }
}

/** The four conditions, and whether treatment plans are on. */
export async function switches(payload: Payload): Promise<Switches> {
  const d = await need()
  const form = await currentForm(d)
  const people = await payload.count({ collection: 'users', where: { canTreatmentPlans: { equals: true } }, overrideAccess: true }).then((x) => x.totalDocs).catch(() => 0)
  const privacy = await privacyCoversPlans(payload)
  const conditions: Condition[] = [
    { key: 'key', ok: planKeyReady(), text: 'The encryption key is set', detail: 'TREATMENT_PLAN_ENCRYPTION_KEY in Vercel (32 random bytes, base64), then a redeploy.' },
    { key: 'approved', ok: !!form.approvedAt && !form.placeholder, text: 'Lorna has approved the form wording', detail: form.placeholder ? 'The form is still the placeholder. Load the practice\'s own form, then record the approval.' : form.approvedAt ? `Form version ${form.version} approved by ${form.approvedBy}.` : `Form version ${form.version} is waiting for approval.` },
    { key: 'privacy', ok: privacy, text: 'The privacy policy covers treatment plans', detail: 'The published Privacy Policy page needs its section on treatment plans (the approved wording).' },
    { key: 'people', ok: people > 0, text: 'At least one person can create and view treatment plans', detail: `${people} ${people === 1 ? 'login has' : 'logins have'} the permission (Users screen).` },
  ]
  const off = emergencyOff()
  return { on: conditions.every((c) => c.ok) && !off, conditions, emergencyOff: off, emailReady: emailConfigured(), region: databaseRegion(), people }
}

// ---------------------------------------------------------------- the form, in versions

export type FormVersion = { version: number; form: FormDef; placeholder: boolean; createdAt: string; createdBy: string; approvedAt: string | null; approvedBy: string }
const formRow = (r: Record<string, any>): FormVersion => ({
  version: Number(r.version), form: JSON.parse(r.definition) as FormDef, placeholder: !!r.placeholder, createdAt: new Date(r.created_at).toISOString(),
  createdBy: r.created_by, approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null, approvedBy: r.approved_by,
})
export async function currentForm(d?: Db): Promise<FormVersion> {
  const x = d ?? await need()
  const r = await x.query(`SELECT * FROM ape_plan_forms ORDER BY version DESC LIMIT 1`)
  return formRow(r[0])
}
export async function formVersion(version: number): Promise<FormVersion | null> {
  const d = await need()
  const r = await d.query(`SELECT * FROM ape_plan_forms WHERE version = $1`, [version])
  return r[0] ? formRow(r[0]) : null
}
export async function formHistory(): Promise<Omit<FormVersion, 'form'>[]> {
  const d = await need()
  const r = await d.query(`SELECT version, placeholder, created_at, created_by, approved_at, approved_by FROM ape_plan_forms ORDER BY version DESC LIMIT 50`)
  return r.map((x) => ({ version: Number(x.version), placeholder: !!x.placeholder, createdAt: new Date(x.created_at).toISOString(), createdBy: x.created_by, approvedAt: x.approved_at ? new Date(x.approved_at).toISOString() : null, approvedBy: x.approved_by }))
}
/**
 * A change to the form is saved as a new version; plans already written keep theirs. Saved by the practice owner, the
 * new version counts as approved by her; saved by anyone else, it waits for her approval (and the feature stays off).
 */
export async function saveForm(u: PlanUser, raw: unknown): Promise<FormVersion> {
  if (!canManage(u)) throw new PlanError(403, 'not_allowed')
  let form: FormDef
  try { form = cleanForm(raw) } catch (err) { throw new PlanError(400, 'invalid_form', (err as Error).message) }
  const d = await need()
  const cur = await currentForm(d)
  if (JSON.stringify(cur.form) === JSON.stringify(form)) return cur
  const placeholder = !!form.placeholder
  const ownerApproves = u.practiceOwner && !placeholder
  const r = await d.query(`INSERT INTO ape_plan_forms (version, definition, placeholder, created_by, approved_at, approved_by)
    VALUES ((SELECT coalesce(max(version), 0) + 1 FROM ape_plan_forms), $1, $2, $3, ${ownerApproves ? 'now()' : 'NULL'}, $4) RETURNING *`,
    [JSON.stringify(form), placeholder, u.email, ownerApproves ? `${u.email} (practice owner, when saving)` : ''])
  const v = formRow(r[0])
  await logPlan({ by: u.email, action: 'form saved', note: `form version ${v.version}${ownerApproves ? ', approved by the practice owner' : ', waiting for approval'}` })
  return v
}
/** Record Lorna's approval of a form version, with the date and how she gave it (for example "Dr Lorna Gladwin, email 26 Nov 2026"). */
export async function approveForm(u: PlanUser, version: number, by: string): Promise<FormVersion> {
  if (!canApprove(u)) throw new PlanError(403, 'not_allowed')
  const d = await need()
  const f = await formVersion(version)
  if (!f) throw new PlanError(404, 'not_found')
  if (f.placeholder) throw new PlanError(400, 'placeholder', 'The placeholder form cannot be approved. Load the practice\'s own form first.')
  const who = str(by).replace(/[\u2013\u2014]/g, ', ').slice(0, 160) || u.email
  await d.query(`UPDATE ape_plan_forms SET approved_at = now(), approved_by = $2 WHERE version = $1`, [version, `${who} (recorded by ${u.email})`])
  await logPlan({ by: u.email, action: 'form approved', note: `form version ${version}: ${who}` })
  return (await formVersion(version))!
}

// ---------------------------------------------------------------- plans

export type PlanSummary = {
  id: number; planNo: number; version: number; status: 'draft' | 'final'; bookingRef: string; patientName: string; appointmentAt: string | null
  createdAt: string; updatedAt: string; finalisedAt: string | null; retainUntil: string | null; versions: number; lastSentAt: string | null; liveLinks: number
}
export type PlanVersionInfo = { id: number; version: number; status: 'draft' | 'final'; finalisedAt: string | null; finalisedBy: string; createdAt: string; createdBy: string }
export type LinkInfo = { id: number; version: number; createdAt: string; createdBy: string; expiresAt: string; revokedAt: string | null; openedAt: string | null; openCount: number; live: boolean }
export type SendInfo = { at: string; by: string; to: string; method: string; version: number; ok: boolean }
export type PlanFull = {
  id: number; planNo: number; version: number; status: 'draft' | 'final'; bookingRef: string; formVersion: number; form: FormDef
  identity: Identity; answers: Answers; createdAt: string; createdBy: string; updatedAt: string; updatedBy: string
  finalisedAt: string | null; finalisedBy: string; retainUntil: string | null
  versions: PlanVersionInfo[]; links: LinkInfo[]; sends: SendInfo[]; patientEmail: string; bookingHasDob: boolean
}

function need403(u: PlanUser, on: boolean) {
  if (!u.canPlans) throw new PlanError(403, 'no_permission')
  if (!on) throw new PlanError(409, 'off')
}
/** Every route that touches a plan calls this first: the permission, and the feature on. A refusal is logged. */
export async function guard(payload: Payload, u: PlanUser | null, what: string, o: { allowOff?: boolean } = {}): Promise<PlanUser> {
  if (!u) throw new PlanError(401, 'signed_out')
  const sw = o.allowOff ? null : await switches(payload)
  try { need403(u, o.allowOff ? true : !!sw?.on) } catch (err) {
    if ((err as PlanError).code === 'no_permission') await logPlan({ by: u.email, action: 'denied', note: what }).catch(() => {})
    throw err
  }
  return u
}

type BookingIdentity = { ref: string; name: string; first_name: string; last_name: string; dob: string | Date | null; slot_start: Date | string; email: string; status: string }
async function bookingFor(d: Db, ref: string): Promise<BookingIdentity | null> {
  const r = await d.query<BookingIdentity>(`SELECT ref, name, first_name, last_name, dob, slot_start, email, status FROM ape_bookings WHERE ref = $1`, [ref]).catch(() => [])
  return r[0] ?? null
}
const isoDay = (v: unknown): string | null => {
  if (!v) return null
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  return m ? m[1] : null
}
function identityOf(b: BookingIdentity): Identity {
  const name = b.first_name ? fullName(b.first_name, b.last_name || '') : str(b.name)
  return { name, firstName: str(b.first_name) || name.split(' ')[0] || '', dob: isoDay(b.dob), ref: b.ref, appointmentAt: b.slot_start ? new Date(b.slot_start).toISOString() : null }
}
const retain = (id: Identity) => retainUntil(id.appointmentAt ? new Date(id.appointmentAt) : new Date(), id.dob).toISOString().slice(0, 10)

/** A new plan from a booking: the name, date of birth and reference come from the booking, never typed. */
export async function createPlan(u: PlanUser, ref: string): Promise<number> {
  const d = await need()
  const b = await bookingFor(d, str(ref).toUpperCase())
  if (!b) throw new PlanError(404, 'no_booking')
  const form = await currentForm(d)
  const identity = identityOf(b)
  const r = await d.query(`INSERT INTO ape_plans (plan_no, version, booking_ref, form_version, status, sealed, created_by, updated_by, retain_until)
    VALUES (nextval('ape_plan_no_seq'), 1, $1, $2, 'draft', $3, $4, $4, $5) RETURNING id, plan_no`, [b.ref, form.version, sealContent({ identity, answers: {} }), u.email, retain(identity)])
  await logPlan({ by: u.email, action: 'created', planNo: r[0].plan_no, version: 1, ref: b.ref, note: `form version ${form.version}` })
  return Number(r[0].id)
}

export async function listPlans(o: { ref?: string } = {}): Promise<PlanSummary[]> {
  const d = await need()
  const r = await d.query(`
    SELECT p.*, b.first_name, b.last_name, b.name, b.slot_start,
      (SELECT count(*)::int FROM ape_plans x WHERE x.plan_no = p.plan_no) AS versions,
      (SELECT max(s.at) FROM ape_plan_sends s JOIN ape_plans x ON x.id = s.plan_id WHERE x.plan_no = p.plan_no AND s.ok) AS last_sent,
      (SELECT count(*)::int FROM ape_plan_links l JOIN ape_plans x ON x.id = l.plan_id WHERE x.plan_no = p.plan_no AND l.revoked_at IS NULL AND l.expires_at > now()) AS live_links
    FROM ape_plans p LEFT JOIN ape_bookings b ON b.ref = p.booking_ref
    WHERE p.version = (SELECT max(version) FROM ape_plans y WHERE y.plan_no = p.plan_no) ${o.ref ? 'AND p.booking_ref = $1' : ''}
    ORDER BY p.updated_at DESC LIMIT 500`, o.ref ? [o.ref] : [])
  return r.map((x) => ({
    id: x.id, planNo: x.plan_no, version: x.version, status: x.status, bookingRef: x.booking_ref,
    patientName: x.first_name ? fullName(x.first_name, x.last_name || '') : str(x.name) || '(booking deleted)',
    appointmentAt: x.slot_start ? new Date(x.slot_start).toISOString() : null, createdAt: new Date(x.created_at).toISOString(), updatedAt: new Date(x.updated_at).toISOString(),
    finalisedAt: x.finalised_at ? new Date(x.finalised_at).toISOString() : null, retainUntil: x.retain_until ? isoDay(x.retain_until) : null,
    versions: Number(x.versions) || 1, lastSentAt: x.last_sent ? new Date(x.last_sent).toISOString() : null, liveLinks: Number(x.live_links) || 0,
  }))
}

async function row(d: Db, id: number): Promise<Record<string, any>> {
  const r = await d.query(`SELECT * FROM ape_plans WHERE id = $1`, [id])
  if (!r[0]) throw new PlanError(404, 'not_found')
  return r[0]
}

/** One plan version, decrypted. Logged as viewed (once per person per plan in 10 minutes, as "edited" is). */
export async function openPlan(u: PlanUser, id: number, o: { log?: boolean } = {}): Promise<PlanFull> {
  const d = await need()
  const p = await row(d, id)
  const c = openContent(p.sealed)
  const f = await formVersion(p.form_version)
  const versions = await d.query(`SELECT id, version, status, finalised_at, finalised_by, created_at, created_by FROM ape_plans WHERE plan_no = $1 ORDER BY version`, [p.plan_no])
  const links = await d.query(`SELECT l.*, x.version FROM ape_plan_links l JOIN ape_plans x ON x.id = l.plan_id WHERE x.plan_no = $1 ORDER BY l.created_at DESC`, [p.plan_no])
  const sends = await d.query(`SELECT s.* FROM ape_plan_sends s JOIN ape_plans x ON x.id = s.plan_id WHERE x.plan_no = $1 ORDER BY s.at DESC`, [p.plan_no])
  const b = await bookingFor(d, p.booking_ref)
  if (o.log !== false) {
    const recent = await d.query(`SELECT 1 FROM ape_plan_log WHERE action = 'viewed' AND by_email = $1 AND plan_no = $2 AND version = $3 AND at > now() - interval '10 minutes' LIMIT 1`, [u.email, p.plan_no, p.version])
    if (!recent.length) await logPlan({ by: u.email, action: 'viewed', planNo: p.plan_no, version: p.version, ref: p.booking_ref })
  }
  return {
    id: p.id, planNo: p.plan_no, version: p.version, status: p.status, bookingRef: p.booking_ref, formVersion: p.form_version, form: f!.form,
    identity: c.identity, answers: c.answers, createdAt: new Date(p.created_at).toISOString(), createdBy: p.created_by, updatedAt: new Date(p.updated_at).toISOString(), updatedBy: p.updated_by,
    finalisedAt: p.finalised_at ? new Date(p.finalised_at).toISOString() : null, finalisedBy: p.finalised_by, retainUntil: p.retain_until ? isoDay(p.retain_until) : null,
    versions: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, finalisedAt: v.finalised_at ? new Date(v.finalised_at).toISOString() : null, finalisedBy: v.finalised_by, createdAt: new Date(v.created_at).toISOString(), createdBy: v.created_by })),
    links: links.map((l) => ({ id: l.id, version: l.version, createdAt: new Date(l.created_at).toISOString(), createdBy: l.created_by, expiresAt: new Date(l.expires_at).toISOString(), revokedAt: l.revoked_at ? new Date(l.revoked_at).toISOString() : null, openedAt: l.opened_at ? new Date(l.opened_at).toISOString() : null, openCount: Number(l.open_count) || 0, live: !l.revoked_at && new Date(l.expires_at).getTime() > Date.now() })),
    sends: sends.map((s) => ({ at: new Date(s.at).toISOString(), by: s.by_email, to: s.to_email, method: s.method, version: s.version, ok: !!s.ok })),
    patientEmail: b ? str(b.email) : '', bookingHasDob: !!(b && isoDay(b.dob)),
  }
}

/** Save the answers on a draft (the editor saves as she goes). A finalised plan is never changed in place. */
export async function saveDraft(u: PlanUser, id: number, raw: unknown): Promise<{ updatedAt: string }> {
  const d = await need()
  const p = await row(d, id)
  if (p.status !== 'draft') throw new PlanError(409, 'final')
  const f = await formVersion(p.form_version)
  const c = openContent(p.sealed)
  const answers = cleanAnswers(f!.form, raw)
  const r = await d.query(`UPDATE ape_plans SET sealed = $2, updated_at = now(), updated_by = $3 WHERE id = $1 AND status = 'draft' RETURNING updated_at`, [id, sealContent({ ...c, answers }), u.email])
  if (!r[0]) throw new PlanError(409, 'final')
  await logPlan({ by: u.email, action: 'edited', planNo: p.plan_no, version: p.version, ref: p.booking_ref })
  return { updatedAt: new Date(r[0].updated_at).toISOString() }
}

/** Finalise: lock it, with the date and who. Only a finalised plan can be printed or sent. */
export async function finalise(u: PlanUser, id: number): Promise<void> {
  const d = await need()
  const p = await row(d, id)
  if (p.status !== 'draft') throw new PlanError(409, 'final')
  const f = await formVersion(p.form_version)
  const c = openContent(p.sealed)
  const missing = missingRequired(f!.form, c.answers)
  if (missing.length) throw new PlanError(400, 'required', `Please fill in: ${missing.join(', ')}.`)
  const r = await d.query(`UPDATE ape_plans SET status = 'final', finalised_at = now(), finalised_by = $2, updated_at = now(), updated_by = $2 WHERE id = $1 AND status = 'draft' RETURNING id`, [id, u.email])
  if (!r[0]) throw new PlanError(409, 'final')
  await logPlan({ by: u.email, action: 'finalised', planNo: p.plan_no, version: p.version, ref: p.booking_ref })
}

/** Change a finalised plan: a new numbered version starts as a draft copy; the earlier version is kept as it was. */
export async function newVersion(u: PlanUser, id: number): Promise<number> {
  const d = await need()
  const p = await row(d, id)
  if (p.status !== 'final') throw new PlanError(409, 'draft')
  const latest = await d.query(`SELECT max(version) AS v FROM ape_plans WHERE plan_no = $1`, [p.plan_no])
  if (Number(latest[0].v) !== Number(p.version)) throw new PlanError(409, 'not_latest')
  const c = openContent(p.sealed)
  const r = await d.query(`INSERT INTO ape_plans (plan_no, version, booking_ref, form_version, status, sealed, created_by, updated_by, retain_until)
    VALUES ($1, $2, $3, $4, 'draft', $5, $6, $6, $7) RETURNING id`, [p.plan_no, p.version + 1, p.booking_ref, p.form_version, sealContent(c), u.email, p.retain_until])
  await logPlan({ by: u.email, action: 'new version', planNo: p.plan_no, version: p.version + 1, ref: p.booking_ref, note: `from version ${p.version}` })
  return Number(r[0].id)
}

/** Administrators only (the screen asks first): every version of a plan, its links and its send records. The log lines stay. */
export async function deletePlan(u: PlanUser, planNo: number): Promise<void> {
  if (u.role !== 'admin') throw new PlanError(403, 'admin_only')
  const d = await need()
  const r = await d.query(`SELECT booking_ref, max(version) AS v, min(retain_until) AS keep FROM ape_plans WHERE plan_no = $1 GROUP BY booking_ref`, [planNo])
  if (!r[0]) throw new PlanError(404, 'not_found')
  await d.query(`DELETE FROM ape_plans WHERE plan_no = $1`, [planNo])
  await logPlan({ by: u.email, action: 'deleted', planNo, version: Number(r[0].v), ref: r[0].booking_ref, note: `all versions; retain until ${isoDay(r[0].keep) || 'n/a'}` })
}

// ---------------------------------------------------------------- the patient's private link

/** A new private link for one finalised plan version. Only the hash is kept; the token goes in the email once. */
export async function issueLink(u: PlanUser, planId: number, days: number): Promise<{ token: string; expiresAt: string }> {
  const d = await need()
  const p = await row(d, planId)
  if (p.status !== 'final') throw new PlanError(409, 'draft')
  const token = newToken()
  const r = await d.query(`INSERT INTO ape_plan_links (plan_id, token_hash, created_by, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' days')::interval) RETURNING expires_at`,
    [planId, hashToken(token), u.email, String(Math.max(1, Math.min(60, days)))])
  return { token, expiresAt: new Date(r[0].expires_at).toISOString() }
}

/** Revoke every live link to any version of a plan. */
export async function revokeLinks(u: PlanUser, planNo: number): Promise<number> {
  const d = await need()
  const r = await d.query(`UPDATE ape_plan_links l SET revoked_at = now(), revoked_by = $2 FROM ape_plans p
    WHERE p.id = l.plan_id AND p.plan_no = $1 AND l.revoked_at IS NULL AND l.expires_at > now() RETURNING p.version, p.booking_ref`, [planNo, u.email])
  if (r.length) await logPlan({ by: u.email, action: 'revoked', planNo, version: r[0].version, ref: r[0].booking_ref, note: `${r.length} link${r.length > 1 ? 's' : ''}` })
  return r.length
}

export type LinkLookup = { state: 'ok'; planId: number; planNo: number; version: number; ref: string; askDob: boolean; dob: string | null; linkId: number } | { state: 'gone' } | { state: 'off' }

/** What a patient's link leads to. A wrong, made-up, expired or revoked link all give the same answer: gone. */
export async function lookupLink(payload: Payload, token: string): Promise<LinkLookup> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(String(token || ''))) return { state: 'gone' }
  const sw = await switches(payload)
  if (!sw.on) return { state: 'off' }
  const d = await need()
  const r = await d.query(`SELECT l.id AS link_id, p.id, p.plan_no, p.version, p.booking_ref, p.sealed, p.status FROM ape_plan_links l JOIN ape_plans p ON p.id = l.plan_id
    WHERE l.token_hash = $1 AND l.revoked_at IS NULL AND l.expires_at > now()`, [hashToken(token)])
  if (!r[0] || r[0].status !== 'final') return { state: 'gone' }
  const s = await readSettings()
  const c = openContent(r[0].sealed)
  return { state: 'ok', planId: r[0].id, planNo: r[0].plan_no, version: r[0].version, ref: r[0].booking_ref, askDob: s.askDob && !!c.identity.dob, dob: c.identity.dob, linkId: r[0].link_id }
}
export async function linkOpened(l: Extract<LinkLookup, { state: 'ok' }>): Promise<void> {
  const d = await need()
  await d.query(`UPDATE ape_plan_links SET opened_at = coalesce(opened_at, now()), open_count = open_count + 1 WHERE id = $1`, [l.linkId])
  await logPlan({ by: 'patient (private link)', action: 'patient opened', planNo: l.planNo, version: l.version, ref: l.ref })
}
/** A wrong date of birth on the link page. After five, the link is revoked (the practice can send a new one). */
export async function dobFailed(l: Extract<LinkLookup, { state: 'ok' }>): Promise<boolean> {
  const d = await need()
  const r = await d.query(`UPDATE ape_plan_links SET dob_fails = dob_fails + 1 WHERE id = $1 RETURNING dob_fails`, [l.linkId])
  const n = Number(r[0]?.dob_fails) || 0
  await logPlan({ by: 'patient (private link)', action: 'patient date of birth wrong', planNo: l.planNo, version: l.version, ref: l.ref, note: `${n} of 5` })
  if (n >= 5) { await d.query(`UPDATE ape_plan_links SET revoked_at = now(), revoked_by = 'five wrong dates of birth' WHERE id = $1`, [l.linkId]); return true }
  return false
}

// ---------------------------------------------------------------- reading content for the PDF

export async function contentFor(planId: number): Promise<{ plan: Record<string, any>; form: FormDef; identity: Identity; answers: Answers }> {
  const d = await need()
  const p = await row(d, planId)
  const f = await formVersion(p.form_version)
  const c = openContent(p.sealed)
  return { plan: p, form: f!.form, identity: c.identity, answers: c.answers }
}
export async function recordSend(e: { planId: number; by: string; to: string; method: SendMode; version: number; ok: boolean; id: string; error: string }): Promise<void> {
  const d = await need()
  await d.query(`INSERT INTO ape_plan_sends (plan_id, by_email, to_email, method, version, ok, provider_id, error) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [e.planId, e.by, e.to, e.method, e.version, e.ok, e.id, e.error.slice(0, 200)])
}
/** The newest finalised version of a plan (the one that is printed and sent), or null. */
export async function latestFinal(planNo: number): Promise<{ id: number; version: number } | null> {
  const d = await need()
  const r = await d.query(`SELECT id, version FROM ape_plans WHERE plan_no = $1 AND status = 'final' ORDER BY version DESC LIMIT 1`, [planNo])
  return r[0] ? { id: r[0].id, version: r[0].version } : null
}
export async function bookingEmail(ref: string): Promise<string> {
  const d = await need()
  const b = await bookingFor(d, ref)
  return b ? str(b.email) : ''
}

/** A password for the protected PDF: three words and four digits, easy to read out over the phone. Never stored. */
const WORDS = 'amber anchor apple arch aspen banksia basil beacon birch bloom breeze brook cedar clover coast comet coral cove crane creek daisy delta dune ember fern field finch fjord flint garnet glade grove harbour hazel heath heron honey indigo iris island ivory jasper juniper kelp kestrel lagoon lantern laurel lemon lily linen lotus maple marble meadow mint moss nectar oak ocean olive opal orchid otter pebble pepper pine plum poppy quartz quill rain raven reef ridge river robin rose saffron sage sand shell sky slate spruce star stone summer swift tide topaz tulip valley velvet violet wattle willow wren'.split(' ')
export function newPdfPassword(): string {
  const pick = () => WORDS[crypto.randomInt(WORDS.length)]
  return `${pick()}-${pick()}-${pick()}-${crypto.randomInt(1000, 10000)}`
}
