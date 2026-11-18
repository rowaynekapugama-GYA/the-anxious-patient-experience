'use client'
/**
 * Practice details and the options that apply to the whole website. Only the
 * settings the website actually uses are shown here, so nothing changed on this
 * screen is silently ignored.
 */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { Notice, Select, TextArea, TextInput, Toggle, useUnsavedWarning } from '../ui/fields'
import { ImageSlot } from '../ui/MediaPicker'
import { PublishButton } from '../ui/PublishButton'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

export type SettingsState = {
  phone: string
  apeEmail: string
  receptionEmail: string
  clinic: { name: string; street: string; suburb: string; state: string; postcode: string; mapsUrl: string }
  bookingRecipients: string[]
  /** v1.8.3: where booking emails go when the list is empty (BOOKING_NOTIFY_EMAIL, else the APE inbox) */
  recipientsFallback: string[]
  /** v1.10.0: Questionnaire notifications go to (empty: the booking list) */
  questionnaireNotify: string[]
  gyaDeliveryNotice: boolean
  gyaNoticeTo: string
  tracking: { ga4: string; metaPixel: string }
  googleReviewLink: string
  seo: { defaultTitle: string; defaultDescription: string; defaultOgImage: string; defaultOgImageMedia: number | string | null; noindexSite: boolean }
}

