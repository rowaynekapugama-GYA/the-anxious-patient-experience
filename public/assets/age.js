/* The APE age rule (v1.13.0, Lorna's email of 19 Nov 2026): for patients aged 15 and over; patients under 18 need a
   parent or guardian's name to book. Age is worked out from the date of birth on the APPOINTMENT date (Sydney time),
   not today, because a birthday can fall between booking and the appointment.

   Used by Book Now (window.APEAge, loaded by site.js). The server has the same rule in src/booking/age.ts and
   scripts/test-booking.ts checks that the two agree on every test case. */
(function (root) {
  'use strict';
  var DEFAULT = { minAge: 15, guardianRequiredUnder: 18 };

  /** The appointment's date in Sydney, as YYYY-MM-DD. */
  function appointmentDay(slotStart, timeZone) {
    var d = slotStart instanceof Date ? slotStart : new Date(slotStart);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  /** Age in whole years on a day (YYYY-MM-DD). A 29 February birthday counts from 1 March in other years. */
  function ageOn(dobIso, dayIso) {
    var b = String(dobIso).split('-').map(Number), t = String(dayIso).split('-').map(Number);
    if (b.length !== 3 || t.length !== 3 || b.some(isNaN) || t.some(isNaN)) return NaN;
    var age = t[0] - b[0];
    var bday = Date.UTC(t[0], b[1] - 1, b[2]);
    if (Date.UTC(t[0], t[1] - 1, t[2]) < bday) age--;
    return age;
  }

  /** { age, status }: 'under_min' (cannot book), 'guardian' (needs a parent or guardian's name) or 'ok'. */
  function rule(dobIso, slotStart, opts) {
    var r = { minAge: DEFAULT.minAge, guardianRequiredUnder: DEFAULT.guardianRequiredUnder };
    if (opts) { if (opts.minAge) r.minAge = Number(opts.minAge); if (opts.guardianRequiredUnder) r.guardianRequiredUnder = Number(opts.guardianRequiredUnder); }
    var day = appointmentDay(slotStart, opts && opts.timeZone);
    var age = day && dobIso ? ageOn(dobIso, day) : NaN;
    if (isNaN(age)) return { age: null, status: 'unknown' };
    return { age: age, status: age < r.minAge ? 'under_min' : age < r.guardianRequiredUnder ? 'guardian' : 'ok' };
  }

  /** The parent or guardian's name as saved: spaces tidied, at most 120 characters. Valid from 2 characters. */
  function cleanGuardian(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 120); }
  function guardianOk(v) { return cleanGuardian(v).length >= 2; }

  var api = { DEFAULT: DEFAULT, appointmentDay: appointmentDay, ageOn: ageOn, rule: rule, cleanGuardian: cleanGuardian, guardianOk: guardianOk };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.APEAge = api;
})(typeof self !== 'undefined' ? self : this);
