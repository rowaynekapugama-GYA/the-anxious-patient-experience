/* The Anxious Patient Experience: site script.
   Patient journey (sections that turn like pages, gentle reveals, progress bar, Explore sheet), FAQs and the Book Now flow.
   The booking flow runs in test mode: sample APE sessions, no payment taken.
   BOOKING INTEGRATION POINT: replace getSlots() and the pay step with the live booking system and payment gateway. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceMQ.matches;
  var hasIO = 'IntersectionObserver' in window;
  var screens = [].slice.call(document.querySelectorAll('main .screen'));
  var SCROLL = reduce ? 'auto' : 'smooth';
  var GAP = 700;          /* ms between items that appear one by one */
  var AFTER_MAIN = 550;   /* ms before the first one-by-one item, so the main content settles first */

  /* ---------- Bottom bar height (it grows with the safe area on phones) ---------- */
  var bar = document.querySelector('.journey-bar');
  function measure() {
    if (bar) doc.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  }
  measure();

  /* ---------- Gentle reveals ----------
     A screen's content fades up once the screen is at least half in view. Items marked .seq follow one by one.
     Reveals play once. Anything that receives keyboard focus is shown at once. */
  function showNow(el) { el.style.setProperty('--d', '0s'); el.classList.add('in'); }
  var reveals = [].slice.call(document.querySelectorAll('.reveal'));

  if (!hasIO || reduce) {
    reveals.forEach(function (el) { el.classList.add('in'); });
    if (!hasIO) doc.classList.remove('js');
  } else {
    var nextAt = 0;
    var queue = function (el) {
      var now = performance.now();
      var at = Math.max(now, nextAt);
      nextAt = at + GAP;
      el.style.setProperty('--d', ((at - now) / 1000).toFixed(2) + 's');
      el.classList.add('in');
    };
    var itemIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { itemIO.unobserve(en.target); queue(en.target); }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });

    var activate = function (screen) {
      if (screen.getAttribute('data-shown')) return;
      screen.setAttribute('data-shown', '1');
      var items = [].slice.call(screen.querySelectorAll('.reveal:not(.in)'));
      var vh = window.innerHeight;
      items.forEach(function (el) { if (!el.classList.contains('seq')) el.classList.add('in'); });
      nextAt = Math.max(nextAt, performance.now() + AFTER_MAIN);
      items.forEach(function (el) {
        if (!el.classList.contains('seq')) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.94 && r.bottom > 0) queue(el);
        else itemIO.observe(el); /* further down a tall screen: appears when it scrolls into view */
      });
    };

    var steps = [];
    for (var k = 0; k <= 20; k++) steps.push(k / 20);
    var screenIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var half = window.innerHeight * 0.5;
        if (en.isIntersecting && (en.intersectionRatio >= 0.5 || en.intersectionRect.height >= half)) {
          screenIO.unobserve(en.target);
          activate(en.target);
        }
      });
    }, { threshold: steps });
    screens.forEach(function (s) { screenIO.observe(s); });

    /* Reveals outside screens (footer, plain pages) work as before */
    var looseIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); looseIO.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (el) { if (!el.closest('.screen')) looseIO.observe(el); });

    document.addEventListener('focusin', function (ev) {
      var target = ev.target;
      if (!target || !target.closest) return;
      var s = target.closest('.screen');
      if (s && !s.getAttribute('data-shown')) {
        s.setAttribute('data-shown', '1');
        screenIO.unobserve(s);
      }
      if (s) [].forEach.call(s.querySelectorAll('.reveal:not(.in)'), showNow);
      var r = target.closest('.reveal:not(.in)');
      while (r) { showNow(r); r = r.parentElement ? r.parentElement.closest('.reveal:not(.in)') : null; }
    });
  }

  /* ---------- Patient journey: each page turns like a book, one section at a time ----------
     Sections sit side by side in time rather than down the page. Continue, the progress bar, a sideways swipe, the
     arrow keys, or scrolling on past the end of a section turns to the next one with a slow, soft slide. Nothing
     moves unless the visitor asks it to, and a section longer than the window simply scrolls as normal.
     With reduced motion (or without JavaScript) the page is one ordinary scrolling page. */
  var stepsOn = screens.length > 1 && !reduce;
  var segs = [].slice.call(document.querySelectorAll('.journey-progress .seg'));
  var prevBtn = document.querySelector('.step-prev');
  var nextBtn = document.querySelector('.step-next');
  var nextPage = document.querySelector('.step-nextpage');
  var live = document.querySelector('.step-live');
  var LEAVE_MS = 380, ENTER_MS = 760;
  var cur = 0, busy = false;

  function stepOf(el) {
    var s = el && el.closest ? el.closest('main .screen') : null;
    if (s) return screens.indexOf(s);
    return el && el.closest && el.closest('.site-footer') ? screens.length - 1 : -1;
  }
  function paint() {
    segs.forEach(function (a, i) {
      a.style.setProperty('--p', i <= cur ? '1' : '0');
      if (i === cur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    var last = cur === screens.length - 1;
    doc.classList.toggle('on-first', cur === 0);
    doc.classList.toggle('on-last', last);
    if (prevBtn) prevBtn.hidden = cur === 0;
    if (nextBtn) nextBtn.hidden = last;
    if (nextPage) nextPage.hidden = !last;
  }
  function settle(to) {
    var id = to.id && cur > 0 ? '#' + to.id : window.location.pathname;
    try { history.replaceState(null, '', id); } catch (e) { /* file previews */ }
    if (live) live.textContent = 'Section ' + (cur + 1) + ' of ' + screens.length;
  }
  function turnTo(i, opts) {
    opts = opts || {};
    if (!stepsOn || busy || i === cur || i < 0 || i >= screens.length) return false;
    busy = true;
    var from = screens[cur], to = screens[i], dir = i > cur ? 1 : -1;
    from.classList.add(dir > 0 ? 'leave-left' : 'leave-right');
    setTimeout(function () {
      from.classList.remove('is-current', 'leave-left', 'leave-right');
      to.classList.add('is-current', dir > 0 ? 'enter-right' : 'enter-left');
      window.scrollTo(0, 0);
      cur = i;
      paint();
      settle(to);
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { to.classList.remove('enter-right', 'enter-left'); });
      });
      if (opts.focus) { to.setAttribute('tabindex', '-1'); to.focus({ preventScroll: true }); }
      setTimeout(function () {
        busy = false;
        if (opts.then) opts.then();
      }, ENTER_MS);
    }, LEAVE_MS);
    return true;
  }
  function turnNext(o) { return turnTo(cur + 1, o); }
  function turnPrev(o) { return turnTo(cur - 1, o); }
  function atBottom() { return window.innerHeight + window.pageYOffset >= doc.scrollHeight - 4; }
  function atTop() { return window.pageYOffset <= 4; }
  function typing(el) {
    return !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"], .faq-track'));
  }

  if (stepsOn) {
    doc.classList.add('page-turn');
    doc.style.scrollBehavior = 'auto';
    /* start on the section the address points to, if any */
    var target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    var start = Math.max(0, stepOf(target));
    cur = start;
    screens.forEach(function (s, i) { s.classList.toggle('is-current', i === start); });
    paint();
    if (target && start > 0 && !target.classList.contains('screen')) {
      setTimeout(function () { target.scrollIntoView({ block: 'start' }); }, 60);
    }

    if (prevBtn) prevBtn.addEventListener('click', function (ev) { turnPrev({ focus: ev.detail === 0 }); });
    if (nextBtn) nextBtn.addEventListener('click', function (ev) { turnNext({ focus: ev.detail === 0 }); });
    segs.forEach(function (a, i) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); turnTo(i, { focus: ev.detail === 0 }); });
    });

    /* in-page links such as Talk to Alex: turn to the section that holds the target, then bring it into view */
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href^="#"]');
      if (!a || a.classList.contains('seg') || a.getAttribute('href') === '#booking') return;
      var el = document.getElementById(a.getAttribute('href').slice(1));
      var i = stepOf(el);
      if (!el || i < 0) return;
      ev.preventDefault();
      var show = function () { el.scrollIntoView({ behavior: SCROLL, block: 'start' }); };
      if (i === cur) show(); else turnTo(i, { then: show });
    });

    /* scrolling on past the end (or the start) of a section turns the page, once per gesture.
       After a turn, the rest of that same gesture (trackpad momentum) is ignored, but scrolling the other way is
       never blocked, so going back always works. */
    var acc = 0, lastWheel = 0, lastDir = 0, turnedAt = 0;
    window.addEventListener('wheel', function (ev) {
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) || ev.ctrlKey) return;
      var now = performance.now(), dir = ev.deltaY > 0 ? 1 : -1, gap = now - lastWheel;
      lastWheel = now;
      if (busy) { acc = 0; return; }
      /* momentum from the gesture that just turned the page: same direction, events still streaming in */
      if (dir === lastDir && now - turnedAt < 1600 && gap < 90) { acc = 0; return; }
      if ((dir > 0 && !atBottom()) || (dir < 0 && !atTop())) { acc = 0; return; }
      if (gap > 400) acc = 0;
      acc += Math.abs(ev.deltaY) * (ev.deltaMode === 1 ? 32 : 1);
      if (acc >= 70) {
        acc = 0;
        if (dir > 0 ? turnNext() : turnPrev()) { lastDir = dir; turnedAt = now; }
      }
    }, { passive: true });

    /* touch: swipe left for the next section, right to go back; or keep swiping up past the end of a section */
    var t0 = null;
    document.addEventListener('touchstart', function (ev) {
      var el = ev.target.closest ? ev.target : null;
      if (ev.touches.length !== 1 || !el || el.closest('input, textarea, select, .journey-bar')) { t0 = null; return; }
      t0 = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, bottom: atBottom(), top: atTop(), cards: !!el.closest('.faq-track') };
    }, { passive: true });
    document.addEventListener('touchend', function (ev) {
      var s = t0; t0 = null;
      if (!s || busy) return;
      var t = ev.changedTouches[0], dx = s.x - t.clientX, dy = s.y - t.clientY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (!s.cards) { if (dx > 0) turnNext(); else turnPrev(); } /* sideways on the FAQ cards changes the card */
        return;
      }
      if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0 && s.bottom && atBottom()) turnNext();
        else if (dy < 0 && s.top && atTop()) turnPrev();
      }
    }, { passive: true });

    /* keys: left and right turn the page; Page Down, Space and the down arrow do too once a section is read */
    document.addEventListener('keydown', function (ev) {
      if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey || typing(ev.target)) return;
      var onControl = ev.target.closest && ev.target.closest('a, button, summary, [role="group"]');
      var k = ev.key;
      if (k === 'ArrowRight') turnNext({ focus: true });
      else if (k === 'ArrowLeft') turnPrev({ focus: true });
      else if ((k === 'PageDown' || k === 'ArrowDown' || (k === ' ' && !onControl)) && atBottom()) turnNext({ focus: true });
      else if ((k === 'PageUp' || k === 'ArrowUp') && atTop()) turnPrev({ focus: true });
    });
  } else {
    /* one ordinary page: segments fill as you scroll and jump to their section */
    segs.forEach(function (a, i) {
      a.addEventListener('click', function (ev) {
        var s = screens[i];
        if (!s) return;
        ev.preventDefault();
        window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset, behavior: SCROLL });
      });
    });
  }
  var ticking = false;
  function progress() {
    ticking = false;
    if (stepsOn || !segs.length) return;
    var y = window.pageYOffset, vh = window.innerHeight, current = 0;
    screens.forEach(function (s, i) { if (s.getBoundingClientRect().top + y <= y + vh * 0.4) current = i; });
    segs.forEach(function (a, i) {
      a.style.setProperty('--p', i <= current ? '1' : '0');
      if (i === current) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  }
  function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(progress); } }

  /* ---------- Explore sheet (mobile) ---------- */
  var explore = document.querySelector('.journey-bar .explore');
  if (explore) {
    var summary = explore.querySelector('summary');
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && explore.open) { explore.open = false; summary.focus(); }
    });
    document.addEventListener('click', function (ev) {
      if (explore.open && !explore.contains(ev.target)) explore.open = false;
    });
  }

  /* ---------- Keep everything in step with the window ---------- */
  var resizeTimer;
  function refresh() { measure(); progress(); }
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(refresh, 120); });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', refresh);
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(refresh, 120); });
    if (bar) ro.observe(bar);
    screens.forEach(function (s) { ro.observe(s); });
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function () { window.location.reload(); });
  refresh();
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

  /* ---------- FAQ accordion: one answer open at a time ---------- */
  document.querySelectorAll('.faq-list').forEach(function (list) {
    var buttons = list.querySelectorAll('.acc-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wasOpen = btn.getAttribute('aria-expanded') === 'true';
        buttons.forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
          var p = document.getElementById(b.getAttribute('aria-controls'));
          if (p) p.setAttribute('data-open', 'false');
        });
        if (!wasOpen) {
          btn.setAttribute('aria-expanded', 'true');
          var panel = document.getElementById(btn.getAttribute('aria-controls'));
          if (panel) panel.setAttribute('data-open', 'true');
        }
      });
    });
  });

  /* ---------- Book Now ---------- */
  var bookingEl = document.getElementById('booking');
  if (!bookingEl) return;
  var flowBox = bookingEl.parentNode;

  var COPY = {"steps": ["Choose your appointment", "Enter your details", "Pay your $100 deposit", "Booking confirmed"], "policy": {"items": [{"lead": "48 hours' notice or more:", "text": "your deposit can be transferred to a new appointment or refunded."}, {"lead": "Less than 48 hours' notice or non-attendance:", "text": "your deposit may be retained."}, {"lead": "If anxiety is making it hard to attend:", "text": "please contact us. We would much rather hear from you than have you simply not come."}], "checkbox": "I have read and understand the deposit and cancellation policy.", "paymentButton": "Pay $100 deposit"}, "confirmation": {"heading": "You're booked in.", "body": "Your appointment details have been sent to your email. Before your visit, we'll be in touch to learn a little more about you and what will help you feel comfortable.", "accent": "You've already taken the hardest step."}};
  var SESSIONS = {"days": [2, 4], "startTimes": ["09:00", "11:00", "14:00"], "weeksAhead": 6, "minNoticeHours": 48, "timeZone": "Australia/Sydney"};
  var UI = {
    cont: 'Continue', back: 'Back', none: 'No appointments are available right now.',
    name: 'Your name', email: 'Email address', phone: 'Phone number (optional)',
    notes: 'What would you like support with? (optional)',
    errName: 'Please enter your name.', errEmail: 'Please enter a valid email address.',
    mockNote: 'Test mode: no payment is taken. The live booking and payment integration connects here.'
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

  /* Sydney wall-clock time to UTC, daylight saving aware */
  function tzOffsetMinutes(instant, timeZone) {
    var parts = new Intl.DateTimeFormat('en-AU', { timeZone: timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(instant);
    var get = function (k) { for (var i = 0; i < parts.length; i++) if (parts[i].type === k) return Number(parts[i].value); return 0; };
    var asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((asUtc - instant.getTime()) / 60000);
  }
  function zonedToUtc(y, m, d, hh, mm, tz) {
    var guess = Date.UTC(y, m, d, hh, mm);
    var first = tzOffsetMinutes(new Date(guess), tz);
    var second = tzOffsetMinutes(new Date(guess - first * 60000), tz);
    return new Date(guess - second * 60000);
  }
  function localParts(instant, tz) {
    var parts = new Intl.DateTimeFormat('en-AU', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(instant);
    var get = function (k) { for (var i = 0; i < parts.length; i++) if (parts[i].type === k) return parts[i].value; return ''; };
    return { y: Number(get('year')), m: Number(get('month')) - 1, d: Number(get('day')), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')) };
  }

  /* APE-only sample sessions. INTEGRATION POINT: replace with the booking system's APE availability. */
  function getSlots() {
    var now = Date.now(), earliest = now + SESSIONS.minNoticeHours * 3600000, out = [];
    for (var i = 0; i < SESSIONS.weeksAhead * 7; i++) {
      var p = localParts(new Date(now + i * 86400000), SESSIONS.timeZone);
      if (SESSIONS.days.indexOf(p.weekday) === -1) continue;
      SESSIONS.startTimes.forEach(function (st) {
        var hm = st.split(':');
        var start = zonedToUtc(p.y, p.m, p.d, Number(hm[0]), Number(hm[1]), SESSIONS.timeZone);
        if (start.getTime() >= earliest) out.push({ id: 'ape-' + start.toISOString(), start: start.toISOString() });
      });
    }
    return out;
  }
  var TZ = SESSIONS.timeZone;
  function fmtDay(iso) { return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso)); }
  function fmtTime(iso) { return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).replace(' ', ' '); }
  function dayKey(iso) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso)); }

  var state = { step: 1, slots: getSlots(), slot: null, details: { name: '', email: '', phone: '', notes: '' }, errors: {}, ack: false, ref: '' };

  function stepsHtml() {
    return '<ol class="steps" aria-label="How booking works">' + COPY.steps.map(function (label, i) {
      var n = i + 1, st = n < state.step ? 'done' : n === state.step ? 'current' : 'todo';
      return '<li data-state="' + st + '"' + (n === state.step ? ' aria-current="step"' : '') + '>' + t(label) + '</li>';
    }).join('') + '</ol>';
  }
  function chosenHtml(extraStyle) {
    return state.slot ? '<p class="chosen"' + (extraStyle || '') + '>' + esc(fmtDay(state.slot.start) + ', ' + fmtTime(state.slot.start)) + '</p>' : '';
  }
  function panelHtml() {
    var s = state.step, h = '';
    if (s === 1) {
      h += '<div><h3>' + t(COPY.steps[0]) + '</h3>';
      if (!state.slots.length) h += '<p>' + UI.none + '</p>';
      else {
        var groups = [];
        state.slots.forEach(function (sl) {
          var k = dayKey(sl.start), g = groups[groups.length - 1];
          if (!g || g.key !== k) { g = { key: k, label: fmtDay(sl.start), slots: [] }; groups.push(g); }
          g.slots.push(sl);
        });
        h += '<div class="slot-days">' + groups.map(function (g) {
          return '<div class="slot-day"><div class="day">' + esc(g.label) + '</div><div class="slot-times">' + g.slots.map(function (sl) {
            return '<button type="button" class="slot" data-id="' + sl.id + '" aria-pressed="' + (state.slot && state.slot.id === sl.id ? 'true' : 'false') + '">' + esc(fmtTime(sl.start)) + '</button>';
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
        '</div><div class="row-actions"><button type="button" class="btn btn-ghost" data-act="to1">' + UI.back + '</button><button type="submit" class="btn">' + UI.cont + '</button></div></form>';
    }
    if (s === 3) {
      h += '<div><h3>' + t(COPY.steps[2]) + '</h3><div class="policy" role="region" aria-label="Deposit and cancellation policy"><ul>' +
        COPY.policy.items.map(function (p) { return '<li><strong>' + t(p.lead) + '</strong> ' + t(p.text) + '</li>'; }).join('') +
        '</ul></div><label class="check"><input type="checkbox" required' + (state.ack ? ' checked' : '') + '><span>' + t(COPY.policy.checkbox) + '</span></label>' +
        chosenHtml(' style="margin-top:0"') +
        '<div class="row-actions"><button type="button" class="btn btn-ghost" data-act="to2">' + UI.back + '</button>' +
        '<button type="button" class="btn" data-act="pay"' + (state.ack ? ' aria-disabled="false"' : ' disabled aria-disabled="true"') + '>' + t(COPY.policy.paymentButton) + '</button></div>' +
        '<p class="integration-note">' + UI.mockNote + '</p></div>';
    }
    if (s === 4) {
      h += '<div class="confirm"><h3>' + t(COPY.confirmation.heading) + '</h3>' +
        (state.slot ? '<p class="summary">' + esc(fmtDay(state.slot.start) + ', ' + fmtTime(state.slot.start) + (state.ref ? ' · ' + state.ref : '')) + '</p>' : '') +
        '<p>' + t(COPY.confirmation.body) + '</p><p class="accent">' + t(COPY.confirmation.accent) + '</p></div>';
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
  function go(step) { state.step = step; render(true); }

  flowBox.addEventListener('click', function (ev) {
    var slotBtn = ev.target.closest('.slot');
    if (slotBtn) {
      var id = slotBtn.getAttribute('data-id');
      for (var i = 0; i < state.slots.length; i++) if (state.slots[i].id === id) state.slot = state.slots[i];
      render(false);
      return;
    }
    var act = ev.target.closest('[data-act]');
    if (!act) return;
    var a = act.getAttribute('data-act');
    if (a === 'to1') go(1);
    if (a === 'to2' && state.slot) go(2);
    if (a === 'pay' && state.ack) {
      state.ref = 'APE-TEST-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      go(4);
    }
  });
  flowBox.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.name && state.details.hasOwnProperty(el.name)) state.details[el.name] = el.value;
  });
  flowBox.addEventListener('change', function (ev) {
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
    state.errors = errs;
    if (errs.name || errs.email) { render(false); return; }
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
})();
