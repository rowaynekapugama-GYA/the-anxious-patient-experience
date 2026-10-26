# The Anxious Patient Experience™: website (plain HTML)

GYA build for Dr Lorna Gladwin. Plain HTML, CSS and JavaScript with no framework and no dependencies, plus one small
Vercel serverless function (`api/booking.js`) that emails booking requests to the APE inbox. A build step
(`npm run build`) writes the settings in `assets/site-config.js` into every page and checks the site.

Pages: one continuous homepage (The Experience, Who It's For, Meet the Team and FAQs are sections of it), Book Now,
a placeholder Privacy Policy page and a 404 page. All copy is word for word from the approved copy doc (29 Sep 2026)
and Lorna's emails of 7 Oct, 13 Oct and 26 Oct 2026.

## Settings: `assets/site-config.js`

One file for everything that is still changing. Edit it and commit; Vercel runs the build on every deploy.

| Setting | What it controls |
|---|---|
| `contact.phone` | (02) 8599 9815. Footer, the 24-hour note on Book Now and the booking emails. The `tel:` link (`+61285999815`) is worked out from it. |
| `contact.apeEmail` | theanxiouspatientexperience@gmail.com, shown in the footer as "APE enquiries". |
| `contact.receptionEmail` | reception@thecronulladentists.com.au, shown in the footer as "General practice enquiries". |
| `clinic` | The Cronulla Dentists, 13 Cronulla Street, Cronulla NSW 2230, plus the Google Maps link. Footer, Book Now, booking summary, booking emails and the Dentist structured data. |
| `SHOW_INVASIVE_RISK_DISCLAIMER` | Off (`false`) since 15 Oct 2026. `true` shows the "Any invasive procedure carries risks..." line under the footer disclaimer. Needed if the site ever shows before and after photos or promotes a surgical procedure. |
| `disclaimer.general`, `disclaimer.invasiveRisk` | The two footer disclaimer lines. |
| `booking.days`, `booking.startTimes` | Wednesdays at 9:00 am, 10:20 am and 11:40 am, Sydney time. Not shown as fixed text anywhere. |
| `booking.minNoticeHours`, `booking.weeksAhead` | 24 hours' minimum notice; times offered six weeks ahead. |
| `booking.depositMode` | `'test'`: no payment is taken. Leave it until a payment provider is chosen. |

The build replaces whatever sits between the `<!-- config:contact -->`, `<!-- config:disclaimer -->`,
`<!-- config:clinic -->`, `<!-- config:phone -->` and `<!-- config:schema -->` markers in the pages, so edit the config
file, not those parts of the HTML. The booking function reads the same file, so the page and the server check use
the same days, times and notice period.

## Build and check

```
npm install      # nothing to download; it just records the project
npm run build    # applies the settings, checks every page, then copies the finished site into public/
```

The check fails (with a plain-English list) if a link or #anchor points at nothing, an image (including every size in
a `srcset`) or file is missing, the structured data is broken, the FAQ counter or FAQ schema does not match the
questions, a settings marker is missing, or an em dash has crept in.

## Deploy

The repo is connected to Vercel through GitHub, so a push to `main` deploys. Use `update-and-deploy.sh` (supplied
with each release): it checks the repo, tags a backup, copies the new build in, runs the build, commits, pushes and
prints the link and a one-line rollback.

Vercel project settings: Framework Preset **Other**; Build Command `npm run build` (or the default); Output
Directory `public`. The build copies the finished site into `public/` (scripts, `api/`, package files and notes stay
out of it) and Vercel publishes that folder. `api/booking.js` is deployed separately as a serverless function at
`/api/booking/` (`vercel.json` bundles `assets/site-config.js` with it). If the check fails, Vercel stops the deploy
and the live site does not change. `public/` is created by the build and is not committed.

**Environment variables** (Vercel > Settings > Environment Variables, Production and Preview, then redeploy; see
`.env.example`):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Resend API key. Required for booking emails. |
| `BOOKING_FROM` | Sender on a domain verified in Resend, e.g. `The Anxious Patient Experience <bookings@yourdomain.com.au>`. Required. |
| `BOOKING_NOTIFY_TO` | `theanxiouspatientexperience@gmail.com` (also the built-in default if left out). |
| `BOOKING_BCC` | Optional extra copies, comma separated. Empty on purpose (see Booking). |

Without `RESEND_API_KEY` and `BOOKING_FROM` the form still works up to the last step, then shows "Sorry, we could not
send your booking request just now..." with the clinic's phone number, and nothing is lost silently.

