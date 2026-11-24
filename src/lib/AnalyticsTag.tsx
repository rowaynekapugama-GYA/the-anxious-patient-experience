/**
 * Analytics on the two Next.js pages outside the dashboard and the questionnaire: the pay-later page and the deposit
 * policy page (/book-now/terms/). Never used on the questionnaire pages.
 *
 * v1.15.0, with a Tag Manager ID set (the normal case):
 *   - <Analytics /> renders nothing. Google Analytics runs through Tag Manager, which the deposit policy page gets
 *     from its layout (src/app/(public)/layout.tsx) on the live domain only. It is never loaded directly as well.
 *   - <DepositHandOff /> goes on the pay-later page, which carries a private link and so never loads anything from
 *     Google. It loads only the website's own /assets/analytics.js in "hand-off" mode: the three deposit events are
 *     kept in the browser tab (name, amount and payment method, nothing else) and sent from the next public page
 *     the patient opens in that tab, if they open one.
 *
 * With no Tag Manager ID, v1.11.0 is unchanged: <Analytics /> loads Google Analytics 4 directly when a measurement
 * ID is set (the same tag as the static pages, which removes the pay link's token before Google sees the address).
 */
import React from 'react'
import { getSettings, ga4Id, gtmId, assetVersion } from '@/lib/site'

type Tracking = { tracking?: { ga4?: string; gtm?: string } }

export function Analytics() {
  const t = (getSettings() as Tracking).tracking
  if (gtmId(t)) return null
  const id = ga4Id(t)
  if (!id) return null
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `window.APE_GA4=${JSON.stringify(id)};` }} />
      <script src={`/assets/analytics.js?v=${encodeURIComponent(assetVersion())}`} defer />
    </>
  )
}

export function DepositHandOff() {
  if (!gtmId((getSettings() as Tracking).tracking)) return null
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: 'window.APE_Q=1;' }} />
      <script src={`/assets/analytics.js?v=${encodeURIComponent(assetVersion())}`} defer />
    </>
  )
}
