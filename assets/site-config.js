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

  /* Booking rules for the Book Now page. These times are used by the booking system only and are not shown as
     fixed text anywhere on the site.
     days: 0 Sunday, 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday
     startTimes: 24-hour clock, Sydney time
     minNoticeHours: bookings must start at least this many hours from now (Sydney time) */
  booking: {
    timeZone: 'Australia/Sydney',
    days: [3],
    startTimes: ['09:00', '10:20', '11:40'],
    minNoticeHours: 24,
    weeksAhead: 6,
    /* Booking requests are emailed to the APE inbox (api/booking.js); the team blocks the time in Core Practice and
       confirms with the patient. 'test' = no payment is taken. Do not change this until a payment provider is set up. */
    depositMode: 'test'
  }
};
