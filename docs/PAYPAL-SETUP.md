# Setting up PayPal for the $100 deposit (for Andy)

Plain-language steps, in order. Nothing here needs code. Once steps 1 to 4 are done and the details are in Vercel
(step 5), patients pay the deposit on the website itself, the dashboard ticks "Deposit received" by itself and the
team gets an email. PayPal is then only used for refunds and for moving money to the bank.

Allow about 40 minutes. You will need to be the person who owns the PayPal account.

## 1. The PayPal Business account

1. Sign in at https://www.paypal.com/au/business. The account must be a **Business** account (not Personal). If it
   is Personal, PayPal offers "Upgrade to a Business account" under the account settings.
2. Finish anything PayPal is still asking for: confirm the email address, confirm the business details (ABN, address,
   contact), and **link and confirm the bank account** the deposits will be paid out to. PayPal asks for the bank
   details on its own screens. They are never sent to GYA, never put in email and never on the website.
3. Check that the account can receive payments (PayPal shows a notice if anything is still limited).

## 2. Logo and business name

1. Account settings (the cog) > **Business information**: check the business name patients will see on their
   receipt. Suggested: The Anxious Patient Experience, or the practice's legal name if PayPal requires it.
2. Upload the logo where PayPal offers a business logo (Business information, or Account settings > Website
   payments > Checkout customisation, the names move around). Use `ape-logo-square-1000.jpg` from the logo files
   GYA sent (the square navy tile). If a wide header slot appears, `ape-logo-header-750x90.png`.
3. The logo and name shown at checkout come from this account setting. The website only sends the business name and
   the booking reference with each payment.

## 3. The REST app (this is what lets the website talk to PayPal)

1. Go to https://developer.paypal.com and sign in **with the same PayPal business account**.
2. Open **Apps & Credentials**. At the top there is a switch between **Sandbox** and **Live**.
3. On **Live**, press **Create App**. Name: `APE website`. Type: Merchant. Create.
4. The app page shows a **Client ID** and a **Secret** (press "Show" for the secret). These are the live
   credentials. Keep this tab open; see step 5 for how to pass them on.
5. Switch to **Sandbox** and do the same: Create App, name `APE website sandbox`. Copy its Client ID and Secret too.
   Sandbox is PayPal's practice mode: GYA uses it to test the whole flow with pretend money before anything real.
6. Still on Sandbox, open **Testing Tools > Sandbox Accounts**. PayPal creates a pretend buyer account (an email
   ending in @personal.example.com) with a password. GYA needs that email and password to run the test payments.

## 4. The webhook (how PayPal tells the website about payments and refunds)

Do this for the **Live** app and again for the **Sandbox** app.

1. On the app page scroll to **Webhooks** and press **Add Webhook**.
2. Webhook URL:
   - Live app: `https://theanxiouspatientexperience.com.au/api/paypal/webhook`
   - Sandbox app: the preview address GYA gives you, ending in `/api/paypal/webhook`
3. Event types: tick these three only:
   - `Payment capture completed`
   - `Payment capture denied`
   - `Payment capture refunded`
4. Save. PayPal shows a **Webhook ID** (a string like `8PT597110X687430LKGECATA`). Copy it. It is not secret, but
   it is needed in step 5.

## 5. Handing the details to GYA (never by email, text or chat)

There are four values per environment: Client ID, Secret, Webhook ID, and which environment they are for. The
Secret is like a password to the PayPal account, so it must not travel through email, WhatsApp or a text message.
Two safe options, pick either:

- **Option A, you type them in (recommended):** a 10 minute screen-share with Rowayne. He opens Vercel to the
  right screen and you paste each value in yourself. He never sees the Secret in full.
- **Option B, a one-time secret link:** paste the values into a one-time note service that destroys the note after
  it is opened once (for example https://onetimesecret.com or https://password.link), set it to expire in a day, and
  send Rowayne the link. If he says the link was already used when he opened it, stop and make a new Secret in the
  PayPal app (Apps & Credentials > the app > Secret > Generate new), because someone else opened it.

Where they go in Vercel (GYA does this): Settings > Environment Variables.

| Variable | Preview (testing) | Production (live) |
|---|---|---|
| `PAYPAL_ENV` | `sandbox` | `live` |
| `PAYPAL_CLIENT_ID` | sandbox app Client ID | live app Client ID |
| `PAYPAL_CLIENT_SECRET` | sandbox app Secret (Sensitive) | live app Secret (Sensitive) |
| `PAYPAL_WEBHOOK_ID` | sandbox webhook ID | live webhook ID |

Then a redeploy. Until these are in, the website behaves as it does today (patients are told the deposit details
will come with their confirmation).

## 6. After it is live

- Payments appear in PayPal > Activity, each with the booking reference. Nothing needs checking there day to day.
- **Refunds**: PayPal > Activity > the payment > Refund. The website then shows the booking as Refunded by itself.
- **Payouts**: PayPal > Transfer money to the linked bank account, on whatever schedule suits.
- PayPal's fees for Australian businesses are shown in the account under Fees; the website shows patients $100.00
  and the fee comes out of what PayPal passes on.
- If the account's Secret ever leaks, generate a new one in the app and give it to GYA the same safe way; the old
  one stops working as soon as the new one is in Vercel.
