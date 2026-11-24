# The Anxious Patient Experience™: website

GYA build for Dr Lorna Gladwin. Update to the existing repo `rowaynekapugama-GYA/the-anxious-patient-experience`
(it should be private). Staging: https://the-anxious-patient-experience.vercel.app/

From v1.5.0 the site has the **GYA standard client dashboard** at **`/admin`** (as on Precision Dental and Tooth n
Care), with the APE online booking screens built into it:

- **Pages**: click words on the real page to change them, click a photo to replace it, reorder or hide sections, set
  each page's SEO. Footer words (tagline, disclaimer, copyright) can be changed from any page.
- **Blog Posts, Media Library, SEO, Site Settings, Redirects and Users** (Redirects are GYA only; Users is GYA plus
  the practice owner, who only chooses who can open patient questionnaires, v1.10.0).
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
`docs/TEST-BOOKING.md`, `docs/GOOGLE-BUSINESS-PROFILE.md`. v1.10.0: `docs/PAYPAL-ADVANCED-SETUP.md` (for Andy and Ram)
and `docs/FOR-LORNA-v1.10.0.md` (wording and questions for Lorna). v1.11.0: `docs/FOR-LORNA-v1.11.0.md` (the
analytics privacy paragraph), `docs/TRACKING-LINKS.md`, `docs/SEARCH-CONSOLE.md` and `docs/HOW-TO-SEE-YOUR-NUMBERS.md`.
v1.13.0: `docs/stock-shot-list.md` (a brief for a licensed hands photo). v1.14.0: `docs/PATIENT-EMAILS.md` (for Lorna).

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
| `QUESTIONNAIRE_ENCRYPTION_KEY` | Production, Preview | 32 random bytes, base64 (`openssl rand -base64 32`), Sensitive. Encrypts questionnaire answers. Needed before the online questionnaire can go on. Never change it once answers exist (no key rotation); keep a copy in the GYA password manager. | add now: Lorna approved on 19 Nov 2026 (README, v1.13.0) |
| `PAYPAL_ADVANCED` | Preview first, then Production | `on` switches on PayPal Advanced Checkout (card fields, Apple Pay, Google Pay). Not Sensitive. Leave unset until PayPal approves it (`docs/PAYPAL-ADVANCED-SETUP.md`). | v1.10.0, later |
| `APPLE_PAY_DOMAIN_ASSOCIATION` | Production | Optional: the contents of PayPal's Apple Pay domain file, if it is not put in `config/apple-pay/`. Public, not Sensitive. | v1.10.0, optional |
| `NEXT_PUBLIC_GA4_ID` | Production | Leave unset. From v1.15.0 Google Analytics runs through Google Tag Manager (the container ID is in Site Settings > Tracking, no environment variable). This is only read when Tag Manager is switched off. | v1.11.0, not used |
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

## Book Now details, terms and questionnaire access (v1.10.0)

- **Required details**: first name, last name, email, phone (Australian mobile or landline, saved as `0412 345 678`
  or `(02) 8599 9815`) and date of birth (day and month selects, year box; no future dates, nothing over 120 years).
  Checked in the browser and again on the server (`src/booking/patient.ts`). Errors are plain words beside each field,
  listed in a summary that screen readers announce. Under 18 is not blocked; the dashboard shows the age and an
  Under 18 label. Older bookings keep their single name and show "not given" for the date of birth.