function Panel({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel" id={id}>
      <h2>{title}</h2>
      {intro ? <p className="help" style={{ marginTop: -6, marginBottom: 14 }}>{intro}</p> : null}
      {children}
    </section>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SettingsForm({ initial, isAdmin }: { initial: SettingsState; isAdmin: boolean }) {
  const toast = useToast()
  const [s, setS] = useState<SettingsState>(initial)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  useUnsavedWarning(dirty)
  const set = (patch: Partial<SettingsState>) => { setS((x) => ({ ...x, ...patch })); setDirty(true) }
  const setC = (patch: Partial<SettingsState['clinic']>) => set({ clinic: { ...s.clinic, ...patch } })
  const setT = (patch: Partial<SettingsState['tracking']>) => set({ tracking: { ...s.tracking, ...patch } })
  const setSeo = (patch: Partial<SettingsState['seo']>) => set({ seo: { ...s.seo, ...patch } })

  async function save() {
    if (!s.phone.trim()) { toast('Please fill in the phone number.', 'bad'); return }
    for (const [label, v] of [['APE enquiries email', s.apeEmail], ['General practice enquiries email', s.receptionEmail]] as const) {
      if (v.trim() && !EMAIL.test(v.trim())) { toast(`The ${label} does not look right.`, 'bad'); return }
    }
    const bad = [...s.bookingRecipients, ...s.questionnaireNotify, ...(isAdmin && s.gyaNoticeTo ? [s.gyaNoticeTo] : [])].filter((e) => e.trim() && !EMAIL.test(e.trim()))
    if (bad.length) { toast(`This address does not look right: ${bad[0]}`, 'bad'); return }
    const link = s.googleReviewLink.trim()
    if (link && !/^https:\/\/(g\.page|search\.google\.com|www\.google\.com|maps\.app\.goo\.gl|goo\.gl|maps\.google\.com|business\.google\.com)\//i.test(link)) { toast('The Google review link should be the "Ask for reviews" link from the Business Profile (it starts with https://g.page/ or https://search.google.com/).', 'bad'); return }
    setBusy(true)
    try {
      const settings: Record<string, unknown> = {
        phone: s.phone.trim(),
        apeEmail: s.apeEmail.trim(),
        receptionEmail: s.receptionEmail.trim(),
        clinic: Object.fromEntries(Object.entries(s.clinic).map(([k, v]) => [k, v.trim()])),
        googleReviewLink: link,
        bookingRecipients: s.bookingRecipients.map((a) => a.trim()).filter(Boolean).map((address) => ({ address })),
      }
      if (isAdmin) {
        settings.gyaDeliveryNotice = s.gyaDeliveryNotice
        settings.gyaNoticeTo = s.gyaNoticeTo.trim() || null
        settings.tracking = { ga4: s.tracking.ga4.trim(), metaPixel: s.tracking.metaPixel.trim() }
      }
      await api('/api/globals/site-settings?depth=0', { method: 'POST', body: settings })
      // v1.10.0: saved through the Welcome pack route, which keeps the rest of that group as it is
      const notify = s.questionnaireNotify.map((a) => a.trim()).filter(Boolean)
      if (JSON.stringify(notify) !== JSON.stringify(initial.questionnaireNotify)) await api('/api/dashboard/welcome-pack', { method: 'POST', body: { notifyEmails: notify } })
      await api('/api/globals/seo?depth=0', {
        method: 'POST',
        body: {
          defaultTitle: s.seo.defaultTitle, defaultDescription: s.seo.defaultDescription,
          defaultOgImage: s.seo.defaultOgImageMedia ?? null,
          ...(isAdmin ? { noindexSite: s.seo.noindexSite } : {}),
        },
      })
      setDirty(false)
      toast('Settings saved. Press Publish website to put them live.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cols">
      <div>
        <Panel id="contact" title="Contact details" intro="Shown in the footer of every page, on the Book Now page, in the booking emails and in the information Google reads. Change them once here.">
          <TextInput label="Phone number" value={s.phone} onChange={(v) => set({ phone: v })} help="Written the way it should appear, for example (02) 8599 9815." />
          <div className="grid-2">
            <TextInput label="APE enquiries email" type="email" value={s.apeEmail} onChange={(v) => set({ apeEmail: v })} help="Patients' replies to booking emails come here." />
            <TextInput label="General practice enquiries email" type="email" value={s.receptionEmail} onChange={(v) => set({ receptionEmail: v })} />
          </div>
        </Panel>

        <Panel id="clinic" title="Where appointments are held" intro="The clinic shown in the footer, on the Book Now page and in the booking emails.">
          <TextInput label="Clinic name" value={s.clinic.name} onChange={(v) => setC({ name: v })} />
          <TextInput label="Street address" value={s.clinic.street} onChange={(v) => setC({ street: v })} />
          <div className="grid-3">
            <TextInput label="Suburb" value={s.clinic.suburb} onChange={(v) => setC({ suburb: v })} />
            <TextInput label="State" value={s.clinic.state} onChange={(v) => setC({ state: v })} />
            <TextInput label="Postcode" value={s.clinic.postcode} onChange={(v) => setC({ postcode: v })} />
          </div>
          <TextInput label="Google Maps link" value={s.clinic.mapsUrl} onChange={(v) => setC({ mapsUrl: v })} help="Where the address links to." />
        </Panel>

        <Panel id="booking" title="Booking times and prices">
          <Notice tone="info" icon={Icon.info()}>
            <p>The days and times patients can book are under <a href="/admin/availability">Availability</a>, where you also block leave. The appointment fee, deposit and opening special are set by GYA, because offers on a dental website must state the price, inclusions and dates.</p>
          </Notice>
        </Panel>

        <Panel id="reviews" title="Google review page" intro="The page at /review/ for QR codes, emails and text messages. It is not in the menu and search engines do not list it. Every star and the button go to this one link; until it is filled in, the page says reviews are coming soon.">
          <TextInput label="Google review link" value={s.googleReviewLink} onChange={(v) => set({ googleReviewLink: v })} placeholder="https://g.page/r/.../review" help="From the Google Business Profile: Ask for reviews. Takes effect when you publish." />
        </Panel>

        <Panel id="booking-terms" title="Deposit policy" intro="Lorna's deposit policy, which patients read and agree to in a pop-up before the deposit (Book Now and the pay-later page). Each change gets a new version number, and every booking records the version the patient agreed to.">
          <a className="btn" href="/admin/settings/booking-terms">Open Deposit policy</a>
        </Panel>

        <Panel id="questionnaire" title="Welcome pack and questionnaire" intro="Lorna's Patient Guide and questionnaire PDFs, the welcome email and when it is sent have their own screen.">
          <a className="btn" href="/admin/settings/welcome-pack">Open Welcome pack</a>
        </Panel>

        <Panel id="seo" title="Search engine defaults" intro="Used by any page or post that does not set its own. Each page's own title and description are on its SEO tab.">
          <TextInput label="Default title" value={s.seo.defaultTitle} onChange={(v) => setSeo({ defaultTitle: v })} />
          <TextArea label="Default description" value={s.seo.defaultDescription} onChange={(v) => setSeo({ defaultDescription: v })} />
          <ImageSlot label="Default share image" value={s.seo.defaultOgImage} original={initial.seo.defaultOgImage || undefined}
            onChange={(v) => setSeo({ defaultOgImage: v.media ? v.value : initial.seo.defaultOgImage, defaultOgImageMedia: v.media })} />
          {isAdmin ? (
            <Toggle label="Hide the whole website from Google (GYA only)" checked={s.seo.noindexSite} onChange={(v) => setSeo({ noindexSite: v })}
              help="Only before go live. Every page is marked noindex and robots.txt asks search engines to stay away." />
          ) : null}
        </Panel>

        <Panel id="recipients" title="Who receives booking emails" intro={<>Every new booking request and deposit received email goes to all of these. Changes apply to the next booking once you press <b>Save settings</b> (no need to publish).{s.bookingRecipients.filter((x) => x.trim()).length ? null : <> While the list is empty they go to <b>{initial.recipientsFallback.join(', ')}</b>.</>}</>}>
          {s.bookingRecipients.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="input" aria-label={`Recipient ${i + 1}`} value={r} type="email"
                onChange={(e) => set({ bookingRecipients: s.bookingRecipients.map((x, n) => (n === i ? e.target.value : x)) })} />
              <button className="btn small danger" onClick={() => set({ bookingRecipients: s.bookingRecipients.filter((_x, n) => n !== i) })}>{Icon.trash()} Remove</button>
            </div>
          ))}
          <button className="btn small" onClick={() => set({ bookingRecipients: [...s.bookingRecipients, ''] })}>{Icon.plus()} Add an address</button>
        </Panel>
        <Panel id="questionnaire-notify" title="Questionnaire notifications go to" intro={<>Each time a patient completes the online questionnaire, these addresses get a short email with the booking reference and a dashboard link. It never contains answers. {s.questionnaireNotify.filter((x) => x.trim()).length ? null : <>While this list is empty, the email goes to <b>Who receives booking emails</b> above.</>}</>}>
          {s.questionnaireNotify.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="input" aria-label={`Questionnaire notification ${i + 1}`} value={r} type="email"
                onChange={(e) => set({ questionnaireNotify: s.questionnaireNotify.map((x, n) => (n === i ? e.target.value : x)) })} />
              <button className="btn small danger" onClick={() => set({ questionnaireNotify: s.questionnaireNotify.filter((_x, n) => n !== i) })}>{Icon.trash()} Remove</button>
            </div>
          ))}
          <button className="btn small" onClick={() => set({ questionnaireNotify: [...s.questionnaireNotify, ''] })}>{Icon.plus()} Add an address</button>
          <p className="help" style={{ marginTop: 10 }}>The email only tells people a questionnaire arrived. To open it, a person also needs to be ticked on the Users screen.</p>
        </Panel>
        {isAdmin ? (
          <>
            <Panel id="gya-notice" title="GYA delivery check (GYA only)" intro={<>For each booking GYA gets a short notice with the reference, the time and whether each email was accepted: no patient name, phone, email or note. Failure alerts go to the same address. <a href="/admin/settings/email">Open the email check screen</a>.</>}>
              <Toggle label="Send GYA a delivery check for each booking" checked={s.gyaDeliveryNotice} onChange={(v) => set({ gyaDeliveryNotice: v })} />
              <TextInput label="Delivery check and alerts go to" value={s.gyaNoticeTo} onChange={(v) => set({ gyaNoticeTo: v })} placeholder="rowayne@gyaclients.com" help="Blank uses rowayne@gyaclients.com." />
            </Panel>
            <Panel id="tracking" title="Tracking (GYA only)" intro="Leave empty to switch tracking off. Nothing runs on preview deployments.">
              <div className="grid-2">
                <TextInput label="Google Analytics 4 measurement ID" value={s.tracking.ga4} onChange={(v) => setT({ ga4: v })} placeholder="G-XXXXXXXXXX" help="Goes live when you press Publish website. Only once Lorna has approved the analytics paragraph in the privacy policy." />
                <TextInput label="Meta Pixel ID (not used)" value={s.tracking.metaPixel} onChange={(v) => setT({ metaPixel: v })} help="Not added to this website (patient privacy). If it is ever needed for Instagram ads, it must never go on Book Now, the pay-later page or the questionnaire." />
              </div>
            </Panel>
          </>
        ) : null}
      </div>

      <div className="sticky">
        <div className="panel">
          <h2 style={{ marginBottom: 8 }}>Save</h2>
          <p className={dirty ? '' : 'help'} style={{ color: dirty ? 'var(--pd-warn)' : undefined, fontWeight: dirty ? 600 : 400 }}>{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
          <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <button className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving...' : 'Save settings'}</button>
            <PublishButton />
          </div>
          <p className="help" style={{ marginTop: 10 }}>Changes go live on the whole website the next time you press Publish website.</p>
        </div>
      </div>
    </div>
  )
}
