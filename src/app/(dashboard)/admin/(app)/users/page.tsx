import { payloadClient, requireAdmin } from '@/dashboard/lib/server'
import { UsersEditor } from '@/dashboard/editors/UsersEditor'
import { lastLoginEmails } from '@/lib/mailer'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Users' }

export default async function Users() {
  const me = await requireAdmin()
  const payload = await payloadClient()
  const res = await payload.find({ collection: 'users', limit: 500, sort: 'email', depth: 0, overrideAccess: true })
  const users = res.docs.map((d) => ({ id: d.id, name: String(d.name || ''), email: String(d.email), role: d.role === 'admin' ? 'admin' as const : 'editor' as const, mustChangePassword: !!d.mustChangePassword, canViewQuestionnaires: !!(d as { canViewQuestionnaires?: boolean }).canViewQuestionnaires }))
  // v1.8.3: the last login email to each person, from the email log
  const last = await lastLoginEmails()
  const withLast = users.map((u) => ({ ...u, lastEmail: last[u.email.toLowerCase()] ?? null }))
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Users</h1><p className="pd-sub">Who can sign in to the dashboard. Accounts can also be added from Vercel with DASHBOARD_EDITORS (see README). Delete an account here to stop someone signing in.</p></div></div>
      <UsersEditor initial={withLast} me={me.id} />
    </>
  )
}
