import { ForgotForm } from '@/dashboard/editors/AuthForms'
import { BRAND } from '@/dashboard/brand'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Forgotten your password?' }

export default function ForgotPassword() {
  return (
    <div className="login">
      <div>
        <div className="card">
          <div className="logo-strip"><img className="logo" src={BRAND.logoOnDark} alt={BRAND.name} /></div>
          <h1>Forgotten your password?</h1>
          <p className="sub">Enter the email address you sign in with and we will email you a link to choose a new password.</p>
          <ForgotForm />
        </div>
        <p className="foot">Built and supported by GYA</p>
      </div>
    </div>
  )
}
