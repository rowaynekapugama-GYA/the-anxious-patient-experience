/**
 * Every email the website sends goes through deliver() (v1.8.3): it sends through the provider in src/lib/email.ts
 * (SMTP2GO in production) and records the attempt in ape_email_log, so a failed send is never silent.
 *
 * The log holds when, which kind of email, who it went to, the booking reference, accepted or failed, the provider's
 * message ID and the error text. Never the message itself, never a link or token, never questionnaire answers.
 * Entries are deleted after 90 days.
 */
import crypto from 'node:crypto'
import * as core from '@/booking/core'
import { sendEmail, type Email } from '@/lib/email'

export type Kind =
  | 'invite' | 'reset' | 'password-changed'
  | 'booking-patient' | 'booking-team' | 'gya-notice'
  | 'deposit-patient' | 'deposit-team'
  | 'welcome' | 'questionnaire-team' | 'alert' | 'access'

export const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'invite', label: 'Login invite' },
  { kind: 'reset', label: 'Forgotten password' },
  { kind: 'password-changed', label: 'Password changed notice' },
  { kind: 'booking-patient', label: 'Booking request received (patient)' },
  { kind: 'booking-team', label: 'New booking (team)' },
  { kind: 'gya-notice', label: 'GYA delivery check' },
  { kind: 'deposit-patient', label: 'Deposit received (patient)' },
  { kind: 'deposit-team', label: 'Deposit received (team)' },
  { kind: 'welcome', label: 'Welcome pack (patient)' },
  { kind: 'questionnaire-team', label: 'Questionnaire received (team)' },
  { kind: 'alert', label: 'Email failure alert (GYA)' },
  { kind: 'access', label: 'Questionnaire access given' },
]
export const kindLabel = (k: string) => KINDS.find((x) => x.kind === k)?.label ?? k

/** GYA's own inbox for the delivery check notice and failure alerts (Site Settings can change it). */
export const GYA_FALLBACK = 'rowayne@gyaclients.com'

export type Result = { ok: boolean; id: string; error: string }
export type LogStatus = 'accepted' | 'failed' | 'retrying'

async function ready(): Promise<core.Db | null> {
  const d = core.db()
  if (!d) return null
  try { await core.ensureSchema(d, core.loadConfig()); return d } catch { return null }
}

let lastPurge = 0
async function purge(d: core.Db) {
  if (Date.now() - lastPurge < 3600_000) return
  lastPurge = Date.now()
  await d.query(`DELETE FROM ape_email_log WHERE at < now() - interval '90 days'`).catch(() => {})
  await d.query(`DELETE FROM ape_rate WHERE at < now() - interval '1 day'`).catch(() => {})
}

/** Errors are kept short and never carry a link (a reset link holds a token). */
const cleanError = (e: unknown) => String((e as Error)?.message || e || 'unknown error').replace(/https?:\/\/\S+/g, '[link]').slice(0, 400)

