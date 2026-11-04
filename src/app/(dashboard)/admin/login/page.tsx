import { redirect } from 'next/navigation'
import { currentUser, payloadClient } from '@/dashboard/lib/server'
import { FirstUserForm, LoginForm } from '@/dashboard/editors/AuthForms'
import { BRAND } from '@/dashboard/brand'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in' }

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await currentUser()
  if (u) redirect(u.mustChangePassword ? '/admin/change-password' : '/admin')
  const { next } = await searchParams
  let firstUser = false
  if (process.env.ALLOW_FIRST_USER === 'true') {
    const payload = await payloadClient()
    firstUser = (await payload.count({ collection: 'users', overrideAccess: true }).catch(() => ({ totalDocs: 1 }))).totalDocs === 0
  }
  return (
    <div className="login">
      <div>
        <div className="card">
          <div className="logo-strip"><img className="logo" src={BRAND.logoOnDark} alt={BRAND.name} /></div>
          <h1>Website dashboard</h1>
          <p className="sub">{firstUser ? `Set up the dashboard for ${BRAND.name}.` : `Sign in to update ${BRAND.name} website.`}</p>
          {firstUser ? <FirstUserForm /> : <LoginForm next={next} />}
        </div>
        <p className="foot">Built and supported by GYA</p>
      </div>
    </div>
  )
}
