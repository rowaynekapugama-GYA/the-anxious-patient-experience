# Test booking script: PayPal deposit, booking emails, welcome pack and questionnaire

Run it first on the **preview address with PayPal sandbox** credentials, then once on production with the live
credentials and a real $100 payment that the account owner refunds from PayPal. Fill in the results table and send
it to Lorna.

## How the deposit works (v1.8.0)

- The patient books, then pays the $100 deposit on the website itself, with PayPal or a debit or credit card (guest
  checkout, no PayPal account needed). The server creates the PayPal order (amount set by the server, never the
  browser, reference in `custom_id`), captures it when the patient approves, marks the booking **Deposit received**,
  stores the PayPal transaction id, and emails "Deposit received" to the patient and the APE inbox.
- If the patient closes the window or the payment fails, the booking stays **Deposit not paid** and the patient's
  email carries a private **Pay your deposit** link (`/book-now/pay/?t=...`), good for 14 days or until paid.
- The webhook `/api/paypal/webhook` is the backup: it verifies each event with PayPal (`PAYPAL_WEBHOOK_ID`), ignores
  repeats, marks completed captures paid, denied captures failed, and refunds made in PayPal as **Refunded**.
- The team never needs to open PayPal to check a deposit. PayPal is for refunds and moving money to the bank.

## Before you start

| Need | Preview test | Production test |
|---|---|---|
| Email | `SMTP2GO_API_KEY`, `BOOKING_FROM`, `BOOKING_NOTIFY_EMAIL` in Vercel (Preview and Production) | same |
| PayPal | Preview: `PAYPAL_ENV=sandbox`, sandbox `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` (sandbox webhook pointing at the preview address) | Production: `PAYPAL_ENV=live` and the live values, webhook on the real domain |
| Sandbox buyer | the sandbox personal account email and password from developer.paypal.com > Testing Tools > Sandbox Accounts | a real card or PayPal account, refunded afterwards |
| Questionnaire | `QUESTIONNAIRE_ENCRYPTION_KEY` (Preview), then Site Settings > Welcome pack: welcome email on, notice approved, online questionnaire on | only if Lorna has approved it; otherwise skip steps 6 and 7 |
| Logins | a dashboard login (and, for step 7, one with **Can view patient questionnaires**) | same |
| Test patient address | an inbox you can read, used as the patient | same |

Preview address: Vercel > Deployments > the latest Preview.

## Steps

Use a clearly fake name such as `Test Patient GYA`.

1. **Make a booking.** (v1.12.0: with PayPal set up, the button on step 3 is **Continue to payment**, and the
   emails in step 3 below only arrive once the deposit is paid.) `/book-now/`: pick a time, press Continue with the details empty and check every field says
   what is missing (v1.10.0: first name, last name, email, phone and date of birth are required). Then enter the test
   name, your email, a phone number and a date of birth, tick consent, Continue. v1.11.0: the **deposit policy pop-up**
   opens (Your Appointment Deposit). Press **I Agree & Continue** without ticking: it explains the box must be ticked.
   Press Escape (or Go back, or the X): you are back on your details with everything still filled in. Continue again,
   tick the box, **I Agree & Continue**. The deposit step shows the three short policy lines (no tick); press **Continue to payment**. Expect "Pay by card, or with PayPal. You don't need a PayPal account." and the PayPal and
   **Debit or Credit Card** buttons. Note the reference. At this moment the booking shows as Paying now (held 30 minutes) and nothing is emailed yet.
2. **Pay with the sandbox buyer account.** Press the PayPal button, sign in with the sandbox buyer, approve. Expect
   the "You're booked in" screen with "Your $100 deposit has been received". In the dashboard the booking shows
   Deposit **Received**; open the row to see the PayPal transaction and the **View in PayPal** link.
3. **Check the emails.** Your inbox: "We have received your booking request" (with the pay link, which now says
   already received if opened) and "Deposit received". The APE inbox: the booking request, then "Deposit received:
   [ref]". Check junk mail.
4. **Pay with a sandbox card.** Make a second booking; on the PayPal step choose **Debit or Credit Card** and use a
   sandbox test card (developer.paypal.com > Testing Tools > Credit card generator). Expect the same result.
