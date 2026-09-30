# Changelog

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
