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
- **Team** opens the homepage in the page editor at the team cards.

The public pages are still plain HTML files. They are written from `content/` by the build, so visitors never touch
the database, and an unedited site is **byte for byte the approved v1.4.0 pages** (`npm run qa:parity` proves it).
Bookings and availability are live (the Book Now page reads them from the API); everything else goes live when
someone presses **Publish website**.

For Lorna and the APE team: `docs/HOW-TO-UPDATE.md`. What changed: `CHANGELOG.md`. This release's handover
(env vars, Stripe go-live, the email audit and the post-launch scoping): `docs/HANDOVER-v1.6.0.md`.

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
| `DEPOSIT_PAYMENT_URL` | Production (test link in Preview) | The $100 Stripe Payment Link, `https://buy.stripe.com/...` | add when Stripe is ready |
| `STRIPE_WEBHOOK_SECRET` | Production | `whsec_...` from the Stripe webhook (see Stripe go-live steps) | optional, recommended |
| `NEXT_PUBLIC_SERVER_URL` | Production | At go-live: `https://the-final-domain.com.au`, no trailing slash. Leave unset on vercel.app. | at go-live |
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
  link to choose a password (one use, 72 hours). Existing logins are left alone; removing an address does not
  delete its login (Users > Delete, GYA only). Preview builds do nothing.
- To add someone: add the address to `DASHBOARD_EDITORS` and redeploy (or press Publish website). Or add them under
  **Users** and press **Email a password link**.
- **Forgotten password**: "Forgotten your password?" on `/admin/login` emails a reset link (same response whether or
  not the address has a login; one email per address every 2 minutes). Needs the email variables above.
- GYA administrators are added under Users, not through `DASHBOARD_EDITORS`.

## Booking emails (audit, 9 Nov 2026)

Each booking sends two emails through `src/lib/email.ts` (SMTP2GO if `SMTP2GO_API_KEY` is set, else Resend):

1. **To the APE team**: "APE booking request: [day, time], [name] ([ref])" to Site Settings > Who receives booking
   requests if that list has anyone in it (it is empty), else `BOOKING_NOTIFY_EMAIL`, else
   theanxiouspatientexperience@gmail.com. Every detail of the request; Reply-To is the patient.
2. **To the patient**: "We have received your booking request", with the time, place, fee, reference and the deposit
   link. Reply-To is the APE inbox.

The booking is saved before the emails are sent, so a failed email never loses a booking (it shows under Bookings).
Before v1.6.0 only Resend was wired up and its variables were never added, so the live booking form could not send.

## Stripe

- The site never holds Stripe API keys. The deposit is a **Stripe Payment Link** (`DEPOSIT_PAYMENT_URL`); the
  booking adds `client_reference_id` (the booking reference) and `prefilled_email`.
- Optional webhook: `POST /api/stripe/webhook`, verified with `STRIPE_WEBHOOK_SECRET` (Stripe-Signature, 5 minute
  tolerance). On `checkout.session.completed` or `checkout.session.async_payment_succeeded` with a paid session and an
  `APE-XXXXXX` reference, the booking's Deposit received is ticked. A bad signature gets 400; a database error gets
  500 so Stripe retries.
- **Bank and payout details belong in the Stripe Dashboard only** (Settings > Bank accounts and currencies), never in
  this repo, Vercel or an email. Go-live steps: `docs/HANDOVER-v1.6.0.md`.

## How it works

```
dashboard (/admin)  ->  Neon Postgres  ->  "Publish website"  ->  Vercel deploy hook
                                                                        |
  npm run build (scripts/build.mjs):                                    v
    1. payload migrate          dashboard tables up to date
    2. seed --if-empty          the first time only: load content/ into the dashboard
    2b. content-updates         this release's changes to dashboard content, only where the client has not edited it
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
src/app/api/             availability, booking, stripe/webhook, dashboard/bookings, dashboard/forgot-password, dashboard/pages, publish-site, import-content, import-media
src/booking/core.ts      booking rules, schedule, opening special, database
src/lib/email.ts         sending email (SMTP2GO or Resend)      src/lib/stripe.ts  webhook signature check
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
  `.webp` and `-800.webp`, served with a `srcset`. To change it later: dashboard, Team, click the photo, Upload.
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
| Deposit payment link | `DEPOSIT_PAYMENT_URL` (Stripe account owner to set up) |
| Privacy policy: legal entity and Privacy Officer name | Pages > Privacy Policy (written for APE on 9 Nov 2026; Lorna to confirm) |
| Domain | `NEXT_PUBLIC_SERVER_URL`, QR code |
| GA4 / Meta Pixel IDs | Site Settings > Tracking (GYA only) |

## Go-live checklist

- [ ] Repo is private
- [ ] Vercel: `SMTP2GO_API_KEY`, `BOOKING_FROM` (verified domain), `BOOKING_NOTIFY_EMAIL`, `DASHBOARD_EDITORS` added;
      `ALLOW_FIRST_USER` and `ADMIN_PASSWORD` deleted
- [ ] All four logins received their password email and signed in once
- [ ] Test booking: request email at the APE inbox, acknowledgement at the patient's address (check junk), shows
      under Bookings; then cancelled
- [ ] Stripe: test Payment Link paid with 4242 4242 4242 4242; Deposit received ticked (if the webhook is set up);
      then the live link and live webhook (docs/HANDOVER-v1.6.0.md)
- [ ] Payout bank account entered and verified in the Stripe Dashboard by the account owner
- [ ] Privacy Policy: legal entity and Privacy Officer confirmed by Lorna
- [ ] Book Now hero "pay your deposit online in four simple steps" true only once the payment link exists
- [ ] Confirmation heading "You're booked in." agreed (bookings are confirmed by hand)
- [ ] New copy signed off (CHANGELOG 1.5.0, 1.4.0, 1.3.0)
- [ ] `NEXT_PUBLIC_SERVER_URL` set to the domain; QR regenerated if the flyer is not yet printed; GA4 added
- [ ] iPhone check: homepage, menu, pop-up, FAQ cards, a test booking, the privacy page, the dashboard
- [ ] Lorna's profile never uses the word "specialist"
- [ ] DNS: apex primary, www 308 to apex

## Not in this release

- Two-way sync with Core Practice (not wanted: bookings are entered by hand).
- Automatic emails when a booking is confirmed or cancelled (the team emails the patient).
- The New Patient Information Pack online (scoped in `docs/HANDOVER-v1.6.0.md`).
- Changing the fee, deposit or opening special from the dashboard (GYA changes `content/booking.json`, because offers
  must state price, inclusions and dates).
- One-off extra sessions on a single date (the weekly times and blocks cover leave and regular days).
