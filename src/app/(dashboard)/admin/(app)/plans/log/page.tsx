import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/dashboard/lib/server'
import { PlanLog } from '@/dashboard/editors/Plans'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Treatment plan audit log' }

export default async function PlanLogPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const u = await requireUser()
  if (u.role !== 'admin') redirect('/admin/plans')
  const plan = Number((await searchParams).plan) || undefined
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Treatment plan audit log{plan ? `, plan ${plan}` : ''}</h1><p className="pd-sub">Every create, edit, finalise, view, print, send, revoke and delete, and every refused attempt: who and when, never any content. GYA only.</p></div>
        <div className="actions"><Link className="btn" href="/admin/plans">Back to Treatment plans</Link></div>
      </div>
      <PlanLog planNo={plan} />
    </>
  )
}
