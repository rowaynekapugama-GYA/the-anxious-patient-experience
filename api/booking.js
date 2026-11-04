/* ==========================================================================
   Booking requests for The Anxious Patient Experience™ (Vercel serverless function, POST /api/booking/)

   The website does not connect to Core Practice. A patient chooses a time, enters their details and ticks the
   deposit policy; this function:
     1. checks the time again on the server (listed day and time, from the start date, at least 24 hours away,
        not blocked, not already requested), works out the fee (opening special or standard) and saves the booking
        in the database, all in one step so two people can never get the same time or more than the special allows;
     2. emails the request to the APE inbox and an acknowledgement to the patient (with the deposit payment link if
        DEPOSIT_PAYMENT_URL is set).
   The APE team then blocks the time in Core Practice, confirms with the patient and marks it confirmed in /admin/.

   Environment variables (Vercel > Settings > Environment Variables), see .env.example:
     DATABASE_URL         required, Neon Postgres (added automatically when Neon is connected in Vercel > Storage)
     RESEND_API_KEY       required, Resend API key
     BOOKING_FROM         required, sender on a domain verified in Resend
     BOOKING_NOTIFY_TO    optional, where requests go (defaults to the APE inbox)
     BOOKING_BCC          optional, comma-separated extra copies (off by default)
     DEPOSIT_PAYMENT_URL  optional, payment link for the $100 deposit (for example a Stripe Payment Link)
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const core = require('./_lib/core');

const { TM } = core;

function table(rows) {
  return '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:15px/1.5 Arial,sans-serif;color:#284858">' +
    rows.map(([k, v]) => `<tr><td style="vertical-align:top;color:#7E6548;white-space:nowrap"><strong>${core.escHtml(k)}</strong></td><td style="vertical-align:top">${core.escHtml(v).replace(/\n/g, '<br>')}</td></tr>`).join('') +
    '</table>';
}
const para = (l) => `<p style="font:16px/1.6 Arial,sans-serif;color:#284858">${core.escHtml(l).replace(/\n/g, '<br>')}</p>`;

/* The payment link with the booking reference and email filled in (Stripe Payment Links read these two). */
function depositLink(ref, email) {
  const base = process.env.DEPOSIT_PAYMENT_URL;
  if (!base) return '';
  try {
    const u = new URL(base);
    u.searchParams.set('client_reference_id', ref);
    u.searchParams.set('prefilled_email', email);
    return u.toString();
  } catch (err) {
    return base;
  }
}

/* The same rules as the Book Now page. Returns '' if the time is a real, bookable APE time. */
function checkSlot(cfg, iso, now) {
  const start = new Date(iso);
  if (!iso || isNaN(start.getTime())) return { error: 'invalid_time' };
  const b = cfg.booking;
  const p = core.tzParts(start, b.timeZone);
  if (b.days.indexOf(p.weekday) === -1 || b.startTimes.indexOf(p.hm) === -1) return { error: 'invalid_time' };
  if (core.scheduleDays(cfg, now).indexOf(p.day) === -1) return { error: 'invalid_time' };
  if (start.getTime() < now + b.minNoticeHours * 3600000) return { error: 'too_soon' };
  return { error: '', day: p.day, time: p.hm, start };
}