Any `*.vercel.app` address is sent `X-Robots-Tag: noindex, nofollow` (set in `vercel.json`), so the staging link never
competes with the live site in Google. `robots.txt` also keeps crawlers out of `/api/`.

## What is in here

```
index.html                              Home: the whole continuous page
book-now/index.html                     Booking flow
understanding-the-experience/index.html Forwards to /#understanding
meet-the-team/index.html                Forwards to /#meet-the-team
faqs/index.html                         Forwards to /#faqs
privacy-policy/index.html               Placeholder page (noindex) so the footer link works
404.html
api/booking.js                          Booking requests: checks them and emails the APE inbox and the patient
assets/site-config.js                   Settings (see above)
assets/site.css                         Full design system
assets/site.js                          Header, scroll-triggered motion, scroll progress, FAQ cards, Read more, booking flow
assets/fonts/                           Playfair Display and Figtree, self-hosted (SIL OFL)
images/                                 Photos (WebP in three sizes plus a JPG each), logo, social share image
scripts/build.mjs                       The build and check
.env.example                            The environment variables the booking function needs (no real values)
package.json, package-lock.json         `npm run build` (no dependencies)
icon.svg, apple-touch-icon.png, robots.txt, sitemap.xml
vercel.json                             Clean URLs, trailing slashes, headers, booking function settings
README.md, CHANGELOG.md
```

## Before go-live: set the domain

The canonical tags, share (OG) links and sitemap use `https://example.com` until the domain is confirmed. Once it
is, find and replace `https://example.com` with the live domain in every `.html` file, `sitemap.xml` and
`robots.txt`.

## Layout

- **Navigation** (fixed, always visible): The Experience (`#understanding`), Who It's For (`#who-is-it-for`),
  Meet the Team (`#meet-the-team`), FAQs (`#faqs`) and a filled Book Now button. From other pages the links are
  `/#understanding` and so on. Phones show Book Now and a menu button; the menu has all five items and closes after a
  tap. Every section a link can land on has `scroll-margin-top`, so its heading clears the fixed header.
- **Hero**: "Discover the Experience" moves down to the very next section (`#intro`) so visitors read the story from
  the beginning. The intro band is the first mention of the brand: "The Anxious Patient Experience™ (APE)".
- **Quote sections**: "If the thought of booking...", "What if your dental care started with understanding your
  anxiety first?" and "Imagine walking out..." use the two-tone quote band (navy line, taupe rule, taupe line).
- **Old addresses**: `understanding-the-experience/`, `meet-the-team/` and `faqs/` forward to the matching homepage
  section (noindex, canonical to the homepage). Keep them so old links never break.
- **Motion**: anything with `reveal` animates once as it scrolls into view. Add `from-left`, `from-right`, `pop` or
  `fade` for the style, `seq` to make neighbouring items follow one another, `d1` to `d3` for a small delay.
  With reduced motion nothing animates; without JavaScript everything shows.
- **FAQs**: a numbered question index beside an answer card on desktop, swipeable cards on phones. To add a
  question, add a button to `.faq-index`, a matching `.faq-card` to `.faq-track`, update the "/ 11" total, and add
  it to the FAQ schema at the bottom of `index.html`. The build checks all three match.
- **Later additions** (walkthrough videos once Cronulla opens, an education or training platform, member areas, a
  practitioner or location search, a directory or certification pathway): each can be added as a new section or a
  new folder (for example `learn/index.html`, `find-a-practitioner/index.html`) using the same header, footer and
  styles, or moved onto the GYA Next.js framework without changing any address on this site.

## Team

Three people, in this order: Dr Lorna Gladwin (Creator of The Anxious Patient Experience™), Alex Loupos (APE Lead),
Lauren Bright (Dental Assistant). Even columns on desktop; on phones and tablets each person stacks, with a small
portrait beside the name.

- **Bios**: Alex's and Lauren's show "Bio coming soon" (marked `<!-- TODO: client to supply bio -->` in
  `index.html`). Replace the `<p class="bio-soon ...">` with one or more `<p class="bio reveal">...</p>`.