5. **Pay to book** (v1.12.0). Make a third booking and stop at the payment buttons: there is no Pay later, the page
   says the time is held for 30 minutes, the dashboard shows it as **Paying now** and no email has arrived. Close the
   tab. After 30 minutes the time is free again on Book Now and the booking shows under Cancelled as **Released: not
   paid**; its pay link says the time was released. (To check sooner on a preview, wait 30 minutes or ask GYA.)
   For the pay-later page itself, use a booking the team chases: one made before online payment was set up shows
   Not paid under the **Deposit not paid** filter. Open the booking: it shows the date
   of birth, "Deposit policy agreed: [date], version 2 (2026-11-18)" and "Came from: ..." (Direct if you typed the
   address; open Book Now from one of the links in `docs/TRACKING-LINKS.md` to see Instagram or a clinic website). Open the **Pay your deposit**
   link from the patient email in a fresh private window, pay, and check the dashboard flips to Received and the
   "Deposit received" emails arrive. Open the same link again: it says the deposit has already been received.
6. **Mark confirmed** on one booking: "Your APE appointment is confirmed" arrives with both PDFs attached (and the private link if the online questionnaire is on). Pressing Mark confirmed again does not send it twice.
7. **Fill in the questionnaire** from the link: the name and date of birth at the top are filled in from the booking
   (change one to see the "differs from the booking" flag in the dashboard); press Save and finish later, open the link again (the answers are still there), then Send my answers. Check the "Questionnaire received" email (reference and date only) and open it in Questionnaires with a login that has questionnaire access (At a glance, every answer, Print).
8. **Refund one payment.** In the sandbox PayPal business account (sandbox.paypal.com, the business sandbox login):
   Activity > the payment > Refund. Within a minute the dashboard shows that booking as **Refunded** (the webhook).
   If it does not, Developers > the app > Webhooks > the webhook > Events shows the delivery and the response code.
9. **Manual mark.** On another unpaid booking press **Mark deposit received manually**, add a note, and check the
   row shows Received (manual) with the note; **Undo manual mark** puts it back.
10. **Delete the test data.** Cancel the test bookings (frees the times and special places). Delete any test
    questionnaire (GYA). Sandbox money needs no refund beyond step 8.

Then the production run: steps 1, 2 (real PayPal or card), 3, 5 and 8 on the real domain, with the live refund done
by the account owner. Confirm the dashboard shows Refunded.

## Results

| Step | Preview (sandbox) | Production (live) |
|---|---|---|
| 1 Booking made, PayPal step shown (reference) | pass / fail, time, screenshot | |
| 2 PayPal payment captured, Deposit received in dashboard, View in PayPal works | | |
| 3 Patient and APE emails: booking request, Deposit received | | |
| 4 Card (guest) payment captured | | |
| 5 Abandoned booking stays Not paid; pay link pays it; used link refused | | |
| 6 Mark confirmed sends the welcome email | | |
| 7 Questionnaire submitted and visible | | |
| 8 Refund in PayPal shows as Refunded in the dashboard | | |
| 9 Manual mark and undo | | |
| 10 Test data removed | | |

Tested by: ______  Date: ______  Deployment: ______

## If something fails

- No PayPal buttons on step 3, just "Send booking request": `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET` is missing
  in that environment (the site then behaves as before PayPal).
- Buttons load but paying fails with "paypal error": the Secret does not match the Client ID, or `PAYPAL_ENV` is
  wrong for those credentials (sandbox credentials with `live`, or the reverse). Vercel function logs show
  `PayPal token 401` or `PayPal create order 4xx`.
- Payment goes through in PayPal but the dashboard stays Not paid: the capture call did not reach the site and the
  webhook is not set up or its `PAYPAL_WEBHOOK_ID` is wrong (webhook deliveries show 400 `bad_signature`).
- Refund does not show: same webhook check; also confirm `Payment capture refunded` is ticked on the webhook.
- No emails at all: `SMTP2GO_API_KEY` or `BOOKING_FROM` missing, or the sender domain is not verified in SMTP2GO.

## With PayPal Advanced Checkout switched on (`PAYPAL_ADVANCED=on`, v1.10.0)

Only after `docs/PAYPAL-ADVANCED-SETUP.md` steps 1 to 4. On the preview (sandbox):

1. A booking up to the deposit step shows Apple Pay (Safari), Google Pay (Chrome), the card fields and the PayPal button.
2. Card fields with a sandbox card that passes 3D Secure: paid, the dashboard says paid by Card.
3. A sandbox card that fails 3D Secure: "Your bank did not confirm this card, so nothing has been charged." The booking
   stays Not paid; pay again with a good card.
4. Google Pay with a Google test card, and Apple Pay with an Apple sandbox tester: paid, shown as Google Pay or Apple Pay.
5. Refund one in the sandbox PayPal account: the dashboard shows Refunded.
