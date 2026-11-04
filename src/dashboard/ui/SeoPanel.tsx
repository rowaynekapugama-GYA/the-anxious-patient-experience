'use client'
/** Search engine fields with character counters and a Google-style preview. */
import React from 'react'
import { seoVerdict } from '../lib/text'
import { tokensToFriendly, friendlyToTokens } from '../util'
import { BRAND } from '../brand'
import { ImageSlot } from './MediaPicker'
import { AutoTextarea, Toggle } from './fields'

export type SeoState = { title: string; description: string; ogImage: string; ogImageMedia: number | string | null; canonical: string; noindex: boolean }

export function SeoPanel({ seo, onChange, url, defaultOg, titleHint, showCanonical = false }: {
  seo: SeoState; onChange: (s: SeoState) => void; url: string; defaultOg: string; titleHint?: string; showCanonical?: boolean
}) {
  const title = tokensToFriendly(seo.title)
  const desc = tokensToFriendly(seo.description)
  const t = seoVerdict(title.length, 30, 60)
  const d = seoVerdict(desc.length, 70, 155)
  const set = (patch: Partial<SeoState>) => onChange({ ...seo, ...patch })
  const display = BRAND.domain + (url === '/' ? '' : ' › ' + url.replace(/^\/|\/$/g, '').split('/').join(' › '))
  return (
    <div>
      <div className="field">
        <label htmlFor="seo-title">Title in Google</label>
        <input id="seo-title" className="input" value={title} placeholder={titleHint} onChange={(e) => set({ title: friendlyToTokens(e.target.value) })} />
        <div className="counter"><span>{title.length} characters</span><span className={`chip ${t.tone}`}>{t.label}</span><span>Aim for 30 to 60.</span></div>
      </div>
      <div className="field">
        <label htmlFor="seo-desc">Description in Google</label>
        <AutoTextarea id="seo-desc" value={desc} onChange={(v) => set({ description: friendlyToTokens(v) })} />
        <div className="counter"><span>{desc.length} characters</span><span className={`chip ${d.tone}`}>{d.label}</span><span>Aim for 70 to 155.</span></div>
      </div>
      <div className="field">
        <span className="lab">How it may look in Google</span>
        <div className="snippet" aria-hidden="true">
          <div className="s-site"><span className="fav" style={{ backgroundImage: `url(${BRAND.favicon})` }} /><span><span>{BRAND.name}</span><br /><span className="s-url">{display}</span></span></div>
          <div className="s-title">{(title || titleHint || '').replace(/\{[a-z-]+\}/g, '...').slice(0, 70)}{title.length > 70 ? '...' : ''}</div>
          <div className="s-desc">{desc.replace(/\{phone\}/g, BRAND.phone).slice(0, 160)}{desc.length > 160 ? '...' : ''}</div>
        </div>
      </div>
      <ImageSlot label="Share image (shown when the page is shared on Facebook, LinkedIn or in messages)"
        value={seo.ogImage || defaultOg} original={defaultOg}
        onChange={(v) => set({ ogImage: v.media ? v.value : '', ogImageMedia: v.media })} />
      <div className="help" style={{ marginTop: -8, marginBottom: 14 }}>Best at 1200 by 630 pixels. A wide crop is made automatically.</div>
      {showCanonical ? (
        <div className="field">
          <label htmlFor="seo-canon">Canonical address (GYA only)</label>
          <input id="seo-canon" className="input" value={seo.canonical} placeholder={`https://${BRAND.domain}${url}`} onChange={(e) => set({ canonical: e.target.value.trim() })} />
          <div className="help">Kept for reference. The website always points Google at the page&apos;s own address on the live domain.</div>
        </div>
      ) : null}
      <Toggle label="Hide this page from Google (noindex)" checked={seo.noindex} onChange={(v) => set({ noindex: v })}
        help="The page stays on the website but search engines are asked not to list it, and it is left out of the sitemap." />
    </div>
  )
}
