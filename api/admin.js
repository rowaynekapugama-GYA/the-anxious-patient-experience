/* ==========================================================================
   APE dashboard API (/api/admin/), used by the dashboard page at /admin/.

   Sign in:   POST {action:'login', password}   (password = ADMIN_PASSWORD in Vercel)
              POST {action:'logout'}
   Read:      GET  ?action=data                  bookings, the schedule with blocked days and times, the special
   Change:    POST {action:'booking', ref, status?, depositPaid?}   status: requested | confirmed | cancelled
              POST {action:'block', from, to?, time?, note?}        block a day, a range of days or one time
              POST {action:'unblock', day, time?}

   Every request other than login needs the signed session cookie, and every POST needs the X-APE-Admin header
   (a page on another site cannot send it, so it cannot act for a signed-in user).
   ========================================================================== */
'use strict';

const core = require('./_lib/core');

const SCHEDULE_WEEKS = 20;
const memAttempts = new Map(); // fallback throttle when there is no database

async function tooManyAttempts(d, ip) {
  if (!d) {
    const list = (memAttempts.get(ip) || []).filter((t) => t > Date.now() - 15 * 60000);
    memAttempts.set(ip, list);
    return list.length >= 8;
  }
  const r = await d.query(`SELECT count(*)::int AS n FROM ape_login_attempts WHERE ip = $1 AND at > now() - interval '15 minutes'`, [ip]);
  return (r[0] && r[0].n) >= 8;
}
async function recordFailure(d, ip) {
  if (!d) { memAttempts.set(ip, (memAttempts.get(ip) || []).concat(Date.now())); return; }
  await d.query(`INSERT INTO ape_login_attempts (ip) VALUES ($1)`, [ip]);
  await d.query(`DELETE FROM ape_login_attempts WHERE at < now() - interval '1 day'`);
}

