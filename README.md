# The Anxious Patient Experience™: website

GYA build for Dr Lorna Gladwin. Plain HTML, CSS and JavaScript pages, three small Vercel serverless functions for
booking (`api/`), a booking dashboard for the APE team at `/admin/`, and a Neon Postgres database. A build step
(`npm run build`) writes the settings in `assets/site-config.js` into every page and checks the site.

Repo: `rowaynekapugama-GYA/the-anxious-patient-experience` (update to the existing repo; it should be private).
Staging: https://the-anxious-patient-experience.vercel.app/

Pages: one continuous homepage (The Experience, Who It's For, Meet the Team and FAQs are sections of it), Book Now,
a placeholder Privacy Policy page, a 404 page and the dashboard at `/admin/` (noindex). All copy is word for word from
the approved copy doc (29 Sep 2026) and Lorna's emails of 7 Oct, 13 Oct, 26 Oct and 3 Nov 2026.

## Vercel set-up (once)

Framework Preset **Other**. Build Command `npm run build`. Output Directory `public`. Install Command: default
(`npm install`, which installs the one dependency, the Neon database driver).

1. **Database**: Vercel > the project > Storage > Create Database > **Neon** > connect it to this project (Production
   and Preview). Vercel adds `DATABASE_URL` by itself. The tables are created automatically the first time the site
   is used, and 23 and 30 December 2026 are blocked at that moment.
2. **Environment variables**: Vercel > Settings > Environment Variables (Production and Preview):

   | Variable | Required | What it is |
   |---|---|---|
   | `DATABASE_URL` | yes | Neon Postgres connection string (added by step 1) |
   | `ADMIN_PASSWORD` | yes | Password for the dashboard at `/admin/`. 12+ characters. Changing it signs everyone out |
   | `RESEND_API_KEY` | yes | Resend API key for the booking emails |
   | `BOOKING_FROM` | yes | Sender on a Resend-verified domain, e.g. `The Anxious Patient Experience <bookings@yourdomain.com.au>` |
   | `BOOKING_NOTIFY_TO` | no | Where requests go. Default `theanxiouspatientexperience@gmail.com` |
   | `BOOKING_BCC` | no | Extra copies, comma separated. Empty on purpose (health information) |
   | `DEPOSIT_PAYMENT_URL` | no | Payment link for the $100 deposit, e.g. a Stripe Payment Link. Empty until Ram confirms the account |

3. **Redeploy** after adding variables (Deployments > latest > Redeploy).
4. **Test**: make a booking on the staging site with your own email, check both emails arrive (look in spam the first
   time), sign in at `/admin/`, find it under Bookings and cancel it.

Without `DATABASE_URL`, `RESEND_API_KEY` and `BOOKING_FROM` the site still shows times, but the last booking step says
"Sorry, we could not send your booking request just now..." with the clinic's phone number. Nothing is lost silently.

Any `*.vercel.app` address and `/admin/` are sent `X-Robots-Tag: noindex`, and `robots.txt` keeps crawlers out of
`/api/` and `/admin/`.

## Settings: `assets/site-config.js`

| Setting | What it controls |
|---|---|
| `contact.phone`, `contact.apeEmail`, `contact.receptionEmail` | Footer, Book Now, emails. `tel:` link worked out from the phone number |
| `clinic` | The Cronulla Dentists, 13 Cronulla Street, Cronulla NSW 2230, Maps link. Footer, Book Now, emails, Dentist schema |
| `SHOW_INVASIVE_RISK_DISCLAIMER`, `disclaimer` | Footer disclaimer (invasive line off since 15 Oct 2026) |
| `booking.days`, `booking.startTimes` | Wednesdays at 9:00 am, 10:20 am and 11:40 am, Sydney time |
| `booking.startDate` | First bookable day: `2026-12-02` |
| `booking.minNoticeHours`, `booking.weeksAhead` | 24 hours' notice; six weeks ahead (counted from today or the start date, whichever is later) |
| `booking.initialBlockedDates` | Blocked once, when the database is first used (23 and 30 Dec 2026). After that, blocking is done in the dashboard |
| `pricing.appointment`, `pricing.deposit` | $350 and $100 |
| `openingSpecial` | `$250`, appointments `2026-12-02` to `2026-12-15`, `maxBookings: 6`, `popup: true`, `enabled` |
| `analytics.ga4Id`, `analytics.metaPixelId` | Empty. Fill in and the build adds GA4 / Meta Pixel to every page |

The build replaces whatever sits between the `<!-- config:... -->` markers in the pages (contact, disclaimer, clinic,
phone, schema, analytics), so edit the config file, not those parts of the HTML. The booking functions read the same
file, so the page, the server check and the dashboard always agree.

## Build and check

```
npm install      # installs @neondatabase/serverless
npm run build    # applies the settings, checks every page, then copies the finished site into public/
```

The check fails (with a plain-English list) if a link or #anchor points at nothing, an image (including every size in
a `srcset`) or file is missing, the structured data is broken, the FAQ counter or FAQ schema does not match the
questions, a settings marker is missing, an analytics ID looks wrong, or an em dash has crept in. `api/`, `qr/`,
`docs/`, `scripts/` and developer files are never copied into `public/`.

