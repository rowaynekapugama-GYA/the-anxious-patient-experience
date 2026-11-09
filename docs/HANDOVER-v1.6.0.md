# Handover: v1.6.0, pre-launch (client feedback round 2), 9 November 2026

Update to the existing repo `rowaynekapugama-GYA/the-anxious-patient-experience` (branch `main`, after v1.5.1
`c29748c`). Not a new repo. Lorna has approved going live once these are actioned.

## 1. What this release does

| # | Lorna's request | Done in v1.6.0 |
|---|---|---|
| 1 | Logins for four email addresses | `DASHBOARD_EDITORS` in Vercel; each address gets an Editor login and an email link to choose a password. Forgotten password link on the sign-in page. |
| 2 | Does a booking send an email, and to the APE inbox? | Yes, two emails per booking (audit below). Recipient is `BOOKING_NOTIFY_EMAIL`. Needs an email key and a verified sender before launch. |
| 3 | Stripe and bank details | Bank details stay out of the code. Deposit via a Stripe Payment Link; optional webhook ticks Deposit received. Go-live steps below. |
| 4 | Lauren's photo | In place on the homepage team card: JPG fallback, WebP at 800 and 1086 px with `srcset`, cropped portrait, alt "Lauren Bright, APE Dental Assistant". |
| 5 | QR code would not open | Regenerated: `deliverables/qr/ape-flyer-qr.png` (1000 px, 300 dpi), `ape-flyer-qr-print.png` (about 2000 px), `ape-flyer-qr.svg`. Error correction H. All three scan. |
| 6 | Privacy policy said "awaiting text" | Full policy written for APE: short summary, then Read more opens the full policy (14 sections). The booking form's Privacy Policy link opens it in a new tab, already expanded. Now in the sitemap. |
| 7 | Pre-launch QA | See section 7. |

## 2. Booking emails (plain answer)

Yes. Every booking sends two emails the moment the patient presses send:

1. **To the APE team** at theanxiouspatientexperience@gmail.com: the reference, requested time, fee (and whether it
   is an opening special place), deposit status, the patient's name, email, phone and note, and the next steps.
   Replying to it replies to the patient.
2. **To the patient**: "We have received your booking request", with the time, location, fee, reference and the
   $100 deposit link. Replies go to the APE inbox.

The booking is saved first and shows under Bookings in the dashboard, so even if an email fails nothing is lost.

**The catch**: the email account was never connected in Vercel, so on the current staging site Book Now cannot send
and shows the clinic phone number instead. v1.6.0 sends through **SMTP2GO** (the GYA standard; Resend still works).
To switch it on, add in Vercel:

- `SMTP2GO_API_KEY`: an API key with send permission.
- `BOOKING_FROM`: a sender on a domain verified in SMTP2GO, for example
  `The Anxious Patient Experience <bookings@thecronulladentists.com.au>`. A gmail.com address cannot be the sender
  (Gmail does not allow it and the emails would land in junk). The emails still reply to the APE Gmail.
- `BOOKING_NOTIFY_EMAIL`: `theanxiouspatientexperience@gmail.com`.

Once the APE email account exists (post-launch item a), `BOOKING_FROM` changes to that domain.

## 3. Dashboard logins

- Add in Vercel (Production): `DASHBOARD_EDITORS` =
  `lorna-gladwin1@hotmail.co.uk,reception@thecaringbahdentists.com.au,reception@thecronulladentists.com.au,theanxiouspatientexperience@gmail.com`
- On the next production build each address without a login is added as an **Editor** and emailed "Your login for
  The Anxious Patient Experience website dashboard" with a one-use link to choose a password (72 hours). The build
  log shows a line per address. The email variables in section 2 must be in first, or the logins are created without
  the email (use Users > **Email a password link** afterwards).
- **To change the list later**: edit `DASHBOARD_EDITORS` and redeploy. Removing an address does not delete its login:
  delete it under Users (GYA only). Lorna said these may change, so this is the one place to edit.
- **Forgotten password**: "Forgotten your password?" on the sign-in page.
- Editors can do everything the practice needs (pages, photos, blog, bookings, availability, the special, site
  contact details). Users, Redirects and tracking stay GYA only.

## 4. Stripe go-live steps

Bank details are entered **only** in the Stripe Dashboard by the Stripe account owner. They are not in the repo,
Vercel, the CHANGELOG or any email from GYA. The website does not need the Stripe secret or publishable key: the
patient pays on Stripe's own page (a Payment Link), so no card details or keys ever touch this site.

