# The Anxious Patient Experience™: website (plain HTML)

GYA build for Dr Lorna Gladwin. Plain HTML, CSS and JavaScript. There is no build step, no Node, no TypeScript
and no framework: what is in this folder is exactly what Vercel serves.

Pages: Home, Understanding the Experience, Meet the Team, Book Now, FAQs, plus a placeholder Privacy Policy page
and a 404 page. All copy is word for word from the approved copy doc (29 Sep 2026).

## Deploy (new GitHub repo, new Vercel project)

1. Create a new GitHub repo and set it to **Private** (GYA standard).
2. Upload the **contents** of this folder so that `index.html` and `vercel.json` sit at the top of the repo, not
   inside a subfolder. Drag the folders in as well as the files (`assets`, `images` and the five page folders).
3. In Vercel: Add New Project, import the repo, then set:
   - Framework Preset: **Other**
   - Build Command: leave empty (or switch the override on and leave it blank)
   - Output Directory: leave empty (the repo root)
   - Install Command: leave empty
4. Deploy. No environment variables are needed.
5. Check the file count in GitHub after uploading: there should be 33 files (see "What is in here").

Any `*.vercel.app` address is sent `X-Robots-Tag: noindex` (set in `vercel.json`), so the staging link never
competes with the live site in Google.

## What is in here

```
index.html                              Home
understanding-the-experience/index.html
meet-the-team/index.html
book-now/index.html
faqs/index.html
privacy-policy/index.html               Placeholder page (noindex) so the footer link works
404.html
assets/site.css                         Full design system
assets/site.js                          Screen by screen journey (snapping, reveals, progress bar,
                                        Explore sheet), FAQ accordion, booking flow
assets/fonts/                           Playfair Display and Figtree, self-hosted (SIL OFL)
images/                                 Page photos (WebP), logo, social share image (JPG)
icon.svg, apple-touch-icon.png, robots.txt, sitemap.xml
vercel.json                             Clean URLs, trailing slashes, security and caching headers
README.md, CHANGELOG.md
```

## Before go-live: set the domain

The canonical tags, share (OG) links and sitemap use `https://example.com` until the domain is confirmed. Once it
is, find and replace `https://example.com` with the live domain (for example `https://anxiouspatientexperience.com.au`)
in every `.html` file, `sitemap.xml` and `robots.txt`.

## Screen by screen layout (v1.0.6)

Every page is a series of full-screen "screens", one after another, and the page links live in the bottom bar.

- **A screen** is a `<section class="screen">` inside `<main>`. It is at least one screen tall (`100svh`, with
  `100vh` for older browsers), keeps clear of the header and bottom bar with its own padding, and centres its
  content. The first element inside it is `<span class="snap-point" aria-hidden="true"></span>`, which is what the
  page snaps to.
- **Snapping** is native CSS only (`scroll-snap-type` on the page, switched on by `site.js` with the `snap` class).
  It is mandatory by default and switches to proximity on Book Now and FAQs (`data-snap="proximity"` on `<body>`),
  and on any page where a screen has grown taller than the window (for example the card grid on phones), so nobody
  is ever trapped. No wheel or touch events are intercepted. With reduced motion or without JavaScript there is no
  snapping and the page scrolls normally.
- **Screens that grow** carry `screen--grow`: the Understanding card grid, the Book Now booking flow and the FAQ list.
  On small phones (iPhone SE size) the Home "heart" screen and Lorna's profile also grow, because their copy is longer
  than the screen.
- **Reveals**: anything with `reveal` fades up when its screen is half in view. Add `seq` to make items appear one by
  one (0.7 seconds apart); `d1` to `d3` give a small stagger to the main content. Reveals play once, and anything that
  receives keyboard focus is shown at once.
- **Progress bar**: one link per screen in the bottom bar (`.journey-progress`), in the same order as the screens.
  If you add or remove a screen, add or remove its segment and update the "Go to section X of Y" labels.
- **Bottom bar**: Understanding the Experience, Meet the Team, FAQs and the Book Now pill. The current page's link has
  `aria-current="page"`. On phones the three links sit behind the "Explore" button (a `<details>` element, so it
  works without JavaScript too).

## Booking (test mode)