## Booking

Lorna confirmed (26 Oct 2026) that the team blocks APE time in Core Practice and enters bookings by hand, so the
website does **not** connect to Core Practice.

1. Book Now asks `/api/availability/` for the times patients can book: APE days from 2 December 2026, six weeks
   ahead, at least 24 hours away (Sydney time), minus anything blocked in the dashboard and anything already
   requested. Each time carries its fee ($250 opening special or $350).
2. The patient chooses a time, enters name, email, optional phone and note, and ticks the collection notice.
3. The deposit and cancellation policy sits directly above the send button with a required tick box.
4. "Send booking request" posts to `/api/booking/`. The server checks everything again, works out the fee and saves the
   booking in one locked step, so **a time can never be booked twice and the special can never go past six**. It then
   emails the APE inbox (reply goes to the patient) and the patient (reply goes to the APE inbox).
5. The confirmation screen shows the time, the fee and a reference such as `APE-3F9A1C`.
6. The team blocks the time in Core Practice, confirms with the patient, and marks it confirmed in the dashboard.

**Deposit**: if `DEPOSIT_PAYMENT_URL` is set, the button reads "Send request and pay deposit", the confirmation screen
shows "Pay your $100 deposit" (opens the payment link with the reference and email filled in), and the patient's email
includes the link. If it is not set, the button reads "Send booking request" and the patient is told "Deposit details
will be sent with your confirmation." No payment account is hard-coded anywhere. With a Stripe Payment Link, payments
show the booking reference as the client reference ID. The team marks "Deposit received" in the dashboard.

**Privacy**: the form only asks for what is needed to arrange the visit. The patient's note can contain health
information, so it is not in the email subject, not copied into the patient's email, and `BOOKING_BCC` is empty.
GYA's usual form setup also copies SmileOx and rowayne@gyaclients.com; that is left off for this form on purpose. The
database keeps bookings until they are deleted; the dashboard shows the last 60 days and everything upcoming.

## Opening special

Lorna, 3 Nov 2026: $250 instead of $350 for the first six patients, for appointments in the first two weeks
(Wed 2 Dec to Tue 15 Dec 2026, which is Wednesday 2 and Wednesday 9 December, three times each). Health fund rebates
still apply. The $100 deposit still applies.

- **How it is counted**: every booking saved in the database records whether it got the special. A time gets $250 if
  its date is in the window **and** fewer than six special bookings exist (cancelled ones do not count). This is
  checked inside the same locked database step that saves the booking, so two people booking at once cannot both get
  the sixth place.
- **Switching off by itself**: the ribbon under the homepage hero, the pop-up, the FAQ note, the Book Now card and the
  $250 labels all come from `/api/availability/`. They show only while at least one special-priced time is still
  free. Once six are booked, or the last special day is less than 24 hours away, they all disappear and every time
  is $350. No manual change is needed.
- **If a special booking is cancelled** in the dashboard, that time goes back to $250 (still within the six).
- **Pop-up**: calm, shown at most once per visitor (after 9 seconds or 30% down the homepage), closes with the button,
  the cross, Escape or a click outside. Never on Book Now. It never shows how many places are left (no urgency
  wording, per AHPRA).
- **Change it**: `openingSpecial` in `assets/site-config.js` (`enabled: false` turns it off early).

## Booking dashboard (`/admin/`)

Signed in with `ADMIN_PASSWORD`. Sessions last 12 hours; eight wrong passwords from one address lock sign-in for 15
minutes. Plain-English instructions for the team are in `docs/HOW-TO-USE-THE-BOOKING-DASHBOARD.md` and on the
dashboard's "How to" page.

