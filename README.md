# The Anxious Patient Experience™: website

GYA build for Dr Lorna Gladwin. Update to the existing repo `rowaynekapugama-GYA/the-anxious-patient-experience`
(it should be private). Staging: https://the-anxious-patient-experience.vercel.app/

From v1.5.0 the site has the **GYA standard client dashboard** at **`/admin`** (as on Precision Dental and Tooth n
Care), with the APE online booking screens built into it:

- **Pages**: click words on the real page to change them, click a photo to replace it, reorder or hide sections, set
  each page's SEO. Footer words (tagline, disclaimer, copyright) can be changed from any page.
- **Blog Posts, Media Library, SEO, Site Settings, Redirects and Users** (Redirects and Users are GYA only).
- **Bookings**: requests from Book Now, with Mark confirmed, Deposit received, Cancel and Restore, a count beside the
  menu item and a CSV download.
- **Availability**: block leave (a period, a day or a single time) and change the weekly booking days and times.
- **Opening special**: how many of the six $250 places are used, and whether it is showing on the website.
- **Team** (v1.8.2) is its own screen at `/admin/team`: the homepage team cards as a list (edit in a side panel, drag to
  reorder, hide or show, add, remove). It edits the homepage's team section itself, so it and the page editor stay in sync.

The public pages are still plain HTML files. They are written from `content/` by the build, so visitors never touch
the database, and an unedited site is **byte for byte the approved v1.4.0 pages** (`npm run qa:parity` proves it).
Bookings and availability are live (the Book Now page reads them from the API); everything else goes live when
someone presses **Publish website**.

For Lorna and the APE team: `docs/HOW-TO-UPDATE.md`. What changed: `CHANGELOG.md`. This release's handover
(env vars, the email audit; its Stripe section is superseded by PayPal in v1.8.0): `docs/HANDOVER-v1.6.0.md`. v1.7.0: `docs/GO-LIVE-DOMAIN.md`,
`docs/TEST-BOOKING.md`, `docs/GOOGLE-BUSINESS-PROFILE.md`.

## Vercel environment variables (v1.6.0)

Add or change these in Vercel > Project > Settings > Environment Variables **before** pushing v1.6.0. The build stops
with a message if `DATABASE_URL` is set but `PAYLOAD_SECRET` is not. Mark keys and secrets as Sensitive.

| Variable | Environments | Value | Status |
|---|---|---|---|
| `DATABASE_URL` | Production, Preview | Added by Neon | already set |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Added by the Blob store `ape-media` | already set |
| `PAYLOAD_SECRET` | Production, Preview | Random, 32+ characters. Changing it signs everyone out. | already set |
| `PUBLISH_HOOK_URL` | Production | Deploy hook for `main` | already set |
| `SMTP2GO_API_KEY` | Production, Preview | SMTP2GO API key with send permission (or `RESEND_API_KEY` for Resend) | **add** |
| `BOOKING_FROM` | Production, Preview | `The Anxious Patient Experience <bookings@VERIFIED-DOMAIN>`: a sender on a domain verified in SMTP2GO. Not a gmail.com address. | **add** |
| `BOOKING_NOTIFY_EMAIL` | Production, Preview | `theanxiouspatientexperience@gmail.com` (comma separate for more) | **add** |
| `DASHBOARD_EDITORS` | Production | `lorna-gladwin1@hotmail.co.uk,reception@thecaringbahdentists.com.au,reception@thecronulladentists.com.au,theanxiouspatientexperience@gmail.com` | **add** |
| `PAYPAL_ENV` | Preview `sandbox`, Production `live` | Which PayPal environment the credentials belong to | v1.8.0 |
| `PAYPAL_CLIENT_ID` | Preview (sandbox app), Production (live app) | The REST app's Client ID | v1.8.0, add when Andy's app exists |
| `PAYPAL_CLIENT_SECRET` | Preview, Production | The REST app's Secret, Sensitive | v1.8.0 |
| `PAYPAL_WEBHOOK_ID` | Preview, Production | The webhook created in the same app | v1.8.0 |
| `DEPOSIT_PAYMENT_URL`, `STRIPE_WEBHOOK_SECRET` | | Stripe, replaced by PayPal in v1.8.0 | **delete** if present |
| `NEXT_PUBLIC_SERVER_URL` | Production | At go-live: `https://theanxiouspatientexperience.com.au`, no trailing slash (`docs/GO-LIVE-DOMAIN.md`). Leave unset on vercel.app. | at go-live |
| `QUESTIONNAIRE_ENABLED` | Production, Preview | Leave unset. Since v1.9.0 the switches are in the dashboard (Site Settings > Welcome pack); `false` here is only an emergency off switch for the online questionnaire. | optional |
| `QUESTIONNAIRE_ENCRYPTION_KEY` | Production, Preview | 32 random bytes, base64 (`openssl rand -base64 32`), Sensitive. Encrypts questionnaire answers. Needed before the online questionnaire can go on. Never change it once answers exist; keep a copy in the GYA password manager. | add when Lorna approves |
| `BOOKING_BCC` | optional | Extra copies of each request | optional |
| `ALLOW_FIRST_USER` | | Only for the very first login. | **delete** if still there |
| `ADMIN_PASSWORD` | | Not used since v1.5.0 | **delete** if still there |
| `BOOKING_NOTIFY_TO` | | Still read, but replaced by `BOOKING_NOTIFY_EMAIL` | delete once the new one is in |

