# The Anxious Patient Experience™: website (plain HTML)

GYA build for Dr Lorna Gladwin. Plain HTML, CSS and JavaScript with no framework and no dependencies. A small build
step (`npm run build`) writes the settings in `assets/site-config.js` into every page and checks the site.

Pages: one continuous homepage (The Experience, Who It's For, Meet the Team and FAQs are sections of it), Book Now,
a placeholder Privacy Policy page and a 404 page. All copy is word for word from the approved copy doc (29 Sep 2026)
and Lorna's emails of 7 Oct and 13 Oct 2026.

## Settings: `assets/site-config.js`

One file for everything that is still changing. Edit it, then run `npm run build` (the deploy scripts do this for
you) and commit.

| Setting | What it controls |
|---|---|
| `contact.phone`, `contact.email`, `contact.address` | Footer contact block on every page. Empty (`''`) shows the yellow placeholder. |
| `SHOW_INVASIVE_RISK_DISCLAIMER` | `true` shows the "Any invasive procedure carries risks..." line under the footer disclaimer. Set to `false` once GYA confirms it is not required. |
| `disclaimer.general`, `disclaimer.invasiveRisk` | The two footer disclaimer lines. |
| `clinic` | The APE clinic (The Cronulla Dentists, 11–13 Cronulla Street, Cronulla NSW 2230), shown on Book Now and in the booking summary. |
| `booking.days`, `booking.startTimes` | Appointment days and times used by the booking flow (Wednesdays at 9:00 am, 10:20 am and 11:40 am, Sydney time). Not shown as fixed text anywhere. |
| `booking.minNoticeHours` | Minimum notice (24 hours, Sydney time). |

The build replaces whatever sits between the `<!-- config:contact -->`, `<!-- config:disclaimer -->` and
`<!-- config:clinic -->` markers in the pages, so edit the config file, not those parts of the HTML.

## Build and check

```
npm install      # nothing to download; it just records the project
npm run build    # applies the settings, checks every page, then copies the finished site into public/
```

The check fails (with a plain-English list) if a link or #anchor points at nothing, an image or file is missing, the
structured data is broken, the FAQ counter or FAQ schema does not match the questions, a settings marker is missing,
or an em dash has crept in.

## Deploy

The repo is connected to Vercel through GitHub, so a push to `main` deploys. Use the scripts that come with each
release (`deploy-ape.sh` on a Mac, `deploy-ape.ps1` on Windows): they back up the folder, copy the new build in,
run the build, commit, push and print the link.

Vercel project settings: Framework Preset **Other**; Build Command `npm run build` (or the default); Output
Directory `public` (or the default, which is `public`); no environment variables. The build copies the finished
site into `public/` (scripts, package files and notes stay out of it) and Vercel publishes that folder. If the
check fails, Vercel stops the deploy and the live site does not change. `public/` is created by the build and is
not committed (see `.gitignore`).

Any `*.vercel.app` address is sent `X-Robots-Tag: noindex` (set in `vercel.json`), so the staging link never
competes with the live site in Google.

## What is in here

```
index.html                              Home: the whole continuous page
book-now/index.html                     Booking flow (test mode)
understanding-the-experience/index.html Forwards to /#understanding
meet-the-team/index.html                Forwards to /#meet-the-team
faqs/index.html                         Forwards to /#faqs
privacy-policy/index.html               Placeholder page (noindex) so the footer link works
404.html
assets/site-config.js                   Settings (see above)
assets/site.css                         Full design system
assets/site.js                          Header, scroll-triggered motion, scroll progress, FAQ cards, booking flow
assets/fonts/                           Playfair Display and Figtree, self-hosted (SIL OFL)
images/                                 Photos (WebP), logo, social share image (JPG)
scripts/build.mjs                       The build and check
package.json, package-lock.json         `npm run build` (no dependencies)
icon.svg, apple-touch-icon.png, robots.txt, sitemap.xml
vercel.json                             Clean URLs, trailing slashes, security and caching headers
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
  the beginning.
- **Old addresses**: `understanding-the-experience/`, `meet-the-team/` and `faqs/` forward to the matching homepage
  section (noindex, canonical to the homepage). Keep them so old links never break.
- **Motion**: anything with `reveal` animates once as it scrolls into view. Add `from-left`, `from-right`, `pop` or
  `fade` for the style, `seq` to make neighbouring items follow one another, `d1` to `d3` for a small delay.
  With reduced motion nothing animates; without JavaScript everything shows.
- **FAQs**: a numbered question index beside an answer card on desktop, swipeable cards on phones. To add a
  question, add a button to `.faq-index`, a matching `.faq-card` to `.faq-track`, update the "/ 11" total, and add
  it to the FAQ schema at the bottom of `index.html`. The build checks all three match.

## Team

Three people, in this order: Dr Lorna Gladwin (Creator of The Anxious Patient Experience™), Alex Loupos (APE Lead),
Lauren Bright (Dental Assistant). Even columns on desktop; on phones and tablets each person stacks, with a small
portrait beside the name.

- **Bios**: Alex's and Lauren's show "Bio coming soon" (marked `<!-- TODO: client to supply bio -->` in
  `index.html`). Replace the `<p class="bio-soon ...">` with one or more `<p class="bio reveal">...</p>`.
- **Photos**: Alex and Lauren have initials placeholders (marked `<!-- TODO: client to supply photo -->`). To add a
  photo, save it as WebP (about 1600 px wide) in `images/` (for example `images/team-alex-loupos.webp`) and replace
  the `<div class="frame ph arch portrait" ...>...</div>` with
  `<div class="frame arch portrait"><img src="/images/team-alex-loupos.webp" width="1600" height="1067" alt="Alex Loupos, APE Lead" sizes="(max-width: 900px) 30vw, 30vw" loading="lazy" decoding="async" style="object-position:50% 30%"/></div>`
  (use the photo's real width and height). For Lorna's new photo, save it over `images/team-lorna-gladwin.webp`.

## Images

Lorna asked (13 Oct 2026) that nothing look like a specific dental clinic unless it is genuine photography of her
practices. Since 15 Oct 2026 the site uses object and detail images only: no rooms, interiors or seating areas a
patient could mistake for the practice.

| File | Where | Notes |
|---|---|---|
| `images/home-hero-calm-smile.webp` | Hero | Stock model photo. Hero only: never near Meet the Team, and never presented as a patient, team member or testimonial |
| `images/home-heart-aligner-smile.webp` | The heart of the experience | Stock photo: woman holding a clear aligner |
| `images/toothpaste-smile.webp` | "What if your dental care started with understanding your anxiety first?" | |
| `images/understanding-approach-braces-smile.webp` | Our approach, "We work with it" | Stock photo: girl with braces |
| `images/brushing-demo.webp` | Who is The Anxious Patient Experience™ for? | |
| `images/team-lorna-gladwin.webp` | Meet the Team, Dr Lorna Gladwin | Lorna's own photo |
| `images/book-now-toothpaste-smile.webp` | Book Now hero | Tighter crop of the toothpaste smile |
| `images/social-share-toothpaste-smile.jpg` | Share image (og:image, twitter:image) on every page, 1200 x 630 | |
| `images/ape-logo.webp`, `images/ape-logo.png` | Header and footer logo, logo in the search schema | Client |

All photos carry the same gentle warm grade so they sit with the cream page colour (#F7F4EF).

**Cronulla clinic photos**: the Meet the Team section has a marked spot (`<!-- CRONULLA CLINIC PHOTOS ... -->` in
`index.html`) for a wide photo of the real practice. Genuine photos of the practice could also replace the hero or
Book Now images. Never use stock or AI images of clinics, dental chairs, equipment, treatment rooms or waiting areas.

Use a new file name for a new photo (and update the `src`): browsers and Vercel keep images for a day, so a new
photo under an existing name can take up to a day to show. When `assets/site.css`, `assets/site.js` or
`assets/site-config.js` changes, bump the `?v=` number on their links in every page.

## Booking (test mode)

The Book Now journey works end to end: "Choose a time", the four steps, the details form, the deposit and
cancellation policy with a required checkbox directly above the payment button, and the confirmation screen.
**No payment is taken** and a "Test mode" note shows under the payment button.

- Times come from `assets/site-config.js`: Wednesdays at 9:00 am, 10:20 am and 11:40 am at The Cronulla Dentists,
  six weeks ahead.
- **24-hour minimum notice** (Sydney time): times less than 24 hours away are never offered, and the check runs
  again before each step and before payment, so a page left open cannot book a time that has become too close.
  This is enforced in the browser only, because this site has no server step yet. When the live booking system is
  connected, it must enforce the same 24-hour rule on its side.
- A note near the booking button asks anyone needing an appointment within 24 hours to contact the clinic directly
  (it links to the footer contact details).

The integration point is the `getSlots()` function and the payment step in `assets/site.js` (marked
`INTEGRATION POINT`). To connect it we need: where APE availability comes from (practice booking system or GYA),
the payment gateway for the $100 deposit (Stripe recommended), who is notified (SMTP2GO to reception, the SmileOx
intake address and rowayne@gyaclients.com, plus the patient), and the deposit accounting. A live payment needs a
small serverless function, so connecting it will add an `api` folder to this repo.

## Placeholders (highlighted yellow or marked "coming soon")

| Placeholder | Where |
|---|---|
| `[Phone]`, `[Email]`, `[Practice address]` | Footer contact block, every page (fill in `assets/site-config.js`) |
| Alex's and Lauren's bios | Meet the Team, "Bio coming soon" |
| Photos of Alex and Lauren, new photo of Lorna | Meet the Team (initials placeholders; Lorna's current photo stays) |
| Cronulla clinic photos | Meet the Team marked spot, optionally hero and Book Now |
| Footer disclaimer | `SHOW_INVASIVE_RISK_DISCLAIMER` pending GYA's confirmation |
| Domain | `https://example.com` in canonical, OG and sitemap links |
| Privacy policy text | `/privacy-policy/` |
| Talk to Alex | Goes to the footer contact block until Alex's contact method is confirmed |

## UI labels not in the copy doc (for sign-off)

Booking form labels from Lorna's Canva concept ("Your name", "Email address", "Phone number (optional)", "What would
you like support with? (optional)"), "Continue", "Back", the form error messages, the "less than 24 hours away"
message, the test-mode note, "Skip to content", "Open menu" / "Close menu", "Previous question" / "Next question"
and the "1 / 11" counter on the FAQ cards, "Questions" (screen reader label on the FAQ question index), "Bio coming
soon", "Photo of ... coming soon" (screen reader label on the initials), the link text on the forwarding pages, and
"Page not found" / "Home" on the 404 page.

## Go-live checklist

- [ ] Repo is private
- [ ] iPhone check on the staging link (Safari): scroll the homepage top to bottom, open the menu and try each link,
      swipe the FAQ cards, tap Talk to Alex, run a test booking
- [ ] Every yellow placeholder and "coming soon" replaced (search the files for `[` and `TODO`)
- [ ] Contact details filled in `assets/site-config.js` and confirmed against the brief
- [ ] Footer disclaimer confirmed with Lorna; `SHOW_INVASIVE_RISK_DISCLAIMER` set accordingly
- [ ] `https://example.com` replaced with the live domain everywhere
- [ ] Booking connected and tested end to end in test mode, then live (with the 24-hour rule enforced server side)
- [ ] Deposit and cancellation policy wording re-checked with Lorna on the live flow
- [ ] Team photos and bios in place
- [ ] Name on Lorna's scrubs in her portrait reads "Godwin": confirm the spelling with Lorna (the site uses Gladwin)
- [ ] Lorna's profile never uses the word "specialist" (general dentist with a special interest)
- [ ] Privacy policy supplied (Australian Privacy Principles, covers booking and deposit data)
- [ ] GA4 and Meta Pixel added if wanted
- [ ] DNS: apex primary, www 308 to apex

## Not in this release

The GYA client dashboard (Payload CMS) is not included in the plain HTML version. The Next.js source (v1.0.3) is
kept by GYA and can be used when the dashboard is added.
