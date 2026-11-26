import Link from 'next/link'
import { requireUser } from '@/dashboard/lib/server'
import { PlanEditor } from '@/dashboard/editors/Plans'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Treatment plan' }

export default async function Plan({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Treatment plan</h1></div>
        <div className="actions"><Link className="btn" href="/admin/plans">All plans</Link></div>
      </div>
      <PlanEditor id={Number(id) || 0} />
    </>
  )
}