Without an email key and `BOOKING_FROM`, **online booking is switched off**: Book Now shows "we could not send your
booking request" with the clinic's phone number and nothing is saved. Those two are the launch blocker.

Build settings: Framework Next.js (`vercel.json` sets it), install `npm ci`, build `npm run build`, output `.next`.
Leave the project's own Build and Development settings alone. Node 20.9 or later.

## Dashboard logins

- **Where the list lives**: `DASHBOARD_EDITORS` in Vercel (comma separated). On each production build
  (`scripts/dashboard-logins.ts`), any address in it without a login gets an **Editor** login and an email with a
  link to choose a password (one use, 72 hours). Existing logins are left alone and get **no** email (the build log
  says "already has a login, so no email was sent"); removing an address does not delete its login. Preview builds
  do nothing.
- To add someone: add the address to `DASHBOARD_EDITORS` and redeploy, or add them under **Users** (v1.8.4: Add a
  user emails the invite straight away and never duplicates an existing login). **Send login
  email again** (Users, GYA only) sends anyone a fresh 72 hour link; the Users screen shows the last one and whether
  SMTP2GO accepted it.
- **Forgotten password** (v1.8.3): "Forgotten your password?" on `/admin/login` emails a reset link that works once
  and lasts **1 hour**. Same answer whether or not the address has a login; at most 5 requests per address an hour
  (counted in the database). After any reset or change the person gets "Your password was changed".
- Payload's own `/api/users/forgot-password` and `/api/users/reset-password` are closed (404) and GraphQL is off:
  they bypassed the limits and, with no email adapter, wrote the reset link to the logs. Payload's email adapter now
  sends through SMTP2GO too.
- GYA administrators are added under Users, not through `DASHBOARD_EDITORS`.

## Emails (v1.8.3)

Every email goes through `deliver()` in `src/lib/mailer.ts` (SMTP2GO, `BOOKING_FROM`) and is logged in
`ape_email_log`: time, type, recipient, booking reference, accepted or failed, the SMTP2GO message ID and the error.
Never the message, a link or a token. Kept 90 days. **Site Settings > Email** (`/admin/settings/email`, GYA only)
shows the set up, who gets what, the last 50 sends, and **Send test emails** to one address.

| Email | To | Reply-To |
|---|---|---|
| Login invite, forgotten password, password changed | the person | none |
| Booking request received | the patient | APE inbox (Site Settings) |
| New booking request APE-XXXXXX, time | **booking list** | the patient |
| Deposit received (patient / team) | patient / **booking list** | APE inbox / the patient |
| Welcome pack (questionnaire, off) | the patient | APE inbox |
| Questionnaire received APE-XXXXXX (off) | questionnaire list, else **booking list** | none |
| APE delivery check APE-XXXXXX | GYA (`gyaNoticeTo`, else rowayne@gyaclients.com) | none |
| APE email failed (alert) | GYA, same address | none |

- **Booking list**: Site Settings > Who receives booking emails (the practice can edit it; applies to the next
  booking, no publish), else `BOOKING_NOTIFY_EMAIL`, else `BOOKING_NOTIFY_TO`, else theanxiouspatientexperience@gmail.com
  in the code, so a booking never goes to nobody. The v1.8.3 build fills the list once with the address booking
  emails already went to, so nothing changes for the team.
