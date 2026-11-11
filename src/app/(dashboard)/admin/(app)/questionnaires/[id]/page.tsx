import { requireUser } from '@/dashboard/lib/server'
import { QuestionnaireView } from '@/dashboard/editors/Questionnaires'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Questionnaire' }

export default async function Questionnaire({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const { id } = await params
  return <QuestionnaireView id={id} role={u.role} />
}
