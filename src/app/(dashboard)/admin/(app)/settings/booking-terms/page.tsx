import { requireUser } from '@/dashboard/lib/server'
import { BookingTerms } from '@/dashboard/editors/BookingTerms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Deposit policy' }

export default async function BookingTermsPage() {
  await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Deposit policy</h1><p className="pd-sub">The deposit policy patients read and agree to in a pop-up on Book Now (between their details and the deposit) and on the pay-later page. It is also at /book-now/terms/. Changes apply to the next booking straight away; no Publish needed.</p></div>
        <a className="btn" href="/admin/settings">Back to Site Settings</a>
      </div>
      <BookingTerms />
    </>
  )
}
