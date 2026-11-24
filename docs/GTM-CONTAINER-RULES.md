# Google Tag Manager on the APE website: rules for the container

For whoever manages the container **GTM-PNMVSBCW** ("theanxiouspatientexperience"): Princess, the Ads team, GYA.
Website version 1.15.0, 24 Nov 2026.

This is a health website. Patients book, pay a deposit and answer a health questionnaire on it. The website
promises that Google never receives a name, an email address, a phone number, a date of birth, a booking reference,
a questionnaire answer or a private link. The website keeps its side of that in code. **The container is the other
half.** One publish in Tag Manager, by someone who never touches the website, can change what the site sends. So
every change to the container is checked against this page first.

## 1. Where Tag Manager loads, and where it never does

| Loads (live domain only) | Never loads |
|---|---|
| Home (it now holds The Experience, Meet the Team and FAQs) | The dashboard (`/admin`), Payload (`/cms`), the page editor preview, email previews |
| Book Now (`/book-now/`) | Any `vercel.app` or preview address, and localhost |
| Privacy policy (`/privacy-policy/`) | The questionnaire (`/questionnaire/...`), including when it is shown inside Book Now |
| Deposit policy (`/book-now/terms/`) | The pay-later page (`/book-now/pay/?t=...`) |
| Google review page (`/review/`) | Any address with a value in it other than `utm_` tags (a token, a PayPal return, anything unknown) |
| The 404 page | A 404 for an address that looks like a mistyped private link |
| Blog pages, if the blog is ever used | The old short addresses (`/faqs/` and so on), which forward to Home at once |

"Live domain" means `theanxiouspatientexperience.com.au` and `www.theanxiouspatientexperience.com.au`. Nothing else.

Why: a tag in the container reads the page address and the referrer straight from the browser. The pay-later and
questionnaire addresses hold a private link, so the container is simply not on those pages, and those pages tell
the browser to send no referrer to the next page.

**Ad click IDs are removed.** A link that arrives with `fbclid`, `gclid`, `gbraid`, `wbraid`, `msclkid` and similar
is redirected to the same page without it, then Tag Manager loads. `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content` and `utm_term` are kept. So for any campaign, **use `utm_` tags** (the ready-made links are in
`docs/TRACKING-LINKS.md`). If Google Ads is ever run and needs `gclid` kept, ask GYA first: it is a one-line change,
but it is a decision, not a default.

**Privacy defaults are set by the page**, before the container loads, on every page:
advertising storage, advertising user data and ad personalisation are **denied** (Consent Mode), analytics storage is
granted, and Google signals and ad personalisation signals are off. No tag may change these (no "consent update").

## 2. Settings found in the Google tag on 24 Nov 2026 that need changing

Read from the published container (version 2) on 24 Nov 2026. It holds one Google tag for **G-16W6YW4PR4**, firing
on Initialization (All Pages).

| Setting found | What it does | Do this |
|---|---|---|
| **User-provided data: automatic detection is ON** for email, phone and address | The tag looks through the page for an email address, phone number and address and can send them (hashed) with events. On Book Now the patient types exactly these. | **Switch it off before the website update goes live.** In the Google tag settings, turn off "Allow user-provided data capabilities" (or at least automatic detection). Do not turn on "User-provided data collection" in the GA4 property. |
| Enhanced measurement: **form interactions ON** | Sends form_start and form_submit with the form's id, name and button text. Not what is typed, but it adds nothing here. | Switch form interactions off. |
| Enhanced measurement: page views, scrolls, outbound clicks, file downloads, video, history events | Standard. Outbound clicks send the address of the link clicked (Google Maps, Instagram, PayPal). | Fine to leave on. |
| Google signals: off | | Keep it off. |
| Email redaction: on | | Keep it on. |
| Key events: `purchase`, `qualify_lead`, `close_convert_lead` (the defaults) | None of these is sent by the website. | Mark `booking_submitted` and `deposit_paid` as key events once they arrive (section 3). |

In the GA4 property (Admin): Google signals stays **off**, and ads personalisation stays **off** for all regions.

## 3. The events the website puts in the dataLayer

Each one is pushed as a named event, for example `{ event: 'deposit_paid', value: 100, currency: 'AUD', method: 'card' }`.
The website filters every event before it is pushed: only the four values below can ever be present, and anything
that looks like an email address, a phone number, a booking reference or a date is dropped.

