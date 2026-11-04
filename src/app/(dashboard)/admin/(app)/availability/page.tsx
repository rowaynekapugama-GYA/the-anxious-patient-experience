import { requireUser } from '@/dashboard/lib/server'
import { AvailabilityScreen } from '@/dashboard/editors/Bookings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Availability' }

export default async function Availability() {
  await requireUser()
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Availability</h1><p className="pd-sub">When patients can book online: the weekly booking times, and days or times you block for leave.</p></div></div>
      <AvailabilityScreen initial={null} />
    </>
  )
}
