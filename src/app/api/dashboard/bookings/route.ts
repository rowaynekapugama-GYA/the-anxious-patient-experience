/**
 * The Bookings, Availability and Opening special screens of the dashboard. Signed-in users only (the same
 * Payload sign-in as the rest of /admin).
 *
 *   GET                                               bookings, blocked days and times, the schedule, the special
 *   POST {action:'booking', ref, status?, depositPaid?, note?}  status: requested | confirmed | cancelled; depositPaid marks
 *                                                        the deposit received (or not) by hand, with an optional note
 *   POST {action:'block', from, to?, time?, note?}       block a day, a range of days or one time
 *   POST {action:'unblock', day, time?}
 *   POST {action:'schedule', days, startTimes}           the weekly booking times (null puts back the standard ones)
 *   POST {action:'special', enabled?, popup?, from?, to?, showAfter?, heading?, body?}   the opening special's switches,
 *                                                        dates and pop-up wording (null puts back the standard ones)
 *   POST {action:'note-add', ref, body? | quick?}        v1.16.0: a note on the booking (typed, or quick note 0 to 3)
 *   POST {action:'note-edit', id, body}                  the author only
 *   POST {action:'note-delete', id}                      the author, or an administrator
 *   POST {action:'onboarding', ref, done}                tick or undo the Onboarding call (adds a line to the notes)
 */
import { routeUser } from '@/dashboard/lib/routeAuth'
import * as core from '@/booking/core'
import { packSwitches, onBookingConfirmed, statusByRef } from '@/lib/questionnaire'
import type { Payload } from 'payload'
import * as deposit from '@/booking/deposit'
import { paypalConfigured, paypalEnv } from '@/lib/paypal'
import * as emails from '@/booking/emails'
import { ageOn, sydneyToday } from '@/booking/patient'
import { termsView } from '@/booking/terms'
import { sourceLabel } from '@/booking/source'
import * as notes from '@/booking/notes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCHEDULE_WEEKS = 20
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function bookingRow(r: Record<string, any>, tz: string) {
  const start = new Date(r.slot_start)
  const p = core.tzParts(start, tz)
  return {
    ref: r.ref, start: start.toISOString(), day: p.day, time: p.hm,
    when: core.fmtDateTime(start, tz, true),
    name: emails.nameOf(r as emails.BookingRow), email: r.email, phone: r.phone, notes: r.notes,
    // v1.10.0: first and last name and date of birth with today's age (null on bookings made before v1.10.0: "not given")
    firstName: String(r.first_name || ''), lastName: String(r.last_name || ''),
    dob: emails.dobIso(r.dob), age: emails.dobIso(r.dob) ? ageOn(emails.dobIso(r.dob)!, sydneyToday()) : null,
    ageAtAppointment: emails.dobIso(r.dob) ? ageOn(emails.dobIso(r.dob)!, new Date(`${p.day}T00:00:00Z`)) : null,
    terms: termsView(r),
    // v1.13.0: a parent or guardian's name (patients under 18 at the appointment)
    guardianName: String(r.guardian_name || ''),
    // v1.11.0: where the visit came from
    source: { label: sourceLabel(r.source), source: String(r.source || ''), medium: String(r.source_medium || ''), campaign: String(r.source_campaign || '') },
    price: Number(r.price), special: !!r.special, status: r.status as string, depositPaid: !!r.deposit_paid,
    // v1.12.0: pay to book. Held while the patient pays (until this time), or released because it was not paid in time
    heldUntil: r.status === 'requested' && r.hold_until && r.deposit_status === 'unpaid' ? new Date(r.hold_until).toISOString() : null,
    cancelReason: String(r.cancel_reason || ''),
    deposit: deposit.depositView(r as Partial<deposit.BookingRow>),
    createdAt: new Date(r.created_at).toISOString(),
    // v1.8.3: '' (before v1.8.3) | sent | retry | failed
    emails: { patient: String(r.email_patient || ''), team: String(r.email_team || '') },
    // v1.9.0: the welcome pack email ('' not sent | sent | failed)
    welcome: { status: String(r.welcome_status || ''), sentAt: r.welcome_sent_at ? new Date(r.welcome_sent_at).toISOString() : null, count: Number(r.welcome_count || 0), by: String(r.welcome_by || '') },
    // v1.16.0: the Onboarding call tick, and the team's notes (filled in by data())
    onboarding: { doneAt: r.onboarding_done_at ? new Date(r.onboarding_done_at).toISOString() : null, by: String(r.onboarding_by || '') },
    teamNotes: [] as import('@/booking/followup').NoteView[],
  }
}

