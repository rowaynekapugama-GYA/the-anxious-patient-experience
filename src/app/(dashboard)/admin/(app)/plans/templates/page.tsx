import Link from 'next/link'
import { requireUser } from '@/dashboard/lib/server'
import { TemplatesScreen } from '@/dashboard/editors/PlanTemplates'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Treatment plan templates' }

export default async function PlanTemplates() {
  await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Templates and paragraphs</h1><p className="pd-sub">Set up your wording once and start each plan from it. Nothing about a patient is ever saved in a template or a paragraph.</p></div>
        <div className="actions"><Link className="btn" href="/admin/plans">Back to Treatment plans</Link></div>
      </div>
      <TemplatesScreen />
    </>
  )
}
