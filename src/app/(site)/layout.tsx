import type { Metadata } from 'next'
import { SiteFrame } from '@/lib/SiteFrame'

/**
 * The private patient pages: the questionnaire (v1.7.0) and the pay-later page (v1.8.0). Their addresses carry a
 * private link, so they carry no analytics or tracking of any kind: health answers and private links never reach
 * Google Analytics, Google Tag Manager, the Meta Pixel or the logs, and the pages send no referrer to the next page.
 *
 * v1.15.0: this layout deliberately has no way to add Tag Manager. The one public Next.js page, the deposit policy,
 * lives under src/app/(public) with its own layout. scripts/qa-gtm.mjs fails the build if anything here refers to it.
 */
export const metadata: Metadata = {
  title: 'New Patient Questionnaire | The Anxious Patient Experience™',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: { icon: '/icon.svg' },
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteFrame>{children}</SiteFrame>
}
