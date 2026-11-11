/* The Anxious Patient Experience: site script.
   Continuous scroll (fixed header with section links, gentle scroll-triggered motion, a hairline scroll progress),
   FAQ cards and the Book Now flow. Clinic details, appointment times and booking rules come from
   assets/site-config.js (window.APE_CONFIG).
   Booking (3 Nov 2026): times and prices come from /api/availability/ and requests go to /api/booking/, which saves
   them for the dashboard (/admin/) and emails the APE inbox. The team confirms by hand; nothing connects to Core
   Practice. The $100 deposit is paid through PayPal inside the flow once PayPal is set up in Vercel (v1.8.0). */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceMQ.matches;
  var hasIO = 'IntersectionObserver' in window;
  var SCROLL = reduce ? 'auto' : 'smooth';
  var STAGGER = 0.14;     /* seconds between items that appear one by one */

  /* ---------- Gentle reveals ----------
     Each piece fades, slides or settles in once as it scrolls into view. Pieces marked .seq that arrive together
     follow one another. Anything that receives keyboard focus is shown at once. */
  var reveals = [].slice.call(document.querySelectorAll('.reveal'));
  function showNow(el) { el.style.setProperty('--d', '0s'); el.classList.add('in'); }

  if (!hasIO || reduce) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealIO = new IntersectionObserver(function (entries) {
      var arriving = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; });
      arriving.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
      var counts = [];
      arriving.forEach(function (el) {
        if (el.classList.contains('seq')) {
          var parent = el.parentNode, n = 0;
          for (var i = 0; i < counts.length; i++) if (counts[i].p === parent) { n = ++counts[i].n; break; }
          if (i === counts.length) counts.push({ p: parent, n: 0 });
          el.style.setProperty('--d', Math.min(0.15 + n * STAGGER, 1.2).toFixed(2) + 's');
        }
        el.classList.add('in');
        revealIO.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    reveals.forEach(function (el) { revealIO.observe(el); });
    document.addEventListener('focusin', function (ev) {
      var el = ev.target.closest ? ev.target.closest('.reveal') : null;
      while (el) {
        if (!el.classList.contains('in')) { showNow(el); revealIO.unobserve(el); }
        el = el.parentNode && el.parentNode.closest ? el.parentNode.closest('.reveal') : null;
      }
      [].forEach.call(ev.target.querySelectorAll ? ev.target.querySelectorAll('.reveal:not(.in)') : [], showNow);
    });
  }

  /* ---------- Header: fixed, always visible; it turns softly frosted and a little smaller once you scroll ---------- */
  var header = document.querySelector('.site-header');
  var burger = header && header.querySelector('.burger');
  var menu = document.getElementById('mobile-menu');

  function setMenu(open) {
    if (!header || !burger) return;
    header.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(!header.classList.contains('open')); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && header.classList.contains('open')) { setMenu(false); burger.focus(); }
    });
    document.addEventListener('click', function (ev) {
      if (header.classList.contains('open') && !header.contains(ev.target)) setMenu(false);
    });
    if (menu) menu.addEventListener('click', function (ev) { if (ev.target.closest('a')) setMenu(false); });
  }

  /* ---------- Section links: the current section is underlined in the header ---------- */
  var navLinks = [].slice.call(document.querySelectorAll('.nav-links a[data-section]'));
  var anchors = navLinks.length ? ['understanding', 'who-is-it-for', 'meet-the-team', 'faqs'].map(function (id) { return document.getElementById(id); }) : [];
  anchors = anchors.filter(Boolean);
  var bar = document.querySelector('.scroll-progress span');

  var ticking = false;
  function onFrame() {
    ticking = false;
    var y = window.pageYOffset, vh = window.innerHeight;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (anchors.length) {
      var here = '';
      anchors.forEach(function (sec) { if (sec.getBoundingClientRect().top <= vh * 0.4) here = sec.id; });
      navLinks.forEach(function (a) { a.classList.toggle('is-here', a.getAttribute('data-section') === here); });
    }
    if (bar) {
      var max = doc.scrollHeight - vh;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ')';
    }
  }
  function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(onFrame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onFrame();

  /* ---------- "Read more" on long bios ----------
     Starts closed; the button opens and closes the rest. Without JavaScript the button stays hidden and all of
     the bio shows. */
  [].forEach.call(document.querySelectorAll('.read-more[aria-controls]'), function (btn) {
    var more = document.getElementById(btn.getAttribute('aria-controls'));
    if (!more) return;
    var label = btn.querySelector('.read-more-label');
    function setOpen(open) {
      more.classList.toggle('is-collapsed', !open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = open ? 'Read less' : 'Read more';
      if (open) [].forEach.call(more.querySelectorAll('.reveal'), function (el) { el.classList.add('in'); });
    }
    /* a link straight to the hidden part (the booking form links to #privacy-more) opens it */
    setOpen(location.hash === '#' + more.id);
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
      if (!open) {
        /* after closing, make sure the button is still on screen */
        var hdr = header ? header.getBoundingClientRect().bottom : 0;
        var r = btn.getBoundingClientRect();
        if (r.top < hdr + 8) btn.scrollIntoView({ behavior: SCROLL, block: 'center' });
      }
    });
  });

  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function () { window.location.reload(); });
  doc.classList.add('js-ready');

  /* ---------- FAQs: question index and swipeable answer cards ----------
     The cards sit in a native horizontal scroll-snap track (swipe, trackpad or arrow keys all work).
     The index, the arrows and the counter just move that track and follow where it is. */
  [].forEach.call(document.querySelectorAll('.faq-deck'), function (deck) {
    var track = deck.querySelector('.faq-track');
    var cards = [].slice.call(deck.querySelectorAll('.faq-card'));
    var jumps = [].slice.call(deck.querySelectorAll('.faq-jump'));
    var prev = deck.querySelector('.faq-prev'), next = deck.querySelector('.faq-next');
    var now = deck.querySelector('.faq-now');
    var current = 0;
    function show(i) {
      current = i;
      jumps.forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      if (now) now.textContent = String(i + 1);
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === cards.length - 1;
    }
    function go(i) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      track.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: SCROLL });
      show(i);
    }
    jumps.forEach(function (b, k) { b.addEventListener('click', function () { go(k); }); });
    if (prev) prev.addEventListener('click', function () { go(current - 1); });
    if (next) next.addEventListener('click', function () { go(current + 1); });
    var t;
    track.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var best = 0, dist = Infinity, left = track.scrollLeft;
        cards.forEach(function (c, k) {
          var d = Math.abs(c.offsetLeft - cards[0].offsetLeft - left);
          if (d < dist) { dist = d; best = k; }
        });
        if (best !== current) show(best);
      }, 90);
    }, { passive: true });
    show(0);
  });

  /* ---------- Opening special: ribbon, FAQ note and a gentle pop-up (homepage) ----------
     The booking system (/api/availability/) says whether any special-priced time is still free. If not (all six
     taken, or the dates have passed), nothing shows. Nothing shows without JavaScript either. */
  var APE_API = '/api/availability/';
  function moneyStr(n) { return '$' + Number(n).toLocaleString('en-AU'); }
  function dayList(days) {
    var names = days.map(function (d) {
      var p = d.split('-').map(Number);
      return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
    });
    if (names.length < 2) return names.join('');
    return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
  }
  function specialYear(days) { return days.length ? days[days.length - 1].slice(0, 4) : ''; }
  var ribbon = document.querySelector('[data-special-ribbon]');
  var faqNote = document.querySelector('[data-special-note]');
  var pop = document.getElementById('special-pop');
  var popT0 = Date.now();   /* the pop-up delay counts from here (the page is interactive once this script runs) */
  if ((ribbon || faqNote || pop) && window.fetch) {
    fetch(APE_API + '?summary=1', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        var sp = res && res.special;
        if (!sp || !sp.active || !sp.days || !sp.days.length) return;
        var when = dayList(sp.days) + ' ' + specialYear(sp.days);
        /* NEW COPY (3 Nov 2026), waiting on the client's sign-off */
        if (ribbon) {
          ribbon.querySelector('.special-ribbon-text').textContent = moneyStr(sp.price) + ' for our first six patients (usually ' + moneyStr(sp.regular) + ')';
          ribbon.hidden = false;
        }
        if (faqNote) {
          faqNote.textContent = 'Opening special: for our first six patients, the full appointment is ' + moneyStr(sp.price) +
            ' instead of ' + moneyStr(sp.regular) + ', for appointments on ' + when + '. Health fund rebates are still available, and the ' +
            'deposit still applies.';
          faqNote.hidden = false;
        }
        if (pop && sp.popup && typeof pop.showModal === 'function') setUpPopup(pop, sp, when);
      })
      .catch(function () { /* stay hidden */ });
  }
  /* The pop-up (v1.7.0): shows on the first open of the homepage, about 0.8 seconds after the page is interactive
     (the delay is a dashboard setting), once per browser session, and not again for 7 days after it is closed.
     Every storage read and write is wrapped, so a browser that blocks storage (private mode, in-app browsers) still
     gets it once per page view and never an error. It only exists on the homepage. */
  function setUpPopup(dlg, sp, when) {
    var SESSION_KEY = 'ape-pop-shown', DISMISS_KEY = 'ape-pop-dismissed', WEEK = 7 * 24 * 60 * 60 * 1000;
    function read(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
    function write(store, key, value) { try { window[store].setItem(key, value); } catch (e) { /* storage blocked */ } }
    if (read('sessionStorage', SESSION_KEY)) return;
    var dismissedAt = Number(read('localStorage', DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < WEEK) return;

    var heading = dlg.querySelector('#special-pop-title');
    if (heading && sp.heading) heading.textContent = sp.heading;
    var body = String(sp.body || 'To welcome our first patients, the full 70-minute Anxious New Patient Experience is {price} instead of {regular} for appointments on {dates}. Health fund rebates are still available, and a $100 deposit secures your time.');
    dlg.querySelector('.special-pop-body').textContent = body.split('{price}').join(moneyStr(sp.price)).split('{regular}').join(moneyStr(sp.regular)).split('{dates}').join(when);

    var shown = false, before = null, tries = 0;
    function open() {
      if (shown) return;
      /* wait if the mobile menu or another dialog is open (try again a few times) */
      if (document.querySelector('dialog[open]') || (header && header.classList.contains('open'))) {
        if (tries++ < 20) setTimeout(open, 1000);
        return;
      }
      shown = true;
      write('sessionStorage', SESSION_KEY, '1');
      before = document.activeElement;
      try { dlg.showModal(); } catch (e) { return; }
      doc.classList.add('pop-open');
      dlg.classList.add('is-open');
      var inner = dlg.querySelector('.special-pop-inner');
      if (inner) inner.focus({ preventScroll: true });
    }
    function finish() {
      doc.classList.remove('pop-open');
      if (dlg.open) dlg.close();
      if (before && typeof before.focus === 'function' && document.contains(before)) before.focus({ preventScroll: true });
    }
    function close() {
      write('localStorage', DISMISS_KEY, String(Date.now()));
      dlg.classList.remove('is-open');
      if (reduce) { finish(); return; }
      setTimeout(finish, 260);
    }
    [].forEach.call(dlg.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', close); });
    [].forEach.call(dlg.querySelectorAll('a[href]'), function (a) { a.addEventListener('click', function () { write('localStorage', DISMISS_KEY, String(Date.now())); }); });
    dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); close(); });   /* Esc */
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) close(); });   /* click outside the card */
    var delay = Number(sp.showAfter);
    if (!isFinite(delay) || delay < 0) delay = 0.8;
    setTimeout(open, Math.max(0, delay * 1000 - (Date.now() - popT0)));
  }

  /* ---------- Google review page (/review/, v1.7.0) ----------
     Every star and the button do exactly the same thing: open the "taking you to Google" pop-up and go to the one
     Google review link from Site Settings. Nothing about the rating is stored or branched on (Google's review policy
     and the ACCC both prohibit steering only happy patients to public reviews). With no link yet, "coming soon" shows. */
  var reviewRoot = document.querySelector('[data-review]');
  if (reviewRoot) {
    var reviewLink = String(reviewRoot.getAttribute('data-review-link') || '').trim();
    var ask = reviewRoot.querySelector('[data-review-ask]');
    var soon = reviewRoot.querySelector('[data-review-soon]');
    var rdlg = document.getElementById('review-pop');
    var okLink = /^https:\/\/(g\.page|search\.google\.com|www\.google\.com|maps\.app\.goo\.gl|goo\.gl|maps\.google\.com|business\.google\.com)\//i.test(reviewLink);
    if (okLink && ask) { ask.hidden = false; if (soon) soon.hidden = true; }
    else if (soon) { soon.hidden = false; if (ask) ask.hidden = true; }
    if (okLink && rdlg) {
      [].forEach.call(rdlg.querySelectorAll('[data-review-link-out]'), function (a) { a.setAttribute('href', reviewLink); });
      var timer = null, rBefore = null;
      var goNow = function () { window.location.href = reviewLink; };
      var closeReview;
      var openReview = function () {
        if (typeof rdlg.showModal !== 'function') { goNow(); return; }
        rBefore = document.activeElement;
        try { rdlg.showModal(); } catch (e) { goNow(); return; }
        doc.classList.add('pop-open');
        rdlg.classList.add('is-open');
        var first = rdlg.querySelector('[data-review-link-out]');
        if (first) first.focus({ preventScroll: true });
        clearTimeout(timer);
        timer = setTimeout(goNow, 1500);
      };
      closeReview = function () {
        clearTimeout(timer);
        rdlg.classList.remove('is-open');
        doc.classList.remove('pop-open');
        if (rdlg.open) rdlg.close();
        if (rBefore && typeof rBefore.focus === 'function') rBefore.focus({ preventScroll: true });
      };
      [].forEach.call(reviewRoot.querySelectorAll('[data-review-go]'), function (b) { b.addEventListener('click', openReview); });
      [].forEach.call(rdlg.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeReview); });
      rdlg.addEventListener('cancel', function (ev) { ev.preventDefault(); closeReview(); });
      rdlg.addEventListener('click', function (ev) { if (ev.target === rdlg) closeReview(); });
    }
  }

  /* ---------- Book Now ----------
     Times and prices come from the booking system (/api/availability/): blocked days, times already requested and
     anything under 24 hours away are left out, and each time carries its fee ($250 opening special or $350).
     "Send booking request" posts to /api/booking/, which checks everything again, saves the request and emails the
     APE inbox and the patient. With PayPal set up (deposit.mode 'paypal'), the PayPal buttons then take the $100
     deposit right here (/api/paypal/order and /api/paypal/capture mark the booking paid); until then the patient is told
     the deposit details come with their confirmation (deposit.mode 'later'). */
  var bookingEl = document.getElementById('booking');
  if (!bookingEl) return;
  var flowBox = bookingEl.parentNode;

  var COPY = {"steps": ["Choose your appointment", "Enter your details", "Pay your $100 deposit", "Booking confirmed"], "policy": {"items": [{"lead": "48 hours' notice or more:", "text": "your deposit can be transferred to a new appointment or refunded."}, {"lead": "Less than 48 hours' notice or non-attendance:", "text": "your deposit may be retained."}, {"lead": "If anxiety is making it hard to attend:", "text": "please contact us. We would much rather hear from you than have you simply not come."}], "checkbox": "I have read and understand the deposit and cancellation policy.", "paymentButton": "Pay $100 deposit"}, "confirmation": {"heading": "You're booked in.", "body": "Your appointment details have been sent to your email. Before your visit, we'll be in touch to learn a little more about you and what will help you feel comfortable.", "accent": "You've already taken the hardest step.", "next": "The APE team will be in touch to confirm your appointment and send your new patient information pack."}};
  /* confirmation.next is NEW COPY (26 Oct 2026) waiting on the client's sign-off */
  var CONFIG = window.APE_CONFIG || {};
  var SESSIONS = CONFIG.booking || { minNoticeHours: 24, timeZone: 'Australia/Sydney' };
  var CLINIC = CONFIG.clinic || null;
  var PHONE = (CONFIG.contact && CONFIG.contact.phone) || '(02) 8599 9815';
  var ENDPOINT = '/api/booking/';  /* trailing slash: vercel.json sets trailingSlash, so this skips a redirect */
  var UI = {
    cont: 'Continue', back: 'Back', none: 'No appointments are available right now.',
    name: 'Your name', email: 'Email address', phone: 'Phone number (optional)',
    notes: 'What would you like support with? (optional)',
    errName: 'Please enter your name.', errEmail: 'Please enter a valid email address.',
    tooSoon: 'That time is now less than 24 hours away, so it can no longer be booked online. Please choose another time, or contact the clinic directly on ' + PHONE + '.',
    /* NEW UI COPY (26 Oct and 3 Nov 2026), waiting on the client's sign-off */
    consent: 'I agree to the APE team using these details to arrange my appointment, as set out in the <a href="/privacy-policy/#privacy-more" target="_blank" rel="noopener">Privacy Policy<span class="sr-only"> (opens in a new tab)</span></a>.',
    errConsent: 'Please tick this box so we can arrange your appointment.',
    sending: 'Sending your request',
    sendFail: 'Sorry, we could not send your booking request just now. Please try again, or contact the clinic on ' + PHONE + '.',
    loadFail: 'Sorry, we could not load the available times just now. Please refresh the page, or contact the clinic on ' + PHONE + '.',
    taken: 'Sorry, that time has just been requested by someone else. Please choose another time.',
    rebates: 'Health fund rebates available.',
    specialTag: 'Opening special',
    feeSpecial: function (p, r) { return 'Fee: ' + moneyStr(p) + ' opening special (usually ' + moneyStr(r) + '). Health fund rebates available.'; },
    feeStandard: function (p) { return 'Fee: ' + moneyStr(p) + '. Health fund rebates available.'; },
    depositLater: 'Deposit details will be sent with your confirmation.',
    depositPaypal: 'Next you can pay the $100 deposit securely with PayPal or a debit or credit card. You do not need a PayPal account.',
    sendLater: 'Send booking request',
    sendPaypal: 'Send request and pay deposit',
    payHeading: 'Pay your $100 deposit',
    payIntro: 'Your time is held. Paying the deposit now secures it; the deposit comes off the cost of your appointment.',
    payLoading: 'Loading secure payment options',
    payCancelled: 'No payment was taken. You can try again, or pay later using the link in your email.',
    payFail: 'Sorry, the payment could not be completed. Nothing has been charged. Please try again, or pay later using the link in your email.',
    payLater: 'Pay later',
    payLaterNote: 'Your booking request has been sent and the private payment link is in your email for 14 days.',
    paidLine: 'Your $100 deposit has been received. Thank you.',
    unpaidLine: 'Your $100 deposit has not been paid yet. You can pay it securely here:',
    unpaidLink: 'Pay your deposit',
    specialCard: function (when) { return 'for our first six patients, for appointments on ' + when + '. Health fund rebates are still available.'; }
  };

  function typeset(s) {
    return String(s)
      .replace(/(\w)'(\w)/g, '$1’$2')
      .replace(/(^|[\s(\[])'/g, '$1‘')
      .replace(/'/g, '’')
      .replace(/(^|[\s(\[])"/g, '$1“')
      .replace(/"/g, '”');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(s) { return esc(typeset(s)); }

  var TZ = SESSIONS.timeZone || 'Australia/Sydney';
  function fmtDay(iso) { return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso)); }
  function fmtTime(iso) { return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).replace(/[  ]/g, ' '); }
  function dayKey(iso) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso)); }
  /* A time must still be at least minNoticeHours away when each step is shown (the page may have been left open). */
  function bookable(slot) { return !!slot && new Date(slot.start).getTime() >= Date.now() + (SESSIONS.minNoticeHours || 24) * 3600000; }

  var state = { step: 1, loading: true, loadError: false, slots: [], special: null, deposit: { mode: 'later', amount: 100 },
    slot: null, details: { name: '', email: '', phone: '', notes: '', website: '' }, consent: false, errors: {}, ack: false,
    ref: '', price: null, wasSpecial: false, payment: null, paid: false, payState: 'idle', sending: false };

  function loadSlots(then) {
    state.loading = true;
    fetch(APE_API, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (res) {
        state.loading = false; state.loadError = false;
        state.slots = (res.slots || []).filter(bookable);
        state.special = res.special || null;
        state.deposit = res.deposit || state.deposit;
        if (state.slot) {
          var still = null;
          state.slots.forEach(function (s) { if (s.start === state.slot.start) still = s; });
          state.slot = still;
        }
        showSpecialCard();
        if (then) then();
      }, function () {
        state.loading = false; state.loadError = true;
        if (then) then();
      });
  }
  function showSpecialCard() {
    var card = document.querySelector('[data-special-card]');
    if (!card) return;
    var sp = state.special;
    if (!sp || !sp.active || !sp.days || !sp.days.length) { card.hidden = true; return; }
    card.querySelector('.special-card-text').textContent = UI.specialCard(dayList(sp.days) + ' ' + specialYear(sp.days));
    card.hidden = false;
  }

  function stepsHtml() {
    return '<ol class="steps" aria-label="How booking works">' + COPY.steps.map(function (label, i) {
      var n = i + 1, st = n < state.step ? 'done' : n === state.step ? 'current' : 'todo';
      return '<li data-state="' + st + '"' + (n === state.step ? ' aria-current="step"' : '') + '>' + t(label) + '</li>';
    }).join('') + '</ol>';
  }
  function clinicLine() {
    return CLINIC ? esc(CLINIC.name + ', ' + CLINIC.street + ', ' + CLINIC.suburb) : '';
  }
  function feeLine(price, special) {
    var regular = (state.special && state.special.regular) || 350;
    return special ? UI.feeSpecial(price, regular) : UI.feeStandard(price);
  }
  function chosenHtml(extraStyle) {
    return state.slot ? '<p class="chosen"' + (extraStyle || '') + '>' + esc(fmtDay(state.slot.start) + ', ' + fmtTime(state.slot.start)) +
      (CLINIC ? '<span class="chosen-clinic">' + clinicLine() + '</span>' : '') +
      '<span class="chosen-fee">' + esc(feeLine(state.slot.price, state.slot.special)) + '</span></p>' : '';
  }
  function panelHtml() {
    var s = state.step, h = '';
    if (s === 1) {
      h += '<div><h3>' + t(COPY.steps[0]) + '</h3>';
      if (state.errors.slot) h += '<p class="err slot-err" role="alert">' + esc(state.errors.slot) + '</p>';
      if (state.loading) h += '<p>Loading available times</p>';
      else if (state.loadError) h += '<p class="err" role="alert">' + esc(UI.loadFail) + '</p>';
      else if (!state.slots.length) h += '<p>' + UI.none + '</p>';
      else {
        var groups = [];
        state.slots.forEach(function (sl) {
          var k = dayKey(sl.start), g = groups[groups.length - 1];
          if (!g || g.key !== k) { g = { key: k, label: fmtDay(sl.start), slots: [], special: false }; groups.push(g); }
          g.slots.push(sl);
          if (sl.special) g.special = true;
        });
        h += '<div class="slot-days">' + groups.map(function (g) {
          var sample = g.slots[0];
          return '<div class="slot-day' + (g.special ? ' is-special' : '') + '"><div class="day">' + esc(g.label) +
            (g.special ? ' <span class="slot-special">' + esc(UI.specialTag) + ' ' + esc(moneyStr(sample.price)) + '</span>' : '') +
            '</div><div class="slot-times">' + g.slots.map(function (sl) {
              return '<button type="button" class="slot" data-start="' + esc(sl.start) + '" aria-pressed="' + (state.slot && state.slot.start === sl.start ? 'true' : 'false') + '"' +
                ' aria-label="' + esc(fmtDay(sl.start) + ', ' + fmtTime(sl.start) + ', ' + moneyStr(sl.price)) + '">' + esc(fmtTime(sl.start)) + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>';
      }
      h += chosenHtml();
      h += '<div class="row-actions"><button type="button" class="btn" data-act="to2"' + (state.slot ? '' : ' disabled') + '>' + UI.cont + '</button></div></div>';
    }
    if (s === 2) {
      var d = state.details, e = state.errors;
      h += '<form novalidate data-act="details"><h3>' + t(COPY.steps[1]) + '</h3><div class="form-grid">' +
        '<div class="field"><label for="bk-name">' + UI.name + '</label><input id="bk-name" name="name" autocomplete="name" required value="' + esc(d.name) + '"' + (e.name ? ' aria-invalid="true" aria-describedby="bk-name-err"' : '') + '>' + (e.name ? '<div class="err" id="bk-name-err">' + e.name + '</div>' : '') + '</div>' +
        '<div class="field"><label for="bk-email">' + UI.email + '</label><input id="bk-email" name="email" type="email" autocomplete="email" required value="' + esc(d.email) + '"' + (e.email ? ' aria-invalid="true" aria-describedby="bk-email-err"' : '') + '>' + (e.email ? '<div class="err" id="bk-email-err">' + e.email + '</div>' : '') + '</div>' +
        '<div class="field full"><label for="bk-phone">' + UI.phone + '</label><input id="bk-phone" name="phone" type="tel" autocomplete="tel" value="' + esc(d.phone) + '"></div>' +
        '<div class="field full"><label for="bk-notes">' + UI.notes + '</label><textarea id="bk-notes" name="notes">' + esc(d.notes) + '</textarea></div>' +
        '<div class="hp" aria-hidden="true"><label for="bk-website">Leave this empty</label><input id="bk-website" name="website" tabindex="-1" autocomplete="off" value="' + esc(d.website) + '"></div>' +
        '<div class="field full"><label class="check consent"><input type="checkbox" name="consent" required' + (state.consent ? ' checked' : '') + (e.consent ? ' aria-invalid="true" aria-describedby="bk-consent-err"' : '') + '><span>' + UI.consent + '</span></label>' +
        (e.consent ? '<div class="err" id="bk-consent-err">' + e.consent + '</div>' : '') + '</div>' +
        '</div><div class="row-actions"><button type="button" class="btn btn-ghost" data-act="to1">' + UI.back + '</button><button type="submit" class="btn">' + UI.cont + '</button></div></form>';
    }
    if (s === 3) {
      var paypal = state.deposit.mode === 'paypal';
      if (state.ref && state.payment && !state.paid) {
        /* the request is sent; now the deposit, right here */
        h += '<div class="deposit-step"><h3>' + esc(UI.payHeading) + '</h3><p>' + esc(UI.payIntro) + '</p>' +
          '<div class="policy" role="region" aria-label="Deposit and cancellation policy"><ul>' +
          COPY.policy.items.map(function (p) { return '<li><strong>' + t(p.lead) + '</strong> ' + t(p.text) + '</li>'; }).join('') + '</ul></div>' +
          chosenHtml(' style="margin-top:0"') +
          '<div class="paypal-buttons" id="paypal-buttons" aria-live="polite"></div>' +
          (state.payState === 'loading' ? '<p class="pay-later" data-loading>' + esc(UI.payLoading) + '</p>' : '') +
          (state.payState === 'cancelled' ? '<p class="pay-later" role="status">' + esc(UI.payCancelled) + '</p>' : '') +
          (state.payState === 'error' ? '<p class="err send-err" role="alert">' + esc(UI.payFail) + '</p>' : '') +
          '<p class="pay-later">' + esc(UI.payLaterNote) + ' <button type="button" class="btn btn-ghost" data-act="later">' + esc(UI.payLater) + '</button></p></div>';
      } else {
        h += '<div><h3>' + t(COPY.steps[2]) + '</h3><div class="policy" role="region" aria-label="Deposit and cancellation policy"><ul>' +
          COPY.policy.items.map(function (p) { return '<li><strong>' + t(p.lead) + '</strong> ' + t(p.text) + '</li>'; }).join('') +
          '</ul></div><label class="check"><input type="checkbox" required' + (state.ack ? ' checked' : '') + '><span>' + t(COPY.policy.checkbox) + '</span></label>' +
          chosenHtml(' style="margin-top:0"') +
          (state.errors.send ? '<p class="err send-err" role="alert">' + esc(state.errors.send) + '</p>' : '') +
          '<div class="row-actions"><button type="button" class="btn btn-ghost" data-act="to2"' + (state.sending ? ' disabled' : '') + '>' + UI.back + '</button>' +
          '<button type="button" class="btn" data-act="pay"' + (state.ack && !state.sending ? ' aria-disabled="false"' : ' disabled aria-disabled="true"') + (state.sending ? ' aria-busy="true"' : '') + '>' +
          (state.sending ? esc(UI.sending) + '…' : esc(paypal ? UI.sendPaypal : UI.sendLater)) + '</button></div>' +
          '<p class="integration-note">' + esc(paypal ? UI.depositPaypal : UI.depositLater) + '</p></div>';
      }
    }
    if (s === 4) {
      var depositLine = state.paid ? '<p class="confirm-deposit paid">' + esc(UI.paidLine) + '</p>'
        : state.payment ? '<p class="confirm-deposit">' + esc(UI.unpaidLine) + ' <a class="btn" href="' + esc(state.payment.payUrl) + '">' + esc(UI.unpaidLink) + '</a></p>'
          : '<p class="confirm-deposit">' + esc(UI.depositLater) + '</p>';
      h += '<div class="confirm"><h3>' + t(COPY.confirmation.heading) + '</h3>' +
        (state.slot ? '<p class="summary">' + esc(fmtDay(state.slot.start) + ', ' + fmtTime(state.slot.start) + (state.ref ? ' · ' + state.ref : '')) +
          (CLINIC ? '<span class="chosen-clinic">' + clinicLine() + '</span>' : '') +
          '<span class="chosen-fee">' + esc(feeLine(state.price, state.wasSpecial)) + '</span></p>' : '') +
        depositLine +
        '<p>' + t(COPY.confirmation.body) + '</p><p class="accent">' + t(COPY.confirmation.accent) + '</p>' +
        '<p class="confirm-next">' + t(COPY.confirmation.next) + '</p></div>';
    }
    return h;
  }

  function render(focus) {
    flowBox.innerHTML = stepsHtml() + '<div class="booking" id="booking" tabindex="-1" aria-live="polite">' + panelHtml() + '</div>';
    var panel = document.getElementById('booking');
    if (focus) {
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ behavior: SCROLL, block: 'start' });
    }
  }
  function backToTimes(message) {
    state.slot = null;
    state.step = 1;
    state.errors = { slot: message };
    render(true);
    loadSlots(function () { render(false); state.errors = {}; });
  }
  function go(step) {
    if (step > 1 && step < 4 && !bookable(state.slot)) { backToTimes(UI.tooSoon); return; }
    state.step = step;
    render(true);
    if (step === 1) loadSlots(function () { render(false); });
  }

  flowBox.addEventListener('click', function (ev) {
    var slotBtn = ev.target.closest('.slot');
    if (slotBtn) {
      var start = slotBtn.getAttribute('data-start');
      for (var i = 0; i < state.slots.length; i++) if (state.slots[i].start === start) state.slot = state.slots[i];
      render(false);
      var again = flowBox.querySelector('.slot[data-start="' + start + '"]');
      if (again) again.focus();
      return;
    }
    var act = ev.target.closest('[data-act]');
    if (!act) return;
    var a = act.getAttribute('data-act');
    if (a === 'to1') go(1);
    if (a === 'to2' && state.slot) go(2);
    if (a === 'later' && state.ref) go(4);
    if (a === 'pay' && state.ack && !state.sending) {
      if (!bookable(state.slot)) { backToTimes(UI.tooSoon); return; }
      submitRequest();
    }
  });

  /* Sends the booking request (api/booking.js). */
  function submitRequest() {
    state.sending = true;
    state.errors = {};
    render(false);
    var d = state.details;
    var payload = { slotStart: state.slot.start, name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim(), notes: d.notes.trim(),
      website: d.website, consent: state.consent, policy: state.ack };
    var request = window.APE_BOOKING_PREVIEW
      ? Promise.resolve({ ok: true, ref: 'APE-PREVIEW', price: state.slot.price, special: state.slot.special })
      : fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
    request.then(function (res) {
      state.sending = false;
      if (res && res.ok) {
        state.ref = res.ref || '';
        state.price = res.price != null ? res.price : state.slot.price;
        state.wasSpecial = !!res.special;
        state.payment = res.payment && res.payment.provider === 'paypal' && res.payment.token && res.payment.clientId ? res.payment : null;
        state.paid = false;
        if (state.payment) { state.payState = 'loading'; render(true); mountPaypal(); return; }
        go(4);
        return;
      }
      if (res && res.error === 'too_soon') { backToTimes(UI.tooSoon); return; }
      if (res && (res.error === 'taken' || res.error === 'blocked' || res.error === 'invalid_time')) { backToTimes(UI.taken); return; }
      state.errors = { send: UI.sendFail };
      render(false);
    }, function () {
      state.sending = false;
      state.errors = { send: UI.sendFail };
      render(false);
    });
  }
  /* The PayPal buttons for the deposit (v1.8.0). The order is created and captured by the server, which also marks
     the booking paid and emails both sides; the browser only passes the booking's private pay token. */
  var paypalSdk = null;
  function loadPaypalSdk(clientId) {
    if (window.paypal) return Promise.resolve(window.paypal);
    if (paypalSdk) return paypalSdk;
    paypalSdk = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = (window.APE_PAYPAL_SDK || 'https://www.paypal.com/sdk/js') + '?client-id=' + encodeURIComponent(clientId) + '&currency=AUD&intent=capture&enable-funding=card&disable-funding=paylater,venmo&components=buttons&locale=en_AU';
      sc.async = true;
      sc.onload = function () { if (window.paypal) resolve(window.paypal); else reject(new Error('no sdk')); };
      sc.onerror = function () { reject(new Error('sdk failed')); };
      document.head.appendChild(sc);
    });
    return paypalSdk;
  }
  function mountPaypal() {
    var pay = state.payment;
    if (!pay) return;
    loadPaypalSdk(pay.clientId).then(function (pp) {
      var box = document.getElementById('paypal-buttons');
      if (!box || !state.payment || state.paid) return;
      box.innerHTML = '';
      return pp.Buttons({
        style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay' },
        createOrder: function () {
          return fetch('/api/paypal/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pay.token }) })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.id) throw new Error(j.error || 'order'); return j.id; }); });
        },
        onApprove: function (data) {
          return fetch('/api/paypal/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pay.token, orderId: data.orderID }) })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
              if (r.ok && j.ok) { state.paid = true; state.payState = 'idle'; go(4); return; }
              state.payState = 'error'; render(false); mountPaypal();
            }); });
        },
        onCancel: function () { state.payState = 'cancelled'; render(false); mountPaypal(); },
        onError: function () { state.payState = 'error'; render(false); mountPaypal(); }
      }).render(box).then(function () {
        if (state.payState === 'loading') { state.payState = 'idle'; var note = flowBox.querySelector('[data-loading]'); if (note) note.remove(); }
      });
    }).catch(function () { state.payState = 'error'; render(false); });
  }

  flowBox.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.name && state.details.hasOwnProperty(el.name)) state.details[el.name] = el.value;
  });
  flowBox.addEventListener('change', function (ev) {
    if (ev.target.name === 'consent') { state.consent = ev.target.checked; return; }
    if (ev.target.matches('.check input')) {
      state.ack = ev.target.checked;
      var pay = flowBox.querySelector('[data-act="pay"]');
      pay.disabled = !state.ack;
      pay.setAttribute('aria-disabled', state.ack ? 'false' : 'true');
    }
  });
  flowBox.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var d = state.details, errs = {};
    if (!d.name.trim()) errs.name = UI.errName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) errs.email = UI.errEmail;
    if (!state.consent) errs.consent = UI.errConsent;
    state.errors = errs;
    if (errs.name || errs.email || errs.consent) { render(false); return; }
    go(3);
  });

  /* "Choose a time" on the appointment card */
  document.querySelectorAll('a[href="#booking"]').forEach(function (link) {
    link.addEventListener('click', function (ev) {
      ev.preventDefault();
      var panel = document.getElementById('booking');
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ behavior: SCROLL, block: 'start' });
    });
  });

  render(false);
  loadSlots(function () { render(false); });
})();
