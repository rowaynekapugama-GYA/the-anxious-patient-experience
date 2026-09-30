/* The Anxious Patient Experience: site script.
   Screen by screen journey (snapping, gentle reveals, progress bar, Explore sheet), FAQ accordion and the Book Now flow.
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

  /* ---------- Scroll snapping: one screen at a time ----------
     Native CSS snapping only (html.snap), mandatory, one screen per swipe. Each screen is its own snap target, so a
     screen taller than the window can still be scrolled through. A page can opt into gentler proximity snapping
     with data-snap="proximity" on <body>. */
  var snapOn = screens.length > 0 && !reduce;
  function snapMode() {
    if (!snapOn) { doc.classList.remove('snap', 'snap-soft'); return; }
    doc.classList.add('snap');
    doc.classList.toggle('snap-soft', document.body.getAttribute('data-snap') === 'proximity' || formFocus);
  }
  /* While someone is typing in a form (the booking details), snapping relaxes so the keyboard never pushes the
     field out of view; it firms up again when they leave the form. */
  var formFocus = false;
  document.addEventListener('focusin', function (ev) {
    if (ev.target.matches && ev.target.matches('input, textarea, select')) { formFocus = true; snapMode(); }
  });
  document.addEventListener('focusout', function () {
    setTimeout(function () {
      var a = document.activeElement;
      var still = !!(a && a.matches && a.matches('input, textarea, select'));
      if (formFocus && !still) { formFocus = false; snapMode(); }
    }, 250);
  });

  /* A screen taller than the window gets extra snap stops about 80% of a window apart, ending with its bottom edge,
     so a swipe reads on through it instead of jumping to the next screen. */
  function readingStops() {
    var mandatory = doc.classList.contains('snap') && !doc.classList.contains('snap-soft');
    var vh = window.innerHeight, step = Math.round(vh * 0.8);
    screens.forEach(function (s) {
      [].forEach.call(s.querySelectorAll('.snap-page'), function (n) { n.parentNode.removeChild(n); });
      var h = s.offsetHeight;
      if (!mandatory || h <= vh + 2) return;
      var stops = [];
      for (var y = step; y < h - vh - 40; y += step) stops.push(y);
      stops.push(h - vh);
      stops.forEach(function (y) {
        var n = document.createElement('span');
        n.className = 'snap-page';
        n.setAttribute('aria-hidden', 'true');
        n.style.top = y + 'px';
        s.appendChild(n);
      });
    });
  }

  /* ---------- Touch assist ----------
     Snapping is native. A short, slow swipe can leave the page settling back on the same screen, which feels stuck.
     If a clear vertical swipe ends and the page has not moved, glide to the next (or previous) stop in that
     direction. Listeners are passive: touch and scrolling are never blocked or taken over. */
  function snapStops() {
    var y0 = window.pageYOffset, list = [];
    screens.forEach(function (s) {
      var top = s.getBoundingClientRect().top + y0;
      list.push(Math.round(top));
      [].forEach.call(s.querySelectorAll('.snap-page'), function (n) { list.push(Math.round(top + parseFloat(n.style.top))); });
    });
    list.push(document.documentElement.scrollHeight - window.innerHeight);
    return list.sort(function (a, b) { return a - b; });
  }
  function whenSettled(done) {
    var last = -1, still = 0, tries = 0;
    (function poll() {
      var y = window.pageYOffset;
      still = Math.abs(y - last) < 1 ? still + 1 : 0;
      last = y;
      if (still >= 2 || ++tries > 20) done(); else setTimeout(poll, 90);
    })();
  }
  var touch = null;
  if (snapOn) {
    document.addEventListener('touchstart', function (ev) {
      touch = ev.touches.length === 1 ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY, scroll: window.pageYOffset } : null;
    }, { passive: true });
    document.addEventListener('touchend', function (ev) {
      var t0 = touch; touch = null;
      if (!t0 || !doc.classList.contains('snap') || doc.classList.contains('snap-soft')) return;
      if (ev.target.closest && ev.target.closest('.journey-bar, input, textarea, select')) return;
      var t = ev.changedTouches[0], dy = t0.y - t.clientY, dx = t0.x - t.clientX;
      if (Math.abs(dy) < 30 || Math.abs(dx) > Math.abs(dy)) return;
      var dir = dy > 0 ? 1 : -1;
      whenSettled(function () {
        if (Math.abs(window.pageYOffset - t0.scroll) > 2) return; /* the page moved by itself: nothing to do */
        var stops = snapStops(), target = null;
        for (var i = 0; i < stops.length; i++) {
          if (dir > 0 && stops[i] > t0.scroll + 2) { target = stops[i]; break; }
          if (dir < 0 && stops[i] < t0.scroll - 2) target = stops[i];
        }
        if (target !== null) window.scrollTo({ top: target, behavior: SCROLL });
      });
    }, { passive: true });
  }

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

  /* ---------- Progress bar: one segment per screen ---------- */
  var segs = [].slice.call(document.querySelectorAll('.journey-progress .seg'));
  var ticking = false;
  function progress() {
    ticking = false;
    if (!segs.length) return;
    var y = window.pageYOffset, vh = window.innerHeight, current = 0, tops = [];
    screens.forEach(function (s, i) {
      tops[i] = s.getBoundingClientRect().top + y;
      if (tops[i] <= y + vh * 0.4) current = i;
    });
    screens.forEach(function (s, i) {
      if (!segs[i]) return;
      var p = i < current ? 1 : i > current ? 0 : 1;
      /* a screen taller than the window fills its segment as you read through it */
      if (i === current && s.offsetHeight > vh + 2) p = Math.min(1, Math.max(0, (y + vh - tops[i]) / s.offsetHeight));
      segs[i].style.setProperty('--p', p.toFixed(3));
      if (i === current) segs[i].setAttribute('aria-current', 'step'); else segs[i].removeAttribute('aria-current');
    });
  }
  function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(progress); } }
  segs.forEach(function (a, i) {
    a.addEventListener('click', function (ev) {
      var s = screens[i];
      if (!s) return;
      ev.preventDefault();
      window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset, behavior: SCROLL });
      if (ev.detail === 0) { /* keyboard: carry focus to the screen */
        s.setAttribute('tabindex', '-1');
        s.focus({ preventScroll: true });
      }
    });
  });

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
  function refresh() { measure(); snapMode(); readingStops(); progress(); }
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