const INSERT = `
  INSERT INTO ape_bookings (ref, slot_start, name, email, phone, notes, price, special)
  SELECT $1, $2::timestamptz, $3, $4, $5, $6, CASE WHEN s.ok THEN $8::int ELSE $9::int END, s.ok
  FROM (SELECT ($7::boolean AND (SELECT count(*) FROM ape_bookings WHERE special AND status <> 'cancelled') < $10::int) AS ok) s
  WHERE NOT EXISTS (SELECT 1 FROM ape_blocks b WHERE b.day = $11::date AND (b.time IS NULL OR b.time = $12))
  ON CONFLICT DO NOTHING
  RETURNING ref, price, special`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return core.send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  let body;
  try { body = await core.readBody(req); } catch (err) { return core.send(res, 400, { ok: false, error: 'invalid' }); }
  if (!body || typeof body !== 'object') return core.send(res, 400, { ok: false, error: 'invalid' });

  const cfg = core.loadConfig();
  const now = Date.now();
  const ref = 'APE-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  // Spam trap: a hidden field people never see. Pretend it worked and save or send nothing.
  if (core.clean(body.website, 200)) return core.send(res, 200, { ok: true, ref, price: cfg.pricing.appointment, special: false });

  const name = core.oneLine(core.clean(body.name, 120));
  const email = core.clean(body.email, 200);
  const phone = core.oneLine(core.clean(body.phone, 40));
  const notes = core.clean(body.notes, 2000);
  const fields = {};
  if (!name) fields.name = 'required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'invalid';
  if (body.consent !== true) fields.consent = 'required';
  if (body.policy !== true) fields.policy = 'required';
  if (Object.keys(fields).length) return core.send(res, 400, { ok: false, error: 'invalid', fields });

  const slot = checkSlot(cfg, core.clean(body.slotStart, 40), now);
  if (slot.error) return core.send(res, slot.error === 'too_soon' ? 409 : 400, { ok: false, error: slot.error });

  const d = core.db();
  if (!d || !process.env.RESEND_API_KEY || !process.env.BOOKING_FROM) {
    console.error('booking: DATABASE_URL, RESEND_API_KEY and BOOKING_FROM must all be set in Vercel. Request not taken:', ref);
    return core.send(res, 503, { ok: false, error: 'not_configured' });
  }

  // 1. Save it: one transaction, locked, so the special can never go past its limit and a time is never doubled.
  let saved;
  try {
    await core.ensureSchema(d, cfg);
    const o = cfg.openingSpecial;
    const results = await d.tx([
      ['SELECT pg_advisory_xact_lock(4242001)', []],
      [INSERT, [ref, slot.start.toISOString(), name, email, phone, notes, core.inSpecialWindow(cfg, slot.day), o.price, cfg.pricing.appointment, o.maxBookings, slot.day, slot.time]],
    ]);
    saved = results[1][0];
  } catch (err) {
    console.error('booking: database error', ref, err.message);
    return core.send(res, 503, { ok: false, error: 'unavailable' });
  }
  if (!saved) {
    const blocked = await d.query(`SELECT 1 FROM ape_blocks WHERE day = $1::date AND (time IS NULL OR time = $2) LIMIT 1`, [slot.day, slot.time]).catch(() => []);
    return core.send(res, 409, { ok: false, error: blocked.length ? 'blocked' : 'taken' });
  }
  const price = Number(saved.price);
  const special = !!saved.special;

  // 2. Emails
  const tz = cfg.booking.timeZone;
  const when = `${core.fmtDateTime(slot.start, tz, true)} (Sydney time)`;
  const submitted = `${core.fmtDateTime(new Date(now), tz, true)} (Sydney time), ${new Date(now).toISOString()}`;
  const clinicLine = `${cfg.clinic.name}, ${cfg.clinic.street}, ${cfg.clinic.suburb}`;
  const fee = special
    ? `${core.money(price)} opening special (normally ${core.money(cfg.pricing.appointment)}). Health fund rebates available.`
    : `${core.money(price)}. Health fund rebates available.`;
  const link = depositLink(ref, email);
  const deposit = cfg.pricing.deposit;
  const notifyTo = (process.env.BOOKING_NOTIFY_TO || core.DEFAULT_NOTIFY_TO).split(',').map((s) => s.trim()).filter(Boolean);
  const bcc = (process.env.BOOKING_BCC || '').split(',').map((s) => s.trim()).filter(Boolean);
  const apeInbox = cfg.contact.apeEmail || core.DEFAULT_NOTIFY_TO;
  const clinicPhone = cfg.contact.phone;

  const rows = [
    ['Reference', ref],
    ['Requested time', when],
    ['Appointment', `${TM}: New Patient Appointment (70 minutes)`],
    ['Fee', fee],
    ['Deposit', link ? `${core.money(deposit)}: payment link sent to the patient (check payment before confirming)` : `${core.money(deposit)}: no payment link set up yet, send deposit details with the confirmation`],
    ['Location', clinicLine],
    ['Name', name],
    ['Email', email],
    ['Phone', phone || 'Not provided'],
    ['Note from patient', notes || 'None'],
    ['Deposit and cancellation policy', 'Read and accepted'],
    ['Collection notice', 'Agreed'],
    ['Submitted', submitted],
  ];
  const nextStep = 'Next step: block this time in Core Practice, reply to the patient to confirm and send the new patient information pack, then mark it confirmed in the APE dashboard (/admin/).';
  const notify = {
    from: process.env.BOOKING_FROM,
    to: notifyTo,
    reply_to: email,
    subject: `APE booking request: ${core.fmtDateTime(slot.start, tz, false)}, ${name} (${ref})${special ? ' [opening special]' : ''}`,
    text: `New booking request for ${TM}. This time is held on the website but not yet confirmed.\n\n` + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n${nextStep}\nReplying to this email replies to the patient.`,
    html: `<p style="font:16px/1.5 Arial,sans-serif;color:#284858">New booking request for ${core.escHtml(TM)}. <strong>This time is held on the website but not yet confirmed.</strong></p>` +
      table(rows) + `<p style="font:15px/1.5 Arial,sans-serif;color:#284858">${core.escHtml(nextStep)}<br>Replying to this email replies to the patient.</p>`,
  };
  if (bcc.length) notify.bcc = bcc;
  let notified = true;
  try {
    await core.sendEmail(notify);
  } catch (err) {
    // The booking is saved and shows in the dashboard, so the patient is not asked to try again.
    notified = false;
    console.error('booking: notification email failed (booking saved, see dashboard)', ref, err.message);
  }

  // Acknowledgement to the patient (NEW COPY: needs the client's sign-off, see CHANGELOG)
  const first = name.split(' ')[0];
  const ackLines = [
    `Hi ${first},`,
    `Thank you for your booking request for ${TM} New Patient Appointment.`,
    `Requested time: ${when}\nLocation: ${clinicLine}\nFee: ${fee}\nReference: ${ref}`,
    link
      ? `To secure your time, please pay your ${core.money(deposit)} deposit here: ${link}`
      : `A ${core.money(deposit)} deposit secures your appointment. Deposit details will be sent with your confirmation.`,
    'The APE team will be in touch to confirm your appointment and send your new patient information pack.',
    `If anything changes or you have a question, simply reply to this email or call us on ${clinicPhone}.`,
    `Warm regards,\n${TM} team`,
  ];
  let ackSent = true;
  try {
    await core.sendEmail({
      from: process.env.BOOKING_FROM,
      to: [email],
      reply_to: apeInbox,
      subject: `We have received your booking request | ${TM}`,
      text: ackLines.join('\n\n'),
      html: ackLines.map(para).join(''),
    });
  } catch (err) {
    ackSent = false;
    console.error('booking: acknowledgement email failed (the booking is saved)', ref, err.message);
  }
  return core.send(res, 200, { ok: true, ref, price, special, regular: cfg.pricing.appointment, deposit, depositUrl: link, notified, ackSent });
};

module.exports.checkSlot = checkSlot; // for the test script