The full Book Now journey works: "Choose a time", the four steps as a progress indicator, APE sessions only
(sample times: Tuesdays and Thursdays at 9am, 11am and 2pm Sydney time, 48 hours' minimum notice, six weeks ahead),
the details form, the deposit and cancellation policy directly above the payment button with a required checkbox
(the button stays disabled until it is ticked), and the confirmation screen. **No payment is taken** and a
"Test mode" note shows under the payment button.

The integration point is the `getSlots()` function and the payment step in `assets/site.js` (marked
`INTEGRATION POINT`). To connect it we need:

1. Where APE availability comes from: the practice booking system (a dedicated APE appointment type exposed by API
   or an online booking link) or sessions managed by GYA, with reception entering each booking.
2. The real APE days, times, clinicians, capacity and location.
3. The payment gateway for the $100 deposit (Stripe recommended) and the practice's account.
4. Who is notified: SMTP2GO to reception, the SmileOx intake address and rowayne@gyaclients.com, plus the patient
   confirmation email.
5. Deposit accounting: whether the $100 comes off the $350 fee, and how transfers and refunds are handled.

A live payment needs a small serverless function (Vercel supports this alongside static files), so connecting it
will add an `api` folder to this repo.

## Images

| File | Where |
|---|---|
| `images/home-hero.webp` | Home hero |
| `images/home-heart-of-the-experience.webp` | Home, The heart of the experience |
| `images/understanding-hero.webp` | Understanding the Experience hero |
| `images/understanding-our-approach.webp` | Understanding, "We work with it" |
| `images/meet-the-team-hero.webp` | Meet the Team hero |
| `images/team-lorna-gladwin.webp` | Meet the Team, Dr Lorna Gladwin |
| `images/book-now-hero.webp` | Book Now hero |
| `images/faqs-hero.webp` | FAQs hero |
| `images/social-share.jpg` | Share image (og:image) on every page, 1200 x 630 |
| `images/ape-logo.webp`, `images/ape-logo.png` | Header and footer logo, and the logo in the search schema |
| `apple-touch-icon.png` | Home screen icon on phones |

To swap a photo later, keep the same file name, or update the `src` in the page's `index.html`. Browsers keep
images for a day, so a new photo under the same name can take up to a day to show for returning visitors.

When `assets/site.css` or `assets/site.js` changes, bump the `?v=` number on their links in every page
(for example `site.css?v=1.0.5` to `site.css?v=1.0.6`) so returning visitors get the new version straight away.

## Placeholders (square brackets, highlighted yellow on the site)

| Placeholder | Where |
|---|---|
| `[Surname]` | Meet the Team, Alex's name |
| `[Phone]`, `[Email]`, `[Practice address]` | Footer contact block, every page |
| Domain | `https://example.com` in canonical, OG and sitemap links |
| Privacy policy text | `/privacy-policy/` |
| Talk to Alex | Every "Talk to Alex" button goes to the footer contact block until Alex's contact method is confirmed |
| Alex's portrait | Labelled placeholder on Meet the Team (needs real photography) |

## UI labels not in the copy doc (for sign-off)

Booking form labels from Lorna's Canva concept ("Your name", "Email address", "Phone number (optional)", "What would
you like support with? (optional)"), "Continue", "Back", the two form error messages, the test-mode note, "Skip to
content", "Explore" (the button that opens the page links on phones), "Go to section 1 of 5" and so on (screen
reader labels on the progress bar segments), and "Page not found" / "Home" on the 404 page. "Open menu" / "Close
menu" are gone with the old top menu.

## Go-live checklist

- [ ] Repo is private
- [ ] iPhone check on the staging link (Safari): swipe through every page, open Explore, run a test booking, open
      an FAQ answer, tap Talk to Alex
- [ ] Every yellow placeholder replaced (search the files for `[`)
- [ ] Phone, email, address and APE location confirmed against the brief
- [ ] `https://example.com` replaced with the live domain everywhere
- [ ] Booking connected and tested end to end in test mode, then live
- [ ] Deposit and cancellation policy wording re-checked with Lorna on the live flow
- [ ] Alex's portrait in place
- [ ] Name on Lorna's scrubs in her portrait reads "Godwin": confirm the spelling with Lorna (the site uses Gladwin)
- [ ] Lorna's profile never uses the word "specialist" (general dentist with a special interest)
- [ ] Privacy policy supplied (Australian Privacy Principles, covers booking and deposit data)
- [ ] GA4 and Meta Pixel added if wanted
- [ ] DNS: apex primary, www 308 to apex

## Not in this release

The GYA client dashboard (Payload CMS) is not included in the plain HTML version. The Next.js source (v1.0.3) is
kept by GYA and can be used when the dashboard is added.