- **GYA delivery check**: reference, time and whether each email was accepted. No patient name, phone, email or note.
  Site Settings toggle (GYA only), on by default.
- **Failures**: the booking is always saved first. A failed patient or team email is tried again after a minute
  (after the patient's answer, and again whenever Bookings or the email screen is opened). If it fails again the
  booking shows an amber **Email not sent** flag with **Resend to patient** / **Resend to team**, and GYA gets an
  alert. The Bookings list has a small Emails column (ticks for patient and team).
- **Dashboard home** (everyone): "Emails: working", or how many failed in the last 7 days.
- Tests: `npm run test:email` against a TEST database (SMTP2GO replaced by a local stand-in). Live test steps:
  `docs/EMAIL-TEST.md`.
- Junk mail: the sender domain (thecronulladentists.com.au) has DMARC `p=quarantine` and SPF that does not include
  SMTP2GO, so SMTP2GO must sign with DKIM and use a custom return-path on that domain (Sending > Verified Senders).

## Welcome pack and questionnaire (v1.9.0, built on v1.7.0; both switched off until approved)

Lorna's own content: her **Patient Guide** and **Pre-appointment Questionnaire** (her PDFs of 15 Nov 2026, remade
in the APE brand with the typos corrected in v1.9.2: `public/downloads/ape-patient-guide.pdf` and
`ape-pre-appointment-questionnaire.pdf`, served `noindex`), and the same questionnaire online, word for word
(`src/lib/ape-questionnaire.ts`, form version `ape-2026-11`). The PDFs are built from
`design/welcome-pack/*.html` with `npm run pack:pdf` (needs Playwright locally; never run by Vercel).

