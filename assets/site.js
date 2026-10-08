/* The Anxious Patient Experience: site script.
   Continuous scroll (light header with section links, gentle scroll-triggered motion, a hairline scroll progress),
   FAQ cards and the Book Now flow.
   The booking flow runs in test mode: sample APE sessions, no payment taken.
   BOOKING INTEGRATION POINT: replace getSlots() and the pay step with the live booking system and payment gateway. */
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

  /* ---------- Header: steps away while you read down, comes back when you scroll up ---------- */
  var header = document.querySelector('.site-header');
  var burger = header && header.querySelector('.burger');
  var menu = document.getElementById('mobile-menu');
  var lastY = window.pageYOffset;

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
  if (header) header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });

  /* ---------- Section links: the current section is underlined in the header ---------- */
  var navLinks = [].slice.call(document.querySelectorAll('.nav-links a[data-section]'));
  var anchors = navLinks.length ? ['understanding', 'meet-the-team', 'faqs'].map(function (id) { return document.getElementById(id); }) : [];
  anchors = anchors.filter(Boolean);
  var bar = document.querySelector('.scroll-progress span');

  var ticking = false;
  function onFrame() {
    ticking = false;
    var y = window.pageYOffset, vh = window.innerHeight;
    if (header) {
      header.classList.toggle('is-scrolled', y > 8);
      var open = header.classList.contains('open');
      var focused = false;
      try { focused = !!header.querySelector(':focus-visible'); } catch (e) { focused = false; }
      if (!open && !focused) {
        if (y > lastY + 6 && y > header.offsetHeight * 1.5) header.classList.add('is-hidden');
        else if (y < lastY - 6 || y <= header.offsetHeight) header.classList.remove('is-hidden');
      }
    }
    if (Math.abs(y - lastY) > 6 || y <= 8) lastY = y;
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
