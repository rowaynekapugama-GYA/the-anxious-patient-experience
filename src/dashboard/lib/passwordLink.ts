/**
 * The dashboard's login emails, all through the same sender as the booking emails (src/lib/mailer.ts):
 *   invite            "Your login for ...", a link to choose a password, single use, 72 hours
 *   reset             "Reset your password for ...", single use, 1 hour (v1.8.3)
 *   password-changed  "Your password was changed" (v1.8.3), after a reset or a change
 * Links use the live site address (NEXT_PUBLIC_SERVER_URL). The token itself is never logged.
 */
import type { Payload } from 'payload'
import { emailConfigured, siteOrigin } from '@/lib/email'
import { deliver, type Result } from '@/lib/mailer'
import { getSettings, originOf } from '@/lib/site'
import * as core from '@/booking/core'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const para = (l: string) => `<p style="font:16px/1.6 Arial,sans-serif;color:#284858">${l}</p>`
export const RESET_MINUTES = 60
export const origin = () => siteOrigin(originOf(getSettings()))

/** The email itself, for a link (real or, in a test, a dead sample). */
export function passwordEmail(email: string, kind: 'invite' | 'reset', link: string, o: { test?: boolean } = {}) {
  const signIn = `${origin()}/admin`
  const subject = (o.test ? '[TEST] ' : '') + (kind === 'invite'
    ? 'Your login for The Anxious Patient Experience website dashboard'
    : 'Reset your password for The Anxious Patient Experience website dashboard')
  const lines = [
    ...(o.test ? ['TEST EMAIL. The link below is a sample and does not work.'] : []),
    ...(kind === 'invite'
      ? [
        'Hello,',
        'A login has been set up for you on The Anxious Patient Experience website dashboard, where you can look after online bookings and availability and update the website.',
        `Your login is this email address (${email}). Choose your password using the link below. The link works once and expires in 72 hours.`,
      ]
      : [
        'Hello,',
        `Someone asked to reset the password for ${email} on The Anxious Patient Experience website dashboard. Choose a new password using the link below. The link works once and expires in 1 hour.`,
      ]),
  ]
  const after = [
    `After that, sign in at ${signIn}`,
    kind === 'reset' ? 'If you did not ask for this, you can ignore this email and your password stays as it is.' : 'If you were not expecting this email, please let GYA know on 1300 889 840.',
    'The Anxious Patient Experience website, supported by GYA',
  ]
  return {
    to: [email],
    subject,
    text: [...lines, `Choose your password: ${link}`, ...after].join('\n\n'),
    html: lines.map((l) => para(esc(l))).join('')
      + `<p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:#284858;color:#ffffff;font:600 16px Arial,sans-serif;padding:12px 22px;border-radius:999px;text-decoration:none">Choose your password</a></p>`
      + after.map((l) => para(esc(l).replace(esc(signIn), `<a href="${esc(signIn)}" style="color:#284858">${esc(signIn)}</a>`))).join(''),
  }
}

/**
 * Make a fresh single-use link for an existing login and email it. Returns the send result, or null when email
 * is not set up or the address has no login.
 */
export async function sendPasswordLink(payload: Payload, email: string, kind: 'invite' | 'reset', o: { test?: boolean } = {}): Promise<Result | null> {
  if (!emailConfigured()) return null
  const token = await payload.forgotPassword({ collection: 'users', data: { email }, disableEmail: true, overrideAccess: true })
  if (!token) return null
  if (kind === 'reset') {
    // a reset link lasts 1 hour; an invite keeps the collection's 72 hours (src/sitekit/collections/Users.ts)
    const d = core.db()
    if (d) await d.query(`UPDATE users SET reset_password_expiration = now() + ($2 || ' minutes')::interval WHERE lower(email) = lower($1)`, [email, String(RESET_MINUTES)]).catch((err) => console.error('password: could not shorten the link', (err as Error).message))
  }
  const link = `${origin()}/admin/reset-password?token=${encodeURIComponent(token)}`
  return deliver(kind, passwordEmail(email, kind, link, o), { test: o.test })
}

/** "Your password was changed": so a change nobody asked for never goes unnoticed. */
export function passwordChangedEmail(email: string, o: { test?: boolean } = {}) {
  const when = core.fmtDateTime(new Date(), 'Australia/Sydney', true)
  const lines = [
    ...(o.test ? ['TEST EMAIL. No password was changed.'] : []),
    'Hello,',
    `The password for ${email} on The Anxious Patient Experience website dashboard was changed on ${when} (Sydney time).`,
    'If this was you, there is nothing to do.',
    `If it was not you, reset it straight away at ${origin()}/admin/forgot-password and call GYA on 1300 889 840.`,
    'The Anxious Patient Experience website, supported by GYA',
  ]
  return {
    to: [email],
    subject: `${o.test ? '[TEST] ' : ''}Your password was changed | The Anxious Patient Experience dashboard`,
    text: lines.join('\n\n'),
    html: lines.map((l) => para(esc(l))).join(''),
  }
}

export async function sendPasswordChanged(email: string): Promise<Result | null> {
  if (!emailConfigured()) return null
  return deliver('password-changed', passwordChangedEmail(email))
}
