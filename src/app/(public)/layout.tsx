import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { SiteFrame } from '@/lib/SiteFrame'
import { getSettings, gtmForBuild, assetVersion } from '@/lib/site'
import { TM_HEADER, gtmPieces, tmFlag } from '@/lib/gtm'

/**
 * The public Next.js pages (today only the deposit policy, /book-now/terms/). Same frame as the private pages.
 *
 * v1.15.0: Google Tag Manager is added only when src/proxy.ts says this request may have it (the live domain, and
 * an address with nothing but utm_ tags), by setting a request header to the container ID. The proxy removes any
 * such header sent by a visitor.
 */
export const metadata: Metadata = {
  title: 'The Anxious Patient Experience™',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: { icon: '/icon.svg' },
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const gtm = gtmForBuild(getSettings())
  const on = !!gtm && (await headers()).get(TM_HEADER) === gtm.id
  if (!gtm || !on) return <SiteFrame>{children}</SiteFrame>
  const p = gtmPieces(gtm.id)
  // One inline script, in this order: the privacy defaults, then the container script, then gtag('js'). The static
  // pages carry the container as a plain <script async src> tag, but here React would lift such a tag above the
  // defaults, so the same script element is created by code instead, straight after them.
  const boot = `${p.defaults}(function(){var s=document.createElement('script');s.async=true;s.src=${JSON.stringify(p.src)};document.head.appendChild(s);})();${p.start}${tmFlag(gtm.id)}`
  return (
    <SiteFrame
      head={<>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <script src={`/assets/analytics.js?v=${encodeURIComponent(assetVersion())}`} defer />
      </>}
      bodyStart={<noscript><iframe src={p.frame} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} /></noscript>}
    >
      {children}
    </SiteFrame>
  )
}
