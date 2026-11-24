/**
 * Tag Manager rules (v1.15.0): which requests may get the container, what the snippet looks like, and what the
 * Site Settings field accepts. No database and no browser needed: `npm run test:gtm`.
 */
import { classifyQuery, decide, pathLooksPrivate, gtmCount, gtmFieldOk, gtmIdOf, gtmParts, injectGtm, isLiveHost, LIVE_HOSTS, CLICK_IDS } from '../src/lib/gtm'
import { analyticsTags, gtmId, mergeSettings } from '../src/lib/site'
import { settingsFileFromGlobal } from '../src/sitekit/sync'
import { DEFAULTS } from '../src/site.config'

let pass = 0
let fail = 0
function ok(name: string, cond: unknown, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}${detail ? `: ${detail}` : ''}`) }
}
const ID = 'GTM-PNMVSBCW'
const live = 'theanxiouspatientexperience.com.au'
const d = (host: string | null, search = '') => decide({ host, search, gtmId: ID })

console.log('\n--- 1. Where the container may load ---')
ok('the live domain gets the live copy', d(live) === 'live')
ok('www gets the live copy', d(`www.${live}`) === 'live')
ok('a port and capitals in the host make no difference', d(`WWW.${live.toUpperCase()}:443`) === 'live')
ok('the vercel.app address gets the plain page', d('the-anxious-patient-experience.vercel.app') === 'plain')
ok('a preview address gets the plain page', d('the-anxious-patient-experience-git-main-gya.vercel.app') === 'plain')
ok('localhost gets the plain page', d('localhost:3000') === 'plain')
ok('a lookalike domain gets the plain page', d(`evil-${live}`) === 'plain' && d(`${live}.evil.com`) === 'plain')
ok('no host header gets the plain page', d(null) === 'plain' && d('') === 'plain')
ok('with Tag Manager off, the live domain gets the plain page', decide({ host: live, search: '', gtmId: '' }) === 'plain')
ok('only the two live addresses are allowed', LIVE_HOSTS.length === 2 && LIVE_HOSTS.every((h) => isLiveHost(h)) && !LIVE_HOSTS.some((h) => /vercel|localhost/.test(h)))

console.log('\n--- 2. What may be in the address ---')
ok('utm_ tags are allowed', d(live, '?utm_source=instagram&utm_medium=social&utm_campaign=ape-launch&utm_content=bio') === 'live')
ok('the flyer QR tags are allowed', d(live, '?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch') === 'live')
ok('the pay-later token means the plain page', d(live, '?t=4f0c1d2e3a4b5c6d7e8f') === 'plain')
ok('a token next to utm_ tags still means the plain page', d(live, '?utm_source=email&t=4f0c1d2e3a4b5c6d7e8f') === 'plain')
ok('a PayPal return address means the plain page', d(live, '?token=8XK12345AB678901C&PayerID=ABCDEFGHIJKLM') === 'plain')
ok('a booking reference means the plain page', d(live, '?ref=APE-660A46') === 'plain')
ok('any unknown value means the plain page', d(live, '?email=someone%40example.com') === 'plain' && d(live, '?q=1') === 'plain' && d(live, '?embed=1') === 'plain')
ok('an email address inside a utm_ tag means the plain page', d(live, '?utm_source=newsletter&utm_term=someone%40example.com') === 'plain')
ok('a phone number inside a utm_ tag means the plain page', d(live, '?utm_source=sms&utm_content=0412%20345%20678') === 'plain')
ok('a date of birth inside a utm_ tag means the plain page', d(live, '?utm_source=x&utm_content=1990-03-14') === 'plain')
const fb = d(live, '?fbclid=IwAR0abc123')
ok('an Instagram or Facebook click ID is removed with a redirect', typeof fb === 'object' && fb.redirect === '')
const mix = d(live, '?utm_source=ig&fbclid=IwAR0abc&utm_medium=social&igsh=xyz')
ok('utm_ tags are kept when a click ID is removed', typeof mix === 'object' && mix.redirect === '?utm_source=ig&utm_medium=social')
const g = d(live, '?gclid=EAIaIQobChMI&gad_source=1&gbraid=0AAAA')
ok('Google Ads click IDs are removed too', typeof g === 'object' && g.redirect === '')
ok('a click ID next to a private value is not redirected: the plain page', d(live, '?fbclid=abc&t=4f0c1d2e3a4b5c6d7e8f') === 'plain')
ok('on vercel.app nothing is redirected', d('the-anxious-patient-experience.vercel.app', '?fbclid=abc') === 'plain')
ok('every click ID in the list is removed', CLICK_IDS.every((k) => { const v = classifyQuery(`?${k}=abc`); return v.kind === 'strip' && v.search === '' }))
ok('an empty query is clean', classifyQuery('').kind === 'clean' && classifyQuery('?').kind === 'clean')

console.log('\n--- 2b. The 404 page: mistyped private links ---')
ok('an ordinary mistyped address may have the container', !pathLooksPrivate('/nope/') && !pathLooksPrivate('/book-now-please/') && !pathLooksPrivate('/meet-the-teem/') && !pathLooksPrivate('/blog/some-post-title-2026/'))
ok('a capitalised questionnaire link is treated as private', pathLooksPrivate('/Questionnaire/Zk3mQ9xT7bLp2VnR4sWd8YhC/'))
ok('a misspelt questionnaire link is treated as private', pathLooksPrivate('/questionaire/Zk3mQ9xT7bLp2VnR4sWd8YhC'))
ok('a token on its own in the path is treated as private', pathLooksPrivate('/Zk3mQ9xT7bLp2VnR4sWd8YhC/') && pathLooksPrivate('/x/4f0c1d2e3a4b5c6d7e8f'))
ok('a cut pay-later link is treated as private', pathLooksPrivate('/book-now/payy/') && pathLooksPrivate('/Book-Now/Pay/'))
ok('an address with an email, a phone number or a booking reference is treated as private', pathLooksPrivate('/someone@example.com/') && pathLooksPrivate('/0412%20345%20678/') && pathLooksPrivate('/ref/APE-660A46/'))

console.log('\n--- 3. The snippet ---')
const parts = gtmParts(ID, '1.15.0')
const page = '<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/assets/site.css"/><title>x</title></head><body class="home"><a class="skip-link" href="#main">Skip</a></body></html>'
const out = injectGtm(page, parts)
const c = gtmCount(out)
ok('exactly one script and one noscript', c.script === 1 && c.noscript === 1)
ok('the script is the standard container script with this ID', out.includes(`<script async src="https://www.googletagmanager.com/gtm.js?id=${ID}"></script>`))
ok('it sits straight after the viewport tag, before the stylesheet', out.indexOf('gtm.js') < out.indexOf('rel="stylesheet"') && out.indexOf('name="viewport"') < out.indexOf('gtm.js'))
ok('the character set stays first in <head>', out.indexOf('<meta charset') < out.indexOf('<script'))
ok('the privacy defaults come before the container script', out.indexOf("gtag('consent','default'") > 0 && out.indexOf("gtag('consent','default'") < out.indexOf('gtm.js'))
ok('advertising storage, user data and personalisation are denied', /ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'/.test(out))
ok('Google signals and ad personalisation signals are off', out.includes('allow_google_signals:false') && out.includes('allow_ad_personalization_signals:false'))
ok("gtag('js') follows the script, as in the Cronulla and Lava Street snippet", out.indexOf("gtag('js',new Date())") > out.indexOf('gtm.js'))
ok('the noscript frame is straight after <body>', out.includes(`<body class="home"><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${ID}"`))
ok('analytics.js is put in Tag Manager mode', out.includes(`<script>window.APE_TM="${ID}";</script><script src="/assets/analytics.js?v=1.15.0" defer></script></head>`))
let threw = false
try { injectGtm(out, parts) } catch { threw = true }
ok('a page that already has the snippet is refused, never doubled', threw)
threw = false
try { gtmParts('GTM-<script>', '1') } catch { threw = true }
ok('anything that is not a GTM-... ID is refused', threw)