- **Five steps** (v1.10.0; back to four in v1.11.0, see below): time, details, **Terms and cancellation policy** (full text, "I consent ..." tick), deposit ("I have
  read ..." tick, which replaced the old deposit policy tick), confirmed. Each booking stores the terms version and
  the time of each tick (`terms_version`, `terms_consent_at`, `terms_read_at`, and `terms_pay_read_at` for the
  pay-later page). Terms are edited in Site Settings > Booking terms (`src/booking/terms.ts`), also at `/book-now/terms/`.
- **Retention**: questionnaires are kept 7 years after the appointment, or until the patient turns 25 if they were
  under 18 at the appointment, whichever is later (`retainUntil` in `src/booking/patient.ts`, from the booking's date of
  birth, else the one on the questionnaire).
- **Questionnaire access**: only logins ticked "Can view patient questionnaires" can open them. A **Practice owner**
  (set by GYA; the v1.10.0 migration sets it for lorna-gladwin1@hotmail.co.uk if that login exists, and logs it) sees
  the Users screen and can tick it for anyone. Editors cannot see or change it. Changes go through
  `/api/dashboard/questionnaire-access` (`src/lib/access.ts`), are logged in `ape_access_log` and email the person given
  access. **Questionnaire notifications go to** in Site Settings (empty: the booking list).
- **Questionnaire top**: full name and date of birth, filled in from the booking, needed to send, sealed with the
  answers; the dashboard flags "Name or DOB differs from the booking".

## Booking notes, Onboarding call and questionnaire wording (v1.16.0)

Requested by Dr Lorna Gladwin and Alex, 24 Nov 2026. Dashboard only; the public pages are unchanged apart from the
asset version tag.

- **Notes** on every booking (Bookings, click the patient's name), desktop and phone: a text box with Add note (up to
  2,000 characters), four quick notes ("Called, no answer", "Left a voicemail", "Sent a text", "Spoke to the
  patient"), who and when on each note (Sydney time), newest first. The author edits or deletes their own notes;
  administrators can delete any. Deleting asks first. The list shows the number of notes and the first line of the
  latest under the patient's name.
- **Onboarding call**: Mark onboarding call completed, with who and when, and Undo (asks first). Both add a line to
  the notes. The list shows "Onboarding call: to do / done", and the tab **Onboarding call to do** lists bookings that
  are going ahead (upcoming, not cancelled or released, not still paying) and not ticked. Nothing else changes: no
  email, status, deposit, welcome pack or Google.
- **Storage**: `ape_booking_notes` (one row per note, `ON DELETE CASCADE` from `ape_bookings`) and
  `ape_bookings.onboarding_done_at` / `onboarding_by`, created by `src/booking/core.ts` with `IF NOT EXISTS`. Code:
  `src/booking/notes.ts` (server), `src/booking/followup.ts` (rules shared with the screen),
  `src/app/api/dashboard/bookings/route.ts` (actions `note-add`, `note-edit`, `note-delete`, `onboarding`).
- **Privacy**: notes need a dashboard login, never go to the patient, any email, the CSV, the dataLayer, an address or
  the server logs (errors on note actions log the database error code only), are shown as plain text, and are deleted
  with their booking. `npm run test:notes` checks all of this.
- **Questionnaire wording** (Bookings and Questionnaires): not sent yet; sent, not yet completed; started, not yet
  completed; completed (date); not completed, link expired (`questionnaireLabel` in `src/booking/followup.ts`).
- **Site Settings > Google Business Profile link** (new field, migration `20261124_090000_v1160_profile_link`):
  written into the structured data as `sameAs` on the APE department when set. Blank changes nothing.
- **Sources**: `utm_source=gbp` shows as "Google Business Profile" (`docs/TRACKING-LINKS.md`).
- Guides: `docs/HOW-TO-USE-THE-BOOKING-DASHBOARD.md`, `docs/GOOGLE-BUSINESS-PROFILE-LISTING.md`.

## Google Tag Manager (v1.15.0)

Container **GTM-PNMVSBCW**. Google Analytics (G-16W6YW4PR4) runs through it, so the direct GA4 tag from v1.11.0 is
not loaded. The rules for the container itself are in `docs/GTM-CONTAINER-RULES.md`: read them before publishing
anything in Tag Manager.

- **Why it is built this way**: a tag inside the container reads the page address and the referrer straight from
  the browser, so the v1.11.0 privacy rules cannot live in `analytics.js` any more. They are kept by deciding where
  the container may load (`src/lib/gtm.ts`).
- **Two copies of every public page**: `scripts/render-site.ts` writes the plain page as before, and a copy with the
  container under `public/live-pages/`. `src/proxy.ts` serves the copy only when all three are true: the address is
  the live domain (`theanxiouspatientexperience.com.au` or `www.`), the page is a public page, and the address
  carries nothing but `utm_` tags. Everything else gets the plain page. The copies cannot be opened at their own
  address.
- **Never**: `/admin`, `/cms`, previews, any `vercel.app` address, `/questionnaire/...`, `/book-now/pay/`, any
  address with another value in it (a token, a PayPal return), a 404 that looks like a mistyped private link, and
  the old short addresses (`/faqs/` and so on, which forward at once).
- **Ad click IDs** (`fbclid`, `gclid` and the rest of `CLICK_IDS`) are removed with a 307 redirect on the live
  domain, keeping `utm_` tags, so those visits still count. Campaign links use `utm_` tags (`docs/TRACKING-LINKS.md`).
- **The snippet** is the Cronulla v2.4.0 and Lava Street v1.3.4 format (plain `<script async>` then `gtag('js')`),
  straight after the viewport tag, with the noscript frame straight after `<body>`. One thing is added before it:
  the privacy defaults (Consent Mode: advertising storage, advertising user data and ad personalisation denied;
  Google signals and ad personalisation signals off), so they hold whatever the container is set to.
- **The deposit policy page** (`/book-now/terms/`) is the one public Next.js page. It moved to `src/app/(public)/`
  with its own layout, which adds the container only when the proxy sets the `x-ape-tm` request header. The private
  pages stay in `src/app/(site)/`, whose layout has no way to add it.
- **Referrer**: the private pages send `Referrer-Policy: no-referrer` (`next.config.mjs`, both spellings of the
  pay-later address) and carry `<meta name="referrer" content="no-referrer">` (`src/lib/SiteFrame.tsx`), so the next
  page never learns their address.
- **Events**: `public/assets/analytics.js` pushes the v1.11.0 events to the `dataLayer` as named events, through
  the same filter (only `method`, `value`, `currency` and `from` can be present). The Google tag does not pick
  them up by itself: the container needs one trigger and one GA4 event tag (`docs/GTM-CONTAINER-RULES.md`,
  section 3). Deposits paid on the pay-later page are handed to the next public page in the same tab
  (sessionStorage `ape_evq`: event name, amount, method) and sent from there with `from: 'pay_link'`.
- **Site Settings > Tracking (GYA only)**: Google Tag Manager ID. Blank uses the default in `src/site.config.ts`,
  another `GTM-...` ID replaces it, and `off` switches Tag Manager off (then, and only then, a GA4 ID loads
  directly as in v1.11.0). The build fills a blank field with the default once (`applyGtmContainer` in
  `src/sitekit/releases.ts`). Changes go live with Publish website.
- **The build stops** (`scripts/qa-gtm.mjs`) if a live copy does not have exactly one container script and one
  noscript frame, if any other page has one, if Tag Manager is allowed on anything but the live domain, or if the
  private parts of the site refer to it. `npm run test:gtm` checks the rules themselves.
- **No Content Security Policy** is sent by this site, so nothing was added for Google.
- Migration: additive (`tracking_gtm` on `site_settings`).

## Branded emails and Patient emails (v1.14.0)

- **Layout:** `src/email/layout.ts`, used by every email.
  - `shell()` builds the page: logo, optional photo, eyebrow, heading, sections, sign-off and footer.
  - `panel()` is the details box and `box()` the "Where to go" box.
  - `button()` is the bulletproof button (VML for Outlook).
  - Images: `public/email/` (`ape-logo-320.png`, `banner-*.jpg` at 1200 x 500).
  - Fonts: the site's own woff2 files in `public/assets/fonts/`, inside `@media screen`. Outlook on Windows is told
    to use Arial and Georgia.
  - All links and images use `NEXT_PUBLIC_SERVER_URL` (it must be the live domain in Production).
- **Patient emails:** `src/email/patient.ts`.
  - Kinds `booking-patient`, `welcome` and `deposit-patient`.
  - `defaultTemplate()` is the pre-v1.14 wording word for word. The welcome default comes from `fromLegacyWelcome()`,
    so wording saved in Welcome pack carries over.
  - `check()` holds the rules: required fields, unknown merge fields, the welcome email's questionnaire link, https or
    mailto links, AHPRA warnings.
  - `render()` builds one email.
  - `load()`, `save()`, `reset()` and `versions()` read and write `ape_email_templates` and
    `ape_email_template_versions` (additive, in `core.SCHEMA`; the last 10 versions are kept per email).
- **Where the wording is read:**
  - `emails.patientEmail()` (with the policy line from `terms.policyReminder()` and the saved deposit policy);
  - `deposit.depositEmails()`;
  - `questionnaire.welcomeEmail()`.

  The send paths load the saved template at send time.
- **Dashboard:**
  - `/admin/emails` (`src/dashboard/editors/PatientEmails.tsx`), for any signed-in user.
  - API: `/api/dashboard/patient-emails` (GET; POST preview, save, reset, restore, test).
  - Test sends go only to the signed-in person's own address, 6 an hour (`ape_rate`).
- Team and login emails keep their wording (their text versions are unchanged); only the HTML moved into the layout.
  The GYA delivery check is unchanged.
- No new environment variables.

## Questionnaire live, 15 and over, guardian name (v1.13.0)

- **Online questionnaire**: Lorna approved it on 19 Nov 2026. The release `v1.13.0-questionnaire-approved` (once, in
  `ape_meta`) records "Dr Lorna Gladwin, email 19 Nov 2026" as the approval and switches the online questionnaire on.
  It runs only when `QUESTIONNAIRE_ENCRYPTION_KEY` is also set; until then Site Settings > Welcome pack lists the key
  as the one thing missing and the welcome email says "bring it with you" instead of giving a link.
- **Adding the key** (GYA, once):
  1. On your own computer: `openssl rand -base64 32`. Do not paste it into chat, email, a ticket or the repo.
  2. Vercel > the project > Settings > Environment Variables > Add: name `QUESTIONNAIRE_ENCRYPTION_KEY`, the value,
     Environments **Production** and **Preview**, **Sensitive** on. Save.
  3. Save the same value in the GYA password manager, entry "APE questionnaire encryption key".
  4. Redeploy production (Deployments > latest production > Redeploy) so the key is picked up.
  5. Check: `vercel env ls` shows the name (never the value); Site Settings > Welcome pack shows the online
     questionnaire as live; a test from Email check > "Welcome pack (patient)" has a working TEST questionnaire link.
- **No key rotation in this build.** Answers (and saved drafts) are sealed with that one key. Never change or delete
  it once answers exist: they could not be read back. Rotation would need a re-encryption step that does not exist yet.
- **Age rule** (`src/booking/age.ts`, mirrored in `public/assets/age.js` for Book Now; the test checks they agree):
  `MIN_AGE = 15`, `GUARDIAN_REQUIRED_UNDER = 18`. Age is worked out from the date of birth on the appointment date in
  Sydney. Under 15: refused by Book Now (message plus phone and email, Continue disabled) and by `/api/booking`
  (`fields.dob = 'under_min'`) before any hold; the PayPal order and capture routes also refuse (`age`). 15 to 17:
  `guardianName` required (2 to 120 characters, tidied), saved in `ape_bookings.guardian_name` (additive column);
  refused with `fields.guardian = 'required'` without it. 18 and over: no guardian, and a sent name is not saved.
  Bookings with no DOB (before v1.10.0) are not blocked and show "DOB not given". To change "under 18" to "18 and
  under", set `GUARDIAN_REQUIRED_UNDER = 19` in both files.
- **Under-18 line** in the patient booking email and the welcome email: `content/booking.json` `under18GuardianLine`
  (default true). Team email: "Age at appointment" and "Parent or guardian".
- **Deposit policy version 3**: `DEFAULT_TERMS` is version 2 plus the age sentence (`LORNA_V2_TERMS` keeps version 2).
  The release moves a saved version 2 to version 3 and clears the approval; any other saved wording is left alone.
  Lorna approves it in Site Settings > Deposit policy.
- **Homepage photo**: `v1.13.0-hands-photo` swaps the "Our approach" photo to `ape-textured-napkin` in the saved page,
  unless a Media Library photo is already in that spot.
- **Practice sites pack**: brand, copy blocks, logos, images and screenshots for the Cronulla and Caringbah APE
  sections are in the delivery zip (`handoff/practice-sites/`), not in the repo.

## Pay to book and the confirmation email (v1.12.0)

- **Pay to book** (only when PayPal is set up; without it, requests are taken as before): Book Now's step 3 button is
  **Continue to payment**. The booking is saved with `hold_until` = now + 30 minutes (`core.HOLD_MINUTES`) and nothing
  is emailed. Paying (Book Now, or the webhook as a backup) runs `afterPaid` (`src/booking/paid.ts`): the hold ends and
  the team and patient booking emails go out, saying the deposit is paid (no separate "Deposit received" for these).
  No Pay later button. Starting a payment extends the hold by 15 minutes, never shortens it. Unpaid holds are released
  by `core.releaseHolds` (status cancelled, `cancel_reason` 'not_paid') whenever times are read, a pay link is used or
  the dashboard opens; no scheduled job. A released booking's pay link says so and the order and capture routes
  refuse it (`released`), so nothing is charged; Book Now goes back to the times with a message. Bookings shows
  **Paying now (held until ...)** (no Mark confirmed, not counted) and **Released: not paid** under Cancelled.
  Bookings with no hold (made before PayPal, or chased by the team) keep the 14-day pay link and the usual emails.
- **Confirmation email**: the welcome email is switched on once by the release (`v1.12.0-welcome-email-on`, recorded
  in `ape_meta`, so switching it off later in Site Settings > Welcome pack stays off). Subject "Your APE appointment
  is confirmed" and first line "Your appointment is confirmed for {when}..." (default, or replaced in saved wording
  only where it was unchanged). Sent on Mark confirmed with both PDFs. The online questionnaire stays off.
- Migrations: additive (`hold_until`, `cancel_reason` on `ape_bookings`).

## Deposit policy pop-up, booking sources and Google Analytics (v1.11.0)

- **Four steps again**: time, details, deposit, confirmed. Between the details and the deposit, Lorna's **deposit
  policy pop-up** (`public/assets/policy.js`): her headings and wording from Site Settings > Deposit policy
  (`src/booking/terms.ts`, version 2, approved by Lorna, email of 18 Nov 2026), her tick, and **I Agree & Continue**
  (disabled until ticked; pressing it early explains why). X, Escape and Go back return to the details with
  everything kept. `role="dialog"`, `aria-modal`, labelled by its heading, focus kept inside and returned on close,
  the wording scrolls on small phones and at 200% zoom, no animation with reduced motion. The deposit step shows the
  three pre-v1.10 policy lines again, with no tick. `{deposit}` in the wording is the deposit setting.
- **Recorded**: the booking API refuses a request without `policyAgreed: true` (`fields.policy`); each booking saves
  `terms_version` and `terms_consent_at` (the moment of I Agree & Continue). The pay-later page shows the same pop-up
  unless that booking already agreed to the current version (then "You agreed to our deposit policy on ..."); agreeing
  there saves `terms_pay_read_at` and the version, and `/api/paypal/order/` refuses a booking that never agreed.
  Bookings shows "Deposit policy agreed: [date], version [x]". The patient email has Lorna's 48-hour sentence and a
  link to `/book-now/terms/`.
- **Booking source**: `public/assets/site.js` keeps the first link of the visit in sessionStorage (`ape_src`: utm tags,
  else the referring domain, else direct; no cookie, nothing personal). Saved on the booking (`source`,
  `source_medium`, `source_campaign`), labelled by `src/booking/source.ts`, shown in the Bookings **Source** column,
  the CSV, the team email and the Dashboard box **Where bookings came from (last 30 days)**. Links: `docs/TRACKING-LINKS.md`.
- **Google Analytics 4** (`public/assets/analytics.js`): only when an ID is set (Site Settings > Tracking, or
  `NEXT_PUBLIC_GA4_ID`); ships off. Never on `/admin`, `/cms`, the questionnaire pages or `*.vercel.app`. Addresses are
  cleaned before Google sees them (only `utm_` tags kept, the pay link's `?t=` token removed, `/questionnaire/<link>`
  becomes `/questionnaire/[link]`); event values that look like an email, phone, date or booking reference are
  dropped; Google signals and ad personalisation off. Events: `book_now_view`, `booking_time_selected`,
  `booking_details_completed`, `deposit_policy_agreed`, `deposit_started`, `deposit_paid` (value 100, AUD),
  `booking_submitted` and `generate_lead`, `questionnaire_started` and `questionnaire_sent` (from Book Now),
  `click_to_call`, `click_email`, `outbound_instagram`. Mark `booking_submitted` and `deposit_paid` as **key events**
  in GA4. No Meta Pixel (the Site Settings field remains but outputs nothing).
- **v1.15.0**: Google Analytics now runs through Google Tag Manager (the section above), and this direct tag only
  loads when Tag Manager is switched off. The analytics paragraph for the privacy policy (section 7) is redrafted in
  `docs/FOR-LORNA-v1.15.0.md` and still needs Lorna's approval. Search Console: `docs/SEARCH-CONSOLE.md`.

## PayPal deposit (v1.8.0, cards and wallets v1.10.0)

- v1.10.0: the deposit step says "Pay by card, or with PayPal. You don't need a PayPal account." PayPal's guest
  **Debit or Credit Card** button is requested (`enable-funding=card`); the account must have **PayPal account
  optional** on. With `PAYPAL_ADVANCED=on` the step shows card fields (3D Secure `SCA_WHEN_REQUIRED`, checked before
  capture), Apple Pay and Google Pay, plus the PayPal button, through the same order, capture and webhook
  (`public/assets/pay.js`, shared by Book Now and the pay-later page). Apple Pay's domain file is served from
  `config/apple-pay/` at `/.well-known/apple-developer-merchantid-domain-association` (404 until added).

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
    4. render-site              content/*.json -> public/*.html, sitemap.xml, robots.txt, assets/site-config.js,
                                and the copies with Google Tag Manager in public/live-pages/ (v1.15.0)
    5. qa-site                  every link, anchor, file, structured data, FAQ count; no em dashes
    5b. qa-gtm                  v1.15.0: Google Tag Manager is on every live copy once, and on nothing else
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

Tests (each needs a migrated TEST database in `DATABASE_URL`, never the live one): `npm run test:booking`
(required fields, dates of birth, phone numbers, retention, the deposit policy record and wording, booking sources,
3D Secure decisions, questionnaire access, notification fallback, the mismatch flag; v1.11.0 adds the pop-up
agreement being required, the version and time saved, $ following the deposit setting and the release update; v1.13.0
adds the age rule on both sides, the guardian name, order and capture refusals and the under-18 emails),
`npm run test:questionnaire`, `npm run test:email`.

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
| v1.13.0: the encryption key (Lorna approved the questionnaire on 19 Nov 2026); Lorna ticks who can read questionnaires | Vercel `QUESTIONNAIRE_ENCRYPTION_KEY`; Users screen |
| v1.13.0: Lorna to approve the new wording: deposit policy version 3 (age sentence), "for patients aged 15 and over" on Book Now, the under-15 message, the guardian field and its help text, the under-18 lines (emails and questionnaire), the privacy sentence; and whether 18-year-olds need a guardian | Site Settings > Deposit policy; CHANGELOG 1.13.0 |
| v1.10.0: terms draft, the two tick boxes, the late-cancellation deposit rule, under-18s, privacy and collection notice drafts | `docs/FOR-LORNA-v1.10.0.md`; Site Settings > Booking terms (Draft until approved) |
| v1.10.0: PayPal Advanced Checkout approval, Apple Pay domain file, fees | `docs/PAYPAL-ADVANCED-SETUP.md` (Andy and Ram) |
| v1.15.0: Lorna's approval of the analytics paragraph (Google Analytics through Google Tag Manager); the Google tag's user-provided data detection switched off; the event trigger and tag added in the container | `docs/FOR-LORNA-v1.15.0.md`, `docs/GTM-CONTAINER-RULES.md`, `docs/HOW-TO-SEE-YOUR-NUMBERS.md` |
| v1.11.0: Search Console TXT record at VentraIP and the sitemap | `docs/SEARCH-CONSOLE.md` |
| v1.11.0: tracking links on Instagram, both clinic sites (banner and Book Now tab) and email signatures | `docs/TRACKING-LINKS.md` |
| `npm audit` (18 Nov 2026): 25 advisories, all inside Payload 3.92.1's own dependencies (dompurify in the dashboard's code editor, picomatch in build tooling). Not changed by v1.11.0; fixing them means a Payload upgrade | A separate Payload update, tested on its own |
| Google Business Profile option and admin email | `docs/GOOGLE-BUSINESS-PROFILE.md` |
| Google review link | Site Settings > Google review link (after the profile exists) |
| Google Tag Manager ID (GA4 runs through it; Meta Pixel not used) | Site Settings > Tracking (GYA only). Lorna's approval of the analytics paragraph: `docs/FOR-LORNA-v1.15.0.md` |

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
- [ ] PayPal business account: **PayPal account optional** on (guest card checkout)
- [x] Lorna's deposit policy in place (Site Settings > Deposit policy, version 2, her email of 18 Nov 2026)
- [ ] `QUESTIONNAIRE_ENCRYPTION_KEY` in Vercel (Production and Preview, Sensitive), saved in the password manager, redeployed
- [ ] Lorna approved deposit policy version 3 and the v1.13.0 age wording
- [ ] Lorna approved the v1.10.0 privacy drafts and the v1.15.0 analytics paragraph (`docs/FOR-LORNA-v1.15.0.md`)
- [ ] Tag Manager: user-provided data detection off in the Google tag, checked on Book Now with Tag Assistant (`docs/GTM-CONTAINER-RULES.md`)
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
