# Changelog

## 1.11.0 (18 Nov 2026): Lorna's deposit policy pop-up, booking sources and analytics

Update to the existing repo (on top of 1.10.0). From Lorna's email of 18 Nov 2026. Two commits: the Next.js security
patch on its own, then this release.

- **Next.js 16.4.6** (from 16.4.4), its own commit: fixes advisory GHSA-mfr8-8qww-v76h.
- **Deposit policy pop-up.** The v1.10.0 terms step and both of its ticks are gone; Book Now is back to four steps
  (time, details, deposit, confirmed) and the introduction says "four simple steps" again (only if the dashboard copy
  still said five). Going from the details to the deposit opens a pop-up with Lorna's wording word for word (Your
  Appointment Deposit, Cancellations and Rescheduling, We're Here to Help) and her tick "I understand and agree to the
  deposit policy, including how my deposit will be applied to my appointment and the conditions under which it may be
  forfeited." **I Agree & Continue** is disabled until ticked; pressing it early (mouse, Enter or Space) explains why.
  X, Escape and Go back return to the details with everything kept. Accessible dialog: `role="dialog"`,
  `aria-modal`, labelled by its heading, focus kept inside and returned on close, the wording scrolls on small phones
  and at 200% zoom, no animation with reduced motion. The $100 comes from the deposit setting.
- **The three policy lines are back** on the deposit step exactly as before v1.10.0 (no tick).
- **Pay-later page** shows the same pop-up before paying, unless that booking already agreed to the current version
  (then "You agreed to our deposit policy on [date]. Read it again").
- **Record.** Each booking saves the policy version and the time of I Agree & Continue (the v1.10.0 fields); the
  pay-later agreement too. The booking and order APIs refuse a booking without the agreement. Bookings shows "Deposit
  policy agreed: [date], version [x]"; the team email says the same.
- **Site Settings > Deposit policy** (was Booking terms) holds Lorna's wording as version 2, recorded as approved by
  Lorna (email of 18 Nov 2026). Still editable; a change makes a new version. If v1.10.0's draft was saved, the release
  replaces it with her wording; any other saved wording is left alone. The preview fills in the deposit and phone.