**Who**: the owner of the Stripe account the deposits go to (per Lorna's email, the Cronulla Dentists Services
entity), with GYA alongside for steps 4 to 7.

1. **Account**: sign in to Stripe (or create the account) under the business that will receive the deposits.
   Complete Settings > Business details (ABN, address, representative) so live payments are switched on.
2. **Payout bank account**: Settings > **Bank accounts and currencies** > Add bank account (AUD). Enter the BSB and
   account number there and finish Stripe's verification. Payouts then arrive on Stripe's schedule.
3. **Statement descriptor**: Settings > Public details: something patients recognise, for example `APE CRONULLA`.
4. **Test mode first**: switch to Test mode. Product catalogue > Add product "APE appointment deposit", one-off
   price $100.00 AUD. Payment Links > New > that product, quantity fixed at 1, collect email. After payment: show the
   confirmation page with a short line, for example "Thank you, your deposit has been received. The APE team will
   confirm your appointment." Copy the link (`https://buy.stripe.com/test_...`).
5. **Test webhook** (optional, recommended): Developers > Webhooks > Add endpoint
   `https://the-anxious-patient-experience.vercel.app/api/stripe/webhook`, events `checkout.session.completed` and
   `checkout.session.async_payment_succeeded`. Copy the signing secret (`whsec_...`).
6. **Vercel (Preview or Production while testing)**: `DEPOSIT_PAYMENT_URL` = the test link, `STRIPE_WEBHOOK_SECRET` =
   the test secret. Redeploy. Make a test booking, pay with card 4242 4242 4242 4242 (any future date, any CVC), and
   check Bookings shows Deposit received and Stripe > Payments shows the reference (`client_reference_id`).
7. **Live**: switch Stripe to Live mode and repeat steps 4 and 5 (live products, links and webhooks are separate).
   Use the final domain in the webhook address once it is set. Replace both Vercel values with the live ones
   (Production only) and redeploy. Cancel the test booking in the dashboard.
8. Refunds and cancellations follow the deposit policy on Book Now and are done by the team in Stripe > Payments.

## 5. Vercel environment variables to add or change

| Variable | Action | Value |
|---|---|---|
| `SMTP2GO_API_KEY` | add | SMTP2GO API key (Sensitive) |
| `BOOKING_FROM` | add | `The Anxious Patient Experience <bookings@VERIFIED-DOMAIN>` |
| `BOOKING_NOTIFY_EMAIL` | add | `theanxiouspatientexperience@gmail.com` |
| `DASHBOARD_EDITORS` | add (Production) | the four addresses, comma separated |
| `DEPOSIT_PAYMENT_URL` | add when Stripe is ready | test link, then the live link |
| `STRIPE_WEBHOOK_SECRET` | add when Stripe is ready | test `whsec_`, then live (Sensitive) |
| `NEXT_PUBLIC_SERVER_URL` | at go-live | `https://the-final-domain.com.au` |
| `ALLOW_FIRST_USER`, `ADMIN_PASSWORD` | delete | not needed |
| `BOOKING_NOTIFY_TO` | delete after adding `BOOKING_NOTIFY_EMAIL` | replaced |

