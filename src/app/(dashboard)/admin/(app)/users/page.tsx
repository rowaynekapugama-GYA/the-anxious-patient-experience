import { notFound } from 'next/navigation'
import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { UsersEditor } from '@/dashboard/editors/UsersEditor'
import { lastLoginEmails } from '@/lib/mailer'
import { accessLog, canManageAccess } from '@/lib/access'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Users' }

/**
 * GYA administrators manage every login here. v1.10.0: the practice owner (Lorna) also sees this screen, but only to
 * choose who can open patient questionnaires. Ordinary editors cannot open it.
 */
export default async function Users() {
  const me = await requireUser()
  const admin = me.role === 'admin'
  if (!admin && !canManageAccess(me)) notFound()
  const payload = await payloadClient()
  const res = await payload.find({ collection: 'users', limit: 500, sort: 'email', depth: 0, overrideAccess: true })
  const users = res.docs.map((d) => {
    const x = d as Record<string, any>
    return { id: x.id, name: String(x.name || ''), email: String(x.email), role: x.role === 'admin' ? 'admin' as const : 'editor' as const, mustChangePassword: !!x.mustChangePassword, canViewQuestionnaires: !!x.canViewQuestionnaires, canTreatmentPlans: !!x.canTreatmentPlans, practiceOwner: !!x.practiceOwner, createdAt: String(x.createdAt || ''), lastLoginAt: (x.lastLoginAt as string | null | undefined) ?? null }
  })
  // v1.8.3: the last login email to each person, from the email log (GYA only)
  const last = admin ? await lastLoginEmails() : {}
  const withLast = users.map((u) => ({ ...u, lastEmail: last[u.email.toLowerCase()] ?? null }))
  const log = await accessLog(30)
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Users</h1><p className="pd-sub">{admin
        ? 'Who can sign in to the dashboard. Accounts can also be added from Vercel with DASHBOARD_EDITORS (see README). Delete an account here to stop someone signing in.'
        : 'Choose who can open patient questionnaires. Logins are added and removed by GYA.'}</p></div></div>
      <UsersEditor initial={withLast} me={me.id} mode={admin ? 'admin' : 'owner'} log={log} />
    </>
  )
}
