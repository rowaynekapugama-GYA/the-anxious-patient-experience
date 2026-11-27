import Link from 'next/link'
import { requireUser } from '@/dashboard/lib/server'
import { TemplateEditor } from '@/dashboard/editors/PlanTemplates'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Treatment plan template' }

export default async function PlanTemplate({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Template</h1></div>
        <div className="actions"><Link className="btn" href="/admin/plans/templates">All templates</Link></div>
      </div>
      <TemplateEditor id={Number(id) || 0} />
    </>
  )
}