- **/book-now/terms/** is now "Deposit policy" with her wording.
- **Patient email**: "Cancellations or changes made within 48 hours of your appointment will result in your deposit
  being forfeited. You can read the full deposit policy here: [link]".
- **Booking source.** Book Now remembers the first link of the visit (utm tags, else the referring site, else direct;
  sessionStorage only) and saves it with the booking. New **Source** column in Bookings (and the CSV), "Came from" on
  each booking and in the team email, and a Dashboard box **Where bookings came from (last 30 days)**.
- **Google Analytics 4**, off until an ID is set (Site Settings > Tracking or `NEXT_PUBLIC_GA4_ID`). Never on the
  dashboard, the questionnaire or vercel.app previews. Nothing identifying is sent: addresses keep only utm tags (the
  pay link token is removed, questionnaire links become `/questionnaire/[link]`) and personal-looking values are
  dropped. Events for each Book Now step, the deposit (`deposit_paid` with value 100 AUD), `booking_submitted` (plus
  `generate_lead`), the questionnaire on Book Now, and phone, email and Instagram taps. The Meta Pixel is no longer
  output.
- **Printable questionnaire PDF**: "Full name" and "Date of birth" lines on the first page.
- **Docs**: `docs/TRACKING-LINKS.md`, `docs/SEARCH-CONSOLE.md`, `docs/HOW-TO-SEE-YOUR-NUMBERS.md` (for Lorna) and
  `docs/FOR-LORNA-v1.11.0.md` (the analytics privacy paragraph to approve; not published).
- **Migrations**: additive only (`source`, `source_medium`, `source_campaign` on bookings).
- **Checks**: tsc, clean `npm ci`, a full build that migrated a copy of a v1.10.0 database, `npm run qa`,
  test:booking (125), test:questionnaire, test:email, and Playwright on phone and desktop (86 checks: the pop-up cannot
  be bypassed by button, Enter or a direct request; Escape and Go back keep the details; pay-later pop-up; the record
  and version; source capture; GA receives no token or personal details; GA off with no ID).

## 1.10.0 (17 Nov 2026): required details with DOB, terms panel, card and wallet payments, questionnaire access by Lorna

Update to the existing repo. Includes v1.9.3, v1.9.2, v1.9.1, v1.9.0 and v1.8.4 if main does not have them yet. From
Alex's email of 16 Nov 2026.

- **Required booking details.** First name and last name (separate), email, phone and date of birth are all required
  on Book Now. Phone accepts Australian mobiles and landlines written any common way (spaces, brackets, +61) and is
  saved as `0412 345 678` or `(02) 8599 9815`. Date of birth is day and month selects plus a year box; no future dates,
  nothing over 120 years. Under 18 is not blocked (question for Lorna); the dashboard shows the age and an Under 18
  label. Errors are plain words beside each field with a marker, listed in a summary that takes focus and is
  announced to screen readers. The team booking email and Bookings show first name, last name, phone and date of
  birth with the age; the patient's email does not repeat the date of birth; the GYA delivery check still has no
  patient details. Older bookings keep their single name and show "not given". CSV export has the new columns.
- **Terms and cancellation policy step.** Book Now now has five steps: time, details, **Terms and cancellation
  policy**, deposit, confirmed. The terms show in full (no small scroll box) and state the 48-hour rule; the three
  existing policy lines are word for word, the rest is a draft for Lorna. Tick "I consent to the terms and conditions
  and cancellation policy above." to continue. The deposit step needs "I have read the terms and conditions and
  cancellation policy." before sending; it replaces the old tick "I have read and understand the deposit and
  cancellation policy." Each booking stores the terms version and the time of each tick (shown in Bookings). The
  patient's booking email has a 48-hour reminder and a link to `/book-now/terms/`. The pay-later page shows the same
  terms and needs the same tick (recorded too). Terms are edited in Site Settings > **Booking terms**, versioned, with
  Lorna's approval recorded. Book Now's introduction now says "five simple steps" (applied to the dashboard copy only
  if it still said four).
- **Payments.** The deposit step says "Pay by card, or with PayPal. You don't need a PayPal account." The PayPal guest
  card button was already requested in code (`enable-funding=card`); the account needs **PayPal account optional** on.
  **PayPal Advanced Checkout** is built and switched off (`PAYPAL_ADVANCED=on` to switch on): card fields in the APE
  style with 3D Secure when the bank asks (checked before capture; a failed or unfinished check charges nothing and
  shows a clear message with retry), Apple Pay, Google Pay, and the PayPal button kept. Same server order (custom_id =
  booking reference), capture and webhook; how it was paid is saved and shown. Shared by Book Now and the pay-later
  page (`public/assets/pay.js`). Apple Pay's domain file is served at
  `/.well-known/apple-developer-merchantid-domain-association` from `config/apple-pay/` (404 until added). Set-up:
  `docs/PAYPAL-ADVANCED-SETUP.md`. No Stripe.
- **Questionnaire notifications and access.** Site Settings has **Questionnaire notifications go to** (editors can
  change it; empty uses the booking list). New **Practice owner** flag on a login (GYA only); the migration sets it for
  lorna-gladwin1@hotmail.co.uk if that login exists and logs it. The practice owner sees the Users screen with only the
  "Can view patient questionnaires" tick, for anyone including herself, and the line "Only people ticked here can open
  patient questionnaires. Having a login is not enough." Editors cannot see or change it (screen 404, API 403, Payload
  field admin-only). Every change is logged (who, for whom, when; shown on the Users screen) and the person given
  access is emailed (no patient details). "Lorna nominates / GYA switches it on" wording fixed.
- **Questionnaire name and DOB.** "Your details" at the top: full name and date of birth, filled in from the booking,
  needed to send (drafts save without them), sealed with the answers. The dashboard view, At a glance and Print show
  them, with **Name or DOB differs from the booking** when they do not match (also in the list). Lorna's PDF is not
  changed (ask her to add the lines).
- **Retention.** Questionnaires are kept 7 years after the appointment, or until the patient turns 25 if they were
  under 18 at the appointment, whichever is later (from the booking's date of birth, else the questionnaire's).
- **Database.** Additive only: `ape_bookings` gains first_name, last_name, dob, terms_version, terms_consent_at,
  terms_read_at, terms_pay_read_at, deposit_method; migration `20261117_010000_v1100_terms_owner` adds
  users.practice_owner, the booking terms fields, questionnaires.identity_differs and `ape_access_log`.
- **New environment variables (optional):** `PAYPAL_ADVANCED` (later, not Sensitive), `APPLE_PAY_DOMAIN_ASSOCIATION`
  (optional, not Sensitive).
- **Not on the website yet (drafts for Lorna):** the booking collection notice, the privacy policy's booking section
  and section 14, and the questionnaire collection notice: `docs/FOR-LORNA-v1.10.0.md`.
- **Checks:** `npm run test:booking` (new, 116 checks), `test:questionnaire` (57), `test:email`, `npm run qa`, a
  full build migrating a v1.9.3 database, and browser checks on phone and desktop (107), with PayPal, Apple Pay and
  Google Pay replaced by local stand-ins (the real SDKs cannot load here).

## 1.9.3 (16 Nov 2026): Lorna's questionnaire offered on Book Now, straight after booking

Update to the existing repo. Includes v1.9.2, v1.9.1, v1.9.0 and v1.8.4 if main does not have them yet.

- While the online questionnaire is switched on, the Book Now confirmation offers it: "Your pre-appointment
  questionnaire" with Lorna's line about the form and **Fill in the questionnaire now**. It opens right there on
  the booking page (the questionnaire page in a frame that grows with the form, without a second header or
  footer). Patients can save and finish later, or send it; after sending, the page brings the thank-you into view.
  It is optional and the booking itself is unchanged.
- How: `/api/booking` makes the booking's private questionnaire link when the request arrives (only while the
  online questionnaire is live) and returns its path to the patient's own browser; it is never logged. If the
  welcome email goes at request time it carries the same link. When the welcome email goes later (Mark
  confirmed), it says the questionnaire has already been received if it has; otherwise it gives a fresh link (the
  answers saved so far are kept).
- While the online questionnaire is off (as now), Book Now looks and works exactly as before.
- New copy for Lorna to approve: the heading, the button and "It's optional. You can also save your answers and
  finish them later from the link in your welcome email." The privacy policy's section 14 wording should mention
  the link can also be offered when booking.
- Files: `public/assets/site.js` and `site.css` (Book Now), `src/app/api/booking/route.ts`,
  `src/lib/questionnaire.ts`, `src/app/(site)/questionnaire/[token]/` (`?embed=1`, `EmbedBridge.tsx`).

## 1.9.2 (16 Nov 2026): Lorna's welcome pack PDFs remade in the APE brand, typos corrected

Update to the existing repo. Includes v1.9.1, v1.9.0 and v1.8.4 if main does not have them yet (deploy.sh checks).

- **Patient Guide** and **Pre-appointment Questionnaire** rebuilt as A4 PDFs in the website's brand (navy and
  taupe, Playfair Display and Figtree, the APE logo on the cover and every page), using Lorna's copy as sent. Only
  these were changed:
  - Guide: "move fowards" to "move forwards"; "most importnant" to "most important"; full stop after "it's just
    information"; "We'll take a few plenty of time" to "We'll take plenty of time"; the hidden "Things you can do"
    label in the questionnaire box removed; "Emai:" to "Email:"; "in advance, the street view" made two sentences
    and a full stop after "finding a new place"; curly apostrophes throughout.
  - Questionnaire: numbered 01 to 11 in page order (the last three were 10, 11, 09; now the same as the online
    version); "built in to" to "built into"; "If Yes" to "If yes"; "Pre-Appointment" to "Pre-appointment".
- They replace the files in `public/downloads` (same names), so the welcome email attaches them and the
  dashboard's Welcome pack screen shows them as the standard version ("Use the standard version" goes back to
  them). The online questionnaire gets the same two wording fixes.
- Sources in `design/welcome-pack/` (HTML and CSS); `npm run pack:pdf` rebuilds both and stops if any page's
  content would run into its footer. Not part of the website build.
- The guide keeps Lorna's "11–13 Cronulla Street"; the website says 13 Cronulla Street (still to confirm).

## 1.9.1 (16 Nov 2026): Users screen laid out as cards

Update to the existing repo. Includes v1.9.0 and v1.8.4 if main does not have them yet (deploy.sh checks).

- **Users** (GYA only) was an eight-column table, so emails, dates and buttons were squeezed into narrow columns.
  Each login is now a card: who they are (initials, name, email, role and questionnaire access at a glance), how
  their login is going (Signed in, Last login email, Password, each on its own line), the settings (Role, and Can
  view patient questionnaires as a switch), and the buttons along the bottom with Delete set apart on the right.
  A line above the list counts logins, who has signed in, who has not yet and who can view questionnaires.
- Two columns on a laptop, one on a phone; no sideways scrolling and no wrapped buttons at any width.
- Nothing else changes: same buttons, same actions, same Add a user window. No migration, no new environment
  variables.

## 1.9.0 (16 Nov 2026): Lorna's welcome pack and questionnaire, ready to switch on

Update to the existing repo. Includes v1.8.4 if it is not on main yet (deploy.sh checks). From Lorna's email of
15 Nov 2026 and her two PDFs.

- **Lorna's PDFs**: `public/downloads/ape-patient-guide.pdf` and `ape-pre-appointment-questionnaire.pdf`, loaded
  as she sent them, served `noindex`. Either can be replaced from Site Settings > Welcome pack (Media Library
  picker) and switched back to the original. The two v1.7.0 placeholder PDFs are removed.
- **Online questionnaire**: Lorna's questionnaire word for word, laid out like her PDF (intro, every question,
  helper lines, shaded notes, thank-you). 1 to 10 scale (5 + 5 on a phone), tick boxes with Other opening a text
  box, question 03 under its three subheadings, Yes/No with the "If yes" box only after Yes, single choice for 09
  and 10, free text. Nothing required, 07 marked Optional, Clear buttons, keyboard and screen reader labels.
  Numbered 01 to 11 in page order (her 10, 11 and 09 are 09, 10 and 11 here). "Circle" reads "Choose".
- **Save and finish later**: answers saved on the private link, encrypted like sent ones
  (`/api/questionnaire/save`), filled back in when the patient returns.
- **Welcome email** with both PDFs attached, the address, Lorna's train and parking directions and the phone
  number; the private link only while the online questionnaire is on. Sent once on Mark confirmed (or on request,
  if chosen). New **Send welcome pack** button on confirmed bookings; Bookings shows a Welcome pack column.
  Drafted wording for Lorna to approve, editable on the Welcome pack screen with a preview.
- **Switches** (Site Settings > Welcome pack, GYA only, both off): Send the welcome email; Online questionnaire,
  which needs `QUESTIONNAIRE_ENCRYPTION_KEY` and the collection notice marked approved (changing the notice clears
  the approval). `QUESTIONNAIRE_ENABLED` is now only an emergency off switch (`false`).
- **Dashboard view**: At a glance (score, what makes them anxious, question 03 preferences), every answer in
  Lorna's order with follow-ups, Print. Questions and emails moved to the Welcome pack screen (the old address
  redirects there). Site Settings links to it instead of holding the send rule and notification list.
- **Tests**: Email check sends the real welcome email (both PDFs) with a TEST questionnaire link; test rows are
  marked TEST, listed apart for GYA, never counted with real ones, and deleted after 24 hours.
  `npm run test:questionnaire`: 53 checks. Playwright: 55 checks on desktop and phone.
- Migration `20261116_012208_v190_welcome_pack` (additive only). Booking columns `welcome_*` added by the booking
  schema check. No new environment variables; `QUESTIONNAIRE_ENCRYPTION_KEY` is needed only to switch the online
  questionnaire on.


## 1.8.4 (16 Nov 2026): adding a user sends the invite, Cronulla location check, website QR code

Update to the existing repo (after v1.8.3 on main). From Lorna's email of 15 Nov 2026.

- **Add a user now sends the invite.** Users > Add a user used to create the login straight through Payload
  (`POST /api/users` from `UsersEditor.tsx`) with a temporary password and send nothing. It now goes through
  `/api/dashboard/users`, which creates the login and emails the invite (72 hour link) through the logged sender,
  and the screen shows Sent or Not sent straight away. An address that already has a login is never duplicated:
  the screen says "This person already has a login" and offers Send login email again. No temporary passwords.
- Users shows when each person last signed in (recorded from this release on) and when the login was added.
- **Website QR code**: `public/qr/ape-website-qr.png` (2009 px), `.svg` and `.pdf` (A4, 8 cm code), encoding
  exactly https://theanxiouspatientexperience.com.au/ (level Q, navy #2A3C4E, 11.3:1 contrast). A QR code panel on
  the dashboard home downloads all three; the build adds the PNG and PDF to the Media Library once.
- **Cronulla location**: checked every place the site gives a location (Book Now, booking emails, footer, privacy
  policy, map link, structured data, FAQs, pop-up). All already say The Cronulla Dentists, Cronulla; no Caringbah
  on any public page. One difference with Lorna's Patient Guide left for approval: the site says 13 Cronulla Street,
  the guide says 11-13 Cronulla Street.
- Build: before migrations, `scripts/sync-sequences.mjs` moves the migrations id counter ahead of its rows if a
  copied or restored database left it behind (found in testing: the new migration then failed to record itself).
- Migration `20261116_010034_v184_last_login` (one column, additive). No new environment variables.

## 1.8.3 (13 Nov 2026): login and booking emails reach the right inboxes, plus an email check screen

Update to the existing repo (after v1.8.2 `6e6cc7c` on main). Asked 13 Nov 2026: make sure Lorna gets the login and
password reset emails, the team gets an email for every booking, and test it with Rowayne's inbox.

### Found
- Payload's own `/api/users/forgot-password` was open with no email adapter: it wrote reset links (with the token)
  to the server log and replaced any unused invite link. Closed, with Payload's email now sent through SMTP2GO and
  GraphQL switched off.
- The forgotten-password limit was kept in memory, so it reset with each Vercel instance; reset links lasted 72 hours.
- No email was logged or retried, and a failed booking email was only visible in the Vercel log.
- Logins that already existed when `DASHBOARD_EDITORS` was added got no email from the build.

### Changed
- Every email goes through `deliver()` (`src/lib/mailer.ts`) and is logged (`ape_email_log`, 90 days, no message
  bodies, links or tokens).
- Password reset: single use, 1 hour, same answer for any address, 5 an hour per address (database), signs you in,
  and a new "Your password was changed" email after a reset or a change.
- Users (GYA): **Send login email again** (fresh 72 hour link) and the last login email with its status.
- Booking emails: Site Settings > **Who receives booking emails** is now editable by the practice and read live (no
  publish), with fallbacks `BOOKING_NOTIFY_EMAIL`, `BOOKING_NOTIFY_TO`, then the APE inbox in the code. Filled once
  with the address booking emails already went to. Team subjects start with the reference
  ("New booking request APE-XXXXXX, ..."). Deposit and questionnaire notices go to the same list; the questionnaire
  notice no longer carries a first name.
- GYA delivery check for each booking (reference, time, accepted or failed; no patient details), Site Settings
  toggle (GYA only), on by default, to rowayne@gyaclients.com unless changed.
- A failed booking email is retried once after a minute, then shows an amber **Email not sent** flag in Bookings
  with **Resend to patient** / **Resend to team**, and GYA gets an alert. New Emails column with ticks.
- **Site Settings > Email** (`/admin/settings/email`, GYA only): set up, who gets what, last 50 sends with filters,
  and **Send test emails** ([TEST], sample details, only to the address typed, 3 runs an hour).
- Dashboard home: "Emails: working" or the number failed in the last 7 days.
- `npm run test:email` (SMTP2GO stand-in, test database) and `docs/EMAIL-TEST.md` for the live test.
- Database: `ape_email_log`, `ape_rate` and three booking columns (created by the site, additive), and migration
  `20261113_070622_v183_email_settings` (two Site Settings columns, additive). No new environment variables.

## 1.8.2 (13 Nov 2026): Team opens its own screen, and the homepage deep link works

Update to the existing repo (after v1.8.1). Reported 13 Nov 2026: "The team page on the dashboard is not functioning.
It's redirecting to the home page when you click it."

### Why it looked broken
- The Team menu item was only a link to the Home page editor (`/admin/pages/<home>?section=team`), and the menu never
  highlighted Team there (it highlighted Pages), so it looked like being sent to the homepage.
- The editor only scrolled to the team on its first load, so asking for the team while the Home editor was already
  open did nothing, and it never selected the section.
- Signing in from a dashboard link always landed on the dashboard home, losing where the link pointed.

### What changed
- **Team screen** at `/admin/team` (like the Precision Dental Team editor): the homepage team cards in order, each with
  photo, name, role, Edit, hide or show, remove and a drag handle. The side panel edits photo (library, upload or the
  original), photo description, name, role, every bio paragraph and any button, using the same fields as before.
  **Add a team member** adds a card built like the others. Warnings for a lone last card on the row of three, for
  "specialist" (blocks saving) and for the AHPRA words. Save changes and Publish website work as everywhere else, and
  the unsaved changes warning works when leaving.
- The Team screen edits the homepage's own team section (no second copy), so an edit on either screen shows on the
  other. A hidden card stays in the section markup between `<!--pd:hidden-->` markers and is never rendered.
- **Edit on the homepage** opens the Home editor at `?section=team`: it scrolls to the team, flashes it, opens the
  Sections tab and highlights the Team row, on first load and whenever the address asks again.
- Signing in from a dashboard link now returns to that link (`/admin/login?next=...`, dashboard addresses only).
- Files: `src/dashboard/team.ts`, `src/dashboard/editors/TeamEditor.tsx`, `src/app/api/dashboard/team/route.ts`,
  `src/app/(dashboard)/admin/(app)/team/page.tsx` (new); `PageEditor.tsx`, `Shell.tsx`, `(app)/layout.tsx`,
  `lib/server.ts`, `login/page.tsx`, `AuthForms.tsx`, `src/proxy.ts`, `src/lib/parts.ts`, `src/dashboard/render.ts`,
  `src/dashboard/pages.ts`, `dashboard.css`, `scripts/qa-banned.mjs`, `docs/HOW-TO-UPDATE.md`, README.
- No change to the public site until someone edits the team (qa:parity and qa:editor byte for byte), and none to
  Bookings, Availability, Opening special, Questionnaires, the Review page or PayPal. No new environment variables.

## 1.8.1 (11 Nov 2026): dashboard switch display fix

Update to the existing repo. Found while taking screenshots for the dashboard guide.

- Dashboard on/off switches (Opening special > Settings and the pop-up, and the questionnaire settings) showed with
  the switch hidden and a white dot over the first letters of the label. Fixed in `src/dashboard/dashboard.css`
  (one line). No change to the public website, the database or the environment variables.

## 1.8.0 (11 Nov 2026): the $100 deposit paid through PayPal inside Book Now

Lorna's email of 11 Nov 2026 (Andy is setting up the PayPal business account) and Rowayne's brief. Update to the
existing repo (after v1.7.0 `4b868fa`, the build that went live on theanxiouspatientexperience.com.au). The deposit
moves from a Stripe Payment Link to **PayPal Checkout built into the booking flow**, so the team never has to open
PayPal to check a deposit: it shows in the dashboard and in the emails.

### What changed
- **Book Now**: after the booking request is sent, the same step shows "Pay your $100 deposit", the deposit and
  cancellation terms (verbatim, as before) and the PayPal buttons (PayPal, or debit/credit card as a guest). The
  server creates the order (Orders v2, amount from `content/booking.json`, `custom_id` = booking reference,
  description "The Anxious Patient Experience deposit", brand name set, shipping off) and captures it on approval;
  the booking is marked **Deposit received** with the PayPal capture id, and "Deposit received" emails go to the
  patient and the APE inbox. **Pay later** or a closed window leaves the booking **Not paid**; the patient's email
  and the confirmation screen carry a private **Pay your deposit** link (`/book-now/pay/?t=...`, 14 days or until
  paid, noindex, no-store). The browser never sets an amount; it only passes the booking's pay token.
- **Webhook** `/api/paypal/webhook`: verified with PayPal's verify-webhook-signature against `PAYPAL_WEBHOOK_ID`,
  idempotent by event id (`ape_paypal_events`). `PAYMENT.CAPTURE.COMPLETED` marks paid (backup for the capture
  call), `PAYMENT.CAPTURE.DENIED` marks failed, `PAYMENT.CAPTURE.REFUNDED` marks **Refunded**. A forged or unsigned
  event gets 400 and changes nothing; a replay changes nothing.
- **Dashboard**: deposit status on every booking (Not paid, Received, Received (manual), Refunded, Failed), a
  **Deposit not paid** filter, the PayPal transaction and **View in PayPal** on the booking row, **Mark received
  manually** with a note (refused over a PayPal payment) and Undo, a **Deposits not paid** count on the home screen.
  Mark confirmed and the welcome email are unchanged.
- **Switch-over safety**: without `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` the deposit step is not offered and
  Book Now behaves exactly as v1.7.0 (checked). Stripe code removed (`src/lib/stripe.ts`, `/api/stripe/webhook`).
- **Database**: new columns on `ape_bookings` (`deposit_status`, `deposit_amount`, `deposit_paid_at`,
  `deposit_note`, `paypal_order_id`, `paypal_capture_id`, `pay_token_hash`, `pay_token_expires`) and the
  `ape_paypal_events` table, added on first use like the rest of the booking tables; existing ticked deposits
  become "manual".
- **Logo files** for PayPal in `brand/paypal/` (square 1000 and 250, horizontal 1200 x 400, header 750 x 90, small
  190 x 60; PNG and JPG), exported from the 512 px master (no vector original exists), with a note on which goes
  where. Also delivered as `ape-logo-files-2026-11-11.zip`.
- Docs: `docs/PAYPAL-SETUP.md` (for Andy, including the safe hand-over of credentials), `docs/TEST-BOOKING.md`
  rewritten for PayPal, README, `docs/HOW-TO-UPDATE.md`, `.env.example`; `docs/GOOGLE-BUSINESS-PROFILE.md` records
  theanxiouspatientexperience@gmail.com as the listing's Primary owner (GYA stays on as Manager).

### Vercel environment variables
Add (Preview = sandbox app, Production = live app): `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
(Sensitive), `PAYPAL_WEBHOOK_ID`. Delete once PayPal is live: `DEPOSIT_PAYMENT_URL`, `STRIPE_WEBHOOK_SECRET`.
Everything else as v1.7.0.

### Checked
`tsc` clean; `npm ci && npm run build` from the zipped tree without PayPal variables; `npm run qa`; banned-words and
secret scans clean (the PayPal secret appears nowhere in the repo or the client bundle). Against a local stand-in for
PayPal's API and JS SDK: booking and payment in the flow (PayPal and card buttons), cancel then Pay later, payment
through the emailed link in a fresh browser, used and wrong links refused, repeat capture and repeat order with a
used token refused, both "Deposit received" emails, webhook forged/unsigned 400 with no change, completed replay no
change and no email, refund marks Refunded, refund replay ignored, denied marks Failed, manual mark and the refusals
over PayPal payments; with no PayPal variables Book Now behaves as v1.7.0. Real sandbox and live runs follow
`docs/TEST-BOOKING.md` once Andy's credentials are in.

## 1.7.0 (11 Nov 2026): pop-up on first open, domain prep, New Patient Information Pack, Google review page

Lorna's email of 10 Nov 2026 and Rowayne's reply. Update to the existing repo (after v1.6.0 `20532bd`). Lorna's
questionnaire and welcome pack are still to come, so that system ships built, tested and **switched off**, with
clearly marked placeholders.

### What changed
- **Offer pop-up shows on first open.** Cause: it only fired after 9 seconds or 30% scroll, and once shown it was
  remembered in localStorage for ever, so anyone who had seen it once (Lorna had) never saw it again. Now: about 0.8
  seconds after the homepage is interactive, no scroll needed, once per browser session, not again for 7 days after
  it is closed, every storage call wrapped (private mode and in-app browsers still get it once per page view, no
  errors). Focus moves in, Esc and close work, focus returns, the page behind does not scroll. Only on the homepage.
  New dashboard settings under Opening special: special on/off, pop-up on/off, dates, **Show the pop-up after
  (seconds)** (default 0.8), heading and wording with `{price}`, `{regular}`, `{dates}`; saved in `ape_meta`
  (`special`), applied straight away. The offer wording states the price, what is included and the dates, with no
  urgency words (unchanged).
- **Domain prepared, no DNS changed**: `docs/GO-LIVE-DOMAIN.md` (Vercel domains, VentraIP records, keep MX/SPF/DKIM
  untouched, nameserver check, links to update, SMTP2GO domain-sending option for later, go-live checklist). Origin
  now follows `NEXT_PUBLIC_SERVER_URL`, else the preview's own address, else Vercel's production address; **preview
  deployments render noindex with `Disallow: /`** by environment. Dashboard SEO previews show the real domain. QR codes
  regenerated for `theanxiouspatientexperience.com.au` (the vercel.app code kept as `*-staging`), plus a review page QR.
- **New Patient Information Pack** (off until `QUESTIONNAIRE_ENABLED=true`): welcome email on Mark confirmed (or on
  request, Site Settings), welcome pack attached and linked, private one-use questionnaire link valid to 7 days after
  the appointment, questionnaire pages in the site's style with no analytics, answers validated, **encrypted
  (AES-256-GCM, `QUESTIONNAIRE_ENCRYPTION_KEY`)** and stored in Neon, notification email with reference, first name and
  date only, dashboard Questionnaires (list, open laid out like the form, Print, Reviewed, GYA-only Delete with typed
  confirmation, access log), **Can view patient questionnaires** per-user permission (off for everyone by default,
  every view and refusal logged), Questionnaire column and Resend welcome email in Bookings, count on the Dashboard,
  Questions and emails editor (sections, questions, types, collection notice, thank-you, welcome email, welcome pack
  PDF upload), Site Settings: send when, notification list. Retention 7 years or to age 25. Placeholder questionnaire
  and welcome pack PDFs in `public/downloads/`. Collection notice and consent tick on the form; privacy policy gains
  section 14 on the questionnaire (for Lorna to approve). Payload migration `20261111_013051_v170_questionnaire`.
- **Google review page** `/review/`: noindex, out of menus, footer and sitemap. Every star and the button open the same
  "Taking you to Google now" pop-up (progress bar, Go now, fallback link) and go to the one **Google review link** in
  Site Settings after about 1.5 seconds; no rating stored or branched on; private feedback line shown to everyone
  first; "coming soon" while the link is empty. Editable as a page (menu: Review page). Added to the live dashboard
  by a release update.
- **Stripe**: unchanged Payment Link approach confirmed (reference already passed as `client_reference_id`);
  `docs/TEST-BOOKING.md` step-by-step test with a results table.
- **Google Business Profile**: `docs/GOOGLE-BUSINESS-PROFILE.md` (existing-profile check, eligibility options with a
  recommendation for a practitioner listing, paste-ready AHPRA-compliant content, set-up and hand-over steps). Nothing
  created or submitted.
- Media Library accepts PDFs (for the welcome pack); the photo grid shows images only.
- Docs: README, `docs/HOW-TO-UPDATE.md` (questionnaires, access, reviews, the pop-up settings), `.env.example`.

### Vercel environment variables
New: `QUESTIONNAIRE_ENABLED` (leave unset until approved), `QUESTIONNAIRE_ENCRYPTION_KEY` (32 bytes base64, Sensitive,
never change once answers exist, back it up). At go-live: `NEXT_PUBLIC_SERVER_URL=https://theanxiouspatientexperience.com.au`.
Still outstanding from v1.6.0: `SMTP2GO_API_KEY`, `BOOKING_FROM`, `BOOKING_NOTIFY_EMAIL`, `DASHBOARD_EDITORS`;
delete `ALLOW_FIRST_USER`, `ADMIN_PASSWORD`, `BOOKING_NOTIFY_TO`.

### Checked
`tsc` clean; `npm ci && npm run build` with the flag unset and set to true; `npm run qa` passing; Chromium: pop-up on
first load (desktop 1061 ms, mobile), not again after dismissal, again after 8 simulated days, once per session,
with storage blocked, never on Book Now, privacy, review or questionnaire pages, no console errors; booking, Mark
confirmed, welcome email with the PDF attached, questionnaire submitted at 390 px with no horizontal scroll, link
refused afterwards, notification without answers, raw row unreadable, access refused and logged without the
permission, decrypted with it, Reviewed, log; review page: all five stars and the button same link, redirect at
about 1.5 s, Esc cancels, fallback link, coming soon with no link, noindex, not in sitemap, no rating branching;
banned-words and secrets scans clean, no em dashes.

## 1.6.0 (9 Nov 2026): pre-launch, client feedback round 2

Lorna's email of 9 Nov 2026 and Rowayne's brief "Client feedback round 2". Update to the existing repo. Lorna has
approved going live once these are done. Full handover: `docs/HANDOVER-v1.6.0.md`.

### What changed
- **Dashboard logins from a list**: `DASHBOARD_EDITORS` (Vercel, comma separated). Each production build adds any
  address without a login as an Editor and emails a link to choose a password (one use, 72 hours). Never deletes.
  (`scripts/dashboard-logins.ts`, build step.) Set to Lorna's four addresses.
- **Forgotten password** on the sign-in page (`/admin/forgot-password`, `/admin/reset-password`), and **Email a
  password link** for each person under Users (GYA only). Same message whether or not an address has a login; one
  email per address every 2 minutes. Reset links clear "must change password".
- **Emails through SMTP2GO** (the GYA standard) or Resend: `src/lib/email.ts`. Used by booking emails and password
  links. Booking request recipient now `BOOKING_NOTIFY_EMAIL` (`BOOKING_NOTIFY_TO` still read). Audit: every booking
  emails the APE inbox and the patient; on staging neither could send because no email key was ever set.
- **Stripe webhook** (optional): `POST /api/stripe/webhook`, signature checked with `STRIPE_WEBHOOK_SECRET`; a paid
  Checkout session with an `APE-XXXXXX` reference ticks Deposit received. No Stripe API keys in the site. Bank details
  are entered in the Stripe Dashboard only and appear nowhere in the repo.
- **Lauren's photo** (supplied 9 Nov): `team-lauren-bright-2026-11-09.jpg` 1086 x 1448, WebP at 800 and 1086 px,
  `<picture>` with `srcset`, framed at 45% 22%. Alt text unchanged.
- **Privacy Policy** written for APE (it said "to be supplied"): a summary, then **Read more** opens the full policy
  in 14 sections (button with `aria-expanded`; without JavaScript it all shows). Now indexed and in the sitemap. Lorna
  to confirm the legal entity and Privacy Officer. New `{{site:apeEmailLink}}` token; legal page styles in `site.css`.
- **Booking form**: the Privacy Policy link in the consent line opens in a new tab (so the booking is not lost) with
  the full policy already open (`#privacy-more`). Any link to `#privacy-more` opens it.
- **QR code** regenerated: `deliverables/qr/` 1000 px PNG (300 dpi), about 2000 px PNG and SVG, error correction H,
  opening the vercel.app address with UTM tags. `qr/make-qr.py` writes all three.
- **Release content updates** (`scripts/content-updates.ts`, `src/sitekit/releases.ts`): the build puts the new
  privacy policy and Lauren's photo into the live dashboard content only where the client has not changed them, then
  leaves them alone.
- Other legal links checked: the site has only the Privacy Policy (no Terms or Cookie pages); footer, booking form and
  sitemap all link to it.
- Docs: README (env table, logins, email audit, Stripe), `docs/HOW-TO-UPDATE.md` (signing in, forgotten password, who
  can sign in, deposit ticking itself), `.env.example`, `docs/HANDOVER-v1.6.0.md`.

### Vercel environment variables
Add: `SMTP2GO_API_KEY`, `BOOKING_FROM` (sender on a domain verified in SMTP2GO), `BOOKING_NOTIFY_EMAIL`
(`theanxiouspatientexperience@gmail.com`), `DASHBOARD_EDITORS` (the four addresses, Production). When Stripe is
ready: `DEPOSIT_PAYMENT_URL`, `STRIPE_WEBHOOK_SECRET`. At go-live: `NEXT_PUBLIC_SERVER_URL`. Delete:
`ALLOW_FIRST_USER`, `ADMIN_PASSWORD`, and `BOOKING_NOTIFY_TO` once the new one is in. Unchanged: `DATABASE_URL`,
`PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `PUBLISH_HOOK_URL`.

### Checked
`npm run build` with and without a database; `npm run qa` all passing; end-to-end in Chromium against a copy of the
live content: pop-up, booking with both emails, Stripe webhook (good and bad signature), logins and password reset,
privacy page at 390 px with keyboard Read more, Lauren's photo at desktop and mobile, QR files decoding. Details in
the handover, section 7.

## 1.5.1 (4 Nov 2026): dashboard sign-in card centred

- The sign-in card at `/admin/login` sat left of centre on wide screens when it showed the "Create the first login"
  notice (the notice's long line widened the column). The column is now always the card's width, so the card is
  centred at every width. "Built and supported by GYA" is now in the warm brand tone. Dashboard only; the website is
  unchanged. (`src/dashboard/dashboard.css`)

## 1.5.0 (4 Nov 2026): the GYA standard client dashboard, with online booking built in

Rowayne, 4 Nov 2026: build the standard dashboard now so the client can see the process with the booking dashboard
(nothing is live yet). Update to the existing repo. **The website looks and reads exactly as v1.4.0**: an unedited
build gives back the v1.4.0 pages byte for byte (`npm run qa:parity`).

### What changed
- **Dashboard at `/admin`**, ported from the GYA standard (Precision Dental v3.7 / Tooth n Care v2.1): sign in with
  your own email and password (GYA administrators and practice Editors), Dashboard home, Pages with the visual page
  editor (click words to edit in place, click a photo to replace it, Content / SEO / Sections tabs, Desktop and
  Mobile), Blog Posts, Media Library, Team (opens the homepage at the team cards), SEO, Site Settings, Redirects and
  Users (GYA only), Publish website. Payload's own screens moved to `/cms` (GYA only).
- **Booking screens inside it** (replace the v1.4.0 password page at `/admin/`):
  - Bookings: To confirm / Upcoming / Past / Cancelled, Mark confirmed, Deposit received, Cancel (with a check),
    Restore, patient notes, CSV download, a count of requests to confirm beside the menu item and on the Dashboard.
  - Availability: block a period, a day or a single time; a list of the next weeks with every time's status (open,
    booked with the patient's name, blocked, too soon); clash warning naming anyone already booked; and **the weekly
    booking days and start times can now be changed** (straight away on the website), with "Use the standard times".
  - Opening special: places used and left, whether it is showing on the website, the special bookings.
- **Pages are built from `content/`** (the content model the dashboard edits) by `scripts/render-site.ts`. The site is
  now a Next.js project on Vercel (`vercel.json` sets the framework); the public pages are still plain HTML files.
- **Booking API** moved from `api/*.js` (v1.4.0) to Next.js routes with the same addresses, rules and responses:
  `/api/availability/`, `/api/booking/`. Same database tables; the special is still decided in one locked step.
- **Site Settings**: phone, the two email addresses and the clinic address, written into the footer, Book Now, the
  structured data and the booking emails; GYA only: who receives booking requests, GA4 and Meta Pixel IDs.
- **Canonical and share links** now use the site's own address (the vercel.app address until `NEXT_PUBLIC_SERVER_URL`
  is set at go-live) instead of the `https://example.com` placeholder.
- **FAQ structured data** is now written from the questions on the page, so an edited question updates it too.
- **Blog**: `/blog/` and one page per post, in the Privacy Policy page's layout, only once a post is published; the
  Blog link then joins the menus and footer. Small styles added to `site.css` for posts.
- `docs/HOW-TO-UPDATE.md` replaces `HOW-TO-USE-THE-BOOKING-DASHBOARD.md` (bookings, availability, the special, words,
  photos, sections, SEO, posts, settings, publishing). Screenshots in `docs/screenshots/`.
- Removed: `admin/`, `api/`, `assets/admin.*`, `ADMIN_PASSWORD` (no longer used). `assets/` and `images/` moved to
  `public/`.

### New wording for sign-off (dashboard only, not on the website)
Dashboard labels and help text on the Bookings, Availability and Opening special screens, and `docs/HOW-TO-UPDATE.md`.
The booking emails now say "mark it confirmed under Bookings in the website dashboard (/admin)" instead of
"in the APE dashboard (/admin/)".

### Vercel: needed before pushing (see README)
Blob store (`BLOB_READ_WRITE_TOKEN`), `PAYLOAD_SECRET`, `PUBLISH_HOOK_URL`, `ALLOW_FIRST_USER=true` for the first login
only. The build stops if `DATABASE_URL` is set without `PAYLOAD_SECRET`.

### Checks run
- `qa:parity`: the 4 pages rendered from `content/` match v1.4.0 byte for byte (apart from the old `<!-- config -->`
  markers). Import into the dashboard then pull back out: `content/` identical.
- `qa:editor`: every page in the editor is identical to the live page once the editor's markers are removed
  (174 pieces of wording, 8 photos, 8 links).
- `qa:site`, `qa:banned` (no em dashes; AHPRA words reviewed), `qa:secrets`, `tsc` clean, `next build` clean.
- Full build against a local Postgres: migrate, first-build import, pull, render, build; the dashboard driven in a
  browser: first login, home, page editor (edit and save a heading, photo panel, Sections, Mobile, SEO, footer words,
  menu note), Team link, Media upload and photo import, blog post published and built into `/blog/`, Site Settings
  change built into the footer, Publish website calling the deploy hook, a new Editor with a temporary password
  (must change it; no Redirects or Users; refused at `/admin/users`, `/admin/redirects` and `/cms`).
- Booking: a booking from Book Now arrives under Bookings with both emails sent; confirm, deposit, cancel (time and
  special place freed on the website), restore; leave blocking, clash warning, single time block and open, weekly
  times changed and put back. Eight requests for the same time at once: one saved, seven refused. Eleven special
  times booked at once with one place already used: exactly five at $250, six at $350.
- Dashboard at phone width (390 px): no sideways scrolling on any screen.

## 1.4.0 (3 Nov 2026): final bios, Alex's photo, pricing, opening special, booking dashboard, QR code

Lorna's email of 3 Nov 2026 and Rowayne's notes (pop-up for the offer; a dashboard for availability; the offer must
come down by itself after two weeks or once the places are filled). Update to the existing repo. Design unchanged.

### Changes

**Team**
- Alex Loupos: Lorna's final bio, word for word, with "Read more" like Lorna's. Role line "APE Lead | Patient Care &
  Support". Photo `images/team-alex-loupos-2026-11-03.webp` + `.jpg` fallback (987 x 1593), lazy-loaded, framed on
  her face.
- Lauren Bright: final bio, word for word, with "Read more". Role line "APE Dental Assistant | Patient Care & Support".
  Photo pending: a soft "L" monogram in the brand colours at **`images/team-lauren-bright.jpg`**. Replace that one
  file (same name, portrait about 1200 x 1500, face in the top third) and nothing else changes. Team photos are now
  served with `must-revalidate`, so a replaced photo shows straight away.
- "Meet Alex" / "Meet Lauren" lines are not used as headings: the cards sit under "Meet the Team" and already carry the
  names, as Lorna's card does.

**"Talk to Alex" softened** (every instance: 2 buttons on the homepage, 1 button and 1 section label on Book Now)
- Buttons now read "Reach out to Alex" and go to the contact details in the footer.
- "Alex is happy to talk it through with you." is now "Alex, our APE Lead, is happy to talk it through with you."
- Book Now: "Not ready to book yet? Talk to Alex first..." is now "Not ready to book yet? Reach out to Alex, our APE
  Lead, first. There is no pressure and no need to have the right words."

**Pricing**
- FAQ "How much does it cost?": "The New Patient Appointment is 70 minutes and costs $350. Health fund rebates are
  available. A $100 deposit is required to secure your booking." (FAQ schema updated.)
- Book Now card: "70 minutes | $350", "Health fund rebates available", "$100 deposit required to secure the
  appointment".
- Every time on Book Now shows its fee in the summary ("Fee: $350. Health fund rebates available." or "Fee: $250
  opening special (usually $350). Health fund rebates available."), and so do the confirmation screen and both emails.
- Deposit: no payment account hard-coded. `DEPOSIT_PAYMENT_URL` (a Stripe Payment Link or similar) switches on
  "Send request and pay deposit" and a "Pay your $100 deposit" button with the reference filled in. Until it is set:
  "Send booking request" and "Deposit details will be sent with your confirmation." The old test-mode note is gone.

**Opening special** ($250 for the first six patients, appointments Wed 2 Dec to Tue 15 Dec 2026)
- A quiet ribbon under the homepage hero buttons, a calm pop-up (once per visitor), a note in the cost FAQ, a card on
  Book Now with ~~$350~~ $250, and an "Opening special $250" label on those days in the booking list.
- Automatic: shows only while a special-priced time is still free. Hides by itself once six special bookings exist or
  the special days are under 24 hours away. Counted in the database inside the same locked step that saves each
  booking, so it can never go past six. A cancelled special booking frees its place.
- Settings: `openingSpecial` in `assets/site-config.js` (price, dates, cap, pop-up on/off, enabled).
- The $100 deposit still applies to the special. No "places left" count is ever shown (no urgency wording).
- With three times on each Wednesday, the window holds exactly six times, so the cap and the dates end together unless
  a day is blocked.

**Booking**
- APE appointments start Wednesday 2 December 2026 (`booking.startDate`). Earlier Wednesdays are no longer offered.
- Bookings are saved in Neon Postgres. A time that has been requested disappears from Book Now, so two patients can no
  longer ask for the same time. The 24-hour rule, the start date, blocked days and the special are all checked again
  on the server.
- If the notification email fails, the booking is still saved and shows in the dashboard.

**Booking dashboard at `/admin/`** (password `ADMIN_PASSWORD`)
- Bookings: confirm, mark deposit received, cancel (frees the time), restore; tabs for To confirm, Cancelled, Past.
- Availability: block a period of leave, a single day or a single time, and open them again. 23 and 30 December 2026
  are blocked from the first use.
- Opening special: places used and whether it is showing.
- "How to" page and `docs/HOW-TO-USE-THE-BOOKING-DASHBOARD.md` for Lorna.
- Sign-in: 12-hour session cookie (HttpOnly, Secure, SameSite=Strict), 8 wrong attempts lock sign-in for 15 minutes,
  every change needs the dashboard's own header. noindex, not in the sitemap, blocked in robots.txt.

**QR code**: `qr/ape-flyer-qr.png` (2015 px) and `qr/ape-flyer-qr.svg`, navy on white, error correction H, encoding
`https://the-anxious-patient-experience.vercel.app/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch`.
`qr/make-qr.py` regenerates it for the final domain (one-line command in the README).

**Also**: GA4 and Meta Pixel slots (`analytics` in the settings, empty), new files `api/availability.js`,
`api/admin.js`, `api/_lib/core.js`, `admin/index.html`, `assets/admin.css`, `assets/admin.js`,
`docs/HOW-TO-USE-THE-BOOKING-DASHBOARD.md`, `qr/`; one dependency (`@neondatabase/serverless`).

### New copy needing the client's sign-off
1. Ribbon: "OPENING SPECIAL $250 for our first six patients (usually $350)".
2. Pop-up: eyebrow "Opening special"; heading "A gentle welcome for our first six patients"; "$350 $250" (struck
   through); "To welcome our first patients, the full 70-minute Anxious New Patient Experience is $250 instead of $350
   for appointments on Wednesday 2 December or Wednesday 9 December 2026. Health fund rebates are still available, and
   a $100 deposit secures your time."; buttons "See available times" and "Maybe later".
3. FAQ note: "Opening special: for our first six patients, the full appointment is $250 instead of $350, for
   appointments on Wednesday 2 December or Wednesday 9 December 2026. Health fund rebates are still available, and the
   deposit still applies."
4. Book Now card: "OPENING SPECIAL $350 $250 for our first six patients, for appointments on Wednesday 2 December or
   Wednesday 9 December 2026. Health fund rebates are still available."
5. Pricing lines: "Health fund rebates are available." (FAQ), "Health fund rebates available" (Book Now card), fee
   lines as above.
6. Booking: "Send booking request", "Send request and pay deposit", "Deposit details will be sent with your
   confirmation.", "After you send your request, you can pay the $100 deposit securely online.", "Pay your $100
   deposit", "The payment page opens in a new tab. Your reference is filled in for you.", "Sorry, that time has just
   been requested by someone else. Please choose another time.", "Sorry, we could not load the available times just
   now. Please refresh the page, or contact the clinic on (02) 8599 9815."
7. "Alex, our APE Lead," (two places) and "Reach out to Alex".
8. Patient email: now includes "Fee: ..." and either "To secure your time, please pay your $100 deposit here: [link]"
   or "A $100 deposit secures your appointment. Deposit details will be sent with your confirmation."
9. Book Now hero (approved copy, unchanged): "Book your first appointment and pay your deposit online in four simple
   steps." This is only true once the deposit link is set up. Suggest changing it if the site launches without one.
10. The dashboard wording (for the APE team only).

### Still pending
- Lauren's photo (replace `images/team-lauren-bright.jpg`).
- Ram's deposit account: create a $100 payment link and add it as `DEPOSIT_PAYMENT_URL` in Vercel.
- Final domain: the QR code uses the vercel.app address; regenerate before printing large runs.
- Vercel set-up: Neon, `ADMIN_PASSWORD`, Resend (`RESEND_API_KEY`, `BOOKING_FROM`), then a test booking.
- Privacy policy text (the booking form now stores personal details).
- GA4 ID, so the flyer UTM tags can be seen.
- Repo still public; should be private.

### Environment variables
Required: `DATABASE_URL` (Neon, added by Vercel Storage), `ADMIN_PASSWORD`, `RESEND_API_KEY`, `BOOKING_FROM`.
Optional: `BOOKING_NOTIFY_TO` (defaults to the APE inbox), `BOOKING_BCC`, `DEPOSIT_PAYMENT_URL`.

### Checked
39 server tests (pricing in and out of the window, the cap of six, a cancelled special reopening, blocked days and
single times, the 24-hour rule, the start date, no database, the deposit link) and 68 browser tests (homepage ribbon,
pop-up once per visitor, Read more on all three bios, Alex's photo and Lauren's placeholder, Reach out to Alex, booking
at 375, 768, 1280 and 1440 with $250 and $350 times, 23 and 30 Dec not offered, the special hiding itself once full,
the dashboard at desktop and phone width, payment link mode, no database). No horizontal scroll at 320 to 1920, no
console errors. Lighthouse mobile: home 95 performance / 100 accessibility, Book Now 98 / 100. Vercel build ok (three
functions, each with the settings file and the Neon driver).

## 1.3.1 (26 Oct 2026)

Meet the Team only. No change to copy, layout, booking or the other images.

- Dr Lorna Gladwin's new photo: `images/team-lorna-gladwin-2026-10-26.webp` (1086 x 1448, as supplied) replaces
  `team-lorna-gladwin.webp`, which is deleted. New file name so browsers and Vercel show it straight away.
- Framing: centred on her face on desktop; on phones and tablets the small portrait beside her name is gently zoomed
  to head and shoulders (the previous zoom was set for the old landscape photo). Alt text unchanged.
- This also closes the open item about the old portrait's scrubs reading "Godwin".

## 1.3.0 (26 Oct 2026): Round 4 client updates

Delivered as `ape-website-v4-2026-10-26.zip`. Lorna's email of 26 Oct 2026, plus a full audit of every earlier
request. The design, palette, type, spacing and motion are unchanged.

### Part A: new changes

**A1. Imagery: Lorna's five images.** Every stock image with a face is gone (hero calm smile, aligner smile,
toothpaste smiles, braces smile, brushing demo, the old share image). The only faces left are the team's own photos.
No clinic rooms, chairs or treatment spaces.

| Image | Where | Why there |
|---|---|---|
| `ape-armchair-corner` | Hero | As suggested |
| `ape-candle-book` | The heart of the experience | Keeps the warm, calm mood straight after the hero |
| `ape-hands-comfort` | Our approach, "We work with it" | As suggested |
| `ape-toothbrushes-eucalyptus` | Who is The Anxious Patient Experience™ for? | The homepage has no photo spot near "What happens after I book?" (it is an FAQ card), so it sits here instead |
| `ape-textured-napkin` | Book Now hero | As suggested |

- Five images for what were six photo spots, so "What if your dental care started with understanding your anxiety
  first?" is now a two-tone quote band (the same style as the site's other quote sections) instead of text beside a
  photo.
- `ape-candle-book`: the book's cover and spine carried a legible third-party title. It has been removed, so the
  book reads as plain white at every size. Nothing else in the photo was changed.
- Each image: WebP at 800, 1400 and 2400 px wide plus a 1400 px JPG fallback, in a `<picture>`. Hero and Book Now
  images are preloaded; everything below the fold is lazy-loaded. The two cooler photos (hands, toothbrushes) have
  the site's gentle warm grade; the other three are as supplied.
- New share image `social-share-armchair.jpg` (1200 x 630).
- Alt text: armchair "A soft cream armchair beside a small wooden table with a white vase of olive branches and a lit
  candle, in warm afternoon light"; candle "A lit candle in a glass resting on a plain white book, beside a stone vase
  of dried flowers"; hands "One hand resting gently on another over a soft white blanket"; toothbrushes "Bamboo
  toothbrushes in a glass jar beside a sprig of eucalyptus and folded white towels"; napkin "A textured cream napkin
  with a small tooth outline, resting on soft draped fabric".
- On phones the photos stay moderate (full column width, landscape crop) and always follow the section's heading and
  text.

**A2. Practice and contact details** (footer on every page and the Book Now page), all from `assets/site-config.js`:
The Cronulla Dentists, 13 Cronulla Street, Cronulla NSW 2230 (linked to Google Maps), (02) 8599 9815
(`tel:+61285999815`), theanxiouspatientexperience@gmail.com labelled "APE enquiries", and
reception@thecronulladentists.com.au labelled "General practice enquiries". The address replaces 11–13 Cronulla
Street everywhere. New `Dentist` JSON-LD on the homepage and Book Now, with the APE as a department. Staging stays
noindex (the `X-Robots-Tag` header on `*.vercel.app`).

**A3. Booking requests to the APE inbox** (no Core Practice connection). Same flow and design: choose appointment,
details, deposit, confirmation.

- New `api/booking.js` (Vercel serverless function, Resend). It checks the request again on the server (Wednesday,
  9:00 / 10:20 / 11:40 am Sydney time, at least 24 hours away, within six weeks, required fields, both tick boxes),
  emails the request to the APE inbox and sends the patient an acknowledgement. Hidden spam field. No keys in code.
- 24-hour rule: times under 24 hours away (Sydney time) are never shown, and the server refuses them too. The note
  now gives the number: "Need an appointment within the next 24 hours? Please contact the clinic directly on
  (02) 8599 9815 so we have time to properly prepare for your visit."
- Form kept minimal (name, email, optional phone, optional note). New collection notice tick box (see New copy).
- Deposit stays in **test mode**: no payment is taken. Provider and deposit handling still to be confirmed.
- Deposit and cancellation policy still sits directly above the payment button with the required tick box (approved
  copy wording, which matches the three points in the brief).
- Confirmation: "You've already taken the hardest step." is kept, with the new line underneath.
- Appointment title stays "The Anxious Patient Experience™: New Patient Appointment" (colon rather than a dash, per
  the site's no-dash style), 70 minutes | $350, $100 deposit.

**Environment variables to add in Vercel** (Settings > Environment Variables, Production and Preview, then redeploy):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | from Resend (required) |
| `BOOKING_FROM` | a sender on a Resend-verified domain, e.g. `The Anxious Patient Experience <bookings@yourdomain.com.au>` (required) |
| `BOOKING_NOTIFY_TO` | `theanxiouspatientexperience@gmail.com` |
| `BOOKING_BCC` | leave empty (optional) |

Until the first two are set, the last step shows the send-failure message with the clinic's phone number.

### New copy needing client sign-off

1. Confirmation screen, under "You've already taken the hardest step.": **"The APE team will be in touch to confirm
   your appointment and send your new patient information pack."**
2. The confirmation heading is still the approved "You're booked in.", but bookings are now confirmed by hand.
   Suggest Lorna considers a softer heading (for example "We've received your request."). Not changed without her
   sign-off.
3. Collection notice tick box (details step): "I agree to the APE team using these details to arrange my
   appointment, as set out in the Privacy Policy." Error: "Please tick this box so we can arrange your appointment."
4. Footer labels: "APE enquiries", "General practice enquiries".
5. 24-hour note: "...contact the clinic directly on (02) 8599 9815..." (number added).
6. Booking messages: "Sending your request…"; "Sorry, we could not send your booking request just now. Please try
   again, or contact the clinic on (02) 8599 9815."; too-soon message now ends "...or contact the clinic directly on
   (02) 8599 9815."; test-mode note "Test mode: no payment is taken. Your booking request is still sent to the APE
   team."
7. Patient acknowledgement email. Subject "We have received your booking request | The Anxious Patient
   Experience™". Body: "Hi [first name], / Thank you for your booking request for The Anxious Patient Experience™
   New Patient Appointment. / Requested time: [day, date, time] (Sydney time) / Location: The Cronulla Dentists,
   13 Cronulla Street, Cronulla NSW 2230 / Reference: [APE-XXXXXX] / The APE team will be in touch to confirm your
   appointment and send your new patient information pack. No deposit has been taken yet. / If anything changes or
   you have a question, simply reply to this email or call us on (02) 8599 9815. / Warm regards, The Anxious Patient
   Experience™ team"
8. Internal request email to the APE inbox (not patient facing): subject "APE booking request: [day, time], [name]
   ([reference])", all details, and "Next step: block this time in Core Practice, then reply to the patient to
   confirm the appointment and send the new patient information pack."

### Part B: audit of earlier requests

✅ already correct · 🔧 fixed now · ⚠️ needs input

| # | Request | Status | Notes |
|---|---|---|---|
| 1 | Hero button "Discover the Experience ↓", next section only | ✅ | Down arrow is an icon; goes to `#intro` |
| 2 | Eyebrow "A GENTLER WAY TO BEGIN DENTAL CARE" | ✅ | |
| 3 | Nav order, anchors, filled Book Now, sticky both ways, menu closes, offsets | ✅ | Headings clear the header at 375, 768, 1280 and 1440 |
| 4 | First mention reads "The Anxious Patient Experience™ (APE)" | 🔧 | "(APE)" was on the What is... line, but the intro band mentions the brand first. Moved to the intro band |
| 5 | Quote section, verbatim | ✅ | Now a two-tone quote band |
| 6 | "We don't ask you to ignore that response. We work with it." | ✅ | |
| 7 | Nervous-system wording, verbatim | 🔧 | Words were right but split into two paragraphs; now one, as in Lorna's email |
| 8 | Appointment wording, verbatim | ✅ | In What is..., replacing the 7 Oct "During the appointment, the focus is..." paragraph, as her 13 Oct email asked |
| 9 | Meet the Team: three members, initials tiles, Read more | ✅ | ⚠️ Alex's and Lauren's bios and photos, and Lorna's softer photo, still to come |
| 10 | Footer disclaimer, verbatim, invasive line removed | ✅ | |
| 11 | FAQ "What happens after I book?", verbatim | ✅ | Second in the list |
| 12 | Continuous scroll, gentle motion, reduced motion respected | ✅ | |
| 13 | Intro flows into Understanding | ✅ | |
| 14 | What is The Anxious Patient Experience™?, verbatim; no sedation in Understanding | 🔧 ⚠️ | 🔧 First line now "The Anxious Patient Experience™ begins with..." (see 4). ⚠️ The round 4 brief quotes the 7 Oct "During the appointment, the focus is..." paragraph, which Lorna replaced on 13 Oct with item 8; item 8 is kept. Confirm she does not want both. No sedation in Understanding ✅ |
| 15 | Who It's For, verbatim | ✅ | |
| 16 | Lorna's bio, verbatim; smaller, softer photo on phones | ✅ | |
| 17 | FAQ headphones, verbatim | ✅ | |
| 18 | FAQ sedation, verbatim | ✅ | |
| 19 | Opening lines and cornerstone statement | ✅ | |
| 20 | Triggers, physical responses, "not always a conscious..." | 🔧 | Added "People you don't know" and "Lack of control" from her 22 Sep brief (the printed copy had cut them off). Physical responses all present. Closing line uses the approved "This is not always a conscious choice." |
| 21 | What we do differently, incl. additional support/sedation | ⚠️ | Six cards. The sedation card was removed at Lorna's request on 7 Oct ("I want to take the sedation bit out of this"); sedation is covered in Who It's For and the FAQ. Not re-added |
| 22 | FAQ list | ✅ | All 11 |
| 23 | Ready for future additions | ✅ | Plain folders and sections; see README "Later additions" |
| QA | No console errors; build passes | ✅ | |
| QA | 375, 768, 1280, 1440: nav, anchors, menu, booking | ✅ | Plus a keyboard-only booking |
| QA | Lighthouse mobile | ✅ | Home: performance 97, accessibility 100. Book Now: 99, 100 (hero subline taupe darkened slightly for contrast) |
| QA | ™ renders as text, never "™️" | ✅ | |
| QA | Staging noindex | ✅ | |

### Files

New: `api/booking.js`, `.env.example`, the ten `ape-*` WebP files, five `ape-*.jpg`, `social-share-armchair.jpg`.
Changed: `index.html`, `book-now/index.html`, `privacy-policy/index.html`, `404.html`, `assets/site-config.js`,
`assets/site.css`, `assets/site.js`, `scripts/build.mjs`, `vercel.json`, `.gitignore`, `package.json`,
`package-lock.json`, `README.md`, `CHANGELOG.md`. Removed: the seven old photos.

## 1.2.5 (15 Oct 2026)

Footer disclaimer only, per Lorna's 15 Oct email. No change to copy, images, layout or booking.

- Removed the "Any invasive procedure carries risks..." line from the footer on every page
  (SHOW_INVASIVE_RISK_DISCLAIMER is now false in assets/site-config.js). It is only needed if the site shows before
  and after photos; the wording stays in the settings file so it can be switched back on.
- The footer keeps Lorna's preferred disclaimer, unchanged.

## 1.2.4 (15 Oct 2026)

Meet the Team, at Rowayne's request. No change to copy, images or booking.

- Dr Lorna Gladwin's bio now shows its first paragraph with a "Read more" button underneath. It opens the rest of the
  bio and her quote with a gentle slide, and changes to "Read less". Works the same on phones, tablets and desktop.
- Keyboard and screen reader friendly (a real button with aria-expanded). With reduced motion it opens without
  animation; without JavaScript the full bio shows.

## 1.2.3 (15 Oct 2026)

Images only, at Rowayne's request. No change to copy, layout, styles or booking.

- The heart of the experience: home-heart-sensory.webp to home-heart-aligner-smile.webp (a young woman smiling and
  holding a clear aligner).
- Our approach: understanding-our-approach.webp to understanding-approach-braces-smile.webp (a smiling girl with
  braces).
- Same gentle warm grade as the other photos; new alt text, width and height; old files deleted.

## 1.2.2 (15 Oct 2026)

Images only. Per Lorna's feedback, every image that showed a room or interior a patient could mistake for the practice
is replaced with an object or detail image. No change to copy, layout, styles or booking.

- Hero: home-hero-lamp.webp to home-hero-calm-smile.webp (a woman smiling at home).
- "What if your dental care started...": understanding-window-seat.webp to toothpaste-smile.webp.
- Who is The Anxious Patient Experience™ for?: faqs-hero.webp to brushing-demo.webp.
- Book Now hero: book-now-hero.webp to book-now-toothpaste-smile.webp (tighter crop).
- Share image: social-share-lamp.jpg to social-share-toothpaste-smile.jpg (og:image and twitter:image on every page).
- Kept (objects or details, not places): home-heart-sensory.webp, understanding-our-approach.webp, Lorna's portrait.
- New photos have a gentle warm grade, new alt text and correct width and height; replaced files deleted.

## 1.2.1 (14 Oct 2026)

- Fixes the Vercel deploy of 1.2.0, which stopped with "No Output Directory named public found". Now that the site
  has a build step, Vercel publishes the `public` folder, so `npm run build` copies the finished site there
  (scripts, package files and notes are left out). `public/` is added to `.gitignore`. No change to any page.

## 1.2.0 (13 Oct 2026)

Lorna's revisions of 13 Oct 2026. Client copy used word for word.

- Hero: the small line now reads "A GENTLER WAY TO BEGIN DENTAL CARE". The main button is now "Discover the
  Experience" and moves down to the very next section only (the introduction), so the story reads from the start.
  Book Now beside it is unchanged.
- Navigation: The Experience, Who It's For, Meet the Team, FAQs and a filled Book Now button. The header is now fixed
  and always visible, scrolling down or up (it no longer hides). Every section a link lands on clears the header.
  The phone menu has the same five items and closes after a tap.
- First mention of APE now reads "The Anxious Patient Experience™ (APE)" (opening line of What is The Anxious
  Patient Experience™?).
- Quote: "What if your dental care started with understanding your anxiety first? / Then built an experience around
  what you need."
- Our approach: new evidence-informed wording under "We don't ask you to ignore that response. We work with it."
  (two paragraphs). Appointment paragraph in What is The Anxious Patient Experience™? replaced. No other copy on the
  site repeated or contradicted the old wording (FAQs and meta descriptions checked).
- Meet the Team: three people in this order: Dr Lorna Gladwin (Creator of The Anxious Patient Experience™), Alex
  Loupos (APE Lead), Lauren Bright (Dental Assistant). Even columns on desktop, stacked on phones. Lorna's bio and
  photo unchanged. Alex and Lauren show "Bio coming soon" and soft initials placeholders until their bios and photos
  arrive.
- Imagery: every image that looked like a dental clinic was replaced with non-dental lifestyle imagery: hero
  (home-hero.webp to home-hero-lamp.webp), The heart of the experience (home-heart-of-the-experience.webp to
  home-heart-sensory.webp), the quote section (understanding-hero.webp to understanding-window-seat.webp) and the
  share image (social-share.jpg to social-share-lamp.jpg). The Meet the Team reception banner (meet-the-team-hero.webp)
  is removed and marked as the spot for Cronulla clinic photos. Old files deleted.
- Footer: the client's preferred disclaimer, with the existing invasive procedure line kept below it for now
  (switch: SHOW_INVASIVE_RISK_DISCLAIMER in assets/site-config.js). Footer links match the new navigation.
- Booking: The Cronulla Dentists, 11–13 Cronulla Street, Cronulla NSW 2230. Wednesdays at 9:00 am, 10:20 am and
  11:40 am. 24-hour minimum notice (Sydney time), checked when times are listed, before each step and before
  payment. New note near the booking button: "Need an appointment within the next 24 hours? Please contact the clinic
  directly so we have time to properly prepare for your visit."
- FAQs: new "What happens after I book?" (second, after "Am I suitable..."), added to the FAQ schema. 11 questions.
- New settings file assets/site-config.js (contact details, disclaimer switch, clinic, booking times and notice) and
  a build step (npm run build: scripts/build.mjs, no dependencies) that writes the settings into every page and checks
  links, anchors, images, structured data and the FAQ count.
- site.css and site.js links bumped to ?v=1.2.0.

## 1.1.1 (9 Oct 2026)

- Phones and tablets: photos, headings and cards that slide in from the side now finish exactly in place. Before
  this fix they stopped 20px short on screens 900px wide and under, so some sat against the screen edge or were
  pushed off the right side (Lorna's and Alex's photos, the Understanding headline, several photos and cards).
- Phones: the small portraits in Meet the Team keep their soft rounded bottom corners.
- Header links have a larger tap area on touch screens. The underline position is unchanged.
- Checked on every page at 320, 360, 375, 390, 414, 768 and 1024 px wide with motion on: nothing off the edge,
  no sideways scrolling, every section finishes its animation.
- site.css and site.js links bumped to ?v=1.1.1.

## 1.1.0 (8 Oct 2026)

Follow-up changes from Dr Lorna Gladwin's feedback of 7 Oct 2026. Visual design unchanged.

- Continuous scroll: the site is now one homepage you read top to bottom. The page turns, Continue and Back, the
  bottom bar and the per-page progress bar are gone. Order: Hero, intro, The heart of the experience, quote,
  Understanding the experience, the nervous system, Our approach, What we do differently, Who is The Anxious Patient
  Experience™ for?, closing quote, Meet the Team, FAQs, Book Now.
- Gentle motion, triggered by scrolling only: sections fade up, photos and cards slide in from the side, and cards,
  trigger chips and key panels settle in with a soft pop, one after another. Each plays once. The hero fades in
  without moving. Reduced motion: no animation at all. Without JavaScript everything shows.
- Header: logo, Understanding the Experience, Meet the Team, FAQs and a quiet Book Now. It sits on the page at the
  top, steps out of the way while you read down and comes back, softly frosted, when you scroll up. The section
  you are in is underlined. Phones: Book Now plus a menu button. A hairline scroll progress line runs across the top
  of the homepage.
- Hero: the main button is now "Understand the experience" and leads down into Understanding. Book Now stays beside
  it as a quieter link.
- Understanding opens with the new "What is The Anxious Patient Experience™?" copy, word for word, with
  "70-minute Anxious New Patient Experience" in bold. The old Understanding headline ("What if your dental care
  started with understanding your anxiety first?") now leads into the nervous system section.
- Sedation removed from Understanding: the "Additional support where clinically appropriate" card and the two notes
  ("Sedation is one option, not the whole plan." and "Is this approach enough on its own?") are gone. What we do
  differently is now six cards, three and three.
- New "Who is The Anxious Patient Experience™ for?" section after What we do differently, word for word.
- Meet the Team: Lorna's new role and bio, word for word. On phones her photo is now a small, soft portrait beside
  her name so the words lead. Alex's photo placeholder matches.
- FAQs: new answers for "Can I use headphones or choose what I watch or listen to?" and "Is sedation available?",
  word for word (FAQ schema updated and moved to the homepage). The swipeable FAQ cards are kept. "Still have a
  question?" is now a light strip under the cards.
- Old page addresses (/understanding-the-experience/, /meet-the-team/, /faqs/) now forward to the matching section
  of the homepage (noindex, canonical to the homepage). sitemap.xml lists the homepage and Book Now only.
- Book Now: booking flow unchanged (four steps, $100 deposit, policy tick-box, test mode). New header, bottom bar
  removed.
- site.css and site.js links bumped to ?v=1.1.0.

## 1.0.9 (30 Sep 2026)

- Patient journey: scroll snapping is gone. Each page now turns like a book, one section at a time, with a slow, soft
  sideways slide (about one second). The visitor sets the pace: Continue and Back in the bottom bar, the progress bar,
  a sideways swipe on phones, the left and right arrow keys, or simply scrolling on past the end of a section. Nothing
  moves unless the visitor asks, and each scroll or swipe turns one section only.
- Going back is never blocked: scrolling or swiping the other way turns back straight away (only the leftover
  momentum of the gesture that just turned the page is ignored). Back is labelled in the bottom bar on larger screens,
  and the bounce at the top of the page is switched off on phones so a pull down always goes back.
- Sections longer than the window (Understanding cards, booking flow, text-heavy screens on small phones) scroll as
  normal first, then turn when you carry on past the end.
- Continue on the last section of a page leads to the next page in the journey: Home, Understanding the Experience,
  Meet the Team, FAQs, Book Now.
- The logo shows on the first section of each page; the footer shows after the last section.
- "Talk to Alex" turns to the last section and brings the contact details into view. Links to a section (for example
  /understanding-the-experience/#screen-4) open on that section.
- Reduced motion, or no JavaScript: one ordinary scrolling page with every section and the footer showing.
- site.css and site.js links bumped to ?v=1.0.9.

## 1.0.8 (30 Sep 2026)

- FAQs redesigned so the questions and answers fit one calm screen instead of a long accordion list. On desktop a
  numbered question index sits beside a large answer card; choose a question, or use the arrows, to change the card.
  On phones and tablets the answers are a deck of cards you swipe left and right (the next card peeks in), with
  Previous and Next arrows and a "1 / 10" counter. Swiping up or down still moves between screens.
- The cards use a native horizontal scroll-snap track, so swipe, trackpad and the arrow keys all work. Without
  JavaScript every question and answer shows as a plain list. Copy is unchanged, word for word, and the FAQ schema is
  untouched.
- site.css and site.js links bumped to ?v=1.0.8.

## 1.0.7 (29 Sep 2026)

- Phones: a swipe now always moves on to the next screen. Snapping is firm on every page (no more resting halfway
  between two screens), each screen is its own snap stop, and a short or slow swipe that would have settled back on
  the same screen glides on to the next one (passive touch listeners only, nothing is blocked).
- Screens taller than the window (Understanding cards, booking flow, FAQs, and the text-heavy screens on small phones)
  get reading stops about 80% of a window apart, ending with the screen's bottom edge, so swiping reads through them
  without skipping content.
- Progress bar shows whole segments: every screen you have reached is filled, the rest are empty. Only a screen taller
  than the window fills gradually while you read it.
- Booking: "Choose a time" and every booking step land on the booking panel, and snapping relaxes while a form field
  is in use so the keyboard never hides the field.
- site.css and site.js links bumped to ?v=1.0.7.

## 1.0.6 (29 Sep 2026)

- Every page is now a calm, screen by screen journey: each section fills the screen, and the page snaps to the next
  one with native CSS scroll snapping (no scroll-jacking; wheel, trackpad, touch and keyboard all work as normal).
- Screen map as briefed: Home 5 screens, Understanding 8, Meet the Team 4, Book Now 3, FAQs 3. Copy regrouped only,
  never reworded. The Home "Explore at your own pace" pathway cards are removed; their links now live in the bottom bar.
- Gentle reveals: each screen fades up when half in view; key points appear one by one about 0.7 seconds apart with a
  slow one second ease. Reveals play once, and anything reached with the keyboard shows at once.
- Header is the logo only, shown larger on the first screen and scrolling away with it (no sticky bar). The top menu,
  burger and mobile menu are gone.
- New bottom bar on every page: a progress bar with one clickable segment per screen, then Understanding the
  Experience, Meet the Team, FAQs and the Book Now pill. An underline slides in on hover and stays on the current
  page. On phones the three links sit behind an "Explore" button.
- Footer logo is larger. images/ape-logo.webp re-exported at 256px so the bigger logos stay sharp on high-resolution
  screens.
- Screens that can be taller than the window (Understanding cards, Book Now booking flow, FAQs, and the text-heavy
  screens on small phones) grow and scroll naturally, and the page switches to gentle proximity snapping.
- Reduced motion: no animation, no smooth scrolling, no snapping. Without JavaScript all content shows and the page
  scrolls normally.
- site.css and site.js links bumped to ?v=1.0.6.

## 1.0.5 (29 Sep 2026)

- Understanding, What we do differently: removed the Sensory support photo card; the seven cards are now the same
  size in a 4 + 3 layout with the second row centred (2 per row on tablet with the last card centred, 1 per row on
  mobile), and the descriptions line up across each row.
- Hover effect on every card sitewide: cards lift slightly with a soft shadow and taupe border; the icon circle turns
  tan on the What we do differently cards. Hover only on devices with a mouse; no lift when reduced motion is on.
- Fixed pathway card hovers that were slowed by the scroll reveal animation.
- Header stays on one line between tablet and desktop widths (the practice name beside the logo hides below 1100px).
- Caching: site.css and site.js links now carry a version number and are always rechecked, so layout changes show
  straight away. Fonts stay cached for a year, images for a day. (1.0.4 cached site.css for a year, which is why the
  photo card showed in the wrong place.)
- Removed images/understanding-sensory-support.webp.

## 1.0.4 (29 Sep 2026)

- All page photos replaced with the supplied set (The Anxious Patient Images): Home hero, The heart of the experience,
  Understanding hero, Our approach, Book Now hero.
- New photos added: Meet the Team hero, FAQs hero, and a Sensory support photo in the Understanding card grid.
- Understanding hero frame changed to landscape (same as Book Now) to suit the new photo.
- Real logo file replaces the CSS logo tile in the header and footer; logo added to the organisation schema and as a
  phone home screen icon.
- Social share image (1200 x 630 JPG) used on every page, with width, height and alt tags.
- Removed the old images: home-hero-lamp, home-heart-sofa, understanding-hero-curtains, understanding-approach-mug,
  book-now-nook.

## 1.0.3 (29 Sep 2026)

- Delivered as a plain HTML, CSS and JavaScript site with no build step, so it deploys to Vercel without Node or
  TypeScript (Framework Preset: Other).
- Booking flow, FAQ accordion, mobile menu and scroll reveals rewritten in plain JavaScript (`assets/site.js`).
- Fonts and images served locally from `assets/fonts` and `images`.
- Added `vercel.json` (clean URLs, trailing slashes, noindex on `*.vercel.app`, caching and security headers).
- No design preview banner (that was only on the review HTML files).

## 1.0.2

- Understanding the Experience hero (curtains) and approach (mug) images added.

## 1.0.1

- Lorna's bio and portrait updated (sand studio background).

## 1.0.0

- First full build of all pages, word for word from the approved copy doc.
