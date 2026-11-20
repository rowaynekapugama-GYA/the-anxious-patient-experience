import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { lookupToken, loadWords, readDraft, tooMany, bookingIdentity } from '@/lib/questionnaire'
import { FORM, ID } from '@/lib/ape-questionnaire'
import { getSettings } from '@/lib/site'
import { QuestionnaireForm } from './QuestionnaireForm'
import { ageRule, GUARDIAN_REQUIRED_UNDER } from '@/booking/age'
import { EmbedBridge } from './EmbedBridge'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pre-appointment Questionnaire | The Anxious Patient Experience™' }

const css = <link rel="stylesheet" href={`/assets/questionnaire.css?v=${encodeURIComponent(String(process.env.npm_package_version || '1'))}`} precedence="default" />

/** A private link from the welcome email: one booking, one token. Answers can be saved and finished later. */
export default async function QuestionnairePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { token } = await params
  // v1.9.3: ?embed=1 is the questionnaire shown inside the Book Now page, without the site header and footer
  const embed = (await searchParams).embed === '1'
  const frame = embed ? <><style>{EMBED_CSS}</style><EmbedBridge /></> : null
  const s = getSettings()
  const contact = <p className="legal-lead">If you have a question, just reply to your booking email or call the clinic on {s.phone}.</p>
  const h = await headers()
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown').split(',')[0].trim()
  if (tooMany(`page:${ip}`, 60, 10 * 60 * 1000)) return <Message frame={frame} heading="Please try again in a few minutes.">{contact}</Message>

  const payload = await getPayload({ config })
  const found = await lookupToken(payload, token)
  if (found.state === 'off') {
    return <Message frame={frame} heading="The online questionnaire is not open at the moment.">
      <p>Your welcome email has the questionnaire attached as a PDF. If you would like to, fill it in and bring it with you to your appointment.</p>{contact}
    </Message>
  }
  if (found.state === 'submitted') {
    return <Message frame={frame} heading={FORM.thanksHeading}>{FORM.thanks.map((p) => <p key={p}>{p}</p>)}{contact}</Message>
  }
  if (found.state !== 'ok' || !found.row) {
    // the same message for a wrong, replaced or expired link, so a link tells nobody anything
    return <Message frame={frame} heading="This link is no longer active.">
      <p>Questionnaire links work until a week after the appointment, and a newer email replaces the link in an older one. Please reply to your booking email and we will send you a fresh link, or bring the PDF copy with you.</p>{contact}
    </Message>
  }
  const row = found.row
  const words = await loadWords(payload)
  // v1.10.0: the name and date of birth from the booking, unless the patient has already saved their own
  const initial = readDraft(row)
  const booking = found.test ? { name: String(row.patientName || ''), dob: null } : await bookingIdentity(String(row.bookingRef))
  if (booking && !initial[ID.name] && booking.name) initial[ID.name] = booking.name
  if (booking && !initial[ID.dob] && booking.dob) initial[ID.dob] = booking.dob
  // v1.13.0: a gentle line for patients under 18 at the appointment (from the booking's date of birth). NEW COPY for Lorna.
  const minor = !!(booking?.dob && row.appointmentAt) && (ageRule(String(booking!.dob), String(row.appointmentAt)).age ?? 99) < GUARDIAN_REQUIRED_UNDER
  const when = row.appointmentAt ? new Date(row.appointmentAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <section className="qn-page">
      {css}{frame}
      <div className="wrap qn-wrap">
        {found.test ? <p className="qn-test" role="note"><b>TEST questionnaire.</b> Sent from the dashboard&apos;s Email check. It is kept apart from real patients&apos; answers and deleted after 24 hours.</p> : null}
        <header className="qn-top">
          <p className="qn-brand">{FORM.brand}</p>
          <h1>{FORM.title}</h1>
          <p className="qn-strap">{FORM.strap}</p>
          {when ? <p className="qn-when">For your appointment on {when}</p> : null}
        </header>
        <section className="qn-intro" aria-labelledby="qn-intro-h">
          <h2 id="qn-intro-h">{FORM.introHeading}</h2>
          {FORM.intro.map((p) => <p key={p}>{p}</p>)}
          <p className="qn-confidential">{FORM.confidential}</p>
          {minor ? <p className="qn-minor">If you&apos;re under 18, you&apos;re welcome to fill this out with your parent or guardian.</p> : null}
        </section>
        <QuestionnaireForm token={token} initial={initial} savedAt={row.draftSavedAt || null} notice={words.notice} consentLabel={words.consent} phone={s.phone} />
      </div>
    </section>
  )
}

const EMBED_CSS = 'body{padding-top:0!important;background:transparent}.site-header,.site-footer,.skip-link{display:none!important}.qn-page{padding:4px 0 8px}.qn-wrap{padding:0}'

function Message({ heading, children, frame }: { heading: string; children: React.ReactNode; frame: React.ReactNode }) {
  return (
    <section className="qn-page">
      {css}{frame}
      <div className="wrap qn-wrap"><div className="qn-thanks"><h1>{heading}</h1>{children}</div></div>
    </section>
  )
}