function bookingRow(r, tz) {
  const start = new Date(r.slot_start);
  const p = core.tzParts(start, tz);
  return {
    ref: r.ref, start: start.toISOString(), day: p.day, time: p.hm,
    when: core.fmtDateTime(start, tz, true),
    name: r.name, email: r.email, phone: r.phone, notes: r.notes,
    price: Number(r.price), special: !!r.special, status: r.status, depositPaid: !!r.deposit_paid,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

async function data(cfg, d, now) {
  const tz = cfg.booking.timeZone;
  const o = cfg.openingSpecial;
  const out = {
    ok: true,
    database: !!d,
    email: !!(process.env.RESEND_API_KEY && process.env.BOOKING_FROM),
    deposit: { mode: process.env.DEPOSIT_PAYMENT_URL ? 'link' : 'later', amount: cfg.pricing.deposit },
    pricing: cfg.pricing,
    booking: { startDate: cfg.booking.startDate, startTimes: cfg.booking.startTimes, days: cfg.booking.days, minNoticeHours: cfg.booking.minNoticeHours, weeksAhead: cfg.booking.weeksAhead },
    bookings: [], blocks: [], schedule: [],
  };
  const state = await core.readState(cfg);
  if (d) {
    const rows = await d.query(`SELECT * FROM ape_bookings WHERE slot_start >= now() - interval '60 days' ORDER BY slot_start, created_at`);
    out.bookings = rows.map((r) => bookingRow(r, tz));
  }
  out.blocks = state.blocks.filter((b) => b.day >= core.tzParts(new Date(now), tz).day);
  const pub = core.availability(cfg, state, now);
  out.special = {
    enabled: !!o.enabled, price: o.price, regular: cfg.pricing.appointment, from: o.from, to: o.to,
    max: o.maxBookings, used: state.specialUsed, showing: pub.special.active,
  };
  // The schedule: every APE day for the next few months and what is happening at each time.
  const live = out.bookings.filter((b) => b.status !== 'cancelled');
  const earliest = now + cfg.booking.minNoticeHours * 3600000;
  out.schedule = core.scheduleDays(cfg, now, SCHEDULE_WEEKS).map((day) => {
    const whole = state.blocks.find((b) => b.day === day && !b.time);
    const first = core.slotStart(cfg, day, cfg.booking.startTimes[0]);
    return {
      day,
      label: core.fmtDay(first, tz, true),
      special: core.inSpecialWindow(cfg, day),
      blocked: whole ? { note: whole.note } : null,
      slots: cfg.booking.startTimes.map((time) => {
        const start = core.slotStart(cfg, day, time);
        const booking = live.find((b) => b.start === start.toISOString());
        const block = state.blocks.find((b) => b.day === day && b.time === time);
        let status = 'open';
        if (booking) status = 'booked';
        else if (whole || block) status = 'blocked';
        else if (start.getTime() < earliest) status = 'closed';
        return {
          time, label: core.fmtTime(start, tz), start: start.toISOString(), status,
          note: block ? block.note : '',
          booking: booking ? { ref: booking.ref, name: booking.name, status: booking.status } : null,
        };
      }),
    };
  });
  return out;
}

module.exports = async function handler(req, res) {
  const cfg = core.loadConfig();
  const now = Date.now();
  const d = core.db();
  if (!process.env.ADMIN_PASSWORD) return core.send(res, 503, { ok: false, error: 'no_password' });

  let body = {};
  if (req.method === 'POST') {
    if (req.headers['x-ape-admin'] !== '1') return core.send(res, 403, { ok: false, error: 'forbidden' });
    try { body = await core.readBody(req); } catch (err) { return core.send(res, 400, { ok: false, error: 'invalid' }); }
  } else if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return core.send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const action = req.method === 'GET' ? new URL(req.url, 'http://x').searchParams.get('action') : String(body.action || '');

  try {
    if (d) await core.ensureSchema(d, cfg);

    if (action === 'login') {
      const ip = core.clientIp(req);
      if (await tooManyAttempts(d, ip)) return core.send(res, 429, { ok: false, error: 'too_many' });
      if (!core.passwordMatches(core.clean(body.password, 200))) {
        await recordFailure(d, ip);
        await new Promise((r) => setTimeout(r, 600));
        return core.send(res, 401, { ok: false, error: 'wrong_password' });
      }
      return core.send(res, 200, { ok: true }, { 'Set-Cookie': core.cookieHeader(core.makeSession(now), core.SESSION_HOURS * 3600) });
    }
    if (action === 'logout') return core.send(res, 200, { ok: true }, { 'Set-Cookie': core.cookieHeader('', 0) });

    // "Am I signed in?" answers quietly (no 401), so the sign-in page loads without console errors
    if (action === 'session') return core.send(res, 200, { ok: core.hasSession(req, now) });
    if (!core.hasSession(req, now)) return core.send(res, 401, { ok: false, error: 'signed_out' });
    if (action === 'data') return core.send(res, 200, await data(cfg, d, now));

    if (!d) return core.send(res, 503, { ok: false, error: 'no_database' });

    if (action === 'booking') {
      const ref = core.clean(body.ref, 20);
      const sets = [];
      const params = [ref];
      if (body.status !== undefined) {
        if (['requested', 'confirmed', 'cancelled'].indexOf(body.status) === -1) return core.send(res, 400, { ok: false, error: 'invalid' });
        params.push(body.status); sets.push(`status = $${params.length}`);
      }
      if (body.depositPaid !== undefined) { params.push(!!body.depositPaid); sets.push(`deposit_paid = $${params.length}`); }
      if (!sets.length) return core.send(res, 400, { ok: false, error: 'invalid' });
      try {
        const r = await d.query(`UPDATE ape_bookings SET ${sets.join(', ')}, updated_at = now() WHERE ref = $1 RETURNING ref`, params);
        if (!r.length) return core.send(res, 404, { ok: false, error: 'not_found' });
      } catch (err) {
        if (/unique|duplicate/i.test(err.message)) return core.send(res, 409, { ok: false, error: 'taken' });
        throw err;
      }
      return core.send(res, 200, { ok: true });
    }

    if (action === 'block') {
      const from = core.clean(body.from, 10);
      const to = core.clean(body.to, 10) || from;
      const time = core.clean(body.time, 5) || null;
      const note = core.oneLine(core.clean(body.note, 200));
      if (!core.isDay(from) || !core.isDay(to) || to < from) return core.send(res, 400, { ok: false, error: 'invalid_dates' });
      if (time && (cfg.booking.startTimes.indexOf(time) === -1 || from !== to)) return core.send(res, 400, { ok: false, error: 'invalid_time' });
      const days = [];
      for (let day = from, n = 0; day <= to && n < 800; day = core.addDays(day, 1), n++) {
        if (cfg.booking.days.indexOf(core.weekdayOf(day)) !== -1) days.push(day);
      }
      if (!days.length) return core.send(res, 400, { ok: false, error: 'no_ape_days' });
      for (const day of days) {
        await d.query(`INSERT INTO ape_blocks (day, time, note) VALUES ($1::date, $2, $3) ON CONFLICT DO NOTHING`, [day, time, note]);
      }
      // Tell the team about any requests already on those days (blocking does not cancel them)
      const clash = await d.query(
        `SELECT ref, name, slot_start FROM ape_bookings WHERE status <> 'cancelled' AND (slot_start AT TIME ZONE $1)::date = ANY($2::date[]) ORDER BY slot_start`,
        [cfg.booking.timeZone, days]);
      const tz = cfg.booking.timeZone;
      const clashes = clash
        .map((r) => ({ ref: r.ref, name: r.name, when: core.fmtDateTime(new Date(r.slot_start), tz, false), time: core.tzParts(new Date(r.slot_start), tz).hm }))
        .filter((c) => !time || c.time === time);
      return core.send(res, 200, { ok: true, days, clashes });
    }

    if (action === 'unblock') {
      const day = core.clean(body.day, 10);
      const time = core.clean(body.time, 5) || '';
      if (!core.isDay(day)) return core.send(res, 400, { ok: false, error: 'invalid_dates' });
      await d.query(`DELETE FROM ape_blocks WHERE day = $1::date AND coalesce(time, '') = $2`, [day, time]);
      return core.send(res, 200, { ok: true });
    }

    return core.send(res, 400, { ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error('admin: error', action, err.message);
    return core.send(res, 500, { ok: false, error: 'server_error' });
  }
};
