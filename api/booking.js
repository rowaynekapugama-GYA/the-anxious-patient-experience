/* ==========================================================================
   Booking requests for The Anxious Patient Experience™ (Vercel serverless function, POST /api/booking)

   The website does not connect to Core Practice. A patient chooses a time, enters their details and ticks the
   deposit policy; this function checks the request and emails it to the APE inbox. The APE team then blocks the
   time in Core Practice and confirms with the patient. The patient gets an acknowledgement email straight away.

   Email is sent with Resend (https://resend.com). Environment variables (Vercel > Settings > Environment Variables):
     RESEND_API_KEY      required, the Resend API key
     BOOKING_FROM        required, a sender on a domain verified in Resend,
                         e.g. The Anxious Patient Experience <bookings@yourdomain.com.au>
     BOOKING_NOTIFY_TO   optional, where requests go (defaults to the APE inbox below)
     BOOKING_BCC         optional, comma-separated extra copies of the request (off by default)

   Booking rules (days, times, 24-hour notice, weeks ahead) come from assets/site-config.js, the same file the
   Book Now page uses, so the page and this check can never disagree. Payment stays in test mode: no money is taken.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const DEFAULT_NOTIFY_TO = 'theanxiouspatientexperience@gmail.com';
const FALLBACK = {
  contact: { phone: '(02) 8599 9815', apeEmail: DEFAULT_NOTIFY_TO },
  clinic: { name: 'The Cronulla Dentists', street: '13 Cronulla Street', suburb: 'Cronulla NSW 2230' },
  booking: { timeZone: 'Australia/Sydney', days: [3], startTimes: ['09:00', '10:20', '11:40'], minNoticeHours: 24, weeksAhead: 6, depositMode: 'test' },
};
const TM = 'The Anxious Patient Experience™';
const APPOINTMENT = `${TM}: New Patient Appointment (70 minutes, $350, $100 deposit)`;

function loadConfig() {
  const candidates = [path.join(process.cwd(), 'assets', 'site-config.js'), path.join(__dirname, '..', 'assets', 'site-config.js')];
  for (const file of candidates) {
    try {
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: 'site-config.js', timeout: 200 });
      const c = sandbox.window.APE_CONFIG;
      if (c && c.booking && c.clinic) return { contact: c.contact || FALLBACK.contact, clinic: c.clinic, booking: Object.assign({}, FALLBACK.booking, c.booking) };
    } catch (err) { /* try the next location */ }
  }
  console.warn('booking: could not read assets/site-config.js, using built-in fallback settings');
  return FALLBACK;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!raw && typeof req.on === 'function') {
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
const tidy = (s) => s.replace(/[  ]/g, ' ');

function sydneyParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(date);
  const get = (k) => (parts.find((p) => p.type === k) || {}).value;
  return { weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), hm: `${get('hour')}:${get('minute')}` };
}
function fmtDateTime(date, timeZone, withYear) {
  const day = new Intl.DateTimeFormat('en-AU', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined }).format(date);
  const time = new Intl.DateTimeFormat('en-AU', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  return tidy(`${day}, ${time}`);
}

/* The same rules as the Book Now page: a listed day and start time, at least minNoticeHours away, within weeksAhead. */
function checkSlot(iso, rules, now) {
  const start = new Date(iso);
  if (!iso || isNaN(start.getTime())) return 'invalid_time';
  const p = sydneyParts(start, rules.timeZone);
  if (rules.days.indexOf(p.weekday) === -1 || rules.startTimes.indexOf(p.hm) === -1) return 'invalid_time';
  if (start.getTime() < now + rules.minNoticeHours * 3600000) return 'too_soon';
  if (start.getTime() > now + (rules.weeksAhead * 7 + 1) * 86400000) return 'invalid_time';
  return '';
}

async function sendEmail(msg) {
  const r = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json().catch(() => ({}));
}

