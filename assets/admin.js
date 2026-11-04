/* APE booking dashboard (/admin/). Talks to /api/admin/. Plain JavaScript, no build step. */
(function () {
  'use strict';
  var API = '/api/admin/';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); };
  var state = { data: null, filter: 'upcoming', view: 'bookings' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n).toLocaleString('en-AU'); }
  function dayLabel(day, opts) {
    var p = day.split('-').map(Number);
    return new Intl.DateTimeFormat('en-AU', Object.assign({ timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, opts || {}))
      .format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
  }
  function timeLabel(hm) {
    var p = hm.split(':').map(Number);
    return (p[0] % 12 || 12) + ':' + String(p[1]).padStart(2, '0') + (p[0] < 12 ? ' am' : ' pm');
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 3600);
  }
  function api(method, body, query) {
    var opts = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (method === 'POST') { opts.headers['Content-Type'] = 'application/json'; opts.headers['X-APE-Admin'] = '1'; opts.body = JSON.stringify(body || {}); }
    return fetch(API + (query || ''), opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'server_error' }; }).then(function (j) {
        if (r.status === 401 && j.error === 'signed_out') { showSignin(); throw new Error('signed_out'); }
        return j;
      });
    });
  }
  var ERR = {
    wrong_password: 'That password is not right. Please try again.',
    too_many: 'Too many attempts. Please wait 15 minutes and try again.',
    no_password: 'The dashboard password has not been set up yet. Please contact GYA.',
    no_database: 'The booking database is not connected yet, so changes cannot be saved. Please contact GYA.',
    taken: 'Another booking already has that time, so this one cannot be restored.',
    invalid_dates: 'Please choose a valid first day (and last day, if you add one, on or after the first day).',
    no_ape_days: 'There are no APE days between those dates.',
    server_error: 'Something went wrong. Please try again, or contact GYA if it keeps happening.'
  };
  function errText(e) { return ERR[e] || ERR.server_error; }

  /* ---------- sign in / out ---------- */
  function showSignin() { $('#app').hidden = true; $('#signin').hidden = false; setTimeout(function () { $('#pw').focus(); }, 30); }
  function showApp() { $('#signin').hidden = true; $('#app').hidden = false; }
  $('#signin-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var err = $('#signin-error'), btn = $('#signin-form button');
    err.hidden = true; btn.disabled = true;
    api('POST', { action: 'login', password: $('#pw').value }).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { err.textContent = errText(r.error); err.hidden = false; $('#pw').select(); return; }
      $('#pw').value = '';
      showApp(); load();
    }, function () { btn.disabled = false; err.textContent = ERR.server_error; err.hidden = false; });
  });
  $('#signout').addEventListener('click', function () {
    api('POST', { action: 'logout' }).then(function () { state.data = null; showSignin(); });
  });

  /* ---------- views ---------- */
  function setView(v) {
    state.view = v;
    $$('.view').forEach(function (s) { s.hidden = s.id !== 'view-' + v; });
    $$('.side nav a').forEach(function (a) { if (a.getAttribute('data-view') === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  $$('.side nav a').forEach(function (a) {
    a.addEventListener('click', function (ev) { ev.preventDefault(); setView(a.getAttribute('data-view')); history.replaceState(null, '', '#' + a.getAttribute('data-view')); $('#main').focus(); });
  });
  $$('[data-refresh]').forEach(function (b) { b.addEventListener('click', function () { load().then(function () { toast('Up to date.'); }); }); });

  function load() {
    return api('GET', null, '?action=data').then(function (d) {
      if (!d.ok) { $('#notices').innerHTML = '<p class="notice">' + esc(errText(d.error)) + '</p>'; return; }
      state.data = d; render();
    }).catch(function () {});
  }

  function render() {
    var d = state.data;
    var n = [];
    if (!d.database) n.push('<strong>The booking database is not connected yet.</strong> Patients can see times on the website but cannot send a request until GYA connects it.');
    if (!d.email) n.push('<strong>Booking emails are not set up yet.</strong> Requests cannot be sent until GYA finishes the email set-up.');
    if (d.deposit.mode === 'later') n.push('No deposit payment link yet: patients are told the deposit details will come with their confirmation.');
    $('#notices').innerHTML = n.map(function (x) { return '<p class="notice">' + x + '</p>'; }).join('');
    renderStats(); renderBookings(); renderSchedule(); renderSpecial();
    $('#avail-intro').textContent = 'APE appointments are on ' + d.booking.days.map(function (x) { return ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][x]; }).join(', ') +
      ' at ' + d.booking.startTimes.map(timeLabel).join(', ') + ', from ' + dayLabel(d.booking.startDate, { weekday: undefined }) +
      '. Patients can book up to ' + d.booking.weeksAhead + ' weeks ahead and at least ' + d.booking.minNoticeHours + ' hours before.';
  }

  function todayKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date()); }

  function renderStats() {
    var b = state.data.bookings, today = todayKey();
    var up = b.filter(function (x) { return x.day >= today && x.status !== 'cancelled'; });
    var toConfirm = up.filter(function (x) { return x.status === 'requested'; }).length;
    var depositDue = up.filter(function (x) { return !x.depositPaid; }).length;
    var s = state.data.special;
    $('#stats').innerHTML =
      '<div class="stat"><b>' + toConfirm + '</b><span>To confirm</span></div>' +
      '<div class="stat"><b>' + up.length + '</b><span>Upcoming appointments</span></div>' +
      '<div class="stat"><b>' + depositDue + '</b><span>Deposits not yet received</span></div>' +
      (s.enabled ? '<div class="stat"><b>' + Math.min(s.used, s.max) + ' of ' + s.max + '</b><span>Opening special used</span></div>' : '');
    $$('.tabs button').forEach(function (btn) {
      var f = btn.getAttribute('data-filter'), c = filtered(f).length;
      btn.innerHTML = esc(btn.textContent.replace(/\s*\d+$/, '')) + '<span class="count">' + c + '</span>';
    });
  }
  function filtered(f) {
    var b = state.data.bookings, today = todayKey();
    if (f === 'requested') return b.filter(function (x) { return x.day >= today && x.status === 'requested'; });
    if (f === 'cancelled') return b.filter(function (x) { return x.status === 'cancelled'; });
    if (f === 'past') return b.filter(function (x) { return x.day < today && x.status !== 'cancelled'; }).reverse();
    return b.filter(function (x) { return x.day >= today && x.status !== 'cancelled'; });
  }
  $$('.tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.filter = btn.getAttribute('data-filter');
      $$('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === btn ? 'true' : 'false'); });
      renderBookings();
    });
  });

  function renderBookings() {
    var list = filtered(state.filter);
    var box = $('#booking-list');
    if (!list.length) {
      box.innerHTML = '<p class="empty">' + ({ upcoming: 'No upcoming bookings yet.', requested: 'Nothing waiting to be confirmed.', cancelled: 'No cancelled bookings.', past: 'No past bookings.' })[state.filter] + '</p>';
      return;
    }
    var groups = [];
    list.forEach(function (b) {
      var g = groups[groups.length - 1];
      if (!g || g.day !== b.day) { g = { day: b.day, items: [] }; groups.push(g); }
      g.items.push(b);
    });
    box.innerHTML = groups.map(function (g) {
      return '<div class="day-group"><h3>' + esc(dayLabel(g.day)) + '</h3>' + g.items.map(bookingHtml).join('') + '</div>';
    }).join('');
  }
  function bookingHtml(b) {
    var status = { requested: 'To confirm', confirmed: 'Confirmed', cancelled: 'Cancelled' }[b.status];
    var made = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(b.createdAt));
    var actions = [];
    if (b.status === 'requested') actions.push('<button class="btn btn-small" data-do="confirm" data-ref="' + esc(b.ref) + '">Mark confirmed</button>');
    if (b.status !== 'cancelled') {
      actions.push(b.depositPaid
        ? '<button class="btn btn-ghost btn-small" data-do="unpaid" data-ref="' + esc(b.ref) + '">Undo deposit</button>'
        : '<button class="btn btn-ghost btn-small" data-do="paid" data-ref="' + esc(b.ref) + '">Deposit received</button>');
      actions.push('<button class="btn btn-ghost btn-small" data-do="cancel" data-ref="' + esc(b.ref) + '">Cancel booking</button>');
    } else {
      actions.push('<button class="btn btn-ghost btn-small" data-do="restore" data-ref="' + esc(b.ref) + '">Restore</button>');
    }
    return '<article class="booking' + (b.status === 'cancelled' ? ' is-cancelled' : '') + '">' +
      '<div class="b-time">' + esc(timeLabel(b.time)) + '<small>' + esc(b.ref) + '</small></div>' +
      '<div><div class="b-name">' + esc(b.name) + '</div>' +
      '<div class="b-meta"><a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>' + (b.phone ? '<a href="tel:' + esc(b.phone.replace(/[^\d+]/g, '')) + '">' + esc(b.phone) + '</a>' : '<span>No phone given</span>') + '<span>Requested ' + esc(made) + '</span></div>' +
      '<div class="b-badges"><span class="badge ' + b.status + '">' + status + '</span>' +
      (b.special ? '<span class="badge special">Opening special ' + money(b.price) + '</span>' : '<span class="badge">' + money(b.price) + '</span>') +
      '<span class="badge">' + (b.depositPaid ? 'Deposit received' : 'Deposit not yet received') + '</span></div>' +
      (b.notes ? '<div class="b-note"><strong>Note:</strong> ' + esc(b.notes) + '</div>' : '') + '</div>' +
      '<div class="b-actions">' + actions.join('') + '</div></article>';
  }
  $('#booking-list').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-do]');
    if (!btn) return;
    var ref = btn.getAttribute('data-ref'), what = btn.getAttribute('data-do');
    var b = state.data.bookings.filter(function (x) { return x.ref === ref; })[0];
    var body = { action: 'booking', ref: ref };
    var done = '';
    if (what === 'confirm') { body.status = 'confirmed'; done = 'Marked confirmed.'; }
    if (what === 'paid') { body.depositPaid = true; done = 'Deposit marked as received.'; }
    if (what === 'unpaid') { body.depositPaid = false; done = 'Deposit marked as not received.'; }
    if (what === 'restore') { body.status = 'requested'; done = 'Booking restored.'; }
    var go = function () {
      btn.disabled = true;
      api('POST', body).then(function (r) {
        if (!r.ok) { btn.disabled = false; toast(errText(r.error)); return; }
        toast(done); load();
      }).catch(function () {});
    };
    if (what === 'cancel') {
      body.status = 'cancelled'; done = 'Booking cancelled. The time is open on the website again.';
      ask('Cancel this booking?', b.name + ', ' + dayLabel(b.day) + ' at ' + timeLabel(b.time) + '. The time will open up on the website again. This does not email the patient.', 'Cancel booking', go);
      return;
    }
    go();
  });

  /* ---------- availability ---------- */
  function renderSchedule() {
    var box = $('#schedule');
    box.innerHTML = state.data.schedule.map(function (day) {
      var blocked = !!day.blocked;
      return '<div class="sched-day' + (blocked ? ' is-blocked' : '') + '">' +
        '<div class="sd-date">' + esc(dayLabel(day.day, { year: undefined })) +
        '<small>' + (blocked ? 'Blocked' + (day.blocked.note ? ': ' + esc(day.blocked.note) : '') : (day.special ? 'Opening special day' : 'Open')) + '</small></div>' +
        '<div class="sd-times">' + day.slots.map(function (s) {
          if (s.status === 'booked') return '<span class="chip booked">' + esc(s.label) + '<small>' + esc(s.booking.name) + (s.booking.status === 'confirmed' ? ' (confirmed)' : ' (to confirm)') + '</small></span>';
          if (s.status === 'closed') return '<span class="chip closed">' + esc(s.label) + '<small>Under 24 hours</small></span>';
          if (blocked) return '<span class="chip blocked">' + esc(s.label) + '<small>Blocked</small></span>';
          if (s.status === 'blocked') return '<button type="button" class="chip blocked" data-unblock-time="' + s.time + '" data-day="' + day.day + '" aria-label="' + esc(s.label) + ' is blocked. Open this time">' + esc(s.label) + '<small>Blocked' + (s.note ? ': ' + esc(s.note) : '') + '. Tap to open</small></button>';
          return '<button type="button" class="chip" data-block-time="' + s.time + '" data-day="' + day.day + '" aria-label="' + esc(s.label) + ' is open. Block this time">' + esc(s.label) + '<small>Open. Tap to block</small></button>';
        }).join('') + '</div>' +
        '<div>' + (blocked
          ? '<button type="button" class="btn btn-ghost btn-small" data-unblock-day="' + day.day + '">Open this day</button>'
          : '<button type="button" class="btn btn-ghost btn-small" data-block-day="' + day.day + '">Block this day</button>') + '</div></div>';
    }).join('') || '<p class="empty">No APE days to show.</p>';
  }
  function afterBlock(r, msg) {
    if (!r.ok) { toast(errText(r.error)); return; }
    if (r.clashes && r.clashes.length) {
      ask('Requests already on ' + (r.clashes.length === 1 ? 'that time' : 'those days'),
        'Blocking stops new bookings but does not cancel these: ' + r.clashes.map(function (c) { return c.name + ' (' + c.when + ')'; }).join('; ') +
        '. Contact these patients, then cancel them under Bookings if needed.', null, null);
    } else toast(msg);
    load();
  }
  $('#schedule').addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    var day = b.getAttribute('data-day') || b.getAttribute('data-block-day') || b.getAttribute('data-unblock-day');
    if (b.hasAttribute('data-block-time')) {
      api('POST', { action: 'block', from: day, time: b.getAttribute('data-block-time') }).then(function (r) { afterBlock(r, 'Time blocked.'); }).catch(function () {});
    } else if (b.hasAttribute('data-unblock-time')) {
      api('POST', { action: 'unblock', day: day, time: b.getAttribute('data-unblock-time') }).then(function (r) { if (!r.ok) return toast(errText(r.error)); toast('Time opened.'); load(); }).catch(function () {});
    } else if (b.hasAttribute('data-block-day')) {
      api('POST', { action: 'block', from: day }).then(function (r) { afterBlock(r, 'Day blocked.'); }).catch(function () {});
    } else if (b.hasAttribute('data-unblock-day')) {
      api('POST', { action: 'unblock', day: day }).then(function (r) { if (!r.ok) return toast(errText(r.error)); toast('Day opened. Patients can book it again.'); load(); }).catch(function () {});
    }
  });
  $('#block-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var err = $('#block-error');
    err.hidden = true;
    var from = $('#bf-from').value, to = $('#bf-to').value || from;
    if (!from) { err.textContent = 'Please choose the first day.'; err.hidden = false; return; }
    api('POST', { action: 'block', from: from, to: to, note: $('#bf-note').value }).then(function (r) {
      if (!r.ok) { err.textContent = errText(r.error); err.hidden = false; return; }
      $('#bf-from').value = ''; $('#bf-to').value = ''; $('#bf-note').value = '';
      afterBlock(r, (r.days.length === 1 ? '1 day' : r.days.length + ' days') + ' blocked.');
    }).catch(function () {});
  });

  /* ---------- opening special ---------- */
  function renderSpecial() {
    var s = state.data.special;
    var box = $('#special-card');
    if (!s.enabled) { box.innerHTML = '<div class="card"><p>The opening special is switched off.</p></div>'; return; }
    var used = Math.min(s.used, s.max);
    box.innerHTML = '<div class="card">' +
      '<h2>' + money(s.price) + ' instead of ' + money(s.regular) + '</h2>' +
      '<p class="muted">For appointments from ' + esc(dayLabel(s.from)) + ' to ' + esc(dayLabel(s.to)) + ', for the first ' + s.max + ' patients.</p>' +
      '<div class="meter" role="img" aria-label="' + used + ' of ' + s.max + ' used"><span style="width:' + Math.round(100 * used / Math.max(1, s.max)) + '%"></span></div>' +
      '<p><strong>' + used + ' of ' + s.max + '</strong> special bookings made (cancelled ones do not count).</p>' +
      '<div class="special-big"><div class="stat"><b>' + (s.showing ? 'Showing' : 'Not showing') + '</b><span>On the website right now</span></div></div>' +
      '<p class="muted small">The special shows on the website (banner, pop-up and the $250 price on those days) while any of its times are still free. It disappears by itself once ' + s.max +
      ' special bookings are made or the last special day has passed, whichever comes first. If a special booking is cancelled, that time goes back to ' + money(s.price) + '.</p></div>';
  }

  /* ---------- confirm dialog ---------- */
  function ask(title, body, yesLabel, onYes) {
    var dlg = $('#confirm-dlg');
    $('#confirm-title').textContent = title;
    $('#confirm-body').textContent = body;
    var yes = $('#confirm-yes');
    yes.hidden = !yesLabel;
    yes.textContent = yesLabel || '';
    $('.dlg-actions .btn-ghost', dlg).textContent = yesLabel ? 'Keep it' : 'OK';
    dlg.onclose = function () { if (dlg.returnValue === 'yes' && onYes) onYes(); };
    dlg.showModal();
  }

  /* ---------- start ---------- */
  var first = (location.hash || '#bookings').slice(1);
  setView(['bookings', 'availability', 'special', 'help'].indexOf(first) !== -1 ? first : 'bookings');
  api('GET', null, '?action=session').then(function (r) {
    if (r.ok) { showApp(); load(); }
    else if (r.error === 'no_password') { showSignin(); $('#signin-error').textContent = ERR.no_password; $('#signin-error').hidden = false; }
    else showSignin();
  }).catch(function () {});
})();
