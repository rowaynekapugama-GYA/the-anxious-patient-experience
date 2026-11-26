import Link from 'next/link'
import { requireUser } from '@/dashboard/lib/server'
import { FormBuilder } from '@/dashboard/editors/Plans'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Treatment plan form' }

export default async function PlanForm() {
  await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Treatment plan form</h1><p className="pd-sub">What is on every new plan: sections, fixed wording and the fields to fill in. The practice can change it at any time.</p></div>
        <div className="actions"><Link className="btn" href="/admin/plans">Back to Treatment plans</Link></div>
      </div>
      <FormBuilder />
    </>
  )
}
