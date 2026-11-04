/**
 * The Bookings, Availability and Opening special screens of the dashboard. Signed-in users only (the same
 * Payload sign-in as the rest of /admin).
 *
 *   GET                                               bookings, blocked days and times, the schedule, the special
 *   POST {action:'booking', ref, status?, depositPaid?}  status: requested | confirmed | cancelled
 *   POST {action:'block', from, to?, time?, note?}       block a day, a range of days or one time
 *   POST {action:'unblock', day, time?}
 *   POST {action:'schedule', days, startTimes}           the weekly booking times (null puts back the standard ones)
 */
import { routeUser } from '@/dashboard/lib/routeAuth'
import * as core from '@/booking/core'

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
    name: r.name, email: r.email, phone: r.phone, notes: r.notes,
    price: Number(r.price), special: !!r.special, status: r.status as string, depositPaid: !!r.deposit_paid,
    createdAt: new Date(r.created_at).toISOString(),
  }
}

async function data(now: number) {
  const { cfg, state } = await core.readState()
  const tz = cfg.booking.timeZone
  const o = cfg.openingSpecial
  const d = core.db()
  const base = core.loadConfig()
  let bookings: ReturnType<typeof bookingRow>[] = []
  if (d) {
    const rows = await d.query(`SELECT * FROM ape_bookings WHERE slot_start >= now() - interval '60 days' ORDER BY slot_start, created_at`)
    bookings = rows.map((r) => bookingRow(r, tz))
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
    email: !!(process.env.RESEND_API_KEY && process.env.BOOKING_FROM),
    deposit: { mode: process.env.DEPOSIT_PAYMENT_URL ? 'link' : 'later', amount: cfg.pricing.deposit },
    pricing: cfg.pricing,
    booking: {
      startDate: cfg.booking.startDate, minNoticeHours: cfg.booking.minNoticeHours, weeksAhead: cfg.booking.weeksAhead,
      days: cfg.booking.days, startTimes: cfg.booking.startTimes,
      dayNames: cfg.booking.days.map((n) => WEEKDAYS[n]),
      standard: { days: base.booking.days, startTimes: base.booking.startTimes },
      custom: !!state.schedule,
    },
    bookings,
    blocks: state.blocks.filter((b) => b.day >= today),
    special: { enabled: !!o.enabled, price: o.price, regular: cfg.pricing.appointment, from: o.from, to: o.to, max: o.maxBookings, used: state.specialUsed, showing: pub.special.active },
    schedule,
  }
}

export async function GET(req: Request) {
  const { user } = await routeUser(req)
  if (!user) return core.send(401, { ok: false, error: 'signed_out' })
  try {
    return core.send(200, await data(Date.now()))
  } catch (err) {
    console.error('bookings: error', (err as Error).message)
    return core.send(500, { ok: false, error: 'server_error' })
  }
}

export async function POST(req: Request) {
  const { user } = await routeUser(req)
  if (!user) return core.send(401, { ok: false, error: 'signed_out' })
  let body: Record<string, unknown>
  try { body = await core.readBody(req) } catch { return core.send(400, { ok: false, error: 'invalid' }) }
  const d = core.db()
  if (!d) return core.send(503, { ok: false, error: 'no_database' })
  const action = String(body.action || '')
  try {
    const base = core.loadConfig()
    await core.ensureSchema(d, base)
    const cfg = core.loadConfig(await core.readSchedule(d))

    if (action === 'booking') {
      const ref = core.clean(body.ref, 20)
      const sets: string[] = []
      const params: unknown[] = [ref]
      if (body.status !== undefined) {
        if (!['requested', 'confirmed', 'cancelled'].includes(String(body.status))) return core.send(400, { ok: false, error: 'invalid' })
        params.push(body.status); sets.push(`status = $${params.length}`)
      }
      if (body.depositPaid !== undefined) { params.push(!!body.depositPaid); sets.push(`deposit_paid = $${params.length}`) }
      if (!sets.length) return core.send(400, { ok: false, error: 'invalid' })
      try {
        const r = await d.query(`UPDATE ape_bookings SET ${sets.join(', ')}, updated_at = now() WHERE ref = $1 RETURNING ref`, params)
        if (!r.length) return core.send(404, { ok: false, error: 'not_found' })
      } catch (err) {
        if (/unique|duplicate/i.test((err as Error).message)) return core.send(409, { ok: false, error: 'taken' })
        throw err
      }
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

    return core.send(400, { ok: false, error: 'unknown_action' })
  } catch (err) {
    console.error('bookings: error', action, (err as Error).message)
    return core.send(500, { ok: false, error: 'server_error' })
  }
}
