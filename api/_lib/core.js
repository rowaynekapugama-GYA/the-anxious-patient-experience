/* ==========================================================================
   Shared code for the booking functions (api/availability.js, api/booking.js, api/admin.js).
   Files in api/_lib are not deployed as functions of their own (Vercel skips names starting with "_").

   - Settings come from assets/site-config.js, the same file the pages use.
   - Bookings, blocked dates and times live in Neon Postgres (DATABASE_URL). Tables are created on first use.
   - Email goes through Resend (RESEND_API_KEY, BOOKING_FROM).
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const TM = 'The Anxious Patient Experience™';
const DEFAULT_NOTIFY_TO = 'theanxiouspatientexperience@gmail.com';
const FALLBACK = {
  contact: { phone: '(02) 8599 9815', apeEmail: DEFAULT_NOTIFY_TO, receptionEmail: '' },
  clinic: { name: 'The Cronulla Dentists', street: '13 Cronulla Street', suburb: 'Cronulla NSW 2230' },
  booking: { timeZone: 'Australia/Sydney', days: [3], startTimes: ['09:00', '10:20', '11:40'], startDate: '2026-12-02', minNoticeHours: 24, weeksAhead: 6, initialBlockedDates: [] },
  pricing: { appointment: 350, deposit: 100 },
  openingSpecial: { enabled: false, price: 250, from: '', to: '', maxBookings: 0, popup: false },
};

/* ---------------- settings ---------------- */
let configCache = null;
function loadConfig() {
  if (configCache) return configCache;
  const candidates = [path.join(process.cwd(), 'assets', 'site-config.js'), path.join(__dirname, '..', '..', 'assets', 'site-config.js')];
  for (const file of candidates) {
    try {
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: 'site-config.js', timeout: 200 });
      const c = sandbox.window.APE_CONFIG;
      if (c && c.booking && c.clinic) {
        configCache = {
          contact: Object.assign({}, FALLBACK.contact, c.contact),
          clinic: Object.assign({}, FALLBACK.clinic, c.clinic),
          booking: Object.assign({}, FALLBACK.booking, c.booking),
          pricing: Object.assign({}, FALLBACK.pricing, c.pricing),
          openingSpecial: Object.assign({}, FALLBACK.openingSpecial, c.openingSpecial),
        };
        return configCache;
      }
    } catch (err) { /* try the next location */ }
  }
  console.warn('ape: could not read assets/site-config.js, using built-in fallback settings');
  configCache = FALLBACK;
  return configCache;
}

