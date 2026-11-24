import React from 'react'
import { getSettings } from '@/lib/site'

/**
 * The quiet page frame of the Next.js pages outside the dashboard: the questionnaire and the pay-later page
 * (src/app/(site)) and the deposit policy page (src/app/(public)). The website's own stylesheet, a small header and
 * a one-line footer.
 *
 * `head` and `bodyStart` are empty for the private pages. Only the public layout passes anything in (v1.15.0).
 */
export function SiteFrame({ children, head = null, bodyStart = null }: { children: React.ReactNode; head?: React.ReactNode; bodyStart?: React.ReactNode }) {
  const s = getSettings()
  return (
    <html lang="en-AU" className="__variable_398cc5 __variable_052c8a">
      <head>
        {head}
        <meta name="referrer" content="no-referrer" />
        <link rel="stylesheet" href={`/assets/site.css?v=q${encodeURIComponent(String(process.env.npm_package_version || '1'))}`} />
      </head>
      <body className="questionnaire-page">
        {bodyStart}
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="wrap nav">
            <a className="logo" aria-label="The Anxious Patient Experience™" href="/">
              <img className="logo-tile logo-img" src="/images/ape-logo.webp" width="62" height="62" alt="" />
              <span className="logo-name">The Anxious Patient Experience™</span>
            </a>
            <span className="q-private">Private page</span>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <p className="legal">{s.clinic.name}, {s.clinic.street}, {s.clinic.suburb} {s.clinic.state} {s.clinic.postcode}. Phone {s.phone}. <a href="/privacy-policy/">Privacy Policy</a></p>
          </div>
        </footer>
      </body>
    </html>
  )
}