- **Welcome email** (switch 1). When the team presses **Mark confirmed** (or, if chosen, when a request arrives),
  the patient gets "Your APE welcome pack and questionnaire" with both PDFs attached, where to go (address from Site
  Settings, Lorna's train and parking directions, phone), and the questionnaire paragraph. Sent once per booking;
  **Send welcome pack** on Bookings sends it by hand (no backfill of bookings made before it was switched on).
  Every send is in the email log and on the booking (when, how many times, by whom).
- **Online questionnaire** (switch 2). Adds a private link to the welcome email, and (v1.9.3) offers the
  questionnaire on the Book Now confirmation, filled in right there on the page (`?embed=1` frame). It cannot be switched on until
  `QUESTIONNAIRE_ENCRYPTION_KEY` is set and the collection notice is marked approved (and it goes off again if the
  notice wording changes). The link works until the answers are sent or 7 days after the appointment; a newer
  welcome email replaces it. Patients can **Save and finish later** (saved answers are encrypted like sent ones).
  Nothing is required; question 07 is marked Optional. Pages are `noindex`, `no-store`, no referrer, no analytics,
  rate limited.
- **Dashboard**: Site Settings > **Welcome pack** (`/admin/settings/welcome-pack`): replace either PDF from the
  Media Library or go back to the original, the email wording (with a preview), the collection notice and tick box
  wording, who gets "questionnaire received", and (GYA only) the switches, the readiness checklist and who can read
  answers. Questionnaires: the list, one questionnaire with **At a glance** (score, what makes them anxious,
  question 03) and every answer in Lorna's order, Print / Save as PDF, Reviewed, the access log (GYA).
- **Who can read answers**: only logins with **Can view patient questionnaires** (Users screen, off for everyone,
  GYA administrators included). Every open, print, review, delete and refusal is logged.
- **Tests**: Email check's "Welcome pack (patient)" sends the real email with both PDFs and a link to a TEST
  questionnaire; test rows are kept apart (GYA sees them under Questionnaires > Tests) and deleted after 24 hours.
  `npm run test:questionnaire` (53 checks) against a TEST database.
- **Retention**: 7 years after the appointment. Lorna's form has no date of birth, so the under-18 rule cannot be
  applied automatically. Nothing is deleted automatically except test rows.
- Code: `src/lib/ape-questionnaire.ts`, `src/lib/questionnaire.ts`, `src/lib/crypto.ts`,
  `src/app/(site)/questionnaire/[token]/`, `src/app/api/questionnaire/{save,submit}`,
  `src/app/api/dashboard/{welcome-pack,questionnaires}`, `src/dashboard/editors/{WelcomePack,Questionnaires}.tsx`,
  migration `20261116_012208_v190_welcome_pack`.

## Google review page (v1.7.0)

`/review/` is for QR codes, emails and text messages: `noindex`, not in any menu or the footer, not in the sitemap.
Every star (1 to 5) and the button do the same thing: open the "Taking you to Google now" pop-up and go to the one
link in Site Settings > Google review link after about 1.5 seconds (Go now and a fallback link are there too). No
rating is stored or branched on, because selectively inviting only happy patients to Google is prohibited by Google's
review policy and treated as misleading by the ACCC. A private feedback line (mailto the APE inbox) shows to everyone
before they choose anything. With no link set, the page says reviews are coming soon. Wording is edited like any page
(dashboard menu > Review page); QR codes in `deliverables/qr/ape-review-qr*`. Setting up the Google Business Profile:
`docs/GOOGLE-BUSINESS-PROFILE.md`.

## Opening special pop-up (v1.7.0)

Shows on the first open of the homepage about 0.8 seconds after the page is interactive (no scrolling needed), once
per browser session, and not again for 7 days after it is closed. Storage reads and writes are wrapped, so a browser
that blocks storage still gets it once per page view with no errors. Focus moves into it, Esc and the close button
work, focus returns afterwards and the page behind does not scroll. It exists only on the homepage. On/off, the
dates, **Show the pop-up after (seconds)**, the heading and the wording (with `{price}`, `{regular}`, `{dates}`) are
under Opening special in the dashboard and apply straight away (`ape_meta`, key `special`); the price and the number
of places stay in `content/booking.json` (GYA).

## PayPal deposit (v1.8.0)

- The patient pays the $100 deposit **inside Book Now** with PayPal Checkout (PayPal or a debit/credit card, guest
  checkout). Server side with the Orders v2 REST API (`src/lib/paypal.ts`): the server creates the order (amount from
  `content/booking.json`, `custom_id` = booking reference, brand name set, shipping off), captures it when the patient
  approves (`/api/paypal/capture`), marks the booking **Deposit received** with the capture id, and emails "Deposit
  received" to the patient and the APE inbox. The browser only ever passes the booking's private pay token.
- Unpaid: the booking stays **Not paid**; the patient email carries a private **Pay your deposit** link
  (`/book-now/pay/?t=...`, 14 days or until paid, noindex). The confirmation screen offers it too.
- `/api/paypal/webhook`: verified with PayPal (`PAYPAL_WEBHOOK_ID`), idempotent by event id (`ape_paypal_events`).
  `PAYMENT.CAPTURE.COMPLETED` marks paid, `DENIED` marks failed, `REFUNDED` marks **Refunded**.
- Dashboard: deposit status on every booking (Not paid, Received, Received (manual), Refunded, Failed), a **Deposit
  not paid** filter, View in PayPal, **Mark deposit received manually** with a note, and a Deposits not paid count on
  the home screen.
- Without `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` the deposit step is not offered and Book Now behaves exactly as
  before. Bank and payout details live in the PayPal account only. Set-up for Andy: `docs/PAYPAL-SETUP.md`; the test
  script: `docs/TEST-BOOKING.md`.

## How it works

```
dashboard (/admin)  ->  Neon Postgres  ->  "Publish website"  ->  Vercel deploy hook
                                                                        |
  npm run build (scripts/build.mjs):                                    v
    1. payload migrate          dashboard tables up to date
    2. seed --if-empty          the first time only: load content/ into the dashboard
    2b. content-updates         this release's changes to dashboard content, only where the client has not edited it
                                (v1.7.0: the review page and the privacy policy's questionnaire section)
    2c. dashboard-logins        DASHBOARD_EDITORS: add missing logins and email their password links
    3. pull-content             dashboard -> content/*.json (skipped until the content has been imported)
    4. render-site              content/*.json -> public/*.html, sitemap.xml, robots.txt, assets/site-config.js
    5. qa-site                  every link, anchor, file, structured data, FAQ count; no em dashes
    6. next build               the dashboard, Payload at /cms (GYA only), the booking and dashboard API
```

- If the database is down, empty or not imported, steps 2 and 3 are skipped and the site is built from the JSON in
  the repo. The live site cannot break because of the dashboard.
- `content/pages/*.json`: each page's head (SEO values as `{{seo:...}}` tokens), its sections (the approved markup with
  every word, link and photo as a `{{fN}}` placeholder plus the values), and its tail (pop-up, structured data,
  scripts). `content/chrome.json` is the footer. Contact details are `{{site:...}}` tokens filled from Site Settings.
  The FAQ structured data is written from the questions on the page, so it always matches them.
