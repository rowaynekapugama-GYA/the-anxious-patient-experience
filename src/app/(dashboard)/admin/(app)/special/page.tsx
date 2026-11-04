import { requireUser } from '@/dashboard/lib/server'
import { SpecialScreen } from '@/dashboard/editors/Bookings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Opening special' }

export default async function Special() {
  await requireUser()
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Opening special</h1><p className="pd-sub">The $250 welcome for the first six patients. It looks after itself; this shows where it is up to.</p></div></div>
      <SpecialScreen initial={null} />
    </>
  )
}
