/**
 * Build step: make sure everyone listed in DASHBOARD_EDITORS can sign in to the dashboard.
 *
 *   DASHBOARD_EDITORS=lorna@example.com,reception@example.com.au
 *
 * Each address without an account gets an Editor account, and (when email is set up) an email with a link to
 * choose their password. Addresses that already have an account are left alone. Taking an address off the list
 * does not delete its account: delete it on the dashboard's Users screen. Only on production builds, so a
 * preview deployment never emails anyone.
 */
import './load-env'
import crypto from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendPasswordLink } from '../src/dashboard/lib/passwordLink'
import { emailConfigured } from '../src/lib/email'

async function main() {
  const list = [...new Set(String(process.env.DASHBOARD_EDITORS || '').split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))]
  if (!list.length) { console.log('logins: DASHBOARD_EDITORS is empty, nothing to do'); process.exit(0) }
  if (!process.env.DATABASE_URL) { console.log('logins: no DATABASE_URL, nothing to do'); process.exit(0) }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') { console.log('logins: not a production build, nothing to do'); process.exit(0) }
  const payload = await getPayload({ config })
  for (const email of list) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.log(`logins: "${email}" is not an email address, skipped`); continue }
    const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
    if (found.docs[0]) { console.log(`logins: ${email} already has a login, so no email was sent (Users > Send login email again sends one)`); continue }
    await payload.create({
      collection: 'users', overrideAccess: true, depth: 0,
      // nobody knows this password: the person chooses their own from the emailed link
      data: { email, name: '', role: 'editor', mustChangePassword: false, password: crypto.randomBytes(24).toString('base64url') + 'a1' } as never,
    })
    if (!emailConfigured()) { console.log(`logins: ${email} added as an Editor; email is not set up, so GYA sends the link from the Users screen later`); continue }
    try {
      const r = await sendPasswordLink(payload, email, 'invite')
      if (r?.ok) console.log(`logins: ${email} added as an Editor and emailed a link to choose a password (SMTP2GO ${r.id || 'accepted'})`)
      else console.log(`logins: ${email} added as an Editor, but the email was not accepted (${r?.error ?? 'no login found'}); use Users > Send login email again`)
    } catch (err) {
      console.log(`logins: ${email} added as an Editor, but the email could not be sent (${(err as Error).message}); use the Users screen to send it again`)
    }
  }
  process.exit(0)
}

void main()