function table(rows) {
  return '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:15px/1.5 Arial,sans-serif;color:#284858">' +
    rows.map(([k, v]) => `<tr><td style="vertical-align:top;color:#7E6548;white-space:nowrap"><strong>${escHtml(k)}</strong></td><td style="vertical-align:top">${escHtml(v).replace(/\n/g, '<br>')}</td></tr>`).join('') +
    '</table>';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  let body;
  try { body = await readBody(req); } catch (err) { return send(res, 400, { ok: false, error: 'invalid' }); }
  if (!body || typeof body !== 'object') return send(res, 400, { ok: false, error: 'invalid' });

  const cfg = loadConfig();
  const rules = cfg.booking;
  const now = Date.now();
  const ref = 'APE-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  // Spam trap: a hidden field people never see. Pretend it worked and send nothing.
  if (clean(body.website, 200)) return send(res, 200, { ok: true, ref });

  const name = oneLine(clean(body.name, 120));
  const email = clean(body.email, 200);
  const phone = oneLine(clean(body.phone, 40));
  const notes = clean(body.notes, 2000);
  const fields = {};
  if (!name) fields.name = 'required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'invalid';
  if (body.consent !== true) fields.consent = 'required';
  if (body.policy !== true) fields.policy = 'required';
  if (Object.keys(fields).length) return send(res, 400, { ok: false, error: 'invalid', fields });

  const slotError = checkSlot(clean(body.slotStart, 40), rules, now);
  if (slotError) return send(res, slotError === 'too_soon' ? 409 : 400, { ok: false, error: slotError });

  if (!process.env.RESEND_API_KEY || !process.env.BOOKING_FROM) {
    console.error('booking: RESEND_API_KEY and BOOKING_FROM must be set in Vercel. Request not sent:', ref);
    return send(res, 503, { ok: false, error: 'not_configured' });
  }

  const start = new Date(body.slotStart);
  const tz = rules.timeZone;
  const when = `${fmtDateTime(start, tz, true)} (Sydney time)`;
  const submitted = `${fmtDateTime(new Date(now), tz, true)} (Sydney time), ${new Date(now).toISOString()}`;
  const clinicLine = `${cfg.clinic.name}, ${cfg.clinic.street}, ${cfg.clinic.suburb}`;
  const deposit = rules.depositMode === 'test' ? 'TEST MODE: no payment has been taken' : String(rules.depositMode);
  const notifyTo = (process.env.BOOKING_NOTIFY_TO || DEFAULT_NOTIFY_TO).split(',').map((s) => s.trim()).filter(Boolean);
  const bcc = (process.env.BOOKING_BCC || '').split(',').map((s) => s.trim()).filter(Boolean);
  const apeInbox = (cfg.contact && cfg.contact.apeEmail) || DEFAULT_NOTIFY_TO;
  const clinicPhone = (cfg.contact && cfg.contact.phone) || FALLBACK.contact.phone;

  // 1. The request, to the APE inbox
  const rows = [
    ['Reference', ref],
    ['Requested time', when],
    ['Appointment', APPOINTMENT],
    ['Location', clinicLine],
    ['Name', name],
    ['Email', email],
    ['Phone', phone || 'Not provided'],
    ['Note from patient', notes || 'None'],
    ['Deposit', deposit],
    ['Deposit and cancellation policy', 'Read and accepted'],
    ['Collection notice', 'Agreed'],
    ['Submitted', submitted],
  ];
  const nextStep = 'Next step: block this time in Core Practice, then reply to the patient to confirm the appointment and send the new patient information pack.';
  const notify = {
    from: process.env.BOOKING_FROM,
    to: notifyTo,
    reply_to: email,
    subject: `APE booking request: ${tidy(fmtDateTime(start, tz, false))}, ${name} (${ref})`,
    text: `New booking request for ${TM}. This time is not yet confirmed.\n\n` + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n${nextStep}\nReplying to this email replies to the patient.`,
    html: `<p style="font:16px/1.5 Arial,sans-serif;color:#284858">New booking request for ${escHtml(TM)}. <strong>This time is not yet confirmed.</strong></p>` +
      table(rows) + `<p style="font:15px/1.5 Arial,sans-serif;color:#284858">${escHtml(nextStep)}<br>Replying to this email replies to the patient.</p>`,
  };
  if (bcc.length) notify.bcc = bcc;
  try {
    await sendEmail(notify);
  } catch (err) {
    console.error('booking: notification email failed', ref, err.message);
    return send(res, 502, { ok: false, error: 'send_failed' });
  }

  // 2. The acknowledgement, to the patient (NEW COPY: needs the client's sign-off, see CHANGELOG)
  const first = name.split(' ')[0];
  const ackLines = [
    `Hi ${first},`,
    `Thank you for your booking request for ${TM} New Patient Appointment.`,
    `Requested time: ${when}\nLocation: ${clinicLine}\nReference: ${ref}`,
    'The APE team will be in touch to confirm your appointment and send your new patient information pack.' +
      (rules.depositMode === 'test' ? ' No deposit has been taken yet.' : ''),
    `If anything changes or you have a question, simply reply to this email or call us on ${clinicPhone}.`,
    `Warm regards,\n${TM} team`,
  ];
  let ackSent = true;
  try {
    await sendEmail({
      from: process.env.BOOKING_FROM,
      to: [email],
      reply_to: apeInbox,
      subject: `We have received your booking request | ${TM}`,
      text: ackLines.join('\n\n'),
      html: ackLines.map((l) => `<p style="font:16px/1.6 Arial,sans-serif;color:#284858">${escHtml(l).replace(/\n/g, '<br>')}</p>`).join(''),
    });
  } catch (err) {
    ackSent = false;
    console.error('booking: acknowledgement email failed (the request itself was sent)', ref, err.message);
  }
  return send(res, 200, { ok: true, ref, ackSent });
};

module.exports.checkSlot = checkSlot; // for the test script
