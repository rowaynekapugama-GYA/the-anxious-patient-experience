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
     the deposit details come with their confirmation (deposit.mode 'later').
     v1.10.0: five steps. Details asks for first and last name, email, phone and date of birth (all required, checked
     here and again on the server); then the terms and cancellation policy with a tick; then the deposit, with
     "I have read the terms" ticked before sending. Paying uses /assets/pay.js (cards without a PayPal account, and
     Apple Pay, Google Pay and card fields once PayPal Advanced Checkout is switched on). */
  var bookingEl = document.getElementById('booking');
  if (!bookingEl) return;
  var flowBox = bookingEl.parentNode;

  var COPY = {"steps": ["Choose your appointment", "Enter your details", "Terms and cancellation policy", "Pay your $100 deposit", "Booking confirmed"], "policy": {"items": [{"lead": "48 hours' notice or more:", "text": "your deposit can be transferred to a new appointment or refunded."}, {"lead": "Less than 48 hours' notice or non-attendance:", "text": "your deposit may be retained."}, {"lead": "If anxiety is making it hard to attend:", "text": "please contact us. We would much rather hear from you than have you simply not come."}], "paymentButton": "Pay $100 deposit"}, "confirmation": {"heading": "You're booked in.", "body": "Your appointment details have been sent to your email. Before your visit, we'll be in touch to learn a little more about you and what will help you feel comfortable.", "accent": "You've already taken the hardest step.", "next": "The APE team will be in touch to confirm your appointment and send your new patient information pack."}};
  /* confirmation.next is NEW COPY (26 Oct 2026) waiting on the client's sign-off */
  var CONFIG = window.APE_CONFIG || {};
  var SESSIONS = CONFIG.booking || { minNoticeHours: 24, timeZone: 'Australia/Sydney' };
  var CLINIC = CONFIG.clinic || null;
  var PHONE = (CONFIG.contact && CONFIG.contact.phone) || '(02) 8599 9815';
  var ENDPOINT = '/api/booking/';  /* trailing slash: vercel.json sets trailingSlash, so this skips a redirect */
  var SITE_V = (document.currentScript && document.currentScript.src.split('?')[1]) || '';
  var UI = {
    cont: 'Continue', back: 'Back', none: 'No appointments are available right now.',
    firstName: 'First name', lastName: 'Last name', email: 'Email address', phone: 'Phone number',
    phoneHelp: 'A mobile or landline, including the area code.',
    dob: 'Date of birth', dobDay: 'Day', dobMonth: 'Month', dobYear: 'Year (4 digits)',
    notes: 'What would you like support with? (optional)',
    required: 'Required',
    errFirst: 'Please enter your first name.', errLast: 'Please enter your last name.', errEmail: 'Please enter a valid email address.',
    errPhone: 'Please enter an Australian mobile or landline number, including the area code.',
    errPhoneEmpty: 'Please enter your phone number.',
    errDob: { required: 'Please enter your date of birth.', invalid: 'Please check your date of birth: that date does not exist.', future: 'Your date of birth cannot be in the future.', too_old: 'Please check the year of your date of birth.' },
    errSummary: function (n) { return n === 1 ? 'There is 1 thing to fix before you continue:' : 'There are ' + n + ' things to fix before you continue:'; },
    errPrefix: 'Error: ',
    /* v1.10.0: the terms step and the deposit tick (wording from Site Settings > Booking terms, these are the fallbacks) */
    termsIntro: 'Please read our terms and cancellation policy. You can also read them any time at',
    termsConsent: 'I consent to the terms and conditions and cancellation policy above.',
    termsRead: 'I have read the terms and conditions and cancellation policy.',
    errTermsConsent: 'Please tick the box to say you consent to the terms and cancellation policy.',
    errTermsRead: 'Please tick the box to say you have read the terms and cancellation policy.',
    reminder48: 'A reminder: we ask for at least 48 hours\u2019 notice if you need to cancel or move your appointment.',
    termsVersion: function (v) { return 'Terms version ' + v; },
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
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
    depositPaypal: 'Next you can pay the $100 deposit by card, or with PayPal. You don\u2019t need a PayPal account.',
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
    /* v1.9.3: the questionnaire offered after booking, only while the online questionnaire is switched on.
       qIntro is Lorna's own line from her questionnaire; the rest is NEW COPY waiting on her sign-off. */
    qHeading: 'Your pre-appointment questionnaire',
    qIntro: 'This short form helps me get to know you and tailor your appointment so you can feel calm, supported, and in control.',
    qOpen: 'Fill in the questionnaire now',
    qNote: 'It\u2019s optional. You can also save your answers and finish them later from the link in your welcome email.',
    qFrameTitle: 'Pre-appointment questionnaire',
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
    slot: null, details: { firstName: '', lastName: '', email: '', phone: '', dobDay: '', dobMonth: '', dobYear: '', notes: '', website: '' }, consent: false, errors: {},
    terms: null, termsConsent: false, termsConsentAt: null, ack: false, ackAt: null,
    ref: '', price: null, wasSpecial: false, payment: null, paid: false, payState: 'idle', payMsg: '', sending: false };

  /* v1.10.0: the same checks as src/booking/patient.ts on the server */
  function normalisePhone(v) {
    var s = String(v || '').trim();
    if (!s || s.length > 40 || /[^\d\s()+\-.]/.test(s)) return null;
    s = s.replace(/[\s()\-.]/g, '');
    if (s.charAt(0) === '+') { if (s.indexOf('+61') !== 0) return null; s = '0' + s.slice(3); }
    else if (/^61\d{9}$/.test(s)) s = '0' + s.slice(2);
    s = s.replace(/^0+(?=0\d{9}$)/, '');
    if (/^00\d{9}$/.test(s)) s = s.slice(1);
    if (/^0[45]\d{8}$/.test(s)) return s.slice(0, 4) + ' ' + s.slice(4, 7) + ' ' + s.slice(7);
    if (/^0[2378]\d{8}$/.test(s)) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 6) + ' ' + s.slice(6);
    return null;
  }
  function sydneyToday() { return new Date(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()) + 'T00:00:00Z'); }
  function checkDob(d, m, y) {
    if (!String(d).trim() && !String(m).trim() && !String(y).trim()) return 'required';
    d = Number(d); m = Number(m); y = Number(y);
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1000 && y <= 9999) || d % 1 || m % 1 || y % 1) return 'invalid';
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return 'invalid';
    var today = sydneyToday();
    if (dt.getTime() > today.getTime()) return 'future';
    if (dt.getTime() < Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate())) return 'too_old';
    return '';
  }
  function detailErrors() {
    var d = state.details, e = {};
    if (!d.firstName.trim()) e.firstName = UI.errFirst;
    if (!d.lastName.trim()) e.lastName = UI.errLast;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = UI.errEmail;
    if (!d.phone.trim()) e.phone = UI.errPhoneEmpty; else if (!normalisePhone(d.phone)) e.phone = UI.errPhone;
    var dob = checkDob(d.dobDay, d.dobMonth, d.dobYear);
    if (dob) e.dob = UI.errDob[dob];
    if (!state.consent) e.consent = UI.errConsent;
    return e;
  }
  /* the terms text from Site Settings: "## " headings, "- " bullets, blank lines between paragraphs */
  function termsHtml(text) {
    var out = '', para = [], list = [];
    function flushP() { if (para.length) { out += '<p>' + t(para.join(' ')) + '</p>'; para = []; } }
    function flushL() { if (list.length) { out += '<ul>' + list.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul>'; list = []; } }
    String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) { flushP(); flushL(); return; }
      if (line.indexOf('## ') === 0) { flushP(); flushL(); out += '<h4>' + t(line.slice(3)) + '</h4>'; return; }
      if (/^[-*] /.test(line)) { flushP(); list.push(line.slice(2)); return; }
      flushL(); para.push(line);
    });
    flushP(); flushL();
    return out;
  }
  /* until /api/availability/ answers (or if it has no terms), the policy that was on Book Now before v1.10.0 */
  function fallbackTerms() {
    return '## Cancellation policy: 48 hours\' notice\n' + COPY.policy.items.map(function (p) { return '- ' + p.lead + ' ' + p.text; }).join('\n');
  }
  function termsNow() { return state.terms || { text: fallbackTerms(), version: '', consentLabel: UI.termsConsent, readLabel: UI.termsRead }; }
  function fieldErr(id, msg) { return msg ? '<div class="err" id="' + id + '-err"><span class="sr-only">' + esc(UI.errPrefix) + '</span><span class="err-mark" aria-hidden="true">!</span> ' + esc(msg) + '</div>' : ''; }
  function inv(id, msg, extra) { var ids = [msg ? id + '-err' : '', extra || ''].filter(Boolean).join(' '); return (msg ? ' aria-invalid="true"' : '') + (ids ? ' aria-describedby="' + ids + '"' : ''); }

  function loadSlots(then) {
    state.loading = true;
    fetch(APE_API, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (res) {
        state.loading = false; state.loadError = false;
        state.slots = (res.slots || []).filter(bookable);
        state.special = res.special || null;
        state.deposit = res.deposit || state.deposit;
        if (res.terms && res.terms.text) state.terms = res.terms;
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
      var errKeys = ['firstName', 'lastName', 'email', 'phone', 'dob', 'consent'].filter(function (k) { return e[k]; });
      var target = { firstName: 'bk-first', lastName: 'bk-last', email: 'bk-email', phone: 'bk-phone', dob: 'bk-dob-day', consent: 'bk-consent' };
      var req = ' <span class="req">(' + esc(UI.required.toLowerCase()) + ')</span>';
      var days = '<option value="">' + esc(UI.dobDay) + '</option>';
      for (var dd = 1; dd <= 31; dd++) days += '<option value="' + dd + '"' + (String(d.dobDay) === String(dd) ? ' selected' : '') + '>' + dd + '</option>';
      var months = '<option value="">' + esc(UI.dobMonth) + '</option>' + UI.months.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (String(d.dobMonth) === String(i + 1) ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('');
      h += '<form novalidate data-act="details"><h3>' + t(COPY.steps[1]) + '</h3>' +
        (errKeys.length ? '<div class="err-summary" role="alert" tabindex="-1" id="bk-errors"><p><strong>' + esc(UI.errSummary(errKeys.length)) + '</strong></p><ul>' +
          errKeys.map(function (k) { return '<li><a href="#' + target[k] + '">' + esc(e[k]) + '</a></li>'; }).join('') + '</ul></div>' : '') +
        '<div class="form-grid">' +
        '<div class="field"><label for="bk-first">' + UI.firstName + req + '</label><input id="bk-first" name="firstName" autocomplete="given-name" required value="' + esc(d.firstName) + '"' + inv('bk-first', e.firstName) + '>' + fieldErr('bk-first', e.firstName) + '</div>' +
        '<div class="field"><label for="bk-last">' + UI.lastName + req + '</label><input id="bk-last" name="lastName" autocomplete="family-name" required value="' + esc(d.lastName) + '"' + inv('bk-last', e.lastName) + '>' + fieldErr('bk-last', e.lastName) + '</div>' +
        '<div class="field"><label for="bk-email">' + UI.email + req + '</label><input id="bk-email" name="email" type="email" autocomplete="email" required value="' + esc(d.email) + '"' + inv('bk-email', e.email) + '>' + fieldErr('bk-email', e.email) + '</div>' +
        '<div class="field"><label for="bk-phone">' + UI.phone + req + '</label><input id="bk-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required value="' + esc(d.phone) + '"' + inv('bk-phone', e.phone, 'bk-phone-help') + '><div class="field-help" id="bk-phone-help">' + esc(UI.phoneHelp) + '</div>' + fieldErr('bk-phone', e.phone) + '</div>' +
        '<fieldset class="field full dob"' + (e.dob ? ' aria-describedby="bk-dob-err"' : '') + '><legend>' + UI.dob + req + '</legend><div class="dob-parts">' +
          '<div><label for="bk-dob-day">' + esc(UI.dobDay) + '</label><select id="bk-dob-day" name="dobDay" autocomplete="bday-day" required' + (e.dob ? ' aria-invalid="true"' : '') + '>' + days + '</select></div>' +
          '<div><label for="bk-dob-month">' + esc(UI.dobMonth) + '</label><select id="bk-dob-month" name="dobMonth" autocomplete="bday-month" required' + (e.dob ? ' aria-invalid="true"' : '') + '>' + months + '</select></div>' +
          '<div><label for="bk-dob-year">' + esc(UI.dobYear) + '</label><input id="bk-dob-year" name="dobYear" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="bday-year" required value="' + esc(d.dobYear) + '"' + (e.dob ? ' aria-invalid="true" aria-describedby="bk-dob-err"' : '') + '></div>' +
        '</div>' + fieldErr('bk-dob', e.dob) + '</fieldset>' +
        '<div class="field full"><label for="bk-notes">' + UI.notes + '</label><textarea id="bk-notes" name="notes">' + esc(d.notes) + '</textarea></div>' +
        '<div class="hp" aria-hidden="true"><label for="bk-website">Leave this empty</label><input id="bk-website" name="website" tabindex="-1" autocomplete="off" value="' + esc(d.website) + '"></div>' +
        '<div class="field full"><label class="check consent"><input type="checkbox" id="bk-consent" name="consent" required' + (state.consent ? ' checked' : '') + inv('bk-consent', e.consent) + '><span>' + UI.consent + '</span></label>' +
        fieldErr('bk-consent', e.consent) + '</div>' +
        '</div><div class="row-actions"><button type="button" class="btn btn-ghost" data-act="to1">' + UI.back + '</button><button type="submit" class="btn">' + UI.cont + '</button></div></form>';
    }
    if (s === 3) {
      /* v1.10.0: the full terms and cancellation policy, then the consent tick */
      var tm = termsNow();
      h += '<div class="terms-step"><h3>' + t(COPY.steps[2]) + '</h3>' +
        '<p class="terms-intro">' + esc(UI.termsIntro) + ' <a href="/book-now/terms/" target="_blank" rel="noopener">/book-now/terms/<span class="sr-only"> (opens in a new tab)</span></a>.</p>' +
        '<div class="terms-box" role="region" aria-labelledby="bk-terms-h" tabindex="0"><p class="sr-only" id="bk-terms-h">' + esc(COPY.steps[2]) + '</p>' + termsHtml(tm.text) +
        (tm.version ? '<p class="terms-version">' + esc(UI.termsVersion(tm.version)) + '</p>' : '') + '</div>' +
        '<label class="check terms-tick"><input type="checkbox" id="bk-terms-consent" name="termsConsent"' + (state.termsConsent ? ' checked' : '') + inv('bk-terms-consent', state.errors.termsConsent) + '><span>' + t(tm.consentLabel || UI.termsConsent) + '</span></label>' +
        fieldErr('bk-terms-consent', state.errors.termsConsent) +
        chosenHtml(' style="margin-top:16px"') +
        '<div class="row-actions"><button type="button" class="btn btn-ghost" data-act="to2">' + UI.back + '</button><button type="button" class="btn" data-act="to4">' + UI.cont + '</button></div></div>';
    }
    if (s === 4) {
      var paypal = state.deposit.mode === 'paypal';
      var tm4 = termsNow();
      if (state.ref && state.payment && !state.paid) {
        /* the request is sent; now the deposit, right here */
        h += '<div class="deposit-step"><h3>' + esc(UI.payHeading) + '</h3><p>' + esc(UI.payIntro) + '</p>' +
          chosenHtml(' style="margin-top:0"') +
          '<div class="pay-area" id="paypal-buttons" aria-live="polite"></div>' +
          (state.payState === 'cancelled' ? '<p class="pay-later" role="status">' + esc(state.payMsg || UI.payCancelled) + '</p>' : '') +
          (state.payState === 'error' ? '<p class="err send-err" role="alert">' + esc(state.payMsg || UI.payFail) + '</p>' : '') +
          '<p class="pay-later">' + esc(UI.payLaterNote) + ' <button type="button" class="btn btn-ghost" data-act="later">' + esc(UI.payLater) + '</button></p></div>';
      } else {
        h += '<div class="deposit-step"><h3>' + t(COPY.steps[3]) + '</h3>' +
          '<p class="reminder-48">' + t(UI.reminder48) + ' <a href="/book-now/terms/" target="_blank" rel="noopener">Read the full terms<span class="sr-only"> (opens in a new tab)</span></a></p>' +
          '<label class="check"><input type="checkbox" id="bk-terms-read" name="termsRead"' + (state.ack ? ' checked' : '') + inv('bk-terms-read', state.errors.termsRead) + '><span>' + t(tm4.readLabel || UI.termsRead) + '</span></label>' +
          fieldErr('bk-terms-read', state.errors.termsRead) +
          chosenHtml(' style="margin-top:16px"') +
          (state.errors.send ? '<p class="err send-err" role="alert">' + esc(state.errors.send) + '</p>' : '') +
          '<div class="row-actions"><button type="button" class="btn btn-ghost" data-act="to3"' + (state.sending ? ' disabled' : '') + '>' + UI.back + '</button>' +
          '<button type="button" class="btn" data-act="pay"' + (state.sending ? ' disabled aria-busy="true"' : '') + '>' +
          (state.sending ? esc(UI.sending) + '…' : esc(paypal ? UI.sendPaypal : UI.sendLater)) + '</button></div>' +
          '<p class="integration-note">' + esc(paypal ? UI.depositPaypal : UI.depositLater) + '</p></div>';
      }
    }
    if (s === 5) {
      var depositLine = state.paid ? '<p class="confirm-deposit paid">' + esc(UI.paidLine) + '</p>'
        : state.payment ? '<p class="confirm-deposit">' + esc(UI.unpaidLine) + ' <a class="btn" href="' + esc(state.payment.payUrl) + '">' + esc(UI.unpaidLink) + '</a></p>'
          : '<p class="confirm-deposit">' + esc(UI.depositLater) + '</p>';
      h += '<div class="confirm"><h3>' + t(COPY.confirmation.heading) + '</h3>' +
        (state.slot ? '<p class="summary">' + esc(fmtDay(state.slot.start) + ', ' + fmtTime(state.slot.start) + (state.ref ? ' · ' + state.ref : '')) +
          (CLINIC ? '<span class="chosen-clinic">' + clinicLine() + '</span>' : '') +
          '<span class="chosen-fee">' + esc(feeLine(state.price, state.wasSpecial)) + '</span></p>' : '') +
        depositLine +
        '<p>' + t(COPY.confirmation.body) + '</p><p class="accent">' + t(COPY.confirmation.accent) + '</p>' +
        '<p class="confirm-next">' + t(COPY.confirmation.next) + '</p>' +
        (state.questionnaire ? '<div class="q-offer" id="q-offer"><h4>' + esc(UI.qHeading) + '</h4><p>' + esc(UI.qIntro) + '</p>' +
          '<div class="q-offer-start"><button type="button" class="btn" data-act="q-open">' + esc(UI.qOpen) + '</button>' +
          '<p class="q-offer-note">' + esc(UI.qNote) + '</p></div><div class="q-frame-wrap" hidden></div></div>' : '') +
        '</div>';
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
    if (step > 1 && step < 5 && !bookable(state.slot)) { backToTimes(UI.tooSoon); return; }
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
    if (a === 'to2' && state.slot) { state.errors = {}; go(2); }
    if (a === 'to3' && state.slot) { state.errors = {}; go(3); }
    if (a === 'to4' && state.slot) {
      if (!state.termsConsent) { state.errors = { termsConsent: UI.errTermsConsent }; render(false); focusEl('bk-terms-consent'); return; }
      state.errors = {}; go(4);
    }
    if (a === 'later' && state.ref) go(5);
    if (a === 'q-open' && state.questionnaire) openQuestionnaire();
    if (a === 'pay' && !state.sending) {
      if (!state.ack) { state.errors = { termsRead: UI.errTermsRead }; render(false); focusEl('bk-terms-read'); return; }
      if (!bookable(state.slot)) { backToTimes(UI.tooSoon); return; }
      submitRequest();
    }
  });

  /* v1.9.3: Lorna's questionnaire inside the confirmation, in a frame of this website's own questionnaire page, which
     reports its height (so the frame grows with it) and when it has been sent. */
  function openQuestionnaire() {
    var wrap = flowBox.querySelector('.q-frame-wrap');
    if (!wrap) return;
    var start = flowBox.querySelector('.q-offer-start');
    if (start) start.hidden = true;
    if (!wrap.firstChild) {
      var f = document.createElement('iframe');
      f.src = state.questionnaire.url + '?embed=1';
      f.title = UI.qFrameTitle;
      f.className = 'q-frame';
      f.setAttribute('referrerpolicy', 'no-referrer');
      wrap.appendChild(f);
    }
    wrap.hidden = false;
    wrap.scrollIntoView({ behavior: SCROLL, block: 'start' });
  }
  var qDone = false, qOffset = 0;
  function showThanks(f) {
    qDone = false;
    var header = document.querySelector('.site-header');
    var top = f.getBoundingClientRect().top + window.pageYOffset + qOffset - (header ? header.offsetHeight : 0) - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: SCROLL });
  }
  window.addEventListener('message', function (ev) {
    if (ev.origin !== window.location.origin || !ev.data || ev.data.source !== 'ape-questionnaire') return;
    var f = flowBox.querySelector('.q-frame');
    if (!f) return;
    if (ev.data.type === 'height' && ev.data.height > 0) {
      f.style.height = Math.min(ev.data.height, 20000) + 'px';
      if (qDone) showThanks(f);
    }
    /* sent: the frame shrinks to the thank-you, so bring the thank-you into view once the frame has its new height */
    if (ev.data.type === 'done') { qDone = true; qOffset = Math.max(0, Number(ev.data.offset) || 0); setTimeout(function () { if (qDone) showThanks(f); }, 600); }
  });

  /* Sends the booking request (api/booking.js). */
  function submitRequest() {
    state.sending = true;
    state.errors = {};
    render(false);
    var d = state.details, tm = termsNow();
    var payload = { slotStart: state.slot.start, firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim(), phone: d.phone.trim(),
      dob: { day: d.dobDay, month: d.dobMonth, year: String(d.dobYear).trim() }, notes: d.notes.trim(), website: d.website, consent: state.consent,
      termsConsent: state.termsConsent, termsConsentAt: state.termsConsentAt, termsRead: state.ack, termsReadAt: state.ackAt, termsVersion: tm.version || '' };
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
        /* v1.9.3: the booking's private questionnaire link (a path on this website), when the questionnaire is on */
        state.questionnaire = res.questionnaire && /^\/questionnaire\/[A-Za-z0-9_-]{40,50}$/.test(res.questionnaire.url || '') ? res.questionnaire : null;
        if (state.payment) { state.payState = 'loading'; render(true); mountPaypal(); return; }
        go(5);
        return;
      }
      if (res && res.error === 'too_soon') { backToTimes(UI.tooSoon); return; }
      /* the server found a problem with the details (the same checks as here): back to that step with the messages */
      if (res && res.error === 'invalid' && res.fields) {
        var f = res.fields, errs = {};
        if (f.firstName) errs.firstName = UI.errFirst;
        if (f.lastName) errs.lastName = UI.errLast;
        if (f.email) errs.email = UI.errEmail;
        if (f.phone) errs.phone = f.phone === 'required' ? UI.errPhoneEmpty : UI.errPhone;
        if (f.dob) errs.dob = UI.errDob[f.dob] || UI.errDob.invalid;
        if (f.consent) errs.consent = UI.errConsent;
        if (Object.keys(errs).length) { state.errors = errs; state.step = 2; render(true); focusEl('bk-errors'); return; }
        if (f.termsConsent) { state.termsConsent = false; state.errors = { termsConsent: UI.errTermsConsent }; state.step = 3; render(true); return; }
        if (f.termsRead) { state.ack = false; state.errors = { termsRead: UI.errTermsRead }; render(false); return; }
      }
      if (res && (res.error === 'taken' || res.error === 'blocked' || res.error === 'invalid_time')) { backToTimes(UI.taken); return; }
      state.errors = { send: UI.sendFail };
      render(false);
    }, function () {
      state.sending = false;
      state.errors = { send: UI.sendFail };
      render(false);
    });
  }
  /* The deposit (v1.8.0, v1.10.0): /assets/pay.js shows the card and PayPal options (and Apple Pay, Google Pay and
     card fields with PayPal Advanced Checkout). The order is created and captured by the server, which also marks the
     booking paid and emails both sides; the browser only passes the booking's private pay token. */
  var payJs = null;
  function loadPayJs() {
    if (window.APEPay) return Promise.resolve(window.APEPay);
    if (payJs) return payJs;
    payJs = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = '/assets/pay.js' + (SITE_V ? '?' + SITE_V : '');
      sc.async = true;
      sc.onload = function () { if (window.APEPay) resolve(window.APEPay); else reject(new Error('no pay.js')); };
      sc.onerror = function () { payJs = null; reject(new Error('pay.js failed')); };
      document.head.appendChild(sc);
    });
    return payJs;
  }
  function payNote(st, msg) {
    var old = flowBox.querySelector('.deposit-step [data-pay-note]');
    if (old) old.remove();
    if (st !== 'cancelled' && st !== 'error') return;
    var p = document.createElement('p');
    p.setAttribute('data-pay-note', '');
    p.className = st === 'error' ? 'err send-err' : 'pay-later';
    p.setAttribute('role', st === 'error' ? 'alert' : 'status');
    p.textContent = msg || (st === 'error' ? UI.payFail : UI.payCancelled);
    var area = document.getElementById('paypal-buttons');
    if (area) area.parentNode.insertBefore(p, area.nextSibling);
  }
  function mountPaypal() {
    var pay = state.payment;
    if (!pay) return;
    loadPayJs().then(function (P) {
      var box = document.getElementById('paypal-buttons');
      if (!box || !state.payment || state.paid) return;
      return P.mount(box, {
        clientId: pay.clientId, token: pay.token, amount: (state.deposit && state.deposit.amount) || 100, advanced: !!pay.advanced, env: pay.env || 'sandbox', from: 'book-now',
        onPaid: function () { state.paid = true; state.payState = 'idle'; go(5); },
        onState: function (st, msg) { state.payState = st; state.payMsg = msg; payNote(st, msg); }
      });
    }).catch(function () { state.payState = 'error'; state.payMsg = ''; payNote('error'); });
  }

  function focusEl(id) {
    var el = document.getElementById(id);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: SCROLL, block: 'center' }); }
  }

  flowBox.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.name && state.details.hasOwnProperty(el.name)) state.details[el.name] = el.value;
  });
  flowBox.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.name && state.details.hasOwnProperty(el.name)) state.details[el.name] = el.value;
    if (el.name === 'consent') { state.consent = el.checked; return; }
    /* v1.10.0: when each tick was made is saved with the booking */
    if (el.name === 'termsConsent') { state.termsConsent = el.checked; state.termsConsentAt = el.checked ? new Date().toISOString() : null; return; }
    if (el.name === 'termsRead') { state.ack = el.checked; state.ackAt = el.checked ? new Date().toISOString() : null; }
  });
  flowBox.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var errs = detailErrors();
    state.errors = errs;
    if (Object.keys(errs).length) { render(false); focusEl('bk-errors'); return; }
    state.details.phone = normalisePhone(state.details.phone) || state.details.phone;
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
