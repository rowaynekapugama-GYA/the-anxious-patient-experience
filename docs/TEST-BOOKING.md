# Test booking script: deposit, booking emails, welcome pack and questionnaire

For the test Lorna asked for once Stripe is connected. Run it first on the preview address with Stripe in **test
mode**, then once on production with the live link and a real $100 payment that the Stripe account owner refunds
from the Stripe Dashboard. Fill in the results table and send it to Lorna.

## How the deposit works (unchanged from v1.6.0, confirmed 11 Nov 2026)

- The site holds **no Stripe keys**. The patient pays on a **Stripe Payment Link** (`DEPOSIT_PAYMENT_URL` in Vercel).
- The booking appends `client_reference_id=APE-XXXXXX` (the booking reference) and `prefilled_email=` to that link,
  so every payment in Stripe carries the booking it belongs to. Stripe shows it on the payment and in the
  `checkout.session.completed` event. This is the cleanest match Payment Links allow, and it was already in v1.6.0.
- Optional but recommended: the webhook `POST https://<site>/api/stripe/webhook` with `STRIPE_WEBHOOK_SECRET` in
  Vercel. A paid session with an `APE-` reference ticks **Deposit received** on the booking by itself. Without the
  webhook, the team ticks it by hand after checking Stripe.
- Bank payout details, the Stripe account and the Payment Link are set up by the account owner in the Stripe
  Dashboard (steps in `docs/HANDOVER-v1.6.0.md`, section 4). GYA never asks for, pastes or stores keys or bank details.

## Before you start

| Need | Preview test | Production test |
|---|---|---|
| Email | `SMTP2GO_API_KEY`, `BOOKING_FROM`, `BOOKING_NOTIFY_EMAIL` in Vercel (Preview and Production) | same |
| Stripe | Test-mode Payment Link in `DEPOSIT_PAYMENT_URL` (Preview); test webhook secret in `STRIPE_WEBHOOK_SECRET` (Preview), endpoint `https://<preview-address>/api/stripe/webhook` | Live link and live webhook secret (Production), endpoint on the real domain |
| Questionnaire | `QUESTIONNAIRE_ENABLED=true` and `QUESTIONNAIRE_ENCRYPTION_KEY` (Preview) | only if Lorna has approved it; otherwise skip steps 5 and 6 |
| Logins | a dashboard login with **Can view patient questionnaires** ticked (Users) for step 6 | same |
| Test patient address | an inbox you can read (your own), used as the patient | same |

Preview address: Vercel > Deployments > the latest Preview, or the production address before the domain is live.

## Steps

Use a clearly fake name such as `Test Patient GYA` so it is easy to find and delete.

1. **Make a booking.** Open `/book-now/`, pick a time, enter the test name, your email and phone, tick consent,
   accept the deposit policy, press Send. Note the reference (`APE-XXXXXX`). Expect the "booked in" screen with the
   **Pay your $100 deposit** button.
2. **Check the two booking emails.** (a) The APE inbox (or `BOOKING_NOTIFY_EMAIL`) gets "APE booking request:
   [day], [name] ([ref])" with every detail; Reply-To is the patient. (b) Your inbox gets "We have received your
   booking request" with the time, fee, reference and the deposit link. Check junk mail. In the dashboard the booking
   shows under Bookings as **To confirm**.
3. **Pay with Stripe's test card.** Press the deposit button (or the link in the patient email). On the Stripe page
   use card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode. Expect Stripe's confirmation page. In
   Stripe > Payments the payment shows `client_reference_id` = the booking reference.
4. **Check the webhook ticked Deposit received.** Refresh Bookings: the Deposit column shows **Received** within a few
   seconds. If not: Stripe > Developers > Webhooks > the endpoint > Recent deliveries shows the attempt and the
   response (400 means the secret in Vercel does not match this endpoint; 503 means `STRIPE_WEBHOOK_SECRET` is not set
   in that environment).
5. **Mark confirmed and check the welcome email.** Press **Mark confirmed**. The toast says the welcome pack and
   questionnaire link were emailed. Your inbox gets "Welcome to The Anxious Patient Experience: your welcome pack and
   questionnaire" with the pack attached (PDF), the pack link and a private `/questionnaire/...` link. The Bookings
   row shows Questionnaire **Not yet received**.
6. **Submit the questionnaire.** Open the link, answer the required questions, tick consent, send. Expect the
   thank-you page; opening the link again says it is no longer active. The notification address gets
   "Questionnaire received: [ref], [first name], [date]" with no answers in it. In the dashboard: Questionnaires shows
   the entry under To review; open it (your login needs the permission), read the answers, press Mark reviewed; the
   Access log (GYA) shows the view.
7. **Delete the test data.** Bookings > **Cancel booking** on the test booking (frees the time and the special
   place). Questionnaires > open the test entry > **Delete** (GYA only, type DELETE). Stripe: in test mode nothing to
   refund; in live mode the account owner refunds the $100 from Stripe > Payments > Refund.

Then the production run: steps 1 to 7 on the real domain with the live Payment Link, a real card and a refund.

## Results

| Step | Preview (test mode) | Production (live) |
|---|---|---|
| 1 Booking made (reference) | pass / fail, time, screenshot | |
| 2a Request email at APE inbox | | |
| 2b Patient email with deposit link | | |
| 3 Test payment accepted (Stripe shows the reference) | | |
| 4 Deposit received ticked by the webhook | | |
| 5 Welcome email with pack attached and questionnaire link | | |
| 6 Questionnaire submitted, notification received, visible in dashboard, access logged | | |
| 7 Test data deleted (booking cancelled, questionnaire deleted, payment refunded) | | |

Tested by: ______  Date: ______  Deployment: ______

## If something fails

- No emails at all: `SMTP2GO_API_KEY` or `BOOKING_FROM` missing in that environment, or the sender domain is not
  verified in SMTP2GO. Vercel > the function's logs show `booking: ... must all be set` or the SMTP2GO error.
- Emails in junk: expected for a brand-new sender; add SPF and DKIM for the sending domain (SMTP2GO shows them), and
  later move the sender to the APE domain (`docs/GO-LIVE-DOMAIN.md`, section 5).
- Deposit button missing: `DEPOSIT_PAYMENT_URL` not set in that environment.
- Welcome email not sent: the toast gives the reason (feature off, no encryption key, email not set up, or Site
  Settings sends it at request time instead). **Resend welcome email** on the booking tries again.
