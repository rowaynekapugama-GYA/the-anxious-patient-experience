/**
 * Client specific defaults for The Anxious Patient Experience.
 * At build time these are merged with content/site-settings.json, which the dashboard writes.
 * One level object merge, arrays replaced wholesale.
 */
export const DEFAULTS = {
  practiceName: 'The Anxious Patient Experience™',
  /** The website's own address for canonical tags and share links. NEXT_PUBLIC_SERVER_URL wins when set. */
  siteUrl: 'https://the-anxious-patient-experience.vercel.app',
  /** The clinic where APE appointments are held: footer, Book Now, the booking emails and the structured data. */
  clinic: {
    name: 'The Cronulla Dentists',
    street: '13 Cronulla Street',
    suburb: 'Cronulla',
    state: 'NSW',
    postcode: '2230',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=The%20Cronulla%20Dentists%2C%2013%20Cronulla%20Street%2C%20Cronulla%20NSW%202230',
  },
  phone: '(02) 8599 9815',
  /** labelled "APE enquiries" in the footer; also where booking requests are sent */
  apeEmail: 'theanxiouspatientexperience@gmail.com',
  /** labelled "General practice enquiries" */
  receptionEmail: 'reception@thecronulladentists.com.au',
  /** Booking requests are emailed to these. Empty uses BOOKING_NOTIFY_TO, then the APE inbox. */
  bookingRecipients: [] as string[],
  /** the default share picture and its size and description */
  ogImage: '/images/social-share-armchair.jpg',
  ogImageAlt: 'A soft cream armchair beside a small wooden table with a white vase of olive branches and a lit candle, in warm afternoon light',
  ogImageWidth: '1200',
  ogImageHeight: '630',
  tracking: { ga4: '', metaPixel: '' },
}

export type SiteDefaults = typeof DEFAULTS
