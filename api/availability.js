/* ==========================================================================
   GET /api/availability/  ->  the times patients can book now, each with its price, plus the opening special status.
   Used by the Book Now page (times and prices) and the homepage (opening special ribbon and pop-up).
   Blocked days and times (set in the dashboard) and times already requested are left out.
   ========================================================================== */
'use strict';

const core = require('./_lib/core');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET');
    return core.send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const cfg = core.loadConfig();
  let state;
  try {
    state = await core.readState(cfg);
  } catch (err) {
    console.error('availability: database error', err.message);
    return core.send(res, 503, { ok: false, error: 'unavailable' });
  }
  const out = core.availability(cfg, state, Date.now());
  const summary = String(req.url || '').indexOf('summary=1') !== -1;
  return core.send(res, 200, Object.assign({ ok: true, bookable: state.db }, summary ? { special: out.special } : out));
};