Unchanged: `DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `PUBLISH_HOOK_URL`.

## 6. How the release reaches the live dashboard

The dashboard database already holds the site's content, so a normal deploy would keep the old privacy page and
Lauren's monogram. v1.6.0 adds `scripts/content-updates.ts` (`src/sitekit/releases.ts`), run by the build before the
content is pulled:

- **Privacy policy**: replaced only if the page still holds the "to be supplied" placeholder.
- **Lauren's photo**: replaced only if no photo has been uploaded there in the dashboard; any edits to the team
  wording are kept.

Both are logged in the build and do nothing on later builds. Tested against a copy of the live content with a
dashboard edit in place: both applied, the edit survived, and a second run changed nothing.

## 7. Pre-launch QA (9 Nov 2026, local production build)

- `npm run build`: passes with a database (all steps, including content updates and logins) and without one.
- `npm run qa`: typecheck clean; parity (every page matches v1.4.0 plus the approved photo change); editor parity
  (4 of 4 pages); qa:site (7 pages, no problems); banned words (0 em dashes, 0 new phrases); no secrets.
- Booking end to end in Chromium: pop-up shows (after 9 seconds or 30% scroll), choose a time, details, consent,
  deposit policy, send: saved as an opening special at $250, request email to the APE inbox (Reply-To the patient),
  acknowledgement to the patient (Reply-To the APE inbox) with the Stripe link carrying the reference and email.
- Stripe webhook: wrong signature rejected (400, nothing changed); correct signature ticked Deposit received;
  repeat delivery harmless.
- Logins: four Editor logins created and emailed from `DASHBOARD_EDITORS`; second build sent nothing; preview build
  skipped; forgotten password email, reset page, sign in with the new password, used link refused (403); unknown
  address gets the same message and no email; Editors cannot send password links (GYA only).
- Privacy page at 390 px: no sideways scroll; Read more and Read less by keyboard (Enter and Space) with
  `aria-expanded` following; from the booking form it opens expanded in a new tab.
- Lauren's photo at 1280 px and 390 px: WebP loaded, face framed, no layout shift (width and height set).
- QR: PNG (both sizes) and SVG decode to the URL at error correction H.
- No "awaiting", "lorem", "TBC" or "placeholder" in content or public pages. No bank details anywhere in the repo.

Not testable here, do on staging after the push: real SMTP2GO delivery (and junk folder check at Gmail and Hotmail),
a real Stripe test payment, and an iPhone pass.

## 8. Privacy policy: for Lorna to confirm

Written for APE, in the scope of the Caringbah and Cronulla policies (Privacy Act 1988 and the APPs, the NSW Health
Records and Information Privacy Act 2002, health records retention, overseas providers, website and cookies, data
breaches, access and correction, complaints to the OAIC and the NSW Information and Privacy Commission). Two things
only the practice can confirm: the **legal entity** to name as the provider of APE (the policy currently says APE "is provided at
The Cronulla Dentists"), and **who the Privacy Officer is** (currently reached through
the APE email and the clinic phone). It is editable in Pages > Privacy Policy. Not legal advice: if the practice has
a lawyer or indemnity insurer review its policies, include this one.

## 9. Post-launch items (scoped, not built)

### a. A secure APE email account

- **Recommendation**: Google Workspace Business Starter (about $10 to $11 AUD per user per month) on the APE domain,
  because the team already works in Gmail. Microsoft 365 Business Basic is equal on security and suits a practice
  already on Outlook. One mailbox (for example `hello@`) plus `bookings@` as an alias or group, so no extra licence.
- **Set-up**: buy or confirm the domain; add the MX records; SPF (`v=spf1 include:_spf.google.com
  include:spf.smtp2go.com ~all`, adjusted to the provider), DKIM for both the mailbox provider and SMTP2GO, and DMARC
  starting at `p=none` with reports, moving to `quarantine` after two clean weeks. Two-step verification on for every
  user. Forward or migrate the APE Gmail and keep it running for a few months.
- **Website**: verify the domain in SMTP2GO, then `BOOKING_FROM` = `bookings@` that domain and `BOOKING_NOTIFY_EMAIL`
  = the new inbox; update Site Settings > APE email. No code change.
- **Effort**: about 2 to 3 hours GYA time once the domain is confirmed. **Needed from Lorna**: the domain, provider
  choice, who gets a mailbox, and who holds the admin login.

### b. New Patient Information Pack

- **Online questionnaire**: a form on the website (dashboard-controlled questions) sent with a private link in the
  confirmation email. Answers saved to the Australian database (Neon Sydney), viewed only in the dashboard by
  signed-in team members, never sent by email (the email only says "a questionnaire has been completed for
  APE-XXXXXX"). Needs its own collection notice and consent, and a retention rule that matches the policy.
  Alternatively the questionnaire can live in Core Practice's own forms if it offers them, which keeps the health
  record in one place; worth checking first.
- **Printable version**: a designed PDF of the same questions plus the welcome booklet (what to expect, parking,
  what to bring), downloadable from the confirmation page and email. Brand fonts and colours, A4, printable in mono.
- **Automatic welcome email**: sent when the team presses Mark confirmed (not on request, so nobody gets a pack for a
  time that is not confirmed), with the questionnaire link and PDF. Wording from Lorna.
- **Health data**: sensitive information under the Privacy Act and a health record under the NSW HRIP Act, so:
  stored in Australia, access by named logins only, no health answers in email or analytics, retained per the
  policy (7 years, or until 25 for under 18s), and the Privacy Policy updated before it goes live.
- **Effort**: questionnaire and dashboard view about 2 to 3 days; PDF and booklet design about 1 to 2 days; welcome
  email about half a day. **Needed from Lorna**: the questions and booklet copy, the welcome email wording, whether
  Core Practice forms should be used instead, and sign-off of the updated privacy wording.
