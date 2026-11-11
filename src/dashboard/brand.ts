/**
 * Everything client specific about the dashboard lives here, so the rest of
 * src/dashboard is the GYA standard dashboard unchanged from site to site.
 */
export const BRAND = {
  name: 'The Anxious Patient Experience',
  /** shown in the SEO previews; follows NEXT_PUBLIC_SERVER_URL at go-live */
  domain: (process.env.NEXT_PUBLIC_SERVER_URL || 'https://theanxiouspatientexperience.com.au').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
  /** shown on the dark sidebar and on the dark strip at the top of the sign in card */
  logoOnDark: '/images/ape-logo.webp',
  favicon: '/icon.svg',
  /** for "Good morning" and the dates in Bookings */
  timeZone: 'Australia/Sydney',
  /** shown as the author of a new post until someone changes it */
  defaultAuthor: 'The Anxious Patient Experience',
  /** shown in the Google preview while a description is being typed */
  phone: '(02) 8599 9815',
  /** the default share picture when a page sets none */
  defaultOg: '/images/social-share-armchair.jpg',
} as const