- **Photos**: Alex and Lauren have warm initials tiles in the brand colours (marked
  `<!-- TODO: client to supply photo -->`). No stock faces. To add a photo, save it as WebP (about 1600 px wide) in
  `images/` (for example `images/team-alex-loupos.webp`) and replace the `<div class="frame ph arch portrait" ...>...</div>` with
  `<div class="frame arch portrait"><img src="/images/team-alex-loupos.webp" width="1600" height="1067" alt="Alex Loupos, APE Lead" sizes="(max-width: 900px) 30vw, 30vw" loading="lazy" decoding="async" style="object-position:50% 30%"/></div>`
  (use the photo's real width and height). Use a new file name for any new photo (see Images) and update the `src`, `width` and `height`.
- **Read more**: Lorna's bio shows its first paragraph, then a "Read more" button that opens the rest of the bio and
  her quote (the button then reads "Read less"). The extra paragraphs sit inside
  `<div class="bio-more" id="lorna-gladwin-more">`. Without JavaScript the full bio shows and the button stays
  hidden. To use it for Alex or Lauren once their bios arrive, copy the same pattern with a new id and matching
  `aria-controls` on the button.

## Images

Lorna's rules: **no faces anywhere except the team's own photos** (26 Oct 2026), and nothing that looks like a
clinic, dental chair or treatment room unless it is genuine photography of her practices (13 Oct 2026).

All five photos were chosen by Lorna (26 Oct 2026). Each is saved as WebP at 800, 1400 and 2400 px wide (the browser
picks the right size) plus a 1400 px JPG for very old browsers, inside a `<picture>`. Everything below the hero is
lazy-loaded.

| Files (`images/`) | Where | Notes |
|---|---|---|
| `ape-armchair-corner-*.webp`, `.jpg` | Hero (preloaded) | |
| `ape-candle-book-*.webp`, `.jpg` | The heart of the experience | The book title on the original was a real brand: it has been removed so the book is plain |
| `ape-hands-comfort-*.webp`, `.jpg` | Our approach, "We work with it" | Hands only, no faces. Gentle warm grade |
| `ape-toothbrushes-eucalyptus-*.webp`, `.jpg` | Who is The Anxious Patient Experience™ for? | Gentle warm grade |
| `ape-textured-napkin-*.webp`, `.jpg` | Book Now hero (preloaded) | |
| `social-share-armchair.jpg` | Share image (og:image, twitter:image) on every page, 1200 x 630 | |
| `team-lorna-gladwin-2026-10-26.webp` | Meet the Team, Dr Lorna Gladwin | Lorna's own photo (26 Oct 2026, 1086 x 1448). Team photos are the only faces allowed on the site |
| `ape-logo.webp`, `ape-logo.png` | Header and footer logo, logo in the search schema | Client |

The "What if your dental care started..." section no longer has a photo (five images for what were six spots); it
is a two-tone quote band.

**Cronulla clinic photos**: the Meet the Team section has a marked spot (`<!-- CRONULLA CLINIC PHOTOS ... -->` in
`index.html`) for a wide photo of the real practice. Never use stock or AI images of clinics, dental chairs,
equipment, treatment rooms or waiting areas.

Use a new file name for a new photo (and update the `src`/`srcset`): browsers and Vercel keep images for a day, so a
new photo under an existing name can take up to a day to show. When `assets/site.css`, `assets/site.js` or
`assets/site-config.js` changes, bump the `?v=` number on their links in every page.

## Booking

Lorna confirmed (26 Oct 2026) that the team will block APE time in Core Practice and enter bookings by hand, so the
website does **not** connect to Core Practice.

1. The patient chooses a time (Wednesdays 9:00 am, 10:20 am or 11:40 am at The Cronulla Dentists, six weeks ahead).
2. They enter their name, email, an optional phone number and an optional note, and tick the collection notice.
3. The deposit and cancellation policy sits directly above the payment button with a required tick box.
   **Payment is in test mode: no money is taken.**
4. "Pay $100 deposit" sends the request to `/api/booking/`, which checks it again on the server (a listed day and
   time, at least 24 hours away in Sydney time, within six weeks, required fields and both tick boxes) and then:
   - emails the request to `theanxiouspatientexperience@gmail.com` (reply goes straight to the patient), with the
     name, email, phone, requested date and time, the note, deposit status (test mode), reference and timestamp;
   - emails the patient an acknowledgement (reply goes to the APE inbox).
5. The confirmation screen shows the time, the clinic and a reference such as `APE-3F9A1C`.

The team then blocks the time in Core Practice and confirms with the patient.

- **24-hour rule**: times less than 24 hours away (Sydney time) are never offered; the page checks again before each
  step, and the server refuses a time that has become too close (the patient is sent back to choose again). The note
  on Book Now gives the clinic's number for anyone who needs an appointment sooner.
- **Two requests for the same time** are possible, because nothing is reserved until the team confirms. The team
  sorts this out when confirming.
- **Spam**: a hidden field catches simple bots; their requests are dropped silently.
- **Privacy**: the form asks only for what is needed to arrange the visit (the pre-appointment questionnaire goes out
  later in the information pack). The patient's note can contain health information, so it is not put in the email
  subject, it is not copied into the patient's acknowledgement, and `BOOKING_BCC` is empty. GYA's usual form setup
  also copies SmileOx and rowayne@gyaclients.com; that has been left off for this form because of the health
  information. Turn it on only if Lorna agrees and the privacy policy covers it.
- **Payment**: still to be decided with the client (provider, and how deposits work alongside manual booking). The
  payment integration point is the `pay` action in `assets/site.js` and the deposit line in `api/booking.js`.

**Resend set-up (once)**: create a Resend account, add and verify a sending domain (DNS records at the domain's
registrar), create an API key, then add the variables above in Vercel and redeploy. Send a test booking and check
both emails arrive (look in spam the first time, and mark the sender as safe in the APE Gmail inbox).

## Placeholders (highlighted yellow or marked "coming soon")

| Placeholder | Where |
|---|---|
| Alex's and Lauren's bios | Meet the Team, "Bio coming soon" |
| Photos of Alex and Lauren | Meet the Team (initials tiles) |
| Cronulla clinic photos | Meet the Team marked spot |
| Domain | `https://example.com` in canonical, OG and sitemap links |
| Privacy policy text | `/privacy-policy/` (now needed: the booking form collects personal details) |
| Talk to Alex | Goes to the footer contact block until Alex's contact method is confirmed |

## UI labels not in the copy doc (for sign-off)

Booking form labels from Lorna's Canva concept ("Your name", "Email address", "Phone number (optional)", "What would
you like support with? (optional)"), "Continue", "Back", the form error messages, the "less than 24 hours away"
message, the test-mode note, "Skip to content", "Open menu" / "Close menu", "Previous question" / "Next question"
and the "1 / 11" counter on the FAQ cards, "Questions" (screen reader label on the FAQ question index), "Read more" /
"Read less" on Lorna's bio, "Bio coming soon", "Photo of ... coming soon" (screen reader label on the initials), the
link text on the forwarding pages, "Page not found" / "Home" on the 404 page, and (26 Oct 2026) the footer labels
"APE enquiries" / "General practice enquiries", the collection notice tick box and its error message, "Sending your
request", the send-failure message, the confirmation line "The APE team will be in touch...", and both booking emails.
Full wording is in CHANGELOG.md under 1.3.0.

## Go-live checklist

- [ ] Repo is private
- [ ] Resend domain verified; `RESEND_API_KEY`, `BOOKING_FROM` and `BOOKING_NOTIFY_TO` set in Vercel; a test booking
      reaches the APE inbox and the patient
- [ ] Payment provider and deposit handling agreed with Lorna; deposit taken live (until then `depositMode: 'test'`)
- [ ] Confirmation screen wording agreed (heading still says "You're booked in." although the team confirms by hand)
- [ ] New copy signed off (see CHANGELOG 1.3.0)
- [ ] Privacy policy supplied (Australian Privacy Principles, covers booking details sent by email and any deposit data)
- [ ] iPhone check on the staging link (Safari): scroll the homepage top to bottom, open the menu and try each link,
      swipe the FAQ cards, tap Talk to Alex, run a test booking
- [ ] Every yellow placeholder and "coming soon" replaced (search the files for `[` and `TODO`)
- [x] Contact details in `assets/site-config.js` match Lorna's email of 26 Oct 2026 (13 Cronulla Street, (02) 8599 9815,
      reception@ and the APE Gmail address)
- [x] Footer disclaimer confirmed with Lorna (15 Oct 2026); invasive procedure line off
- [ ] If before and after photos are ever added, set `SHOW_INVASIVE_RISK_DISCLAIMER` to `true`
- [ ] `https://example.com` replaced with the live domain everywhere
- [ ] Deposit and cancellation policy wording re-checked with Lorna on the live flow
- [ ] Team photos and bios in place (Lorna done 26 Oct 2026; Alex and Lauren to come)
- [x] Lorna's new photo (26 Oct 2026) replaces the portrait whose scrubs read "Godwin"
- [ ] Lorna's profile never uses the word "specialist" (general dentist with a special interest)
- [ ] GA4 and Meta Pixel added if wanted
- [ ] DNS: apex primary, www 308 to apex

## Not in this release

The GYA client dashboard (Payload CMS) is not included in the plain HTML version. The Next.js source (v1.0.3) is
kept by GYA and can be used when the dashboard is added.
