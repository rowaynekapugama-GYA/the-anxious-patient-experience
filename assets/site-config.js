/* ==========================================================================
   The Anxious Patient Experience™: site settings
   --------------------------------------------------------------------------
   One place for the details that are still changing. Edit a value here, then
   run `npm run build` (the deploy script does this for you). The build writes
   the contact details, the footer disclaimer and the clinic details into every
   page, and the Book Now page reads the booking settings from this file.
   ========================================================================== */
window.APE_CONFIG = {

  /* Footer contact details, shown on every page.
     Leave a value empty ('') to keep the yellow placeholder until the client confirms it.
     The client has said contact details are not final, so nothing is filled in yet. */
  contact: {
    phone: '',     // e.g. '02 9000 0000'
    email: '',     // e.g. 'hello@example.com.au'
    address: ''    // e.g. '11–13 Cronulla Street, Cronulla NSW 2230'
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

  /* The clinic where APE appointments are held (shown on Book Now and in the booking summary). */
  clinic: {
    name: 'The Cronulla Dentists',
    street: '11–13 Cronulla Street',
    suburb: 'Cronulla NSW 2230'
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
    weeksAhead: 6
  }
};