export async function logAttempt(e: { kind: Kind; to: string[]; ref?: string | null; status: LogStatus; id?: string; error?: string; test?: boolean }): Promise<void> {
  const d = await ready()
  if (!d) return
  await d.query(
    `INSERT INTO ape_email_log (kind, recipient, ref, status, message_id, error, test) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [e.kind, e.to.join(', ').slice(0, 1000), e.ref || null, e.status, e.id || '', e.error ? cleanError(e.error) : '', !!e.test],
  ).catch((err) => console.error('mailer: could not log', (err as Error).message))
  void purge(d)
}

/**
 * Send one email and log it. Never throws: the result says whether the provider accepted it.
 * failStatus 'retrying' marks a first failure that will be tried again (booking emails).
 */
export async function deliver(kind: Kind, msg: Email, o: { ref?: string | null; test?: boolean; failStatus?: LogStatus } = {}): Promise<Result> {
  try {
    const r = await sendEmail(msg)
    await logAttempt({ kind, to: msg.to, ref: o.ref, status: 'accepted', id: r.id, test: o.test })
    return { ok: true, id: r.id, error: '' }
  } catch (err) {
    const error = cleanError(err)
    console.error(`mailer: ${kind} email failed${o.ref ? ` (${o.ref})` : ''}: ${error}`)
    await logAttempt({ kind, to: msg.to, ref: o.ref, status: o.failStatus || 'failed', error, test: o.test })
    return { ok: false, id: '', error }
  }
}

// ---------------------------------------------------------------- limits

/**
 * At most `limit` events per key in the last `windowMin` minutes, counted in the database (so it holds across
 * Vercel's many instances). The key is hashed, so no email address is stored here.
 */
export async function allow(key: string, limit: number, windowMin: number): Promise<boolean> {
  const d = await ready()
  if (!d) return true
  const k = crypto.createHash('sha256').update(key).digest('hex')
  try {
    const r = await d.query(`SELECT count(*)::int AS n FROM ape_rate WHERE key = $1 AND at > now() - ($2 || ' minutes')::interval`, [k, String(windowMin)])
    if ((Number(r[0]?.n) || 0) >= limit) return false
    await d.query(`INSERT INTO ape_rate (key) VALUES ($1)`, [k])
    return true
  } catch {
    return true
  }
}

// ---------------------------------------------------------------- reading the log

export type LogRow = { id: string; at: string; kind: string; recipient: string; ref: string | null; status: string; message_id: string; error: string; test: boolean }

export async function recent(o: { limit?: number; kind?: string; status?: string } = {}): Promise<LogRow[]> {
  const d = await ready()
  if (!d) return []
  const where: string[] = []
  const args: unknown[] = []
  if (o.kind) { args.push(o.kind); where.push(`kind = $${args.length}`) }
  if (o.status) { args.push(o.status); where.push(`status = $${args.length}`) }
  args.push(Math.min(200, o.limit || 50))
  const rows = await d.query<LogRow>(`SELECT id::text, at, kind, recipient, ref, status, message_id, error, test FROM ape_email_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY at DESC, id DESC LIMIT $${args.length}`, args).catch(() => [])
  return rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() }))
}

/** Real (not test) sends that failed for good in the last `days` days. */
export async function failedCount(days = 7): Promise<number> {
  const d = await ready()
  if (!d) return 0
  const r = await d.query(`SELECT count(*)::int AS n FROM ape_email_log WHERE status = 'failed' AND NOT test AND kind <> 'alert' AND at > now() - ($1 || ' days')::interval`, [String(days)]).catch(() => [])
  return Number(r[0]?.n) || 0
}

/** Whether GYA was told about the failures in the last `days` days (an alert or a delivery check was accepted after them). */
export async function gyaToldSince(days = 7): Promise<boolean> {
  const d = await ready()
  if (!d) return false
  const r = await d.query(
    `SELECT (SELECT max(at) FROM ape_email_log WHERE status = 'failed' AND NOT test AND kind <> 'alert' AND at > now() - ($1 || ' days')::interval) AS failed_at,
            (SELECT max(at) FROM ape_email_log WHERE status = 'accepted' AND NOT test AND kind IN ('alert', 'gya-notice')) AS told_at`, [String(days)]).catch(() => [])
  const f = r[0]?.failed_at ? new Date(r[0].failed_at).getTime() : 0
  const t = r[0]?.told_at ? new Date(r[0].told_at).getTime() : 0
  return !!f && t >= f - 1000
}

/** The last login email (invite or reset) to each address, for the Users screen. */
export async function lastLoginEmails(): Promise<Record<string, { at: string; status: string; kind: string }>> {
  const d = await ready()
  if (!d) return {}
  const rows = await d.query<{ recipient: string; at: string; status: string; kind: string }>(
    `SELECT DISTINCT ON (lower(recipient)) lower(recipient) AS recipient, at, status, kind FROM ape_email_log
      WHERE kind IN ('invite', 'reset') AND NOT test ORDER BY lower(recipient), at DESC`).catch(() => [])
  return Object.fromEntries(rows.map((r) => [r.recipient, { at: new Date(r.at).toISOString(), status: r.status, kind: r.kind }]))
}
