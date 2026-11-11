# Go-live: theanxiouspatientexperience.com.au (VentraIP)

Prepared 11 November 2026 for v1.7.0. Nothing here has been changed yet: do these steps in order once VentraIP
access is in hand. Allow 10 minutes of work and up to a few hours for DNS to settle.

## 0. Before touching DNS

1. **Check the nameservers.** In Terminal: `dig NS theanxiouspatientexperience.com.au +short` (or
   https://dnschecker.org, record type NS). If they are VentraIP's (`ns1.nameserver.net.au` style, or whatever
   VentraIP shows under Domain > Nameservers), the records below go in VentraIP's DNS zone editor. If they point
   somewhere else (Cloudflare, another host), the records go there instead and VentraIP is only the registrar.
2. **Look for existing email.** `dig MX theanxiouspatientexperience.com.au +short` and `dig TXT` on the apex. If any
   MX, SPF (`v=spf1`), DKIM (`*._domainkey`) or DMARC (`_dmarc`) records exist, someone may already be using the
   domain for email. **Leave every MX, SPF, DKIM, DMARC and other TXT record exactly as it is.** The website only needs
   the A and CNAME records below. Lorna has asked for email to stay as it is for now.
3. Confirm with Lorna that the domain is hers and active (she said it is, with VentraIP, on 10 Nov 2026).

## 1. Add the domain in Vercel

Vercel > the-anxious-patient-experience > Settings > Domains:

1. Add `theanxiouspatientexperience.com.au`. Choose it as the **primary** domain when asked.
2. Add `www.theanxiouspatientexperience.com.au` and set it to **Redirect to theanxiouspatientexperience.com.au**
   (308, permanent). Vercel offers this in the same dialog ("Redirect to another domain").
3. Vercel then shows the DNS values it wants for this project. Use those exact values in step 2. They normally look
   like the ones below, but always copy what Vercel shows.

## 2. DNS records at VentraIP (or wherever the nameservers point)

VentraIP: My Services > the domain > DNS Zone Editor (cPanel: Zone Editor).

| Type | Name (host) | Value | TTL | Note |
|---|---|---|---|---|
| A | `@` (the apex) | the IPv4 address Vercel shows, currently `76.76.21.21` | 300 while cutting over, 3600 after | Replace any existing A record for `@` (a parked-page address). Do not add a second one. |
| CNAME | `www` | `cname.vercel-dns.com` | 300, then 3600 | Replace any existing `www` A or CNAME. |

Do not add AAAA records unless Vercel lists one. If VentraIP already has an A record pointing at a "coming soon"
parking page, that is the one to replace. Leave `mail`, `autodiscover`, `_dmarc`, `*._domainkey` and every MX and TXT
record alone.

