/**
 * Who can open patient questionnaires (v1.10.0).
 *
 * Having a dashboard login is not enough: a person can open questionnaires only when "Can view patient
 * questionnaires" is ticked on their login. The practice owner (Lorna) ticks it for anyone, herself included, on the
 * Users screen; a GYA administrator can too. Ordinary editors cannot see or change it. Every change is written to
 * ape_access_log (who, for whom, when) and the person given access gets a short email.
 */
import type { Payload } from 'payload'
import { db } from '@/booking/core'
import { deliver } from '@/lib/mailer'
import { siteOrigin } from '@/lib/email'
import { DEFAULTS } from '@/site.config'
import { shell, paragraphs, panel, status, button, small, LOGIN_FOOTER } from '@/email/layout'

export type Who = { id?: string | number; email: string; role?: string; practiceOwner?: boolean | null }

/** May this person tick or untick questionnaire access (for anyone)? */
export const canManageAccess = (u: Who | null | undefined) => !!u && (u.role === 'admin' || !!u.practiceOwner)
/** May this person make someone a practice owner? GYA only. */
export const canSetOwner = (u: Who | null | undefined) => !!u && u.role === 'admin'

export type LogEntry = { at: string; by: string; for: string; change: string; note: string }

export async function logAccess(e: { by: string; for: string; change: string; note?: string }): Promise<void> {
  const d = db()
  if (!d) return
  await d.query(`INSERT INTO ape_access_log (by_email, for_email, change, note) VALUES ($1, $2, $3, $4)`, [e.by, e.for, e.change, e.note || ''])
}

export async function accessLog(limit = 50): Promise<LogEntry[]> {
  const d = db()
  if (!d) return []
  const r = await d.query<{ at: Date; by_email: string; for_email: string; change: string; note: string }>(
    `SELECT at, by_email, for_email, change, note FROM ape_access_log ORDER BY at DESC, id DESC LIMIT $1`, [limit]).catch(() => [])
  return r.map((x) => ({ at: new Date(x.at).toISOString(), by: x.by_email, for: x.for_email, change: x.change, note: x.note }))
}

/** The short email to someone who can now open questionnaires. No patient details. */
export function accessEmail(to: { email: string; name?: string }, by: string, o: { test?: boolean } = {}): { subject: string; text: string; html: string } {
  const first = String(to.name || '').trim().split(/\s+/)[0] || 'there'
  const link = `${siteOrigin(DEFAULTS.siteUrl)}/admin/questionnaires`
  const text = [
    ...(o.test ? ['TEST EMAIL. No access was changed.'] : []),
    `Hi ${first},`,
    `You can now open patient questionnaires in The Anxious Patient Experience website dashboard. Access was given by ${by}.`,
    `Sign in and choose Questionnaires:\n${siteOrigin(DEFAULTS.siteUrl)}/admin/questionnaires`,
    'Every time a questionnaire is opened, printed or marked reviewed, it is logged. If you did not expect this, please reply to this email.',
  ].join('\n\n')
  const subject = `${o.test ? '[TEST] ' : ''}You can now open patient questionnaires | The Anxious Patient Experience™`
  // v1.14.0: the branded layout; the wording stays fixed
  // v1.17.0: laid out for a quick read; the text version is unchanged
  const html = shell({
    origin: siteOrigin(DEFAULTS.siteUrl), variant: 'login', subject, footer: LOGIN_FOOTER,
    preheader: `Access was given by ${by}.`,
    eyebrow: 'Website dashboard', heading: 'You can now open patient questionnaires',
    sections: [
      ...(o.test ? [status('test', 'TEST EMAIL', 'No access was changed.')] : []),
      paragraphs(`Hi ${first},`),
      status('ok', 'Questionnaire access given', `Access was given by ${by}.`),
      panel([['Your login', to.email], ['Where', 'Dashboard > Questionnaires']]),
      button('Open Questionnaires', link),
      small('Every time a questionnaire is opened, printed or marked reviewed, it is logged. If you did not expect this, please reply to this email.'),
    ],
  }).html
  return { subject, text, html }
}

/**
 * Tick or untick questionnaire access for one login. Returns the updated login, or why not.
 * Only the practice owner or a GYA administrator may; the change is logged and, when given, the person is emailed.
 */
export async function setAccess(payload: Payload, actor: Who, targetId: string | number, on: boolean): Promise<{ ok: true; user: Record<string, any>; emailed: boolean | null } | { ok: false; status: number; error: string }> {
  if (!canManageAccess(actor)) return { ok: false, status: 403, error: 'Only the practice owner or GYA can change who opens questionnaires.' }
  const target = await payload.findByID({ collection: 'users', id: targetId, depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  if (!target) return { ok: false, status: 404, error: 'That login no longer exists.' }
  if (!!target.canViewQuestionnaires === on) return { ok: true, user: target, emailed: null }
  const user = await payload.update({ collection: 'users', id: target.id, data: { canViewQuestionnaires: on }, depth: 0, overrideAccess: true }) as Record<string, any>
  await logAccess({ by: actor.email, for: String(target.email), change: on ? 'questionnaire access: given' : 'questionnaire access: removed' })
  let emailed: boolean | null = null
  if (on) {
    const m = accessEmail({ email: String(target.email), name: String(target.name || '') }, actor.email)
    const r = await deliver('access', { to: [String(target.email)], ...m }).catch(() => ({ ok: false }))
    emailed = !!r.ok
  }
  return { ok: true, user, emailed }
}

/** GYA makes a login the practice owner (or not). Logged. */
export async function setOwner(payload: Payload, actor: Who, targetId: string | number, on: boolean): Promise<{ ok: true; user: Record<string, any> } | { ok: false; status: number; error: string }> {
  if (!canSetOwner(actor)) return { ok: false, status: 403, error: 'Only GYA can choose the practice owner.' }
  const target = await payload.findByID({ collection: 'users', id: targetId, depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
  if (!target) return { ok: false, status: 404, error: 'That login no longer exists.' }
  if (!!target.practiceOwner === on) return { ok: true, user: target }
  const user = await payload.update({ collection: 'users', id: target.id, data: { practiceOwner: on }, depth: 0, overrideAccess: true }) as Record<string, any>
  await logAccess({ by: actor.email, for: String(target.email), change: on ? 'practice owner: on' : 'practice owner: off' })
  return { ok: true, user }
}
