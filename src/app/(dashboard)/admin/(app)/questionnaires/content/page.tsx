import { redirect } from 'next/navigation'

/** v1.9.0: the questions are Lorna's own (in code); the wording around them moved to Site Settings > Welcome pack. */
export default function QuestionnaireContent() {
  redirect('/admin/settings/welcome-pack')
}
