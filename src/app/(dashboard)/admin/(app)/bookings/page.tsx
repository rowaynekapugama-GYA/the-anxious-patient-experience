import { requireUser } from '@/dashboard/lib/server'
import { BookingsScreen } from '@/dashboard/editors/Bookings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bookings' }

export default async function Bookings() {
  await requireUser()
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Bookings</h1><p className="pd-sub">Requests from the Book Now page. Confirm each one with the patient, then mark it confirmed here.</p></div>
        <a className="btn" href="/book-now/" target="_blank" rel="noopener">View Book Now</a></div>
      <BookingsScreen initial={null} />
    </>
  )
}
