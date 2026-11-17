# Card, Apple Pay and Google Pay deposits: PayPal Advanced Checkout (v1.10.0)

For Andy and Ram. Plain steps, in order. Nothing here needs a new account: it is the same PayPal business account
and the same app the website already uses, so deposits keep reconciling by themselves in the dashboard (Deposit
received emails, the webhook, refunds).

## Where things stand today (no changes needed for this)

Book Now already shows two buttons under the line "Pay by card, or with PayPal. You don't need a PayPal account.":

- **PayPal**, for people with a PayPal account
- **Debit or Credit Card**, PayPal's guest checkout: the patient types their card details in a PayPal window and does
  not need, or create, a PayPal account

The website asks PayPal for the card button (`enable-funding=card`); nothing in the code hides it. Please check this
one account setting, because if it is off PayPal pushes people to log in or sign up:

1. Log in to the PayPal **business** account at paypal.com.
2. Go to **Account Settings** (the gear icon) > **Website payments** > **Website preferences** > **Update**.
3. Make sure **PayPal account optional** is **On**, then **Save**.

PayPal decides who sees the guest card button (it can depend on the patient's country, browser and card). It is
offered to most Australian patients.

## What Advanced Checkout adds

Once PayPal approves the account and we switch it on, the deposit step shows:

- **Apple Pay** (Safari on iPhone, iPad and Mac)
- **Google Pay** (Chrome and Android)
- **Card fields on our own page**, in the APE style, with the bank's security check (3D Secure) only when the bank
  asks for it. If the check is not finished or fails, nothing is charged and the patient sees a clear message and can
  try again.
- the **PayPal** button, still there as another option

Every one of these goes through the same server-side order (the booking reference is attached to the payment) and
the same capture, so the dashboard ticks Deposit received in the same way and shows how it was paid (Card, Apple Pay,
Google Pay or PayPal). No new webhook events are needed: Apple Pay, Google Pay and card payments send the same
"payment captured", "declined" and "refunded" events the webhook already handles.

## Steps

### 1. Apply for Advanced Checkout (Andy or Ram, about 10 minutes, then usually a day or two)

1. Go to developer.paypal.com and log in with the PayPal business account.
2. **Apps & Credentials**, switch to **Live**, open the app the website uses (the one whose Client ID is in Vercel).
3. Under **Features** (or **Payment methods**), tick **Advanced Credit and Debit Card Payments** and follow the
   prompts. PayPal may ask for business details. Approval usually takes a day or two; PayPal emails when it is done.

If PayPal declines, tell Rowayne. The fallback is in "If PayPal says no" below.

### 2. After approval: turn on Apple Pay and Google Pay

1. Back in the same live app, under **Features**, tick **Apple Pay** and **Google Pay**, and **Save**.
2. Leave **Vault** and anything else as it is.

### 3. Register the domain for Apple Pay

Apple only shows Apple Pay on domains registered for it.

1. In the PayPal business account, go to **Account Settings** > **Website payments** > **Apple Pay** > **Manage**
   (in some accounts this is in the developer dashboard app, under Apple Pay > **Manage domains**).
2. **Add domain**: `theanxiouspatientexperience.com.au`
3. PayPal gives a file called `apple-developer-merchantid-domain-association`. **Download it and send it to
   Rowayne** (it is not secret). GYA puts it on the website so it shows at
   https://theanxiouspatientexperience.com.au/.well-known/apple-developer-merchantid-domain-association
   (until then that address is a "not found" page, on purpose).
4. Once GYA confirms it is live, go back to the same screen and finish **Register**.

The same is done once in the **sandbox** app for testing, with the preview (vercel.app) address.

### 4. Tell Rowayne

Send: "Advanced Checkout approved, Apple Pay and Google Pay on, domain file attached." GYA then:

- adds the domain file
- sets `PAYPAL_ADVANCED=on` in Vercel, **Preview first** (not Sensitive, nothing secret in it)
- tests in the sandbox (step 5), then sets it in **Production** and redeploys

Nothing else changes in Vercel. The existing `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` and
`PAYPAL_ENV` stay as they are.

### 5. Test, then one live payment refunded

**Sandbox (GYA, on the preview link):** card fields with PayPal's sandbox test cards, including one that asks for the
3D Secure check and one that fails it; Google Pay in Chrome (Google's test cards); Apple Pay on an Apple device signed
in to an Apple sandbox tester account. Each should show Deposit received in the preview dashboard.

**Live:** the website always charges the deposit amount set by GYA ($100), never an amount from the browser, so a
$1 live test is not possible without a temporary code change (which we would rather not do on the live site). Instead:

1. Make one real booking on the live site and pay the $100 deposit by card (or Apple Pay).
2. Check the dashboard shows Deposit received, paid by Card (or Apple Pay), and the Deposit received emails arrive.
3. In PayPal, find the payment and **Refund** the full $100. The dashboard changes to Refunded within a minute.
4. Cancel the test booking in the dashboard.

PayPal refunds the patient in full but may not return all of its own fee on a refunded payment. Ram, please check that
in the account.

## Fees

PayPal charges different rates for card, Apple Pay and Google Pay payments made through Advanced Checkout than for
standard PayPal payments. **Ram, please check the current rates in the PayPal account** (Fees, or the Advanced
Checkout approval email) before we switch it on. GYA has not quoted any numbers.

## If PayPal says no

Stripe is the fallback: cards, Apple Pay and Google Pay on the page, with no PayPal account. Roughly: the practice
opens a Stripe account (bank details go in Stripe, never to GYA), GYA swaps the payment step to Stripe's payment form
with the same booking reference, adds a Stripe webhook so the dashboard still ticks itself, and registers the domain
for Apple Pay in Stripe. The dashboard, emails and pay-later link stay the same. About a day of build and testing. Not
started: we would only do this if PayPal declines.

## Security

Never send the PayPal password, the app's Secret or any login by email or chat. If GYA needs to see something in the
account, it is done on a screen share, or with a one-time secret link. Card details never touch the website: the card
fields are PayPal's own, shown on our page.
