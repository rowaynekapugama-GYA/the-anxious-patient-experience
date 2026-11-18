/**
 * Google Analytics 4 on the pay-later page and /book-now/terms/ (v1.11.0), the same tag as the static pages
 * (/assets/analytics.js, which removes the pay link's token before Google sees the address). Renders nothing until a
 * measurement ID is set. Not used on the questionnaire pages.
 */
import React from 'react'
import { getSettings, ga4Id, assetVersion } from '@/lib/site'

export function Analytics() {
  const id = ga4Id((getSettings() as { tracking?: { ga4?: string } }).tracking)
  if (!id) return null
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `window.APE_GA4=${JSON.stringify(id)};` }} />
      <script src={`/assets/analytics.js?v=${encodeURIComponent(assetVersion())}`} defer />
    </>
  )
}