- **Bookings**: upcoming requests grouped by day, with contact details, note, fee, status and deposit. Mark confirmed,
  Deposit received, Cancel booking (opens the time again), Restore. Tabs for To confirm, Cancelled and Past.
- **Availability**: block a period of leave (every APE day between two dates), block or open a single day, or tap a
  single time to block or open it. 23 and 30 December 2026 are blocked from the start. Blocking does not cancel
  requests already on that day; the dashboard lists them so the team can contact those patients.
- **Opening special**: how many of the six are used and whether it is showing on the website.

This is a booking dashboard only. The full GYA client dashboard (edit wording and photos on the page, blog, SEO) is
not part of this release; see "Not in this release".

## Team

Dr Lorna Gladwin (Creator of The Anxious Patient Experience™), Alex Loupos (APE Lead | Patient Care & Support),
Lauren Bright (APE Dental Assistant | Patient Care & Support). Each bio shows its first paragraph and a "Read more"
button; without JavaScript the whole bio shows.

- **Lauren's photo**: replace **`images/team-lauren-bright.jpg`** with her photo, same file name. Portrait, about
  1200 x 1500 px, JPG, face in the top third. Nothing else needs to change; team photos are served with
  `must-revalidate`, so the new one shows straight away after the deploy. The current file is a soft "L" monogram in
  the brand colours.
- **Alex's photo**: `images/team-alex-loupos-2026-11-03.webp` with a `.jpg` fallback (987 x 1593, as supplied).
- **Lorna's photo**: `images/team-lorna-gladwin-2026-10-26.webp`.

## Images

Lorna's rules: no faces anywhere except the team's own photos (26 Oct 2026), and nothing that looks like a clinic,
dental chair or treatment room unless it is genuine photography of her practices (13 Oct 2026). Lifestyle photos are
WebP at 800, 1400 and 2400 px plus a 1400 px JPG, inside a `<picture>`; everything below the hero is lazy-loaded.

| Files (`images/`) | Where |
|---|---|
| `ape-armchair-corner-*` | Hero (preloaded) |
| `ape-candle-book-*` | The heart of the experience (third-party book title removed) |
| `ape-hands-comfort-*` | Our approach, "We work with it" |
| `ape-toothbrushes-eucalyptus-*` | Who is The Anxious Patient Experience™ for? |
| `ape-textured-napkin-*` | Book Now hero (preloaded) |
| `social-share-armchair.jpg` | Share image, 1200 x 630 |
| `team-*` | Meet the Team (see above) |
| `ape-logo.webp`, `ape-logo.png` | Logo |

## QR code for the flyer

`qr/ape-flyer-qr.png` (2015 x 2015 px, print-ready) and `qr/ape-flyer-qr.svg`. Navy on white, error correction H.
It opens:

`https://the-anxious-patient-experience.vercel.app/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch`

Print it at least 3 cm wide. To make a new one for the final domain (from the repo folder, on a Mac):

```
python3 -m pip install --user segno && python3 qr/make-qr.py "https://YOUR-DOMAIN/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch"
```

The UTM tags only show up in reports once `analytics.ga4Id` is filled in (GA4 > Reports > Acquisition > Traffic
acquisition, source "flyer").

## What is in here

```
index.html, book-now/, privacy-policy/, 404.html      Pages
understanding-the-experience/, meet-the-team/, faqs/  Forward to the matching homepage section
admin/index.html                                      Booking dashboard (noindex)
api/availability.js                                   GET  /api/availability/  times, prices, special status
api/booking.js                                        POST /api/booking/       save a request, email the team and patient
api/admin.js                                          /api/admin/              dashboard sign-in and actions
api/_lib/core.js                                      Shared code (settings, schedule, special, database, email, sign-in)
assets/site-config.js                                 Settings
assets/site.css, assets/site.js                       Website styles and script
assets/admin.css, assets/admin.js                     Dashboard styles and script
assets/fonts/, images/                                Fonts and photos
qr/                                                   Flyer QR code and the script that makes it
docs/HOW-TO-USE-THE-BOOKING-DASHBOARD.md              Instructions for Lorna and the APE team
scripts/build.mjs                                     The build and check
.env.example                                          Environment variables (no real values)
package.json, package-lock.json, vercel.json, robots.txt, sitemap.xml, icon.svg, apple-touch-icon.png
README.md, CHANGELOG.md
```