Vercel checks the records by itself and issues the HTTPS certificate (Let's Encrypt) within a few minutes of the
records resolving. Both names show a green tick under Domains when done. If VentraIP's zone has a very long TTL on
the old records, the switch can take up to that long to be seen everywhere.

## 3. Vercel environment variable

Settings > Environment Variables > Production: `NEXT_PUBLIC_SERVER_URL` = `https://theanxiouspatientexperience.com.au`
(no trailing slash). Then **Redeploy** the latest production deployment (Deployments > the three dots > Redeploy), or
press Publish website in the dashboard. Everything below follows from that one variable:

- canonical tags, Open Graph `og:url` and absolute `og:image` addresses on every page
- `sitemap.xml` and the `Sitemap:` line in `robots.txt`
- the structured data (`MedicalOrganization.url`, logo)
- the links in booking, password and welcome emails, and the dashboard's own address
- the Payload `serverURL` and allowed origins for the dashboard sign-in

**Indexing is set by environment, not by hand.** Production on the real domain is indexable; preview deployments are
rendered `noindex` and get `robots.txt: Disallow: /` (v1.7.0, `VERCEL_ENV=preview`); every `*.vercel.app` address also
carries `X-Robots-Tag: noindex` from `next.config.mjs`. So the vercel.app address keeps working for printed flyers
without ever competing with the domain in Google.

**Nothing is hard-coded to vercel.app.** The only place the address appears is the `siteUrl` fallback in
`src/site.config.ts`, used when no `NEXT_PUBLIC_SERVER_URL` is set and Vercel reports no production address.
Checked 11 Nov 2026 with `grep -rn "vercel.app" src content public/assets scripts`.

## 4. Links to update once the domain is live

| Where | What | Who |
|---|---|---|
| The Caringbah Dentists website | the APE link in the menu and on the APE page (`ape.url`, `ape.bookUrl` in that site's config) | GYA |
| The Cronulla Dentists website | same | GYA |
| QR codes | `deliverables/qr/ape-flyer-qr*.png/svg` already point at `https://theanxiouspatientexperience.com.au/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch` (regenerated 11 Nov 2026). The old vercel.app code is kept as `ape-flyer-qr-staging.*` and keeps working. Print the domain version. | GYA to send; Lorna's designer to use |
| Review page QR | `deliverables/qr/ape-review-qr*` points at `https://theanxiouspatientexperience.com.au/review/` | after the Google review link is in Site Settings |
| Stripe Payment Link | "After payment" confirmation page address, if it points at the site (and the webhook address, `docs/TEST-BOOKING.md`) | Stripe account owner with GYA |
| Google Business Profile | website and appointment links (`docs/GOOGLE-BUSINESS-PROFILE.md`) | GYA |
| Social profiles, email signatures | the new address | practice |

## 5. Sending email from the APE domain (option, not now)

Lorna wants the email account left as it is. When she and Ram are ready, SMTP2GO can verify
`theanxiouspatientexperience.com.au` for sending **without any mailbox**: SMTP2GO > Sending > Verified senders >
Sender domains > add the domain, then add the three CNAME records it shows (two DKIM, one return-path, for example
`s123456._domainkey`, `em123456`, `link`). No MX, SPF or mailbox change, so existing email is untouched. Then in
Vercel set `BOOKING_FROM` = `The Anxious Patient Experience <bookings@theanxiouspatientexperience.com.au>` and
redeploy. Booking, password, welcome and notification emails then come from the APE domain; replies still go to
the current inbox (`Reply-To` is Site Settings > APE enquiries email). Until then the sender stays on a domain already
verified in SMTP2GO (the Cronulla Dentists domain was the v1.6.0 assumption).

## 6. Go-live checklist (v1.7.0)

- [ ] **Launch blocker from v1.6.0 still stands:** `SMTP2GO_API_KEY` and `BOOKING_FROM` (verified sender) in Vercel.
      Without them Book Now cannot take a booking, no login emails go out, and forgotten-password does nothing.
- [ ] `BOOKING_NOTIFY_EMAIL` and `DASHBOARD_EDITORS` in Vercel (v1.6.0); `ALLOW_FIRST_USER`, `ADMIN_PASSWORD`,
      `BOOKING_NOTIFY_TO` deleted
- [ ] Steps 0 to 3 above; both domains green in Vercel; `https://www.theanxiouspatientexperience.com.au/` 308s to the apex
- [ ] `https://theanxiouspatientexperience.com.au/robots.txt` allows crawling and names the sitemap;
      `view-source:` of the homepage shows `<link rel="canonical" href="https://theanxiouspatientexperience.com.au/">`
      and no `noindex`
- [ ] Dashboard sign-in works on the domain (`/admin`); Publish website still works
- [ ] Test booking on the domain (`docs/TEST-BOOKING.md`), then cancelled
- [ ] Pop-up shows on first open of the homepage (desktop and phone)
- [ ] Google Search Console: add the domain property (DNS TXT record at VentraIP, this one is fine to add) and submit
      `sitemap.xml`
- [ ] Links in step 4 updated; QR files sent to Lorna
- [ ] Repo is private
- [ ] Questionnaire stays **off** (`QUESTIONNAIRE_ENABLED` unset) until Lorna's originals, email wording and privacy
      wording are approved
