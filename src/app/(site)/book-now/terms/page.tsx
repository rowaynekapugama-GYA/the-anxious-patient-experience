import { getPayload } from 'payload'
import config from '@payload-config'
import * as core from '@/booking/core'
import * as terms from '@/booking/terms'
import { TermsView } from '@/booking/TermsView'
import { getSettings } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Booking terms and cancellation policy | The Anxious Patient Experience™',
  description: 'The booking terms and 48-hour cancellation policy for The Anxious Patient Experience™ New Patient Appointment.',
  robots: { index: false, follow: true },
}

const long = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })

/** v1.10.0: the full terms, linked from the patient's booking email and from Book Now. Edited in Site Settings > Booking terms. */
export default async function TermsPage() {
  const s = getSettings()
  const t = await terms.loadTerms(await getPayload({ config }))
  const cfg = core.loadConfig()
  const text = terms.fill(t.text, { phone: s.phone, deposit: core.money(cfg.pricing.deposit) })
  return (
    <section className="hero-simple legal-page">
      <div className="wrap prose legal terms-page">
        <p className="eyebrow">Booking</p>
        <h1>Booking terms and cancellation policy</h1>
        <p className="legal-updated">Version {t.version}, {long(t.date)}</p>
        <TermsView text={text} />
        <p className="legal-lead"><a className="btn btn-primary" href="/book-now/">Book Now</a></p>
      </div>
    </section>
  )
}