- `src/proxy.ts` serves the pages the way the v1.4.0 `vercel.json` did: `/book-now` and `/book-now/index.html` go
  (308) to `/book-now/`, unknown addresses get the site's own 404 page with a 404 status, and dashboard redirects apply.
- The booking API: `GET /api/availability/` (times and prices, special status) and `POST /api/booking/` (one locked
  transaction decides the fee and saves the request, so no time is booked twice and the special cannot go past six).
  The dashboard screens use `/api/dashboard/bookings` with the dashboard sign-in. Bookings, blocks and the weekly
  times live in the `ape_bookings`, `ape_blocks` and `ape_meta` tables, created on first use.
- Booking rules, prices and the opening special: `content/booking.json` (GYA). The weekly days and times can be changed
  in the dashboard (Availability) and apply straight away; "Use the standard times" goes back to the file.

```
content/                 the site's content (JSON); the build overwrites it from the dashboard
src/dashboard/           the /admin dashboard: screens, editors, styles (brand.ts and the colours at the top of dashboard.css are the APE parts)
src/dashboard/render.ts  pages to HTML, for the build and for the page editor (so the editor shows what goes live)
src/app/(dashboard)/     /admin routes            src/app/(payload)/   Payload's own screens at /cms (GYA only)
src/app/(site)/          the private patient questionnaire pages (/questionnaire/<token>), no tracking
src/app/api/             availability, booking, paypal/order, paypal/capture, paypal/webhook, dashboard/bookings, dashboard/forgot-password, dashboard/pages, publish-site, import-content, import-media
src/booking/core.ts      booking rules, schedule, opening special, database (deposit columns in ape_bookings)
src/lib/email.ts         sending email (SMTP2GO or Resend)      src/lib/paypal.ts  PayPal Orders v2 and webhook verification
src/booking/deposit.ts   the deposit on a booking: pay tokens, captures, refunds, manual marks, the receipt emails
src/lib/questionnaire.ts the welcome email, private links, encrypted answers, access and logging   src/lib/crypto.ts
src/sitekit/releases.ts  content changes a release makes to the dashboard (never over the client's edits)
src/sitekit/             Payload collections and Site Settings, import and pull (sync.ts)
src/proxy.ts             clean URLs, trailing slash, 404, dashboard redirects
public/                  assets/ (site.css, site.js, fonts), images/, icons, the forwarding pages; the build adds the pages
scripts/                 build.mjs, render-site.ts, pull-content.ts, seed.ts, qa-*.ts/mjs
migrations/              dashboard database schema (the build runs them)
tools/v140/              the approved v1.4.0 pages, which qa:parity compares against
tools/extract-static-site/  the one-off script that made content/ from them (kept for the record)
qr/                      flyer QR code script (and copies)
deliverables/qr/         the QR files to send
docs/                    HOW-TO-UPDATE.md (for the practice), screenshots/, build-notes/
```

## Checks

`npm run qa` runs them all: `typecheck`, `qa:parity` (content renders back to v1.4.0 byte for byte), `qa:editor`
(the editor shows every page exactly as it goes live), `qa:site`, `qa:banned` and `qa:secrets`. See CHANGELOG 1.5.0
for the full verification.

Local: `npm ci`, a `.env` with `DATABASE_URL` and `PAYLOAD_SECRET`, `npm run build`, then `npm start` on port 3000
(the dashboard only accepts sign-ins from its own address, see `NEXT_PUBLIC_SERVER_URL`).

## Team

Dr Lorna Gladwin (Creator of The Anxious Patient Experience™), Alex Loupos (APE Lead | Patient Care & Support),
Lauren Bright (APE Dental Assistant | Patient Care & Support). Each bio shows its first paragraph and "Read more".

- **Lauren's photo** (v1.6.0, supplied 9 Nov 2026): `public/images/team-lauren-bright-2026-11-09.jpg` (1086 x 1448),
  `.webp` and `-800.webp`, served with a `srcset`. To change it later: dashboard, Team, Edit, Upload.
