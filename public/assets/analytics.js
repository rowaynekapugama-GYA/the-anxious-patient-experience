/* Analytics for The Anxious Patient Experience website. Never on the dashboard and never on the questionnaire pages.

   The page chooses one of three modes by setting one value before this file loads:

   1. Tag Manager (window.APE_TM = "GTM-...", v1.15.0). The page already carries the Google Tag Manager snippet, which
      the server only adds on the live domain, on public pages, at an address with nothing but utm_ tags. This file
      does not load anything from Google. It only turns the booking events into named dataLayer events.
   2. Hand-off (window.APE_Q = 1, v1.15.0). The pay-later page. Its address carries a private link, so nothing from
      Google loads there. The three deposit events are kept in this browser tab (sessionStorage: the event name, the
      amount and the payment method, nothing else) and sent by mode 1 from the next public page opened in the tab.
   3. Direct Google Analytics 4 (window.APE_GA4 = "G-...", v1.11.0). Only when no Tag Manager ID is set.

   Privacy, strictly, in every mode: nothing that identifies a patient goes to Google.
   - Events (window.apeTrack) carry only their name and up to four plain values: method, value, currency, from.
     Any value that looks like an email, a phone number, a booking reference or a date is dropped, and so is
     anything else. Nothing typed into a form is ever sent.
   - In mode 3, addresses are cleaned before Google sees them: the pay-later link's ?t= token is removed, a
     questionnaire link becomes /questionnaire/[link], and any query value that is not a utm_ tag is dropped.
     In mode 1 the server does that job by never serving the container at such an address.
   - Google signals and ad personalisation are off. */
(function () {
  'use strict';
  if (window.apeTrack) return;
  var off = function () {};
  var path = window.location.pathname;
  var NEVER = /^\/(admin|cms|questionnaire)(\/|$)/;
  var PERSONAL = /@|\d{3}[\s.-]?\d{3}[\s.-]?\d{3}|APE-[0-9A-F]{6}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i;
  var NAME = /^[a-z][a-z0-9_]{0,39}$/;
  var KEYS = ['method', 'value', 'currency', 'from'];
  var QUEUE = 'ape_evq';
  var QUEUED = { deposit_policy_agreed: 1, deposit_started: 1, deposit_paid: 1 };

  /* Only the four known values get through: a short plain word, or (for value) an amount. */
  function safe(params) {
    var p = {};
    KEYS.forEach(function (k) {
      var v = params ? params[k] : undefined;
      if (k === 'value') { if (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 100000) p[k] = v; }
      else if (typeof v === 'string' && v.length <= 40 && /^[A-Za-z0-9 _-]+$/.test(v) && !PERSONAL.test(v)) p[k] = v;
    });
    return p;
  }

  /* ---------- 2. Hand-off: the pay-later page ---------- */
  if (window.APE_Q && !window.APE_TM) {
    if (NEVER.test(path)) { window.apeTrack = off; return; }
    window.apeTrack = function (name, params) {
      try {
        if (!QUEUED[String(name || '')]) return;
        var list = JSON.parse(window.sessionStorage.getItem(QUEUE) || '[]');
        if (!Array.isArray(list)) list = [];
        list.push({ n: String(name), p: safe(params) });
        window.sessionStorage.setItem(QUEUE, JSON.stringify(list.slice(-6)));
      } catch (e) { /* storage blocked: the event is simply not counted */ }
    };
    return;
  }

  /* ---------- 1. Tag Manager ---------- */
  if (window.APE_TM) {
    /* The server never sets APE_TM on these pages. This is a second lock, not the first. */
    var onlyUtm = true;
    try { new URLSearchParams(window.location.search).forEach(function (v, k) { if (!/^utm_(source|medium|campaign|content|term)$/.test(k)) onlyUtm = false; }); } catch (e) { onlyUtm = false; }
    if (!/^GTM-[A-Z0-9]{4,12}$/.test(String(window.APE_TM)) || NEVER.test(path) || /^\/book-now\/pay(\/|$)/.test(path) || /\.vercel\.app$/i.test(window.location.hostname) || !onlyUtm) { window.apeTrack = off; return; }
    window.dataLayer = window.dataLayer || [];
    var push = function (name, params) {
      if (!NAME.test(String(name || ''))) return;
      var p = safe(params);
      var ev = { event: String(name) };
      /* every value is set on every event, so one event's method or amount never sticks to the next */
      KEYS.forEach(function (k) { ev[k] = Object.prototype.hasOwnProperty.call(p, k) ? p[k] : undefined; });
      window.dataLayer.push(ev);
    };
    window.apeTrack = push;
    /* deposit events handed over by the pay-later page, once */
    try {
      var waiting = JSON.parse(window.sessionStorage.getItem(QUEUE) || '[]');
      window.sessionStorage.removeItem(QUEUE);
      if (Array.isArray(waiting)) waiting.slice(-6).forEach(function (e) {
        if (!e || !QUEUED[String(e.n || '')]) return;
        var p = safe(e.p);
        p.from = 'pay_link';
        push(e.n, p);
      });
    } catch (e) { /* nothing waiting */ }
    listenForClicks();
    return;
  }

  /* ---------- 3. Direct Google Analytics 4 (no Tag Manager ID set) ---------- */
  var id = String(window.APE_GA4 || '');
  if (!/^G-[A-Z0-9]{4,20}$/.test(id) || NEVER.test(path)) { window.apeTrack = off; return; }
  // never on preview deployments (the vercel.app address), so test bookings do not count
  if (/\.vercel\.app$/i.test(window.location.hostname)) { window.apeTrack = off; return; }

  var KEEP = /^utm_(source|medium|campaign|content|term)$/;
  function cleanUrl(href) {
    var u;
    try { u = new URL(href, window.location.href); } catch (e) { return ''; }
    var q = new URLSearchParams();
    u.searchParams.forEach(function (v, k) { if (KEEP.test(k)) q.set(k, v); });
    var cleanPath = u.pathname.replace(/^\/questionnaire\/[^/]+/, '/questionnaire/[link]');
    var qs = q.toString();
    return u.origin + cleanPath + (qs ? '?' + qs : '');
  }
  var loc = cleanUrl(window.location.href);
  var locPath = loc.replace(/^https?:\/\/[^/]+/, '');
  var ref = '';
  try { ref = document.referrer ? cleanUrl(document.referrer) : ''; } catch (e) { ref = ''; }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('js', new Date());
  var cfg = { page_location: loc, page_path: locPath, allow_google_signals: false, allow_ad_personalization_signals: false };
  if (ref) cfg.page_referrer = ref;
  gtag('config', id, cfg);
  var sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(sc);

  window.apeTrack = function (name, params) {
    if (!NAME.test(String(name || ''))) return;
    var p = safe(params);
    p.page_location = loc;
    gtag('event', name, p);
  };
  listenForClicks();

  // phone, email and Instagram links (the event says which kind of link, never the number or address)
  function listenForClicks() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var h = a.getAttribute('href') || '';
      if (/^tel:/i.test(h)) window.apeTrack('click_to_call');
      else if (/^mailto:/i.test(h)) window.apeTrack('click_email');
      else if (/^https?:\/\/(www\.)?instagram\.com\//i.test(h)) window.apeTrack('outbound_instagram');
    }, true);
  }
})();