async function data(now: number, payload: Payload, who: notes.Who) {
  const { cfg, state } = await core.readState()
  const tz = cfg.booking.timeZone
  const o = cfg.openingSpecial
  const d = core.db()
  const base = core.loadConfig()
  let bookings: ReturnType<typeof bookingRow>[] = []
  if (d) {
    // a booking email that failed a minute or more ago is tried once more before the list is shown (v1.8.3)
    await emails.retryDue(d, cfg).catch((err) => console.error('bookings: email retry failed', (err as Error).message))
    const rows = await d.query(`SELECT * FROM ape_bookings WHERE slot_start >= now() - interval '60 days' ORDER BY slot_start, created_at`)
    bookings = rows.map((r) => bookingRow(r, tz))
    const byRef = await notes.notesFor(d, bookings.map((b) => b.ref), who)
    for (const b of bookings) b.teamNotes = byRef[b.ref] || []
  }
  const today = core.tzParts(new Date(now), tz).day
  const pub = core.availability(cfg, state, now)
  const live = bookings.filter((b) => b.status !== 'cancelled')
  const earliest = now + cfg.booking.minNoticeHours * 3600000
  const schedule = core.scheduleDays(cfg, now, SCHEDULE_WEEKS).map((day) => {
    const whole = state.blocks.find((b) => b.day === day && !b.time)
    const first = core.slotStart(cfg, day, cfg.booking.startTimes[0])
    return {
      day,
      label: core.fmtDay(first, tz, true),
      special: core.inSpecialWindow(cfg, day),
      blocked: whole ? { note: whole.note } : null,
      slots: cfg.booking.startTimes.map((time) => {
        const start = core.slotStart(cfg, day, time)
        const booking = live.find((b) => b.start === start.toISOString())
        const block = state.blocks.find((b) => b.day === day && b.time === time)
        let status = 'open'
        if (booking) status = 'booked'
        else if (whole || block) status = 'blocked'
        else if (start.getTime() < earliest) status = 'closed'
        return {
          time, label: core.fmtTime(start, tz), start: start.toISOString(), status,
          note: block ? block.note : '',
          booking: booking ? { ref: booking.ref, name: booking.name, status: booking.status } : null,
        }
      }),
    }
  })
  return {
    ok: true,
    database: state.db,
    email: core.emailConfigured(),
    deposit: { mode: paypalConfigured() ? 'paypal' : 'later', amount: cfg.pricing.deposit, env: paypalConfigured() ? paypalEnv() : null },
    pricing: cfg.pricing,
    booking: {
      startDate: cfg.booking.startDate, minNoticeHours: cfg.booking.minNoticeHours, weeksAhead: cfg.booking.weeksAhead,
      days: cfg.booking.days, startTimes: cfg.booking.startTimes,
      dayNames: cfg.booking.days.map((n) => WEEKDAYS[n]),
      standard: { days: base.booking.days, startTimes: base.booking.startTimes },
      custom: !!state.schedule,
    },
    bookings,
    questionnaire: await (async () => { const sw = await packSwitches(payload); return { welcome: sw.welcome, online: sw.online, byRef: sw.online ? await statusByRef(payload) : {} } })(),
    blocks: state.blocks.filter((b) => b.day >= today),
    special: {
      enabled: !!o.enabled, price: o.price, regular: cfg.pricing.appointment, from: o.from, to: o.to, max: o.maxBookings, used: state.specialUsed, showing: pub.special.active,
      popup: !!o.popup, showAfter: pub.special.showAfter, heading: pub.special.heading, body: pub.special.body,
      standard: { enabled: !!base.openingSpecial.enabled, popup: !!base.openingSpecial.popup, from: base.openingSpecial.from, to: base.openingSpecial.to, ...core.POPUP_DEFAULTS },
      custom: d ? !!(await core.readSpecial(d).catch(() => null)) : false,
    },
    schedule,
  }
}

export async function GET(req: Request) {
  const { user, payload } = await routeUser(req)
  if (!user) return core.send(401, { ok: false, error: 'signed_out' })
  try {
    return core.send(200, await data(Date.now(), payload, notes.whoOf(user)))
  } catch (err) {
    console.error('bookings: error', (err as Error).message)
    return core.send(500, { ok: false, error: 'server_error' })
  }
}

