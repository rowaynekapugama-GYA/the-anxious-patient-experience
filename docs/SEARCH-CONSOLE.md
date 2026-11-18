# Google Search Console for theanxiouspatientexperience.com.au (v1.11.0)

Search Console shows which Google searches show the site and how often people click. It needs a one-off ownership
check with a TXT record in the domain's DNS, then the sitemap. About 15 minutes, plus waiting for DNS.

## 1. Add the property

1. Go to https://search.google.com/search-console and sign in with the Google account that will own APE's Google
   access (the same one as GA4 and the Google Business Profile is easiest; add Lorna as an owner after).
2. **Add property** > **Domain** (left box, not URL prefix) > type `theanxiouspatientexperience.com.au` > **Continue**.
3. Google shows a TXT record that starts `google-site-verification=`. Press **Copy**. Leave this tab open.

## 2. Add the TXT record at VentraIP

First check where the DNS lives, as in `docs/GO-LIVE-DOMAIN.md` step 0 (`dig NS theanxiouspatientexperience.com.au +short`).
If the nameservers are VentraIP's:

1. VentraIP > **My Services** > the domain > **DNS Zone Editor** (cPanel: **Zone Editor**).
2. **Add record**:

| Type | Host / Name | Value | TTL |
|---|---|---|---|
| TXT | `@` (or leave blank, VentraIP's apex) | the whole `google-site-verification=...` string, no quotes | 3600 |

3. Save. Do not remove any other TXT records (email ones such as SPF stay as they are). If there is already a
   `google-site-verification` record from an old attempt, leave it; a second one does no harm.

If the nameservers point at Vercel instead, add the same TXT record in Vercel > Domains > the domain > DNS Records.

## 3. Verify

Back in Search Console press **Verify**. If it says not found, wait 15 to 60 minutes and press it again (DNS can take
a few hours). Check from a terminal with `dig TXT theanxiouspatientexperience.com.au +short`.

## 4. Submit the sitemap

1. Search Console > the property > **Sitemaps**.
2. Enter `https://theanxiouspatientexperience.com.au/sitemap.xml` and press **Submit**.
3. It should say **Success** with the site's pages. (The sitemap is also listed in `/robots.txt`.)

The sitemap lists the public pages only. Book Now's pay-later page, the questionnaire links and `/admin` are not in it
and are kept out of Google (marked noindex, or blocked in `/robots.txt`).

## 5. Afterwards

- **Settings > Users and permissions**: add Lorna (and GYA's account if it is not the owner) as Owner or Full user.
- Optional: in GA4, **Admin > Product links > Search Console links** to see search queries inside GA4.
- Leave the TXT record in place for good; removing it removes the verification.
- First data appears after 2 or 3 days.
