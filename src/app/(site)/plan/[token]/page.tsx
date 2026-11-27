import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getSettings } from '@/lib/site'
import { allow } from '@/lib/mailer'
import { lookupLink, readSettings, practiceLines } from '@/plans/store'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your treatment plan | The Anxious Patient Experience', robots: { index: false, follow: false, nocache: true } }

const css = <link rel="stylesheet" href={`/assets/questionnaire.css?v=${encodeURIComponent(String(process.env.npm_package_version || '1'))}`} precedence="default" />
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * v1.18.0: the patient's private link to their treatment plan, from the email. One plan version, one token (the
 * database keeps only its hash). A wrong, made-up, expired or revoked link all show the same calm page, so a link
 * tells nobody anything. If the booking has a date of birth (and the setting is on), it is asked for first.
 * No analytics or tracking of any kind loads here, and the page sends no referrer.
 */
export default async function PlanLinkPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const { token } = await params
  const e = (await searchParams).e
  const s = getSettings()
  const contact = <p>If you have a question, reply to the email your plan came in, or call the clinic on {s.phone}.</p>
  const h = await headers()
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown').split(',')[0].trim()
  if (!(await allow(`plan-page:${ip}`, 30, 10))) return <Message heading="Please try again in a few minutes.">{contact}</Message>

  const payload = await getPayload({ config })
  const found = await lookupLink(payload, token).catch(() => ({ state: 'gone' as const }))
  if (found.state !== 'ok') {
    return <Message heading="This link is no longer active.">
      <p>For your privacy, treatment plan links stop working after a while, and a newer email replaces the link in an older one. Just reply to the email and we will send you a new link.</p>{contact}
    </Message>
  }
  // v1.19.0: the practice details from Treatment plans > Settings, as at the bottom of the plan itself
  const practice = await readSettings().then((x) => practiceLines(x.practice)).catch(() => [] as string[])
  return (
    <section className="qn-page">
      {css}
      <div className="wrap qn-wrap">
        <header className="qn-top">
          <p className="qn-brand">The Anxious Patient Experience</p>
          <h1>Your treatment plan</h1>
          <p className="qn-strap">Private to you</p>
        </header>
        <div className="qn-intro">
          {found.askDob ? (
            <form method="post" action={`/plan/${token}/open`} className="plan-open">
              <p>To keep your plan private, please enter your date of birth.</p>
              {e === 'dob' ? <p className="qn-err" role="alert">That date of birth does not match our records. Please try again, or call us.</p> : null}
              {e === 'busy' ? <p className="qn-err" role="alert">Please wait a few minutes before trying again.</p> : null}
              <fieldset className="plan-dob">
                <legend className="qn-label">Date of birth</legend>
                <label>Day <input name="d" inputMode="numeric" pattern="[0-9]*" maxLength={2} required autoComplete="bday-day" className="qn-input" /></label>
                <label>Month <select name="m" required autoComplete="bday-month" className="qn-input" defaultValue=""><option value="" disabled>Month</option>{MONTHS.map((m, n) => <option key={m} value={n + 1}>{m}</option>)}</select></label>
                <label>Year <input name="y" inputMode="numeric" pattern="[0-9]*" maxLength={4} required autoComplete="bday-year" className="qn-input" /></label>
              </fieldset>
              <p><button className="btn" type="submit">Open my treatment plan (PDF)</button></p>
            </form>
          ) : (
            <form method="post" action={`/plan/${token}/open`} className="plan-open">
              <p>Your treatment plan from the APE team is ready to read. It opens as a PDF, which you can save or print.</p>
              <p><button className="btn" type="submit">Open my treatment plan (PDF)</button></p>
            </form>
          )}
          <p className="qn-confidential">There is no rush. Read it in your own time, and ask us anything.</p>
        </div>
        {contact}
        {practice.length ? <div className="plan-practice" data-practice><p className="qn-label">Practice details</p>{practice.map((l) => <p key={l}>{l}</p>)}</div> : null}
      </div>
      <style>{'.plan-dob{border:0;padding:0;margin:0 0 18px;display:grid;grid-template-columns:minmax(64px,1fr) minmax(130px,2fr) minmax(84px,1.3fr);gap:10px}.plan-dob legend{margin-bottom:8px}.plan-dob label{display:grid;gap:6px;font-size:15px;color:var(--navy)}.plan-dob input,.plan-dob select{width:100%;box-sizing:border-box;min-height:48px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#FFFEFA;font:inherit;color:var(--navy)}.plan-open .btn{margin-top:6px}.qn-err{color:#8A4317;font-weight:600}.plan-practice{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);font-size:15px}.plan-practice p{margin:0 0 4px}'}</style>
    </section>
  )
}

function Message({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="qn-page">
      {css}
      <div className="wrap qn-wrap"><div className="qn-thanks"><h1>{heading}</h1>{children}</div></div>
    </section>
  )
}
