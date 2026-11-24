# How to see your numbers

A short guide for Lorna and the APE team.

## Where each number comes from

| Question | Where to look | Where the numbers come from |
|---|---|---|
| How many bookings, and where those patients came from | The dashboard (section 1) | Your own booking records on the APE website. Not Google. |
| How many people visit, where from, and how many reach Book Now and finish booking | Google Analytics (section 2) | Google Analytics on the APE website, which runs through Google Tag Manager (from v1.15.0) |
| What people search on Google before finding the site | Google Search Console (section 3) | Google search results only. It knows nothing about visits or bookings |

## 1. Bookings and where they came from: the dashboard

Sign in at **theanxiouspatientexperience.com.au/admin**.

- **Dashboard** (the first screen) has a box called **Where bookings came from (last 30 days)**: how many bookings came from Instagram, the Caringbah website, the Cronulla website, Google, an email, the flyer QR code or Direct (typed in or a bookmark).
- **Bookings** has a **Source** column, and each booking says "Came from: ..." when you open it. **Download for Excel (CSV)** includes it, for counting by month.

**How it knows:** when someone arrives on the APE website, the site notes the link they came in on. The banners and Book Now cards on the Caringbah and Cronulla websites, the Instagram bio link and the email signature link each carry a small label, so they show by name. Otherwise it uses the website they came from (for example google.com shows as Google), or Direct if there isn't one. That note is saved with their booking. It stays in that browser tab only and uses no cookies. Bookings made before 18 November 2026 say Not recorded. It works with or without Google Analytics.

## 2. Visits and the path to booking: Google Analytics

Google Analytics is added to the website through Google Tag Manager, which GYA manages. Go to **analytics.google.com** with the Google login GYA adds you to. Numbers start from the day it went on; there is nothing from before.

| What you want to know | Where to look |
|---|---|
| How many people visited | **Reports > Snapshot**: Users, with the date range at the top right |
| Where visitors came from (Instagram, the clinic sites, Google) | **Reports > Acquisition > Traffic acquisition**, first column set to **Session source / medium** |
| How the launch links are doing | Same report, filter **Session campaign = ape-launch** |
| How many reached Book Now, and how many finished | **Reports > Engagement > Events**: `book_now_view` (opened Book Now), then `booking_time_selected`, `booking_details_completed`, `deposit_policy_agreed`, and `booking_submitted` (booking sent) and `deposit_paid` (deposit paid) |
| Calls, emails and Instagram taps from the website | Events `click_to_call`, `click_email`, `outbound_instagram` |

Google Analytics never receives a name, email, phone number, date of birth or booking reference. It is not on the questionnaire, the page where a deposit is paid from an emailed link, or the dashboard, and it only runs on the live website address. The steps of a booking (the events in the table above) show once GYA has added them in Tag Manager.

Two things it does not count, on purpose: deposits paid from the emailed link (unless the patient goes on to another page of the website), and visits from the flyer QR code. Some visitors also block it. So the **dashboard count is the true number of bookings and deposits**; use Google Analytics for visits, the trend and where people came from.

## 3. Google searches: Search Console

At **search.google.com/search-console** (GYA adds you): **Performance** shows the Google searches the website appeared in, how often, and how many people clicked through. Data starts a few days after it is set up.

## 4. A monthly report from GYA

If you would rather not log in to each of these, GYA can send a simple one-page report each month: visitors, where they came from, how many reached Book Now, bookings and deposits by source. Just ask.

Questions: Rowayne at GYA, 1300 889 840.
