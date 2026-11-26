import Link from 'next/link'
import { requireUser } from '@/dashboard/lib/server'
import { PlansScreen } from '@/dashboard/editors/Plans'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Treatment plans' }

export default async function Plans() {
  const u = await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Treatment plans</h1><p className="pd-sub">Written after a patient&apos;s first appointment, printed or sent to them. Content is encrypted, only people with &quot;Can create and view treatment plans&quot; can open a plan, and every action is logged.</p></div>
        <div className="actions">
          <Link className="btn" href="/admin/plans/form">Form</Link>
          {u.role === 'admin' ? <Link className="btn" href="/admin/plans/log">Audit log</Link> : null}
        </div>
      </div>
      <PlansScreen />
    </>
  )
}