## Layout

- **Navigation** (fixed, always visible): The Experience (`#understanding`), Who It's For (`#who-is-it-for`), Meet
  the Team (`#meet-the-team`), FAQs (`#faqs`) and a filled Book Now button. The phone menu closes after a tap.
- **Hero**: "Discover the Experience" moves down to the next section (`#intro`). The intro band is the first mention
  of the brand: "The Anxious Patient Experience™ (APE)".
- **Motion**: `reveal` with `from-left`, `from-right`, `pop` or `fade`; `seq` for one after another. With reduced
  motion nothing animates; without JavaScript everything shows.
- **FAQs**: to add a question, add a button to `.faq-index`, a `.faq-card` to `.faq-track`, update the "/ 11" total
  and the FAQ schema at the bottom of `index.html`. The build checks all three match.
- **Later additions** (walkthrough videos, training platform, member areas, practitioner search, directory): new
  sections or folders using the same header, footer and styles, or a move to the GYA Next.js framework, without
  changing any address on this site.

## Before go-live: set the domain

Canonical tags, share links and the sitemap use `https://example.com` until the domain is confirmed. Then replace it
with the live domain in every `.html` file, `sitemap.xml` and `robots.txt`, regenerate the QR code, and update
`ape.url` / `ape.bookUrl` on the Caringbah and Cronulla sites.

## Placeholders

| Placeholder | Where |
|---|---|
| Lauren's photo | `images/team-lauren-bright.jpg` (monogram for now) |
| Deposit payment link | `DEPOSIT_PAYMENT_URL` (waiting on Ram's account) |
| Domain | `https://example.com` in canonical, OG and sitemap links; QR code uses the vercel.app address |
| Privacy policy text | `/privacy-policy/` (needed: the booking form collects personal details) |
| Analytics IDs | `analytics` in `assets/site-config.js` |

## Copy not from the client (for sign-off)

All listed in CHANGELOG.md with exact wording: the opening special ribbon, pop-up, FAQ note and Book Now card; the
booking buttons and deposit lines; the booking emails; "Alex, our APE Lead," in two places; the collection notice; the
dashboard wording. Earlier UI labels (form labels, Continue/Back, error messages, menu and FAQ controls) are listed in
the CHANGELOG entries for 1.2.0 to 1.3.0.

## Go-live checklist

- [ ] Repo is private
- [ ] Neon connected; `ADMIN_PASSWORD`, `RESEND_API_KEY`, `BOOKING_FROM`, `BOOKING_NOTIFY_TO` set; redeployed
- [ ] Resend sending domain verified; test booking reaches the APE inbox and the patient
- [ ] Dashboard: sign in, see the test booking, cancel it; 23 and 30 Dec show as blocked
- [ ] Deposit: `DEPOSIT_PAYMENT_URL` added once Ram confirms the account (until then patients get the "details will be sent" line)
- [ ] Book Now hero says "pay your deposit online in four simple steps": true only once the payment link is set (see CHANGELOG 1.4.0)
- [ ] Confirmation heading "You're booked in." agreed (bookings are confirmed by hand)
- [ ] New copy signed off (CHANGELOG 1.4.0 and 1.3.0)
- [ ] Privacy policy supplied (covers booking details held in the database and sent by email, and any deposit data)
- [ ] Lauren's photo in place
- [ ] Domain set, QR code regenerated for it before printing large runs
- [ ] GA4 (and Meta Pixel if wanted) IDs added
- [ ] iPhone check on staging: homepage, menu, pop-up, FAQ cards, Reach out to Alex, a test booking, the dashboard
- [x] Contact details match Lorna's email of 26 Oct 2026
- [x] Footer disclaimer confirmed (15 Oct 2026)
- [ ] Lorna's profile never uses the word "specialist"
- [ ] DNS: apex primary, www 308 to apex

## Not in this release

- The full GYA client dashboard (edit page wording and photos in place, blog, SEO, practice details), per
  `gya-site-kit/client-dashboard-standard.md`. This release adds the booking dashboard Lorna asked for; the page
  editor can be added after launch on the same `/admin/` area and the same Neon database.
- Two-way sync with Core Practice (not wanted: bookings are entered by hand).
- Automatic emails when a booking is confirmed or cancelled in the dashboard (the team emails the patient).
