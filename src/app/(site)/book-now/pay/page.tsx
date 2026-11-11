import * as core from '@/booking/core'
import * as deposit from '@/booking/deposit'
import { paypalConfigured, paypalClientId } from '@/lib/paypal'
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
  return (
    <section className="hero-simple legal-page">
      <div className="wrap prose legal pay-page">
        <p className="eyebrow">Your deposit</p>
        <h1>Pay your {core.money(cfg.pricing.deposit)} deposit</h1>
        <p className="legal-updated">For your appointment on {when} (Sydney time). Reference {row.ref}.</p>
        <p className="legal-lead">The deposit secures your time and comes off the cost of your appointment. You can pay with PayPal or with a debit or credit card; you do not need a PayPal account.</p>
        <PayDeposit token={String(t)} clientId={paypalClientId()} amount={cfg.pricing.deposit} phone={s.phone} />
      </div>
    </section>
  )
}
