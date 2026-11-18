/* Google Analytics 4 for The Anxious Patient Experience website (v1.11.0). Loaded only when a measurement ID is set
   (Site Settings > Tracking, or NEXT_PUBLIC_GA4_ID). Never on the dashboard, and not on the questionnaire pages.

   Privacy, strictly: nothing that identifies a patient goes to Google.
   - Addresses are cleaned before Google sees them: the pay-later link's ?t= token is removed, a questionnaire link
     becomes /questionnaire/[link], and any other query value that is not a utm_ tag is dropped.
   - Events (window.apeTrack) carry only their name and a few plain values (a payment method, an amount). Any value
     that looks like an email, a phone number, a booking reference or a date of birth is dropped.
   - Google signals and ad personalisation are off. Nothing typed into a form is ever sent. */
(function () {
  'use strict';
  if (window.apeTrack) return;
  var id = String(window.APE_GA4 || '');
  var off = function () {};
  if (!/^G-[A-Z0-9]{4,20}$/.test(id) || /^\/(admin|cms|questionnaire)(\/|$)/.test(window.location.pathname)) { window.apeTrack = off; return; }
  // never on preview deployments (the vercel.app address), so test bookings do not count
  if (/\.vercel\.app$/i.test(window.location.hostname)) { window.apeTrack = off; return; }

  var KEEP = /^utm_(source|medium|campaign|content|term)$/;
  function cleanUrl(href) {
    var u;
    try { u = new URL(href, window.location.href); } catch (e) { return ''; }
    var q = new URLSearchParams();
    u.searchParams.forEach(function (v, k) { if (KEEP.test(k)) q.set(k, v); });
    var path = u.pathname.replace(/^\/questionnaire\/[^/]+/, '/questionnaire/[link]');
    var qs = q.toString();
    return u.origin + path + (qs ? '?' + qs : '');
  }
  var loc = cleanUrl(window.location.href);
  var path = loc.replace(/^https?:\/\/[^/]+/, '');
  var ref = '';
  try { ref = document.referrer ? cleanUrl(document.referrer) : ''; } catch (e) { ref = ''; }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('js', new Date());
  var cfg = { page_location: loc, page_path: path, allow_google_signals: false, allow_ad_personalization_signals: false };
  if (ref) cfg.page_referrer = ref;
  gtag('config', id, cfg);
  var sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(sc);

  var PERSONAL = /@|\d{3}[\s.-]?\d{3}[\s.-]?\d{3}|APE-[0-9A-F]{6}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i;
  var NAME = /^[a-z][a-z0-9_]{0,39}$/;
  window.apeTrack = function (name, params) {
    if (!NAME.test(String(name || ''))) return;
    var p = {};
    Object.keys(params || {}).slice(0, 10).forEach(function (k) {
      var v = params[k];
      if (typeof v === 'number' && isFinite(v)) p[k] = v;
      else if (typeof v === 'string' && v.length <= 40 && !PERSONAL.test(v)) p[k] = v;
    });
    p.page_location = loc;
    gtag('event', name, p);
  };

  // phone, email and Instagram links (the event says which kind of link, never the number or address)
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (/^tel:/i.test(h)) window.apeTrack('click_to_call');
    else if (/^mailto:/i.test(h)) window.apeTrack('click_email');
    else if (/^https?:\/\/(www\.)?instagram\.com\//i.test(h)) window.apeTrack('outbound_instagram');
  }, true);
})();
