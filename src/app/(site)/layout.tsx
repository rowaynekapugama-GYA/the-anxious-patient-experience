import type { Metadata } from 'next'
import { getSettings } from '@/lib/site'

/**
 * The patient questionnaire pages (v1.7.0). They use the website's own stylesheet and a quiet header, and carry no
 * analytics or tracking of any kind: health answers never reach GA4, GTM, the Meta Pixel, the URL or the logs.
 */
export const metadata: Metadata = {
  title: 'New Patient Questionnaire | The Anxious Patient Experience™',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: { icon: '/icon.svg' },
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = getSettings()
  return (
    <html lang="en-AU" className="__variable_398cc5 __variable_052c8a">
      <head>
        <meta name="referrer" content="no-referrer" />
        <link rel="stylesheet" href={`/assets/site.css?v=q${encodeURIComponent(String(process.env.npm_package_version || '1'))}`} />
      </head>
      <body className="questionnaire-page">
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
