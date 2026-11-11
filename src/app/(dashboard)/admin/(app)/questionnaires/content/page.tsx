import Link from 'next/link'
import { requireUser } from '@/dashboard/lib/server'
import { QuestionnaireContentEditor } from '@/dashboard/editors/Questionnaires'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Questions and emails' }

export default async function QuestionnaireContent() {
  await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Questions and emails</h1><p className="pd-sub">The questionnaire exactly as patients see it, the collection notice, the welcome email and the welcome pack. Changes apply straight away; no Publish needed.</p></div>
        <div className="actions"><Link className="btn" href="/admin/questionnaires">Back to Questionnaires</Link></div>
      </div>
      <QuestionnaireContentEditor />
    </>
  )
}