- Lorna's rules: no faces except the team's own photos; nothing that looks like a clinic, dental chair or treatment
  room unless it is genuine photography of her practices. The Media Library holds the approved photos.

## QR code for the flyer

`deliverables/qr/` (and a copy in `qr/`): `ape-flyer-qr.png` (1000 x 1000 px, 300 dpi), `ape-flyer-qr-print.png`
(about 2000 px) and `ape-flyer-qr.svg`, navy on white, error correction H. It opens
`https://the-anxious-patient-experience.vercel.app/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch`.
For the final domain: `python3 -m pip install --user segno pillow && python3 qr/make-qr.py "https://YOUR-DOMAIN/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch"`.
Keep the vercel.app address working after go-live (Vercel keeps it by default) so printed flyers keep scanning.

## Before go-live: set the domain

Canonical tags, share links and the sitemap now use the site's own address (`NEXT_PUBLIC_SERVER_URL`, else the
vercel.app address; v1.4.0 used a `https://example.com` placeholder). At go-live set `NEXT_PUBLIC_SERVER_URL` to the
domain and redeploy, regenerate the QR code, and update `ape.url` / `ape.bookUrl` on the Caringbah and Cronulla sites.

## Placeholders and open items

| Item | Where |
|---|---|
| Email key and verified sender | `SMTP2GO_API_KEY`, `BOOKING_FROM` (launch blocker) |
| PayPal credentials | `PAYPAL_*` in Vercel once Andy's app and webhook exist (`docs/PAYPAL-SETUP.md`) |
| Privacy policy: legal entity and Privacy Officer name | Pages > Privacy Policy (written for APE on 9 Nov 2026; Lorna to confirm) |
| Domain: theanxiouspatientexperience.com.au at VentraIP | `docs/GO-LIVE-DOMAIN.md` (waiting on VentraIP access) |
| Lorna's approval of the welcome email wording, collection notice and privacy wording; who reads questionnaires; the encryption key | Site Settings > Welcome pack; both switches off until then |
| Google Business Profile option and admin email | `docs/GOOGLE-BUSINESS-PROFILE.md` |
| Google review link | Site Settings > Google review link (after the profile exists) |
| GA4 / Meta Pixel IDs | Site Settings > Tracking (GYA only) |

## Go-live checklist

- [ ] Repo is private
- [ ] Vercel: `SMTP2GO_API_KEY`, `BOOKING_FROM` (verified domain), `BOOKING_NOTIFY_EMAIL`, `DASHBOARD_EDITORS` added;
      `ALLOW_FIRST_USER` and `ADMIN_PASSWORD` deleted
- [ ] All four logins received their password email and signed in once
- [ ] Test booking: request email at the APE inbox, acknowledgement at the patient's address (check junk), shows
      under Bookings; then cancelled
- [ ] PayPal: sandbox run of docs/TEST-BOOKING.md on the preview, then one live $100 booking refunded in PayPal
- [ ] Payout bank account linked and confirmed in the PayPal business account by the account owner
- [ ] Privacy Policy: legal entity and Privacy Officer confirmed by Lorna
- [ ] Book Now hero "pay your deposit online in four simple steps" true once the PayPal variables are in
- [ ] Confirmation heading "You're booked in." agreed (bookings are confirmed by hand)
- [ ] New copy signed off (CHANGELOG 1.5.0, 1.4.0, 1.3.0)
- [ ] `NEXT_PUBLIC_SERVER_URL` set to the domain; QR regenerated if the flyer is not yet printed; GA4 added
- [ ] iPhone check: homepage, menu, pop-up, FAQ cards, a test booking, the privacy page, the dashboard
- [ ] Lorna's profile never uses the word "specialist"
- [ ] DNS: apex primary, www 308 to apex

## Not in this release

- Two-way sync with Core Practice (not wanted: bookings are entered by hand).
- Automatic emails when a booking is cancelled (the team emails the patient). Confirmed bookings get the welcome pack once it is switched on.
- The welcome email and online questionnaire are built with Lorna's content but switched off (Site Settings > Welcome pack) until she approves the email wording, collection notice and privacy wording.
- Changing the fee, deposit or opening special from the dashboard (GYA changes `content/booking.json`, because offers
  must state price, inclusions and dates).
- One-off extra sessions on a single date (the weekly times and blocks cover leave and regular days).
