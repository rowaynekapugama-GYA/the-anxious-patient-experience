import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { lookupToken, loadTemplate, questionnaireEnabled, tooMany } from '@/lib/questionnaire'
import { getSettings } from '@/lib/site'
import { QuestionnaireForm } from './QuestionnaireForm'

export const dynamic = 'force-dynamic'

/** A private link from the welcome email: one booking, one token, one submission. */
export default async function QuestionnairePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const s = getSettings()
  const contact = <p className="legal-lead">If you have a question, simply reply to your booking email or call the clinic on {s.phone}.</p>

  if (!questionnaireEnabled()) {
    return <Message heading="The online questionnaire is not open yet.">
      <p>Your welcome pack and questionnaire will come from the APE team by email. There is nothing you need to do now.</p>{contact}
    </Message>
  }
  const h = await headers()
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown').split(',')[0].trim()
  if (tooMany(`page:${ip}`, 60, 10 * 60 * 1000)) {
    return <Message heading="Please try again in a few minutes.">{contact}</Message>
  }
  const payload = await getPayload({ config })
  const found = await lookupToken(payload, token)
  if (found.state !== 'ok') {
    // the same message for a wrong, used or expired link, so a link tells nobody anything
    return <Message heading="This link is no longer active.">
      <p>Questionnaire links work until a week after the appointment and can be used once. If you have already sent yours, thank you, it has reached the team. Otherwise please reply to your booking email and we will send you a fresh link.</p>{contact}
    </Message>
  }
  const t = await loadTemplate(payload)
  const when = found.row?.appointmentAt ? new Date(found.row.appointmentAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <section className="hero-simple legal-page">
      <div className="wrap prose legal q-form">
        <p className="eyebrow">Before your appointment</p>
        <h1>{t.title}</h1>
        {when ? <p className="legal-updated">For your appointment on {when}. Reference {String(found.row?.bookingRef || '')}.</p> : null}
        {t.placeholder ? <p className="integration-note">Placeholder questionnaire: the practice&apos;s own questions are still to be loaded in the dashboard.</p> : null}
        {t.intro ? <p className="q-intro">{t.intro}</p> : null}
        <QuestionnaireForm token={token} template={{ sections: t.sections, collectionNotice: t.collectionNotice, consentLabel: t.consentLabel, thankYou: t.thankYou }} />
      </div>
    </section>
  )
}

function Message({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="hero-simple legal-page">
      <div className="wrap prose legal"><h1>{heading}</h1>{children}</div>
    </section>
  )
}
