# How to see your numbers

A one-page guide for Lorna and the APE team (v1.11.0).

## 1. Bookings and where they came from: the dashboard

Sign in at **theanxiouspatientexperience.com.au/admin**.

- **Dashboard** (the first screen) has a box called **Where bookings came from (last 30 days)**: how many bookings
  came from Instagram, the Caringbah website, the Cronulla website, Google, an email, the flyer QR code or Direct
  (typed in or a bookmark). Bookings made before 18 November 2026 say Not recorded.
- **Bookings** has a **Source** column, and each booking says "Came from: ..." when you open it. The **Download for
  Excel (CSV)** button includes it, for counting by month.

This works whether or not Google Analytics is on, and it never leaves the website.

## 2. Visits to the website: Google Analytics

Once GYA has switched it on (after you approve the privacy wording), go to **analytics.google.com** with the Google
login GYA adds you to, and choose the property **The Anxious Patient Experience**.

| What you want to know | Where to look |
|---|---|
| How many people visited this week | **Reports > Snapshot**: Users, with the date range at the top right |
| Where visitors came from (Instagram, the clinic sites, Google) | **Reports > Acquisition > Traffic acquisition**; change the first column to **Session source / medium** |
| How the launch links are doing | Same report, add a filter **Session campaign = ape-launch** |
| How many booked, and how many paid the deposit | **Reports > Engagement > Events**: `booking_submitted` (requests sent) and `deposit_paid` (deposits paid). These two are the key events |
| How many started but stopped | Same Events report: `book_now_view` (opened Book Now), `booking_time_selected`, `booking_details_completed`, `deposit_policy_agreed` |
| Calls and emails from the website | Events `click_to_call` and `click_email` (the number of taps, not who) |
| Taps through to Instagram | Event `outbound_instagram` |

Google Analytics never receives a name, email, phone number, date of birth or booking reference, and it is not on the
questionnaire or the dashboard. Its numbers are rounded and some visitors block it, so the **dashboard count is the
true number of bookings**; use Google Analytics for the trend and where people came from.

## 3. Google searches: Search Console

At **search.google.com/search-console** (GYA adds you): **Performance** shows the searches the site appeared for,
how often, and how many clicked. Data starts a few days after it is set up.

## 4. A simple weekly check (5 minutes)

1. Dashboard: the **Where bookings came from** box. Note the numbers.
2. Google Analytics: Snapshot (visitors this week) and Events (`booking_submitted`, `deposit_paid`).
3. If one source is quiet (for example the Cronulla banner), mention it to GYA.

Questions: GYA on 1300 889 840.
