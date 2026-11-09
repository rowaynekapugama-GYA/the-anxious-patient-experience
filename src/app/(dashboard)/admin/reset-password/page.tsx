import { ResetForm } from '@/dashboard/editors/AuthForms'
import { BRAND } from '@/dashboard/brand'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Choose your password' }

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return (
    <div className="login">
      <div>
        <div className="card">
          <div className="logo-strip"><img className="logo" src={BRAND.logoOnDark} alt={BRAND.name} /></div>
          <h1>Choose your password</h1>
          <p className="sub">For {BRAND.name} website dashboard.</p>
          <ResetForm token={String(token || '').slice(0, 200)} />
        </div>
        <p className="foot">Built and supported by GYA</p>
      </div>
    </div>
  )
}
