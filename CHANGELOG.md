# Changelog

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
