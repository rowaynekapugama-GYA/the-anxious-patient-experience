# Changelog

## 1.2.3 (15 Oct 2026)

Images only, at Rowayne's request. No change to copy, layout, styles or booking.

- The heart of the experience: home-heart-sensory.webp to home-heart-aligner-smile.webp (a young woman smiling and
  holding a clear aligner).
- Our approach: understanding-our-approach.webp to understanding-approach-braces-smile.webp (a smiling girl with
  braces).
- Same gentle warm grade as the other photos; new alt text, width and height; old files deleted.

## 1.2.2 (15 Oct 2026)

Images only. Per Lorna's feedback, every image that showed a room or interior a patient could mistake for the practice
is replaced with an object or detail image. No change to copy, layout, styles or booking.

- Hero: home-hero-lamp.webp to home-hero-calm-smile.webp (a woman smiling at home).
- "What if your dental care started...": understanding-window-seat.webp to toothpaste-smile.webp.
- Who is The Anxious Patient Experience™ for?: faqs-hero.webp to brushing-demo.webp.
- Book Now hero: book-now-hero.webp to book-now-toothpaste-smile.webp (tighter crop).
- Share image: social-share-lamp.jpg to social-share-toothpaste-smile.jpg (og:image and twitter:image on every page).
- Kept (objects or details, not places): home-heart-sensory.webp, understanding-our-approach.webp, Lorna's portrait.
- New photos have a gentle warm grade, new alt text and correct width and height; replaced files deleted.

## 1.2.1 (14 Oct 2026)

- Fixes the Vercel deploy of 1.2.0, which stopped with "No Output Directory named public found". Now that the site
  has a build step, Vercel publishes the `public` folder, so `npm run build` copies the finished site there
  (scripts, package files and notes are left out). `public/` is added to `.gitignore`. No change to any page.

## 1.2.0 (13 Oct 2026)

Lorna's revisions of 13 Oct 2026. Client copy used word for word.

- Hero: the small line now reads "A GENTLER WAY TO BEGIN DENTAL CARE". The main button is now "Discover the
  Experience" and moves down to the very next section only (the introduction), so the story reads from the start.
  Book Now beside it is unchanged.
- Navigation: The Experience, Who It's For, Meet the Team, FAQs and a filled Book Now button. The header is now fixed
  and always visible, scrolling down or up (it no longer hides). Every section a link lands on clears the header.
  The phone menu has the same five items and closes after a tap.
- First mention of APE now reads "The Anxious Patient Experience™ (APE)" (opening line of What is The Anxious
  Patient Experience™?).
- Quote: "What if your dental care started with understanding your anxiety first? / Then built an experience around
  what you need."
- Our approach: new evidence-informed wording under "We don't ask you to ignore that response. We work with it."
  (two paragraphs). Appointment paragraph in What is The Anxious Patient Experience™? replaced. No other copy on the
  site repeated or contradicted the old wording (FAQs and meta descriptions checked).
- Meet the Team: three people in this order: Dr Lorna Gladwin (Creator of The Anxious Patient Experience™), Alex
  Loupos (APE Lead), Lauren Bright (Dental Assistant). Even columns on desktop, stacked on phones. Lorna's bio and
  photo unchanged. Alex and Lauren show "Bio coming soon" and soft initials placeholders until their bios and photos
  arrive.
- Imagery: every image that looked like a dental clinic was replaced with non-dental lifestyle imagery: hero
  (home-hero.webp to home-hero-lamp.webp), The heart of the experience (home-heart-of-the-experience.webp to
  home-heart-sensory.webp), the quote section (understanding-hero.webp to understanding-window-seat.webp) and the
  share image (social-share.jpg to social-share-lamp.jpg). The Meet the Team reception banner (meet-the-team-hero.webp)
  is removed and marked as the spot for Cronulla clinic photos. Old files deleted.
- Footer: the client's preferred disclaimer, with the existing invasive procedure line kept below it for now
  (switch: SHOW_INVASIVE_RISK_DISCLAIMER in assets/site-config.js). Footer links match the new navigation.
- Booking: The Cronulla Dentists, 11–13 Cronulla Street, Cronulla NSW 2230. Wednesdays at 9:00 am, 10:20 am and
  11:40 am. 24-hour minimum notice (Sydney time), checked when times are listed, before each step and before
  payment. New note near the booking button: "Need an appointment within the next 24 hours? Please contact the clinic
  directly so we have time to properly prepare for your visit."
- FAQs: new "What happens after I book?" (second, after "Am I suitable..."), added to the FAQ schema. 11 questions.
- New settings file assets/site-config.js (contact details, disclaimer switch, clinic, booking times and notice) and
  a build step (npm run build: scripts/build.mjs, no dependencies) that writes the settings into every page and checks
  links, anchors, images, structured data and the FAQ count.
- site.css and site.js links bumped to ?v=1.2.0.

## 1.1.1 (9 Oct 2026)