/* ---------------- Sydney time ---------------- */
function tzOffsetMinutes(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(instant);
  const get = (k) => Number((parts.find((p) => p.type === k) || {}).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60000);
}
/* wall-clock time in a time zone -> Date (daylight saving aware) */
function zonedToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m, d, hh, mm);
  const first = tzOffsetMinutes(new Date(guess), tz);
  const second = tzOffsetMinutes(new Date(guess - first * 60000), tz);
  return new Date(guess - second * 60000);
}
function tzParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(date);
  const get = (k) => (parts.find((p) => p.type === k) || {}).value;
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hm: `${get('hour')}:${get('minute')}`,
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
  };
}
const tidy = (s) => String(s).replace(/[  ]/g, ' ');
function fmtDay(date, tz, withYear) {
  return tidy(new Intl.DateTimeFormat('en-AU', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined }).format(date));
}
function fmtTime(date, tz) {
  return tidy(new Intl.DateTimeFormat('en-AU', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(date));
}
function fmtDateTime(date, tz, withYear) { return `${fmtDay(date, tz, withYear)}, ${fmtTime(date, tz)}`; }
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
function weekdayOf(day) { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

/* ---------------- the schedule ---------------- */
/* Every APE day from max(today, startDate), for weeksAhead weeks (or `weeks` if given). */
function scheduleDays(cfg, now, weeks) {
  const b = cfg.booking;
  const today = tzParts(new Date(now), b.timeZone).day;
  const first = isDay(b.startDate) && b.startDate > today ? b.startDate : today;
  const span = (weeks || b.weeksAhead) * 7;
  const out = [];
  for (let i = 0; i <= span; i++) {
    const day = addDays(first, i);
    if (b.days.indexOf(weekdayOf(day)) !== -1) out.push(day);
  }
  return out;
}
function slotStart(cfg, day, time) {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return zonedToUtc(y, m - 1, d, hh, mm, cfg.booking.timeZone);
}
function inSpecialWindow(cfg, day) {
  const o = cfg.openingSpecial;
  return !!(o.enabled && isDay(o.from) && isDay(o.to) && day >= o.from && day <= o.to);
}
const blockedBy = (blocks, day, time) => blocks.find((x) => x.day === day && (!x.time || x.time === time));

/* Times patients can book now, each with its price. state = { blocks, taken (Set of ISO starts), specialUsed } */
function availability(cfg, state, now) {
  const b = cfg.booking;
  const o = cfg.openingSpecial;
  const earliest = now + b.minNoticeHours * 3600000;
  const specialOpen = !!(o.enabled && state.specialUsed < o.maxBookings);
  const slots = [];
  for (const day of scheduleDays(cfg, now)) {
    for (const time of b.startTimes) {
      const start = slotStart(cfg, day, time);
      if (start.getTime() < earliest) continue;
      if (blockedBy(state.blocks, day, time)) continue;
      if (state.taken.has(start.toISOString())) continue;
      const special = specialOpen && inSpecialWindow(cfg, day);
      slots.push({ start: start.toISOString(), day, time, special, price: special ? o.price : cfg.pricing.appointment });
    }
  }
  return {
    slots,
    special: {
      active: slots.some((s) => s.special),
      popup: !!o.popup,
      price: o.price,
      regular: cfg.pricing.appointment,
      from: o.from,
      to: o.to,
      days: slots.filter((s) => s.special).map((s) => s.day).filter((d, i, a) => a.indexOf(d) === i),
    },
    pricing: { appointment: cfg.pricing.appointment, deposit: cfg.pricing.deposit },
    deposit: { mode: process.env.DEPOSIT_PAYMENT_URL ? 'link' : 'later', amount: cfg.pricing.deposit },
  };
}

/* ---------------- database ---------------- */
/* An adapter has query(text, params) -> rows and tx([[text, params], ...]) -> [rows, ...] in one transaction.
   Production uses Neon's serverless driver over HTTPS; the test script swaps in a local Postgres. */
let adapter = null;
function setAdapter(a) { adapter = a; schemaReady = null; }
function db() {
  if (adapter) return adapter;
  if (!process.env.DATABASE_URL) return null;
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  adapter = {
    query: (text, params) => sql.query(text, params || []),
    tx: (list) => sql.transaction(list.map(([text, params]) => sql.query(text, params || []))),
  };
  return adapter;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ape_bookings (
     id bigserial PRIMARY KEY,
     ref text UNIQUE NOT NULL,
     slot_start timestamptz NOT NULL,
     name text NOT NULL,
     email text NOT NULL,
     phone text NOT NULL DEFAULT '',
     notes text NOT NULL DEFAULT '',
     price integer NOT NULL,
     special boolean NOT NULL DEFAULT false,
     status text NOT NULL DEFAULT 'requested',
     deposit_paid boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ape_bookings_live_slot ON ape_bookings (slot_start) WHERE status <> 'cancelled'`,
  `CREATE TABLE IF NOT EXISTS ape_blocks (
     id bigserial PRIMARY KEY,
     day date NOT NULL,
     time text,
     note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ape_blocks_day_time ON ape_blocks (day, (coalesce(time, '')))`,
  `CREATE TABLE IF NOT EXISTS ape_meta (key text PRIMARY KEY, value text NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS ape_login_attempts (ip text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
];
let schemaReady = null;
function ensureSchema(d, cfg) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await d.tx(SCHEMA.map((t) => [t, []]));
      // Blocks from the settings file are added once, the first time the database is used.
      const seeded = await d.query(`INSERT INTO ape_meta (key, value) VALUES ('seeded_blocks', $1) ON CONFLICT DO NOTHING RETURNING key`, [new Date().toISOString()]);
      if (seeded.length) {
        for (const day of (cfg.booking.initialBlockedDates || []).filter(isDay)) {
          await d.query(`INSERT INTO ape_blocks (day, time, note) VALUES ($1::date, NULL, $2) ON CONFLICT DO NOTHING`, [day, 'Christmas (set up by GYA)']);
        }
      }
    })().catch((err) => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

async function readState(cfg) {
  const d = db();
  if (!d) {
    // No database yet: the site still shows times (minus the blocks in the settings file), but bookings cannot be
    // taken until DATABASE_URL is set, because the opening special and taken times could not be tracked.
    return { db: false, blocks: (cfg.booking.initialBlockedDates || []).filter(isDay).map((day) => ({ day, time: null, note: '' })), taken: new Set(), specialUsed: 0 };
  }
  await ensureSchema(d, cfg);
  const [blocks, taken, used] = await Promise.all([
    d.query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, time, note FROM ape_blocks WHERE day >= current_date - 2 ORDER BY day, time NULLS FIRST`),
    d.query(`SELECT slot_start FROM ape_bookings WHERE status <> 'cancelled' AND slot_start >= now() - interval '2 days'`),
    d.query(`SELECT count(*)::int AS n FROM ape_bookings WHERE special AND status <> 'cancelled'`),
  ]);
  return {
    db: true,
    blocks: blocks.map((r) => ({ day: r.day, time: r.time || null, note: r.note || '' })),
    taken: new Set(taken.map((r) => new Date(r.slot_start).toISOString())),
    specialUsed: Number(used[0] && used[0].n) || 0,
  };
}

/* ---------------- email (Resend) ---------------- */
async function sendEmail(msg) {
  const r = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json().catch(() => ({}));
}

/* ---------------- http helpers ---------------- */
function send(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  for (const [k, v] of Object.entries(headers || {})) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!raw && typeof req.on === 'function' && req.method !== 'GET') {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 20000) throw new Error('too_large');
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (raw.length > 20000) throw new Error('too_large');
  return raw ? JSON.parse(raw) : {};
}
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const oneLine = (v) => v.replace(/\s+/g, ' ');
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${Number(n).toLocaleString('en-AU')}`;

/* ---------------- dashboard sign-in ---------------- */
/* One password for the APE team (ADMIN_PASSWORD). The session cookie is signed with a key made from that password,
   so changing the password in Vercel signs everyone out. */
const SESSION_HOURS = 12;
const COOKIE = 'ape_admin';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
function sessionKey() { return sha(`ape-admin-session:${process.env.ADMIN_PASSWORD || ''}`); }
function passwordMatches(pw) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (real.length < 8) return false;
  return crypto.timingSafeEqual(sha(pw), sha(real));
}
function makeSession(now) {
  const exp = String(now + SESSION_HOURS * 3600000);
  const sig = crypto.createHmac('sha256', sessionKey()).update(exp).digest('hex');
  return `${exp}.${sig}`;
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
function hasSession(req, now) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9]+)\\.([a-f0-9]{64})`));
  if (!m) return false;
  if (Number(m[1]) < now) return false;
  const want = crypto.createHmac('sha256', sessionKey()).update(m[1]).digest();
  const got = Buffer.from(m[2], 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '').split(',')[0].trim().slice(0, 64) || 'unknown';
}

module.exports = {
  TM, DEFAULT_NOTIFY_TO, loadConfig, tzParts, zonedToUtc, fmtDay, fmtTime, fmtDateTime, tidy, isDay, addDays, weekdayOf,
  scheduleDays, slotStart, inSpecialWindow, blockedBy, availability,
  db, setAdapter, ensureSchema, readState,
  sendEmail, send, readBody, clean, oneLine, escHtml, money,
  passwordMatches, makeSession, cookieHeader, hasSession, clientIp, SESSION_HOURS, COOKIE,
  _resetConfig: () => { configCache = null; },
};
