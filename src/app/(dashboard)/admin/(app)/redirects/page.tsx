import { payloadClient, requireAdmin } from '@/dashboard/lib/server'
import { RedirectsEditor } from '@/dashboard/editors/RedirectsEditor'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Redirects' }

export default async function Redirects() {
  await requireAdmin()
  const payload = await payloadClient()
  const res = await payload.find({ collection: 'redirects', limit: 2000, sort: 'from', depth: 0, overrideAccess: true, pagination: false })
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Redirects</h1><p className="pd-sub">Send visitors and Google from an old address to a new one.</p></div></div>
      <RedirectsEditor initial={res.docs.map((d) => ({ id: d.id, from: String(d.from), to: String(d.to), type: d.type === 'temporary' ? 'temporary' as const : 'permanent' as const }))} />
    </>
  )
}