- Phones and tablets: photos, headings and cards that slide in from the side now finish exactly in place. Before
  this fix they stopped 20px short on screens 900px wide and under, so some sat against the screen edge or were
  pushed off the right side (Lorna's and Alex's photos, the Understanding headline, several photos and cards).
- Phones: the small portraits in Meet the Team keep their soft rounded bottom corners.
- Header links have a larger tap area on touch screens. The underline position is unchanged.
- Checked on every page at 320, 360, 375, 390, 414, 768 and 1024 px wide with motion on: nothing off the edge,
  no sideways scrolling, every section finishes its animation.
- site.css and site.js links bumped to ?v=1.1.1.

## 1.1.0 (8 Oct 2026)

Follow-up changes from Dr Lorna Gladwin's feedback of 7 Oct 2026. Visual design unchanged.

- Continuous scroll: the site is now one homepage you read top to bottom. The page turns, Continue and Back, the
  bottom bar and the per-page progress bar are gone. Order: Hero, intro, The heart of the experience, quote,
  Understanding the experience, the nervous system, Our approach, What we do differently, Who is The Anxious Patient
  Experience™ for?, closing quote, Meet the Team, FAQs, Book Now.
- Gentle motion, triggered by scrolling only: sections fade up, photos and cards slide in from the side, and cards,
  trigger chips and key panels settle in with a soft pop, one after another. Each plays once. The hero fades in
  without moving. Reduced motion: no animation at all. Without JavaScript everything shows.
- Header: logo, Understanding the Experience, Meet the Team, FAQs and a quiet Book Now. It sits on the page at the
  top, steps out of the way while you read down and comes back, softly frosted, when you scroll up. The section
  you are in is underlined. Phones: Book Now plus a menu button. A hairline scroll progress line runs across the top
  of the homepage.
- Hero: the main button is now "Understand the experience" and leads down into Understanding. Book Now stays beside
  it as a quieter link.
