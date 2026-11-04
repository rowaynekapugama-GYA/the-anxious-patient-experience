/* ==========================================================================
   The Anxious Patient Experience™: site settings
   --------------------------------------------------------------------------
   One place for the details that are still changing. Edit a value here, then
   run `npm run build` (Vercel does this on every deploy). The build writes
   the contact details, the footer disclaimer, the clinic details and the
   Dentist structured data into every page. The Book Now page and the booking
   email function (api/booking.js) read the booking settings from this file.
   ========================================================================== */
window.APE_CONFIG = {

  /* Contact details (Lorna, 26 Oct 2026), shown in the footer on every page and on the Book Now page.
     Leave a value empty ('') to show a yellow placeholder instead.
     phone is shown as written; the tel: link is worked out from it (02 numbers become +61 2...). */
  contact: {
    phone: '(02) 8599 9815',
    apeEmail: 'theanxiouspatientexperience@gmail.com',        // labelled "APE enquiries"
    receptionEmail: 'reception@thecronulladentists.com.au'    // labelled "General practice enquiries"
  },

  /* Footer disclaimer.
     The general line is the client's preferred wording (confirmed 15 Oct 2026).
     The invasive procedure line is switched off: GYA confirmed it is only needed if the site shows before and after
     photos. Set SHOW_INVASIVE_RISK_DISCLAIMER back to true if that changes. */
  SHOW_INVASIVE_RISK_DISCLAIMER: false,
  disclaimer: {
    general: 'The information on this website is general in nature and does not replace individual assessment or advice from a registered dental practitioner. Suitability for The Anxious Patient Experience™, and for any treatment or sedation options discussed, will be assessed individually with your dentist.',
    invasiveRisk: 'Any invasive procedure carries risks. Before proceeding, you should seek a second opinion from an appropriately qualified health practitioner.'
  },

  /* The clinic where APE appointments are held: footer, Book Now, the booking emails and the Dentist structured data.
     26 Oct 2026: the address is 13 Cronulla Street (replaces 11–13 Cronulla Street). */
  clinic: {
    name: 'The Cronulla Dentists',
    street: '13 Cronulla Street',
    suburb: 'Cronulla NSW 2230',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=The%20Cronulla%20Dentists%2C%2013%20Cronulla%20Street%2C%20Cronulla%20NSW%202230'
  },

  /* Booking rules: the Book Now page, the booking function (api/booking.js) and the dashboard all read these.
     days: 0 Sunday, 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday
     startTimes: 24-hour clock, Sydney time. Not shown as fixed text anywhere on the site.
     startDate: the first day APE appointments can be booked for (Lorna: first week of patients is Wed 2 Dec 2026).
     minNoticeHours: a time must be at least this many hours away (Sydney time) to be booked online.
     weeksAhead: how far ahead times are offered, counted from today or from startDate, whichever is later.
     initialBlockedDates: blocked when the database is first set up (Christmas, 26 Oct 2026). After that, Lorna blocks
       and unblocks dates in the dashboard at /admin/, so editing this list later has no effect. */
  booking: {
    timeZone: 'Australia/Sydney',
    days: [3],
    startTimes: ['09:00', '10:20', '11:40'],
    startDate: '2026-12-02',
    minNoticeHours: 24,
    weeksAhead: 6,
    initialBlockedDates: ['2026-12-23', '2026-12-30']
  },

  /* Fees, in whole dollars. The deposit is paid through a payment link once one is set up in Vercel
     (DEPOSIT_PAYMENT_URL); until then patients are told the deposit details will come with their confirmation. */
  pricing: {
    appointment: 350,
    deposit: 100
  },

  /* Opening special (Lorna, 3 Nov 2026): $250 for the full Anxious New Patient Experience for the first six patients
     in the first two weeks. It applies to appointments dated from `from` to `to` (inclusive) and stops once
     `maxBookings` special bookings exist (cancelled bookings do not count). The banner, pop-up and price labels hide
     by themselves once no special-priced time is left. Set enabled to false to switch it off early. */
  openingSpecial: {
    enabled: true,
    price: 250,
    from: '2026-12-02',
    to: '2026-12-15',
    maxBookings: 6,
    popup: true
  },

  /* Analytics. Leave empty until the IDs exist; the build adds the tags to every page when they are filled in.
     The flyer QR code adds utm_source=flyer, so scans show up in GA4 under Acquisition once ga4Id is set. */
  analytics: {
    ga4Id: '',          // e.g. 'G-XXXXXXXXXX'
    metaPixelId: ''     // e.g. '123456789012345'
  }
};
