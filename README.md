# The Anxious Patient Experience™: website (plain HTML)

GYA build for Dr Lorna Gladwin. Plain HTML, CSS and JavaScript. There is no build step, no Node, no TypeScript
and no framework: what is in this folder is exactly what Vercel serves.

Pages: one continuous homepage (Understanding the Experience, Meet the Team and FAQs are sections of it), Book Now,
a placeholder Privacy Policy page and a 404 page. All copy is word for word from the approved copy doc (29 Sep 2026)
and Lorna's follow-up email (7 Oct 2026).

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
index.html                              Home: the whole continuous page
understanding-the-experience/index.html Forwards to /#understanding
meet-the-team/index.html                Forwards to /#meet-the-team
book-now/index.html
faqs/index.html                         Forwards to /#faqs
privacy-policy/index.html               Placeholder page (noindex) so the footer link works
404.html
assets/site.css                         Full design system
assets/site.js                          Header, scroll-triggered motion, scroll progress, FAQ cards,
                                        booking flow
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

## Continuous scroll layout (v1.1.0)

The site is one homepage read from top to bottom, plus Book Now, Privacy Policy and 404.

- **Sections and anchors**: the header links go to `#understanding`, `#meet-the-team` and `#faqs` on the homepage
  (`/#understanding` and so on from other pages). Other useful anchors: `#nervous-system`, `#what-we-do-differently`,
  `#who-is-it-for`, `#lorna-gladwin`, `#alex`, `#book`, `#contact` (footer contact block).
- **Old addresses**: `understanding-the-experience/`, `meet-the-team/` and `faqs/` are small forwarding pages that
  send visitors (and any old links or bookmarks) to the matching homepage section. They are noindex with the
  canonical set to the homepage. Keep them so old links never break.
- **Header**: sits on the page at the top, hides while reading down, returns (frosted) on scroll up, and stays put
  while the phone menu is open or a header link has keyboard focus. The current section is underlined.
- **Motion**: anything with `reveal` animates once as it scrolls into view. Add `from-left`, `from-right`, `pop` or
  `fade` for the style (default is a gentle fade up), and `seq` to make neighbouring items follow one another.
  `d1` to `d3` add a small delay. With reduced motion nothing animates; without JavaScript everything shows.
- **Scroll progress**: the hairline at the top of the homepage (`.scroll-progress`).
- **FAQs**: a numbered question index beside an answer card on desktop, swipeable answer cards on phones
  (`.faq-deck` in `index.html`). To add a question, add a button to `.faq-index`, a matching `.faq-card` to
  `.faq-track`, update the "/ 10" total, and add it to the FAQ schema at the bottom of `index.html`.

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
| `images/home-hero.webp` | Hero |
| `images/home-heart-of-the-experience.webp` | The heart of the experience |
| `images/understanding-hero.webp` | "What if your dental care started with understanding your anxiety first?" |
| `images/understanding-our-approach.webp` | Our approach, "We work with it" |
| `images/faqs-hero.webp` | Who is The Anxious Patient Experience™ for? |
| `images/meet-the-team-hero.webp` | Meet the Team banner |
| `images/team-lorna-gladwin.webp` | Meet the Team, Dr Lorna Gladwin |
| `images/book-now-hero.webp` | Book Now hero |
| `images/social-share.jpg` | Share image (og:image) on every page, 1200 x 630 |
| `images/ape-logo.webp`, `images/ape-logo.png` | Header and footer logo, and the logo in the search schema |
| `apple-touch-icon.png` | Home screen icon on phones |

**New team photos.** Lorna: save the new photo over `images/team-lorna-gladwin.webp` (WebP, about 1600 px wide,
face roughly centred; the phone crop centres on the face). Alex: save the photo as `images/team-alex.webp`, then in
`index.html` replace the placeholder `<div class="frame ph arch portrait" ...>...</div>` inside `#alex` with
`<div class="frame arch portrait"><img src="/images/team-alex.webp" width="1600" height="1073" alt="Alex, APE Lead"
sizes="(max-width: 900px) 30vw, 40vw" loading="lazy" decoding="async"/></div>` (use the photo's real width and
height).

To swap any other photo later, keep the same file name, or update the `src` in the page's `index.html`. Browsers keep
images for a day, so a new photo under the same name can take up to a day to show for returning visitors.

When `assets/site.css` or `assets/site.js` changes, bump the `?v=` number on their links in every page
(for example `site.css?v=1.0.5` to `site.css?v=1.0.6`) so returning visitors get the new version straight away.

## Placeholders (square brackets, highlighted yellow on the site)

| Placeholder | Where |
|---|---|
| `[Surname]` | Meet the Team, Alex's name |
| Alex's bio | Current approved text is in place; Lorna is sending updated details |
| New softer photos of Lorna and Alex | Meet the Team (see "New team photos" above) |
| APE days and practice details | Booking sample times (Tuesdays and Thursdays) until the real days are confirmed |
| `[Phone]`, `[Email]`, `[Practice address]` | Footer contact block, every page |
| Domain | `https://example.com` in canonical, OG and sitemap links |
| Privacy policy text | `/privacy-policy/` |
| Talk to Alex | Every "Talk to Alex" button goes to the footer contact block until Alex's contact method is confirmed |
| Alex's portrait | Labelled placeholder on Meet the Team (needs real photography) |

## UI labels not in the copy doc (for sign-off)

Booking form labels from Lorna's Canva concept ("Your name", "Email address", "Phone number (optional)", "What would
you like support with? (optional)"), "Continue", "Back", the two form error messages, the test-mode note, "Skip to
content", "Open menu" / "Close menu", "Previous question" / "Next question" and the "1 / 10" counter on the FAQ
cards, "Questions" (screen reader label on the FAQ question index), "Photo to come" on Alex's placeholder, the
link text on the forwarding pages, and "Page not found" / "Home" on the 404 page.

## Go-live checklist

- [ ] Repo is private
- [ ] iPhone check on the staging link (Safari): scroll the homepage top to bottom, open the menu and try each link,
      swipe the FAQ cards, tap Talk to Alex, run a test booking
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