- Understanding opens with the new "What is The Anxious Patient Experience™?" copy, word for word, with
  "70-minute Anxious New Patient Experience" in bold. The old Understanding headline ("What if your dental care
  started with understanding your anxiety first?") now leads into the nervous system section.
- Sedation removed from Understanding: the "Additional support where clinically appropriate" card and the two notes
  ("Sedation is one option, not the whole plan." and "Is this approach enough on its own?") are gone. What we do
  differently is now six cards, three and three.
- New "Who is The Anxious Patient Experience™ for?" section after What we do differently, word for word.
- Meet the Team: Lorna's new role and bio, word for word. On phones her photo is now a small, soft portrait beside
  her name so the words lead. Alex's photo placeholder matches.
- FAQs: new answers for "Can I use headphones or choose what I watch or listen to?" and "Is sedation available?",
  word for word (FAQ schema updated and moved to the homepage). The swipeable FAQ cards are kept. "Still have a
  question?" is now a light strip under the cards.
- Old page addresses (/understanding-the-experience/, /meet-the-team/, /faqs/) now forward to the matching section
  of the homepage (noindex, canonical to the homepage). sitemap.xml lists the homepage and Book Now only.
- Book Now: booking flow unchanged (four steps, $100 deposit, policy tick-box, test mode). New header, bottom bar
  removed.
- site.css and site.js links bumped to ?v=1.1.0.

## 1.0.9 (30 Sep 2026)

- Patient journey: scroll snapping is gone. Each page now turns like a book, one section at a time, with a slow, soft
  sideways slide (about one second). The visitor sets the pace: Continue and Back in the bottom bar, the progress bar,
  a sideways swipe on phones, the left and right arrow keys, or simply scrolling on past the end of a section. Nothing
  moves unless the visitor asks, and each scroll or swipe turns one section only.
- Going back is never blocked: scrolling or swiping the other way turns back straight away (only the leftover
  momentum of the gesture that just turned the page is ignored). Back is labelled in the bottom bar on larger screens,
  and the bounce at the top of the page is switched off on phones so a pull down always goes back.
- Sections longer than the window (Understanding cards, booking flow, text-heavy screens on small phones) scroll as
  normal first, then turn when you carry on past the end.
- Continue on the last section of a page leads to the next page in the journey: Home, Understanding the Experience,
  Meet the Team, FAQs, Book Now.
- The logo shows on the first section of each page; the footer shows after the last section.
- "Talk to Alex" turns to the last section and brings the contact details into view. Links to a section (for example
  /understanding-the-experience/#screen-4) open on that section.
- Reduced motion, or no JavaScript: one ordinary scrolling page with every section and the footer showing.
- site.css and site.js links bumped to ?v=1.0.9.

## 1.0.8 (30 Sep 2026)

- FAQs redesigned so the questions and answers fit one calm screen instead of a long accordion list. On desktop a
  numbered question index sits beside a large answer card; choose a question, or use the arrows, to change the card.
  On phones and tablets the answers are a deck of cards you swipe left and right (the next card peeks in), with
  Previous and Next arrows and a "1 / 10" counter. Swiping up or down still moves between screens.
- The cards use a native horizontal scroll-snap track, so swipe, trackpad and the arrow keys all work. Without
  JavaScript every question and answer shows as a plain list. Copy is unchanged, word for word, and the FAQ schema is
  untouched.
- site.css and site.js links bumped to ?v=1.0.8.

## 1.0.7 (29 Sep 2026)

- Phones: a swipe now always moves on to the next screen. Snapping is firm on every page (no more resting halfway
  between two screens), each screen is its own snap stop, and a short or slow swipe that would have settled back on
  the same screen glides on to the next one (passive touch listeners only, nothing is blocked).
- Screens taller than the window (Understanding cards, booking flow, FAQs, and the text-heavy screens on small phones)
  get reading stops about 80% of a window apart, ending with the screen's bottom edge, so swiping reads through them
  without skipping content.
- Progress bar shows whole segments: every screen you have reached is filled, the rest are empty. Only a screen taller
  than the window fills gradually while you read it.
- Booking: "Choose a time" and every booking step land on the booking panel, and snapping relaxes while a form field
  is in use so the keyboard never hides the field.
- site.css and site.js links bumped to ?v=1.0.7.

## 1.0.6 (29 Sep 2026)

- Every page is now a calm, screen by screen journey: each section fills the screen, and the page snaps to the next
  one with native CSS scroll snapping (no scroll-jacking; wheel, trackpad, touch and keyboard all work as normal).
- Screen map as briefed: Home 5 screens, Understanding 8, Meet the Team 4, Book Now 3, FAQs 3. Copy regrouped only,
  never reworded. The Home "Explore at your own pace" pathway cards are removed; their links now live in the bottom bar.
- Gentle reveals: each screen fades up when half in view; key points appear one by one about 0.7 seconds apart with a
  slow one second ease. Reveals play once, and anything reached with the keyboard shows at once.
- Header is the logo only, shown larger on the first screen and scrolling away with it (no sticky bar). The top menu,
  burger and mobile menu are gone.
- New bottom bar on every page: a progress bar with one clickable segment per screen, then Understanding the
  Experience, Meet the Team, FAQs and the Book Now pill. An underline slides in on hover and stays on the current
  page. On phones the three links sit behind an "Explore" button.
- Footer logo is larger. images/ape-logo.webp re-exported at 256px so the bigger logos stay sharp on high-resolution
  screens.
- Screens that can be taller than the window (Understanding cards, Book Now booking flow, FAQs, and the text-heavy
  screens on small phones) grow and scroll naturally, and the page switches to gentle proximity snapping.
- Reduced motion: no animation, no smooth scrolling, no snapping. Without JavaScript all content shows and the page
  scrolls normally.
- site.css and site.js links bumped to ?v=1.0.6.

## 1.0.5 (29 Sep 2026)

- Understanding, What we do differently: removed the Sensory support photo card; the seven cards are now the same
  size in a 4 + 3 layout with the second row centred (2 per row on tablet with the last card centred, 1 per row on
  mobile), and the descriptions line up across each row.
- Hover effect on every card sitewide: cards lift slightly with a soft shadow and taupe border; the icon circle turns
  tan on the What we do differently cards. Hover only on devices with a mouse; no lift when reduced motion is on.
- Fixed pathway card hovers that were slowed by the scroll reveal animation.
- Header stays on one line between tablet and desktop widths (the practice name beside the logo hides below 1100px).
- Caching: site.css and site.js links now carry a version number and are always rechecked, so layout changes show
  straight away. Fonts stay cached for a year, images for a day. (1.0.4 cached site.css for a year, which is why the
  photo card showed in the wrong place.)
- Removed images/understanding-sensory-support.webp.

## 1.0.4 (29 Sep 2026)

- All page photos replaced with the supplied set (The Anxious Patient Images): Home hero, The heart of the experience,
  Understanding hero, Our approach, Book Now hero.
- New photos added: Meet the Team hero, FAQs hero, and a Sensory support photo in the Understanding card grid.
- Understanding hero frame changed to landscape (same as Book Now) to suit the new photo.
- Real logo file replaces the CSS logo tile in the header and footer; logo added to the organisation schema and as a
  phone home screen icon.
- Social share image (1200 x 630 JPG) used on every page, with width, height and alt tags.
- Removed the old images: home-hero-lamp, home-heart-sofa, understanding-hero-curtains, understanding-approach-mug,
  book-now-nook.

## 1.0.3 (29 Sep 2026)

- Delivered as a plain HTML, CSS and JavaScript site with no build step, so it deploys to Vercel without Node or
  TypeScript (Framework Preset: Other).
- Booking flow, FAQ accordion, mobile menu and scroll reveals rewritten in plain JavaScript (`assets/site.js`).
- Fonts and images served locally from `assets/fonts` and `images`.
- Added `vercel.json` (clean URLs, trailing slashes, noindex on `*.vercel.app`, caching and security headers).
- No design preview banner (that was only on the review HTML files).

## 1.0.2

- Understanding the Experience hero (curtains) and approach (mug) images added.

## 1.0.1

- Lorna's bio and portrait updated (sand studio background).

## 1.0.0

- First full build of all pages, word for word from the approved copy doc.