| Event | When | Values |
|---|---|---|
| `book_now_view` | Book Now opens | none |
| `booking_time_selected` | A time is chosen | none |
| `booking_details_completed` | The details step is finished | none |
| `deposit_policy_agreed` | The deposit policy is agreed | none |
| `booking_submitted` **(key event)** | The booking is made | none |
| `generate_lead` | Sent with `booking_submitted` (Google's standard name) | `currency` AUD |
| `deposit_started` | A payment method is chosen | `method` |
| `deposit_paid` **(key event)** | The deposit is paid | `value` 100, `currency` AUD, `method` |
| `questionnaire_started` | The questionnaire is opened inside Book Now | none |
| `questionnaire_sent` | The questionnaire is sent from inside Book Now | none |
| `click_to_call` | A phone link is clicked | none (never the number) |
| `click_email` | An email link is clicked | none (never the address) |
| `outbound_instagram` | An Instagram link is clicked | none |

`method` is one of `card`, `paypal`, `apple_pay`, `google_pay`. A fourth value, `from: 'pay_link'`, marks a deposit
event that happened on the pay-later page (see below).

**The Google tag does not pick these up by itself.** The published container (version 2) only has triggers for page
load. A named dataLayer event goes nowhere until the container has a trigger and a tag for it. To send them to GA4:

1. Variables: four Data Layer Variables named `method`, `value`, `currency` and `from`.
2. Trigger: one Custom Event trigger, "use regex matching", event name
   `^(book_now_view|booking_time_selected|booking_details_completed|deposit_policy_agreed|deposit_started|deposit_paid|booking_submitted|generate_lead|questionnaire_started|questionnaire_sent|click_to_call|click_email|outbound_instagram)$`
3. Tag: one "Google Analytics: GA4 Event" tag for G-16W6YW4PR4, event name `{{Event}}`, event parameters `method`,
   `value`, `currency` and `from` from the variables, fired by that trigger. Nothing else in the tag.
4. In GA4, mark `booking_submitted` and `deposit_paid` as key events.
5. Check in Tag Assistant: each event shows once, with only those values.

This was checked by reading the published container file. It could not be tested against Google from GYA's build
environment, so the Tag Assistant check in step 5 is the proof.

**What is not counted in Google, on purpose:**

- Deposits paid from the emailed pay-later link. That page never loads anything from Google. If the patient opens
  another page of the website in the same tab afterwards, the deposit events are sent from that page with
  `from: 'pay_link'`; if they close the tab, they are not. Most deposits are paid in the Book Now pop-up and are
  counted there.
- Questionnaires opened from the emailed link. Only the questionnaire offered inside Book Now sends the two
  questionnaire events, and it sends them from Book Now, not from the questionnaire.
- Any visit on a `vercel.app` address (the flyer QR code still points there).

The true numbers for bookings and deposits are always the dashboard's: Bookings, and Dashboard > Where bookings
came from. They do not depend on Google at all.

## 4. Rules for anything added later

1. **No Meta Pixel, and no other advertising or remarketing tag, on Book Now or the deposit steps.** That includes
   Google Ads remarketing, TikTok, LinkedIn and Pinterest tags. If one is ever needed for Instagram ads, it fires on
   Home only, and GYA and Dr Lorna agree to it first.
2. **No Custom HTML tag and no Custom JavaScript variable that reads the page.** Nothing that reads form fields,
   page text, the embedded questionnaire, a link address containing `/questionnaire/` or `?t=`, cookies, or
   browser storage.
3. **No user-provided data and no enhanced conversions**, automatic or manual, in any tag.
4. **No variable or trigger built on what a patient typed or clicked in the booking form**: no Form or Click
   variables (Click Text, Click URL, Form Text and so on) sent as event values.
5. **Google signals and ad personalisation stay off**, in the Google tag and in the GA4 property. No tag sets or
   updates consent.
6. **No session recording, heatmap or chat tools** (Hotjar, Clarity, FullStory and the like). They record the screen.
7. **Only the events in section 3 are sent**, with only their four values. New events are added on the website by
   GYA, so they go through the same filter.
8. **Preview before publish.** Open Book Now in Tag Assistant, type a made-up email and phone number, and check that
   no request to Google contains them, hashed or not (look for values named `em`, `ph`, `user_data` or `ep.`
   followed by anything typed).
9. **Tell GYA before publishing** anything beyond section 3. If in doubt, don't publish.

## 5. Switching it off

Site Settings > Tracking (GYA login) > Google Tag Manager ID: type `off`, Save, then Publish website. Tag Manager
is gone from every page a few minutes later. Blank puts the default container back.
