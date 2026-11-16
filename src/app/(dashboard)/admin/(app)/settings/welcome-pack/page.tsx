import { requireUser } from '@/dashboard/lib/server'
import { WelcomePack } from '@/dashboard/editors/WelcomePack'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Welcome pack' }

export default async function WelcomePackPage() {
  await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Welcome pack</h1><p className="pd-sub">Lorna&apos;s Patient Guide and questionnaire, the welcome email patients receive, and the online questionnaire. Changes apply straight away; no Publish needed.</p></div>
        <a className="btn" href="/admin/settings">Back to Site Settings</a>
      </div>
      <WelcomePack />
    </>
  )
}
