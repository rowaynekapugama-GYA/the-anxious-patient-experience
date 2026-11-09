/**
 * "Set up your password" and "Reset your password" emails for the dashboard.
 *
 * A one-off link to /admin/reset-password, valid for 72 hours (Users > auth > forgotPassword), sent from
 * BOOKING_FROM through the same email provider as the booking emails (src/lib/email.ts).
 */
import type { Payload } from 'payload'
import { emailConfigured, sendEmail, siteOrigin } from '@/lib/email'
import { getSettings, originOf } from '@/lib/site'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const para = (l: string) => `<p style="font:16px/1.6 Arial,sans-serif;color:#284858">${l}</p>`

export async function sendPasswordLink(payload: Payload, email: string, kind: 'invite' | 'reset'): Promise<boolean> {
  if (!emailConfigured()) return false
  const token = await payload.forgotPassword({ collection: 'users', data: { email }, disableEmail: true, overrideAccess: true })
  if (!token) return false
  const origin = siteOrigin(originOf(getSettings()))
  const link = `${origin}/admin/reset-password?token=${encodeURIComponent(token)}`
  const signIn = `${origin}/admin`
  const subject = kind === 'invite'
    ? 'Your login for The Anxious Patient Experience website dashboard'
    : 'Reset your password for The Anxious Patient Experience website dashboard'
  const lines = kind === 'invite'
    ? [
      'Hello,',
      'A login has been set up for you on The Anxious Patient Experience website dashboard, where you can look after online bookings and availability and update the website.',
      `Your login is this email address (${email}). Choose your password using the link below. The link works once and expires in 72 hours.`,
    ]
    : [
      'Hello,',
      `Someone asked to reset the password for ${email} on The Anxious Patient Experience website dashboard. Choose a new password using the link below. The link works once and expires in 72 hours.`,
    ]
  const after = [
    `After that, sign in at ${signIn}`,
    kind === 'reset' ? 'If you did not ask for this, you can ignore this email and your password stays as it is.' : 'If you were not expecting this email, please let GYA know on 1300 889 840.',
    'The Anxious Patient Experience website, supported by GYA',
  ]
  await sendEmail({
    to: [email],
    subject,
    text: [...lines, `Choose your password: ${link}`, ...after].join('\n\n'),
    html: lines.map((l) => para(esc(l))).join('')
      + `<p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:#284858;color:#ffffff;font:600 16px Arial,sans-serif;padding:12px 22px;border-radius:999px;text-decoration:none">Choose your password</a></p>`
      + after.map((l) => para(esc(l).replace(esc(signIn), `<a href="${esc(signIn)}" style="color:#284858">${esc(signIn)}</a>`))).join(''),
  })
  return true
}
