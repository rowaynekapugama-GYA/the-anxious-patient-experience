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

For Lorna and the APE team: `docs/HOW-TO-UPDATE.md`. What changed: `CHANGELOG.md`.

## Vercel set-up (once, before pushing v1.5.0)

The build stops with a message if `DATABASE_URL` is set but `PAYLOAD_SECRET` is not, so add the variables first.

1. **Database**: already connected (Neon, `DATABASE_URL`). The dashboard's tables are added by the build. The
   bookings tables from v1.4.0 are kept as they are.
2. **Media storage**: Storage > Create > **Blob** > connect to this project (Production and Preview). Adds
   `BLOB_READ_WRITE_TOKEN`. Without it, photos uploaded in the dashboard would be lost at the next deploy.
3. **Publish hook**: Settings > Git > Deploy Hooks > name `dashboard-publish`, branch `main`. Copy the address into
   `PUBLISH_HOOK_URL`.
4. **Environment variables** (Settings > Environment Variables):

| Variable | Where | Value |
|---|---|---|
| `DATABASE_URL` | Production, Preview | Added by Neon (already there) |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Added by the Blob store (step 2) |
| `PAYLOAD_SECRET` | Production, Preview | A random string of 32 characters or more (`openssl rand -hex 32`). Sensitive. Changing it signs everyone out. |
| `PUBLISH_HOOK_URL` | Production | The deploy hook from step 3. Sensitive. |
| `ALLOW_FIRST_USER` | Production | `true` only while the first login is made (step 6), then delete it |
| `NEXT_PUBLIC_SERVER_URL` | Production | Leave unset on vercel.app. At go-live: `https://the-final-domain.com.au` (no trailing slash), then redeploy |
| `RESEND_API_KEY`, `BOOKING_FROM` | Production, Preview | Booking emails (Resend); `BOOKING_FROM` on a Resend-verified domain |
| `BOOKING_NOTIFY_TO` | optional | Where booking requests go, if Site Settings has no list (defaults to the APE inbox) |
| `BOOKING_BCC` | optional | Extra copies of each request, comma separated |
| `DEPOSIT_PAYMENT_URL` | optional | The $100 deposit payment link (for example a Stripe Payment Link), once Ram confirms the account |

`ADMIN_PASSWORD` from v1.4.0 is no longer used (the dashboard has its own logins now) and can be deleted.

5. **Push** v1.5.0 (`update-v1.5.0.sh`). The first build adds the dashboard tables and loads the website into the
   dashboard by itself.
6. **First login**: open `/admin/login`. With `ALLOW_FIRST_USER=true` and no accounts yet, it shows "Create the first
   login" (always a GYA administrator): use `rowayne@gyaclients.com`. Then **delete `ALLOW_FIRST_USER` and redeploy**.
7. On the Dashboard press **Import pictures into the Media Library** (GYA only), then under **Users** add Lorna and
   Alex as Editors with a temporary password each (they choose their own at first sign in). Send the password
   separately from the link.

Build settings: Framework Next.js (`vercel.json` sets it), install `npm ci`, build `npm run build`, output `.next`.
Leave the project's own Build and Development settings alone. Node 20.9 or later.

## How it works

```
dashboard (/admin)  ->  Neon Postgres  ->  "Publish website"  ->  Vercel deploy hook
                                                                        |
  npm run build (scripts/build.mjs):                                    v
    1. payload migrate          dashboard tables up to date
    2. seed --if-empty          the first time only: load content/ into the dashboard
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
src/app/api/             availability, booking, dashboard/bookings, dashboard/pages, publish-site, import-content, import-media
src/booking/core.ts      booking rules, schedule, opening special, database, email
src/sitekit/             Payload collections and Site Settings, import and pull (sync.ts)
src/proxy.ts             clean URLs, trailing slash, 404, dashboard redirects
public/                  assets/ (site.css, site.js, fonts), images/, icons, the forwarding pages; the build adds the pages
scripts/                 build.mjs, render-site.ts, pull-content.ts, seed.ts, qa-*.ts/mjs
migrations/              dashboard database schema (the build runs them)
tools/v140/              the approved v1.4.0 pages, which qa:parity compares against
tools/extract-static-site/  the one-off script that made content/ from them (kept for the record)
qr/                      flyer QR code
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

- **Lauren's photo**: in the dashboard, Team > click the "L" picture > Upload (portrait, face in the top third), Save
  changes, Publish website. Or replace `public/images/team-lauren-bright.jpg` in the repo (same name).
- Lorna's rules: no faces except the team's own photos; nothing that looks like a clinic, dental chair or treatment
  room unless it is genuine photography of her practices. The Media Library holds the approved photos.

## QR code for the flyer

`qr/ape-flyer-qr.png` (2015 px) and `.svg`, navy on white. It opens
`https://the-anxious-patient-experience.vercel.app/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch`.
For the final domain: `python3 -m pip install --user segno && python3 qr/make-qr.py "https://YOUR-DOMAIN/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch"`.

## Before go-live: set the domain

Canonical tags, share links and the sitemap now use the site's own address (`NEXT_PUBLIC_SERVER_URL`, else the
vercel.app address; v1.4.0 used a `https://example.com` placeholder). At go-live set `NEXT_PUBLIC_SERVER_URL` to the
domain and redeploy, regenerate the QR code, and update `ape.url` / `ape.bookUrl` on the Caringbah and Cronulla sites.

## Placeholders and open items

| Item | Where |
|---|---|
| Lauren's photo | Team (monogram for now) |
| Deposit payment link | `DEPOSIT_PAYMENT_URL` (waiting on Ram's account) |
| Domain | `NEXT_PUBLIC_SERVER_URL`, QR code |
| Privacy policy text | Pages > Privacy Policy (needed: the booking form collects personal details) |
| GA4 / Meta Pixel IDs | Site Settings > Tracking (GYA only) |

## Go-live checklist

- [ ] Repo is private
- [ ] Vercel: Blob, `PAYLOAD_SECRET`, `PUBLISH_HOOK_URL`, Resend variables; first login made and `ALLOW_FIRST_USER` removed
- [ ] Media Library imported; Lorna and Alex added as Editors and signed in once
- [ ] Publish website tested (deploy starts, change shows on the site)
- [ ] Test booking reaches the APE inbox and the patient; shows under Bookings; cancelled afterwards
- [ ] 23 and 30 Dec show as blocked under Availability
- [ ] Deposit link added once Ram confirms (until then patients get the "details will be sent" line)
- [ ] Book Now hero "pay your deposit online in four simple steps" true only once the payment link exists
- [ ] Confirmation heading "You're booked in." agreed (bookings are confirmed by hand)
- [ ] New copy signed off (CHANGELOG 1.5.0, 1.4.0, 1.3.0)
- [ ] Privacy policy supplied; Lauren's photo in place
- [ ] `NEXT_PUBLIC_SERVER_URL` set to the domain; QR regenerated; GA4 added
- [ ] iPhone check: homepage, menu, pop-up, FAQ cards, a test booking, the dashboard
- [ ] Lorna's profile never uses the word "specialist"
- [ ] DNS: apex primary, www 308 to apex

## Not in this release

- Two-way sync with Core Practice (not wanted: bookings are entered by hand).
- Automatic emails when a booking is confirmed or cancelled (the team emails the patient).
- Changing the fee, deposit or opening special from the dashboard (GYA changes `content/booking.json`, because offers
  must state price, inclusions and dates).
- One-off extra sessions on a single date (the weekly times and blocks cover leave and regular days).
