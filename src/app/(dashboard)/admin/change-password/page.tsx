import { requireUser } from '@/dashboard/lib/server'
import { ChangePasswordForm } from '@/dashboard/editors/AuthForms'
import { BRAND } from '@/dashboard/brand'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Choose a new password' }

export default async function ChangePassword() {
  const u = await requireUser({ allowPasswordChange: true })
  return (
    <div className="login">
      <div>
        <div className="card">
          <div className="logo-strip"><img className="logo" src={BRAND.logoOnDark} alt={BRAND.name} /></div>
          <h1>{u.mustChangePassword ? 'Choose your password' : 'Change your password'}</h1>
          <p className="sub">{u.email}</p>
          <ChangePasswordForm forced={!!u.mustChangePassword} />
          {!u.mustChangePassword ? <p className="help" style={{ textAlign: 'center', marginTop: 10 }}><a href="/admin">Back to the dashboard</a></p> : null}
        </div>
      </div>
    </div>
  )
}
