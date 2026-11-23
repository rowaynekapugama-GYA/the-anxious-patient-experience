import { requireUser } from '@/dashboard/lib/server'
import { PatientEmails } from '@/dashboard/editors/PatientEmails'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Patient emails' }

export default async function PatientEmailsPage() {
  await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Patient emails</h1><p className="pd-sub">The wording of the emails patients receive. Changes apply to the next email straight away; no Publish needed. Team and login emails are not edited here.</p></div>
      </div>
      <PatientEmails />
    </>
  )
}
