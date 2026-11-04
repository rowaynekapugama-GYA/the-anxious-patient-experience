import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { SettingsForm } from '@/dashboard/editors/SettingsForm'
import { mediaUrl } from '@/sitekit/sync'
import { mergeSettings } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Site Settings' }

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export default async function SettingsPage() {
  const u = await requireUser()
  const isAdmin = u.role === 'admin'
  const payload = await payloadClient()
  const g = await payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: true }) as Record<string, any>
  const seo = await payload.findGlobal({ slug: 'seo', depth: 1, overrideAccess: true }) as Record<string, any>
  // what the website uses today: the defaults with anything saved on top
  const m = mergeSettings(JSON.parse(JSON.stringify(g, (_k, v) => (v === null ? undefined : v)))) as Record<string, any>
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Site Settings</h1><p className="pd-sub">Contact details and options that apply to the whole website.</p></div></div>
      <SettingsForm isAdmin={isAdmin} initial={{
        phone: str(m.phone), apeEmail: str(m.apeEmail), receptionEmail: str(m.receptionEmail),
        clinic: { name: str(m.clinic?.name), street: str(m.clinic?.street), suburb: str(m.clinic?.suburb), state: str(m.clinic?.state), postcode: str(m.clinic?.postcode), mapsUrl: str(m.clinic?.mapsUrl) },
        bookingRecipients: isAdmin
          ? ((g.bookingRecipients as { address?: string }[] | undefined)?.map((r) => str(r.address)).filter(Boolean) ?? [])
          : [],
        tracking: isAdmin ? { ga4: str(g.tracking?.ga4), metaPixel: str(g.tracking?.metaPixel) } : { ga4: '', metaPixel: '' },
        seo: {
          defaultTitle: str(seo.defaultTitle), defaultDescription: str(seo.defaultDescription),
          defaultOgImage: mediaUrl(seo.defaultOgImage) ?? '',
          defaultOgImageMedia: seo.defaultOgImage && typeof seo.defaultOgImage === 'object' ? seo.defaultOgImage.id : seo.defaultOgImage ?? null,
          noindexSite: !!seo.noindexSite,
        },
      }} />
    </>
  )
}
