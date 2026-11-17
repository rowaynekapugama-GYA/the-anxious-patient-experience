import { requireUser } from '@/dashboard/lib/server'
import { BookingTerms } from '@/dashboard/editors/BookingTerms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Booking terms' }

export default async function BookingTermsPage() {
  await requireUser()
  return (
    <>
      <div className="pd-head">
        <div className="grow"><h1>Booking terms</h1><p className="pd-sub">The terms and cancellation policy patients read on Book Now, before paying the deposit and on the pay-later page. Changes apply to the next booking straight away; no Publish needed.</p></div>
        <a className="btn" href="/admin/settings">Back to Site Settings</a>
      </div>
      <BookingTerms />
    </>
  )
}