console.log('\n--- 4. The Site Settings field ---')
ok('a real ID is accepted', gtmFieldOk(ID) && gtmFieldOk(' gtm-pnmvsbcw '))
ok('blank is accepted (use the default)', gtmFieldOk('') && gtmFieldOk(null) && gtmFieldOk(undefined))
ok('"off" is accepted', gtmFieldOk('off') && gtmFieldOk('OFF'))
ok('a GA4 ID, a UA ID or free text is refused', !gtmFieldOk('G-16W6YW4PR4') && !gtmFieldOk('UA-123-1') && !gtmFieldOk('GTM-') && !gtmFieldOk('GTM-PNMV SBCW') && !gtmFieldOk('<script>'))
ok('the ID is read in capitals', gtmIdOf({ gtm: ' gtm-pnmvsbcw ' }) === ID)
ok('"off" and anything invalid mean no container', gtmIdOf({ gtm: 'off' }) === '' && gtmIdOf({ gtm: 'G-16W6YW4PR4' }) === '' && gtmIdOf(null) === '' && gtmIdOf({}) === '')
ok('the default container is GTM-PNMVSBCW', gtmId(DEFAULTS.tracking) === ID)
const fromDb = (tracking: Record<string, unknown>) => mergeSettings(settingsFileFromGlobal({ tracking })) as unknown as { tracking: { gtm?: string; ga4?: string } }
ok('a blank dashboard field keeps the default', gtmId(fromDb({ ga4: '', metaPixel: '', gtm: '' }).tracking) === ID && gtmId(fromDb({ ga4: null, metaPixel: null, gtm: null }).tracking) === ID)
ok('a blank field next to a GA4 ID still keeps the default', gtmId(fromDb({ ga4: 'G-ABCDEF1234', metaPixel: '', gtm: '' }).tracking) === ID)
ok('"off" in the dashboard switches it off', gtmId(fromDb({ ga4: '', metaPixel: '', gtm: 'off' }).tracking) === '')
ok('a different ID in the dashboard is used', gtmId(fromDb({ ga4: '', metaPixel: '', gtm: 'GTM-ABC1234' }).tracking) === 'GTM-ABC1234')

console.log('\n--- 5. No double counting ---')
ok('with a Tag Manager ID, the plain pages carry no analytics tag at all', analyticsTags({ ga4: '', gtm: ID }) === '')
ok('with a Tag Manager ID, a GA4 ID typed in later is still not loaded directly', analyticsTags({ ga4: 'G-ABCDEF1234', gtm: ID }) === '')
ok('with Tag Manager off and a GA4 ID, v1.11.0 loads Google Analytics directly', /window\.APE_GA4="G-ABCDEF1234"/.test(analyticsTags({ ga4: 'G-ABCDEF1234', gtm: 'off' })))
ok('with neither, nothing loads', analyticsTags({ ga4: '', gtm: 'off' }) === '' && analyticsTags({ ga4: '', gtm: '' }) === '')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
