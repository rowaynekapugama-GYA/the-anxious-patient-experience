'use client'
/**
 * Practice details and the options that apply to the whole website. Only the
 * settings the website actually uses are shown here, so nothing changed on this
 * screen is silently ignored.
 */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { Notice, TextArea, TextInput, Toggle, useUnsavedWarning } from '../ui/fields'
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
  tracking: { ga4: string; metaPixel: string }
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
    const bad = s.bookingRecipients.filter((e) => e.trim() && !EMAIL.test(e.trim()))
    if (bad.length) { toast(`This address does not look right: ${bad[0]}`, 'bad'); return }
    setBusy(true)
    try {
      const settings: Record<string, unknown> = {
        phone: s.phone.trim(),
        apeEmail: s.apeEmail.trim(),
        receptionEmail: s.receptionEmail.trim(),
        clinic: Object.fromEntries(Object.entries(s.clinic).map(([k, v]) => [k, v.trim()])),
      }
      if (isAdmin) {
        settings.bookingRecipients = s.bookingRecipients.map((a) => a.trim()).filter(Boolean).map((address) => ({ address }))
        settings.tracking = { ga4: s.tracking.ga4.trim(), metaPixel: s.tracking.metaPixel.trim() }
      }
      await api('/api/globals/site-settings?depth=0', { method: 'POST', body: settings })
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

        {isAdmin ? (
          <>
            <Panel id="recipients" title="Who receives booking requests (GYA only)" intro="Every booking request from the website is emailed to all of these. If the list is empty, the BOOKING_NOTIFY_TO setting in Vercel is used, then the APE inbox. Takes effect when you publish.">
              {s.bookingRecipients.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="input" aria-label={`Recipient ${i + 1}`} value={r}
                    onChange={(e) => set({ bookingRecipients: s.bookingRecipients.map((x, n) => (n === i ? e.target.value : x)) })} />
                  <button className="btn small danger" onClick={() => set({ bookingRecipients: s.bookingRecipients.filter((_x, n) => n !== i) })}>{Icon.trash()} Remove</button>
                </div>
              ))}
              <button className="btn small" onClick={() => set({ bookingRecipients: [...s.bookingRecipients, ''] })}>{Icon.plus()} Add an address</button>
            </Panel>
            <Panel id="tracking" title="Tracking (GYA only)" intro="Leave empty to switch tracking off. Nothing runs on preview deployments.">
              <div className="grid-2">
                <TextInput label="Google Analytics 4 measurement ID" value={s.tracking.ga4} onChange={(v) => setT({ ga4: v })} placeholder="G-XXXXXXXXXX" />
                <TextInput label="Meta Pixel ID" value={s.tracking.metaPixel} onChange={(v) => setT({ metaPixel: v })} />
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
