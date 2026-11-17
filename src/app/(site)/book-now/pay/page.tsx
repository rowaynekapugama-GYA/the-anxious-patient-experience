import * as core from '@/booking/core'
import * as deposit from '@/booking/deposit'
import { paypalConfigured, paypalClientId, paypalAdvanced, paypalEnv } from '@/lib/paypal'
import { getPayload } from 'payload'
import config from '@payload-config'
import * as terms from '@/booking/terms'
import { TermsView } from '@/booking/TermsView'
import { getSettings } from '@/lib/site'
import { PayDeposit } from './PayDeposit'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pay your deposit | The Anxious Patient Experience™', robots: { index: false, follow: false } }

/** The private "Pay your deposit" link from the booking email (v1.8.0): one booking, until paid or 14 days. */
export default async function PayPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  const s = getSettings()
  const contact = <p className="legal-lead">If you have a question, simply reply to your booking email or call the clinic on {s.phone}.</p>
  const Message = ({ heading, children }: { heading: string; children?: React.ReactNode }) => (
    <section className="hero-simple legal-page"><div className="wrap prose legal"><h1>{heading}</h1>{children}{contact}</div></section>
  )
  if (!paypalConfigured()) return <Message heading="Online deposit payments are not open yet."><p>The APE team will send you the deposit details with your confirmation.</p></Message>
  const d = core.db()
  if (!d) return <Message heading="Please try again shortly." />
  const cfg = core.loadConfig()
  await core.ensureSchema(d, cfg)
  const found = await deposit.bookingForToken(d, String(t || ''))
  if (found.state === 'paid') return <Message heading="Your deposit has already been received."><p>Thank you. There is nothing more to pay.</p></Message>
  if (found.state === 'cancelled') return <Message heading="This booking has been cancelled."><p>If that is unexpected, please get in touch and we will sort it out.</p></Message>
  if (found.state !== 'ok' || !found.row) return <Message heading="This payment link is no longer active."><p>Links work for 14 days. Please reply to your booking email and we will send you a fresh one.</p></Message>
  const row = found.row
  const when = core.fmtDateTime(new Date(row.slot_start), cfg.booking.timeZone, true)
  const tm = await terms.loadTerms(await getPayload({ config }))
  return (
    <section className="hero-simple legal-page">
      <div className="wrap prose legal pay-page">
        <p className="eyebrow">Your deposit</p>
        <h1>Pay your {core.money(cfg.pricing.deposit)} deposit</h1>
        <p className="legal-updated">For your appointment on {when} (Sydney time). Reference {row.ref}.</p>
        <p className="legal-lead">The deposit secures your time and comes off the cost of your appointment. You can pay by card, or with PayPal. You don&apos;t need a PayPal account.</p>
        {/* v1.10.0: the same terms as Book Now, and the same "I have read" tick before paying */}
        <h2 className="pay-terms-h">Terms and cancellation policy</h2>
        <div className="terms-box" role="region" aria-label="Terms and cancellation policy" tabIndex={0}>
          <TermsView text={terms.fill(tm.text, { phone: s.phone, deposit: core.money(cfg.pricing.deposit) })} className="terms-text" />
          <p className="terms-version">Terms version {tm.label}</p>
        </div>
        <PayDeposit token={String(t)} clientId={paypalClientId()} amount={cfg.pricing.deposit} phone={s.phone} readLabel={tm.readLabel} advanced={paypalAdvanced()} env={paypalEnv()} assetVersion={String(process.env.npm_package_version || '1')} />
      </div>
    </section>
  )
}