export async function POST(req: Request) {
  const { user, payload } = await routeUser(req)
  if (!user) return core.send(401, { ok: false, error: 'signed_out' })
  let body: Record<string, unknown>
  try { body = await core.readBody(req) } catch { return core.send(400, { ok: false, error: 'invalid' }) }
  const d = core.db()
  if (!d) return core.send(503, { ok: false, error: 'no_database' })
  const action = String(body.action || '')
  try {
    const base = core.loadConfig()
    await core.ensureSchema(d, base)
    const cfg = core.loadConfig(await core.readOverrides(d))

    // v1.8.3: Resend to patient / Resend to team, from the amber "Email not sent" flag
    if (action === 'resend-email') {
      const ref = core.clean(body.ref, 20)
      const to = String(body.to) === 'team' ? 'team' : 'patient'
      const r = await emails.sendBookingEmails(d, cfg, ref, [to], 'final')
      const res = r[to]
      if (!res) return core.send(404, { ok: false, error: 'not_found' })
      if (!res.ok) return core.send(502, { ok: false, error: 'email_failed', detail: res.error })
      return core.send(200, { ok: true, id: res.id })
    }

    if (action === 'booking') {
      const ref = core.clean(body.ref, 20)
      const sets: string[] = []
      const params: unknown[] = [ref]
      if (body.status !== undefined) {
        if (!['requested', 'confirmed', 'cancelled'].includes(String(body.status))) return core.send(400, { ok: false, error: 'invalid' })
        params.push(body.status); sets.push(`status = $${params.length}`)
        // v1.12.0: a booking the team confirms, restores or cancels is no longer an unpaid hold
        sets.push('hold_until = NULL', `cancel_reason = ''`)
      }
      // the deposit by hand (v1.8.0): a note and who did it, never over a PayPal payment
      if (body.depositPaid !== undefined) {
        const ok = await deposit.setManual(d, ref, !!body.depositPaid, core.oneLine(core.clean(body.note, 200)), String(user.email))
        if (!ok) return core.send(409, { ok: false, error: body.depositPaid ? 'already_paid' : 'paid_by_paypal' })
        if (!sets.length) return core.send(200, { ok: true })
      }
      if (!sets.length) return core.send(400, { ok: false, error: 'invalid' })
      let row: Record<string, any> | undefined
      try {
        const r = await d.query(`UPDATE ape_bookings SET ${sets.join(', ')}, updated_at = now() WHERE ref = $1 RETURNING ref, name, email, slot_start, status, dob`, params)
        if (!r.length) return core.send(404, { ok: false, error: 'not_found' })
        row = r[0]
      } catch (err) {
        if (/unique|duplicate/i.test((err as Error).message)) return core.send(409, { ok: false, error: 'taken' })
        throw err
      }
      // v1.9.0: Mark confirmed sends the welcome pack once, when the welcome email is switched on (and not sent at request time)
      let welcome: { sent: boolean; reason?: string } | undefined
      if (body.status === 'confirmed' && row) {
        welcome = await onBookingConfirmed(payload, { ref: row.ref, name: row.name, email: row.email, slot_start: row.slot_start, dob: row.dob })
      }
      return core.send(200, { ok: true, welcome })
    }

    // v1.16.0: notes and the Onboarding call. Nothing here sends an email or changes the booking itself.
    if (action === 'note-add' || action === 'note-edit' || action === 'note-delete' || action === 'onboarding') {
      const who = notes.whoOf(user)
      const r = action === 'note-add' ? await notes.addNote(d, core.clean(body.ref, 20), { body: body.body, quick: body.quick }, who)
        : action === 'note-edit' ? await notes.editNote(d, core.clean(body.id, 20), { body: body.body }, who)
          : action === 'note-delete' ? await notes.deleteNote(d, core.clean(body.id, 20), who)
            : await notes.setOnboarding(d, core.clean(body.ref, 20), body.done === true, who)
      if (!r.ok) return core.send(r.status, { ok: false, error: r.error })
      return core.send(200, { ok: true })
    }

    if (action === 'block') {
      const from = core.clean(body.from, 10)
      const to = core.clean(body.to, 10) || from
      const time = core.clean(body.time, 5) || null
      const note = core.oneLine(core.clean(body.note, 200))
      if (!core.isDay(from) || !core.isDay(to) || to < from) return core.send(400, { ok: false, error: 'invalid_dates' })
      if (time && (!cfg.booking.startTimes.includes(time) || from !== to)) return core.send(400, { ok: false, error: 'invalid_time' })
      const days: string[] = []
      for (let day = from, n = 0; day <= to && n < 800; day = core.addDays(day, 1), n++) {
        if (cfg.booking.days.includes(core.weekdayOf(day))) days.push(day)
      }
      if (!days.length) return core.send(400, { ok: false, error: 'no_ape_days' })
      for (const day of days) {
        await d.query(`INSERT INTO ape_blocks (day, time, note) VALUES ($1::date, $2, $3) ON CONFLICT DO NOTHING`, [day, time, note])
      }
      // Tell the team about any requests already on those days (blocking does not cancel them)
      const tz = cfg.booking.timeZone
      const clash = await d.query(
        `SELECT ref, name, slot_start FROM ape_bookings WHERE status <> 'cancelled' AND (slot_start AT TIME ZONE $1)::date = ANY($2::date[]) ORDER BY slot_start`,
        [tz, days])
      const clashes = clash
        .map((r) => ({ ref: r.ref, name: r.name, when: core.fmtDateTime(new Date(r.slot_start), tz, false), time: core.tzParts(new Date(r.slot_start), tz).hm }))
        .filter((c) => !time || c.time === time)
      return core.send(200, { ok: true, days, clashes })
    }

    if (action === 'unblock') {
      const day = core.clean(body.day, 10)
      const time = core.clean(body.time, 5) || ''
      if (!core.isDay(day)) return core.send(400, { ok: false, error: 'invalid_dates' })
      await d.query(`DELETE FROM ape_blocks WHERE day = $1::date AND coalesce(time, '') = $2`, [day, time])
      return core.send(200, { ok: true })
    }

    if (action === 'schedule') {
      if (body.days === null) {
        await d.query(`DELETE FROM ape_meta WHERE key = 'schedule'`)
        return core.send(200, { ok: true })
      }
      const days = Array.isArray(body.days) ? [...new Set(body.days.map(Number))].filter((n) => Number.isInteger(n) && n >= 0 && n <= 6).sort() : []
      const times = Array.isArray(body.startTimes) ? [...new Set(body.startTimes.map((t) => core.clean(t, 5)))].filter(core.isTime).sort() : []
      if (!days.length) return core.send(400, { ok: false, error: 'no_days' })
      if (!times.length || times.length > 12) return core.send(400, { ok: false, error: 'no_times' })
      await d.query(`INSERT INTO ape_meta (key, value) VALUES ('schedule', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify({ days, startTimes: times })])
      return core.send(200, { ok: true })
    }

    if (action === 'special') {
      if (body.enabled === null) {
        await d.query(`DELETE FROM ape_meta WHERE key = 'special'`)
        return core.send(200, { ok: true })
      }
      const from = core.clean(body.from, 10)
      const to = core.clean(body.to, 10)
      if ((from && !core.isDay(from)) || (to && !core.isDay(to)) || (from && to && to < from)) return core.send(400, { ok: false, error: 'invalid_dates' })
      const showAfter = body.showAfter === '' || body.showAfter === undefined ? undefined : Number(body.showAfter)
      if (showAfter !== undefined && !(Number.isFinite(showAfter) && showAfter >= 0 && showAfter <= 60)) return core.send(400, { ok: false, error: 'invalid_delay' })
      const v: core.SpecialSettings = {
        enabled: body.enabled === undefined ? undefined : !!body.enabled,
        popup: body.popup === undefined ? undefined : !!body.popup,
        from: from || undefined, to: to || undefined, showAfter,
        heading: core.oneLine(core.clean(body.heading, 120)) || undefined,
        body: core.clean(body.body, 600) || undefined,
      }
      await d.query(`INSERT INTO ape_meta (key, value) VALUES ('special', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(v)])
      return core.send(200, { ok: true })
    }

    return core.send(400, { ok: false, error: 'unknown_action' })
  } catch (err) {
    // v1.16.0: for notes only the database's error code is logged, never anything that could carry a note's text
    if (action.startsWith('note-') || action === 'onboarding') console.error('bookings: error', action, String((err as { code?: string }).code || 'unknown'))
    else console.error('bookings: error', action, (err as Error).message)
    return core.send(500, { ok: false, error: 'server_error' })
  }
}
