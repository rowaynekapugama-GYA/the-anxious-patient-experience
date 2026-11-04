import fs from 'node:fs'
import path from 'node:path'
import type { Chrome, Page, Redirect } from '@/lib/parts'
import { DEFAULTS } from '@/site.config'
import type { SeoDefaults, SeoInfo } from '@/dashboard/render'

export * from '@/lib/parts'

export const CONTENT = () => path.join(process.cwd(), 'content')

function readJson<T>(rel: string, fallback?: T): T {
  const file = path.join(CONTENT(), rel)
  if (!fs.existsSync(file) && fallback !== undefined) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

export function allSlugs(): string[] {
  return fs.readdirSync(path.join(CONTENT(), 'pages')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
}

export function getPage(slug: string): Page | null {
  const file = path.join(CONTENT(), 'pages', `${slug}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Page
}

export function getPages(): Page[] {
  return allSlugs().map((s) => getPage(s)!).filter(Boolean)
}

let chromeCache: Chrome | null = null
export function getChrome(): Chrome {
  if (!chromeCache) chromeCache = readJson<Chrome>('chrome.json')
  return chromeCache
}

export function getRedirects(): Redirect[] {
  return readJson<Redirect[]>('redirects.json', [])
}

export function getSeoDefaults(): SeoDefaults {
  return readJson<SeoDefaults>('seo.json', {})
}

/** The default share picture, from Site Settings. */
export function seoInfoFrom(s: { ogImage?: unknown; ogImageAlt?: unknown; ogImageWidth?: unknown; ogImageHeight?: unknown }): SeoInfo {
  return {
    ogImage: String(s.ogImage || DEFAULTS.ogImage),
    ogImageAlt: String(s.ogImageAlt ?? DEFAULTS.ogImageAlt),
    ogImageWidth: String(s.ogImageWidth || DEFAULTS.ogImageWidth),
    ogImageHeight: String(s.ogImageHeight || DEFAULTS.ogImageHeight),
  }
}

/** Booking rules, prices and the opening special (GYA maintains content/booking.json). */
export type BookingConfig = {
  timeZone: string
  days: number[]
  startTimes: string[]
  startDate: string
  minNoticeHours: number
  weeksAhead: number
  initialBlockedDates: string[]
  pricing: { appointment: number; deposit: number }
  openingSpecial: { enabled: boolean; price: number; from: string; to: string; maxBookings: number; popup: boolean }
}
