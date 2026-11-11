import Link from 'next/link'
import { requireAdmin } from '@/dashboard/lib/server'
import { QuestionnaireLogScreen } from '@/dashboard/editors/Questionnaires'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Questionnaire access log' }

export default async function QuestionnaireLog() {
  await requireAdmin()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Questionnaire access log</h1><p className="pd-sub">Who opened, printed, reviewed or deleted a questionnaire, and every refused attempt. GYA only.</p></div>
        <div className="actions"><Link className="btn" href="/admin/questionnaires">Back to Questionnaires</Link></div>
      </div>
      <QuestionnaireLogScreen />
    </>
  )
}
