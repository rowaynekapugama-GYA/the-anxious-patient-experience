import Link from 'next/link'
import { requireUser } from '@/dashboard/lib/server'
import { QuestionnairesScreen } from '@/dashboard/editors/Questionnaires'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Questionnaires' }

export default async function Questionnaires() {
  const u = await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Questionnaires</h1><p className="pd-sub">New patient questionnaires sent with the welcome pack. Answers open only for people with questionnaire access, and every view is logged.</p></div>
        <div className="actions">
          <Link className="btn" href="/admin/questionnaires/content">Questions and emails</Link>
          {u.role === 'admin' ? <Link className="btn" href="/admin/questionnaires/log">Access log</Link> : null}
        </div>
      </div>
      <QuestionnairesScreen role={u.role} />
    </>
  )
}
