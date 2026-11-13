import { redirect } from 'next/navigation'
import { requireUser } from '@/dashboard/lib/server'
import { EmailCheck } from '@/dashboard/editors/EmailCheck'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Email' }

export default async function EmailPage() {
  const me = await requireUser()
  // GYA only: the practice sees the one-line email status on the dashboard home instead
  if (me.role !== 'admin') redirect('/admin')
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Email</h1><p className="pd-sub">GYA only. How the website sends email, who gets each one, what went out recently, and test emails to one address.</p></div>
        <a className="btn" href="/admin/settings">Back to Site Settings</a></div>
      <EmailCheck me={me.email} />
    </>
  )
}
