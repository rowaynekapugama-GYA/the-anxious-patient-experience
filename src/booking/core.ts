/**
 * Online booking for The Anxious Patient Experience™: shared code for the public booking routes
 * (/api/availability/, /api/booking/) and the Bookings, Availability and Opening special screens of the dashboard.
 *
 * - Rules, prices and the opening special: content/booking.json (GYA). The weekly booking times can be changed
 *   in the dashboard (Availability), which stores them in ape_meta.
 * - Contact details: Site Settings (content/site-settings.json, written by the build from the dashboard).
 * - Bookings, blocked days and times live in Postgres (DATABASE_URL, Neon on Vercel), in tables of their own next to
 *   the dashboard's. They are created on first use.
 * - Email goes through SMTP2GO or Resend (src/lib/email.ts): SMTP2GO_API_KEY or RESEND_API_KEY, and BOOKING_FROM.
 */
import { Pool, type PoolClient } from 'pg'
import bookingJson from '../../content/booking.json'
import savedSettings from '../../content/site-settings.json'
import { mergeSettings } from '@/lib/site'
import { paypalConfigured } from '@/lib/paypal'
import type { BookingConfig } from '@/lib/content'

export const TM = 'The Anxious Patient Experience™'
export const DEFAULT_NOTIFY_TO = 'theanxiouspatientexperience@gmail.com'

export type Cfg = {
  booking: Omit<BookingConfig, 'pricing' | 'openingSpecial'>
  pricing: BookingConfig['pricing']
  openingSpecial: BookingConfig['openingSpecial']
  contact: { phone: string; apeEmail: string; receptionEmail: string }
  clinic: { name: string; street: string; suburb: string }
  bookingRecipients: string[]
}

export type Schedule = { days: number[]; startTimes: string[] }
/** What the dashboard can change about the opening special (Opening special screen). Price and places stay in
 *  content/booking.json (GYA), because an offer must state its price and conditions exactly. */
export type SpecialSettings = { enabled?: boolean; popup?: boolean; from?: string; to?: string; showAfter?: number; heading?: string; body?: string }
export type Overrides = { schedule?: Schedule | null; special?: SpecialSettings | null }
export const POPUP_DEFAULTS = { showAfter: 0.8, heading: 'A gentle welcome for our first six patients', body: 'To welcome our first patients, the full 70-minute Anxious New Patient Experience is {price} instead of {regular} for appointments on {dates}. Health fund rebates are still available, and a $100 deposit secures your time.' }

/** The settings, with what the dashboard has saved on top (the weekly times, the opening special's switches, dates and
 *  pop-up wording). Null or nothing: the ones in content/booking.json. */
export function loadConfig(overrides?: Schedule | Overrides | null): Cfg {
  const b = bookingJson as BookingConfig
  const s = mergeSettings(savedSettings as Record<string, unknown>)
  const { pricing, openingSpecial, ...booking } = b
  const o: Overrides = overrides && 'days' in overrides ? { schedule: overrides as Schedule } : (overrides as Overrides | null) || {}
  const schedule = o.schedule
  const sp = o.special || {}
  const special = { ...openingSpecial, ...POPUP_DEFAULTS, ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v !== undefined && v !== null && v !== '')) }
  if (!isDay(special.from)) special.from = openingSpecial.from
  if (!isDay(special.to)) special.to = openingSpecial.to
  return {
    booking: { ...booking, ...(schedule ? { days: schedule.days, startTimes: schedule.startTimes } : {}) },
    pricing,
    openingSpecial: special,
    contact: { phone: s.phone, apeEmail: s.apeEmail, receptionEmail: s.receptionEmail },
    clinic: { name: s.clinic.name, street: s.clinic.street, suburb: `${s.clinic.suburb} ${s.clinic.state} ${s.clinic.postcode}` },
    bookingRecipients: Array.isArray(s.bookingRecipients) ? s.bookingRecipients : [],
  }
}

// ---------------------------------------------------------------- Sydney time
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(instant)
  const get = (k: string) => Number(parts.find((p) => p.type === k)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - instant.getTime()) / 60000)
}
/** wall-clock time in a time zone -> Date (daylight saving aware) */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, m, d, hh, mm)
  const first = tzOffsetMinutes(new Date(guess), tz)
  const second = tzOffsetMinutes(new Date(guess - first * 60000), tz)
  return new Date(guess - second * 60000)
}
export function tzParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(date)
  const get = (k: string) => parts.find((p) => p.type === k)?.value
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hm: `${get('hour')}:${get('minute')}`,
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(get('weekday'))),
  }
}
export const tidy = (s: string) => String(s).replace(/[  ]/g, ' ')
export function fmtDay(date: Date, tz: string, withYear: boolean): string {
  return tidy(new Intl.DateTimeFormat('en-AU', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined }).format(date))
}
export function fmtTime(date: Date, tz: string): string {
  return tidy(new Intl.DateTimeFormat('en-AU', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(date))
}
export const fmtDateTime = (date: Date, tz: string, withYear: boolean) => `${fmtDay(date, tz, withYear)}, ${fmtTime(date, tz)}`
export const isDay = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
export const isTime = (s: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''))
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// ---------------------------------------------------------------- the schedule
/** Every APE day from max(today, startDate), for weeksAhead weeks (or `weeks` if given). */
export function scheduleDays(cfg: Cfg, now: number, weeks?: number): string[] {
  const b = cfg.booking
  const today = tzParts(new Date(now), b.timeZone).day
  const first = isDay(b.startDate) && b.startDate > today ? b.startDate : today
  const span = (weeks || b.weeksAhead) * 7
  const out: string[] = []
  for (let i = 0; i <= span; i++) {
    const day = addDays(first, i)
    if (b.days.includes(weekdayOf(day))) out.push(day)
  }
  return out
}
export function slotStart(cfg: Cfg, day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return zonedToUtc(y, m - 1, d, hh, mm, cfg.booking.timeZone)
}
export function inSpecialWindow(cfg: Cfg, day: string): boolean {
  const o = cfg.openingSpecial
  return !!(o.enabled && isDay(o.from) && isDay(o.to) && day >= o.from && day <= o.to)
}
/** The same rules as the Book Now page. */
export function checkSlot(cfg: Cfg, iso: string, now: number): { error: string; day?: string; time?: string; start?: Date } {
  const start = new Date(iso)
  if (!iso || isNaN(start.getTime())) return { error: 'invalid_time' }
  const b = cfg.booking
  const p = tzParts(start, b.timeZone)
  if (!b.days.includes(p.weekday) || !b.startTimes.includes(p.hm)) return { error: 'invalid_time' }
  if (!scheduleDays(cfg, now).includes(p.day)) return { error: 'invalid_time' }
  if (start.getTime() < now + b.minNoticeHours * 3600000) return { error: 'too_soon' }
  return { error: '', day: p.day, time: p.hm, start }
}

export type Block = { day: string; time: string | null; note: string }
export type State = { db: boolean; blocks: Block[]; taken: Set<string>; specialUsed: number; schedule: Schedule | null }
const blockedBy = (blocks: Block[], day: string, time: string) => blocks.find((x) => x.day === day && (!x.time || x.time === time))

/** Times patients can book now, each with its price. */
export function availability(cfg: Cfg, state: State, now: number) {
  const b = cfg.booking
  const o = cfg.openingSpecial
  const earliest = now + b.minNoticeHours * 3600000
  const specialOpen = !!(o.enabled && state.specialUsed < o.maxBookings)
  const slots: { start: string; day: string; time: string; special: boolean; price: number }[] = []
  for (const day of scheduleDays(cfg, now)) {
    for (const time of b.startTimes) {
      const start = slotStart(cfg, day, time)
      if (start.getTime() < earliest) continue
      if (blockedBy(state.blocks, day, time)) continue
      if (state.taken.has(start.toISOString())) continue
      const special = specialOpen && inSpecialWindow(cfg, day)
      slots.push({ start: start.toISOString(), day, time, special, price: special ? o.price : cfg.pricing.appointment })
    }
  }
  return {
    slots,
    special: {
      active: slots.some((s) => s.special),
      popup: !!o.popup,
      showAfter: Number.isFinite(Number(o.showAfter)) ? Math.max(0, Number(o.showAfter)) : POPUP_DEFAULTS.showAfter,
      heading: o.heading || POPUP_DEFAULTS.heading,
      body: o.body || POPUP_DEFAULTS.body,
      price: o.price,
      regular: cfg.pricing.appointment,
      from: o.from,
      to: o.to,
      days: [...new Set(slots.filter((s) => s.special).map((s) => s.day))],
    },
    pricing: { appointment: cfg.pricing.appointment, deposit: cfg.pricing.deposit },
    deposit: { mode: paypalConfigured() ? 'paypal' : 'later', amount: cfg.pricing.deposit },
  }
}

// ---------------------------------------------------------------- database
/** query(text, params) -> rows; tx(list) -> rows of each statement, in one transaction. */
export type Db = {
  query: <T = Record<string, any>>(text: string, params?: unknown[]) => Promise<T[]>
  tx: (list: [string, unknown[]][]) => Promise<Record<string, any>[][]>
}

let adapter: Db | null = null
let schemaReady: Promise<void> | null = null
/** Tests swap in their own database. */
export function setAdapter(a: Db | null) { adapter = a; schemaReady = null }

export function db(): Db | null {
  if (adapter) return adapter
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) return null
  const g = globalThis as unknown as { __apePool?: Pool }
  const pool = g.__apePool ?? (g.__apePool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000 }))
  adapter = {
    query: async (text, params) => (await pool.query(text, params ?? [])).rows,
    tx: async (list) => {
      const client: PoolClient = await pool.connect()
      try {
        await client.query('BEGIN')
        const out: Record<string, any>[][] = []
        for (const [text, params] of list) out.push((await client.query(text, params)).rows)
        await client.query('COMMIT')
        return out
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
  }
  return adapter
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
  // v1.8.0: the deposit paid through PayPal inside Book Now
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'unpaid'`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2)`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS deposit_note text NOT NULL DEFAULT ''`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS paypal_order_id text`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS paypal_capture_id text`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS pay_token_hash text`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS pay_token_expires timestamptz`,
  `UPDATE ape_bookings SET deposit_status = 'manual' WHERE deposit_paid AND deposit_status = 'unpaid'`,
  `CREATE INDEX IF NOT EXISTS ape_bookings_pay_token ON ape_bookings (pay_token_hash)`,
  // v1.8.3: which booking emails went out ('' before v1.8.3 | sent | retry | failed), and every send attempt
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS email_patient text NOT NULL DEFAULT ''`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS email_team text NOT NULL DEFAULT ''`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS email_retry_at timestamptz`,
  // v1.9.0: the welcome pack email ('' not sent | sent | failed), when, how many times and by whom (or automatic)
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS welcome_status text NOT NULL DEFAULT ''`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS welcome_count integer NOT NULL DEFAULT 0`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS welcome_by text NOT NULL DEFAULT ''`,
  // v1.10.0: first and last name, date of birth (null on bookings made before v1.10.0: "not given"), and the terms
  // the patient agreed to: when each tick was made and which version of the terms was showing
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT ''`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT ''`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS dob date`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS terms_version text NOT NULL DEFAULT ''`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS terms_consent_at timestamptz`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS terms_read_at timestamptz`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS terms_pay_read_at timestamptz`,
  `ALTER TABLE ape_bookings ADD COLUMN IF NOT EXISTS deposit_method text NOT NULL DEFAULT ''`,
  // v1.10.0: who gave or took away questionnaire access or practice owner, for whom and when (also made by the
  // v1.10.0 migration)
  `CREATE TABLE IF NOT EXISTS ape_access_log (
     id bigserial PRIMARY KEY,
     at timestamptz NOT NULL DEFAULT now(),
     by_email text NOT NULL,
     for_email text NOT NULL,
     change text NOT NULL,
     note text NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS ape_email_log (
     id bigserial PRIMARY KEY,
     at timestamptz NOT NULL DEFAULT now(),
     kind text NOT NULL,
     recipient text NOT NULL,
     ref text,
     status text NOT NULL,
     message_id text NOT NULL DEFAULT '',
     error text NOT NULL DEFAULT '',
     test boolean NOT NULL DEFAULT false)`,
  `CREATE INDEX IF NOT EXISTS ape_email_log_at ON ape_email_log (at DESC)`,
  `CREATE TABLE IF NOT EXISTS ape_rate (key text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS ape_rate_key ON ape_rate (key, at)`,
  `CREATE TABLE IF NOT EXISTS ape_paypal_events (
     event_id text PRIMARY KEY,
     event_type text NOT NULL,
     ref text,
     received_at timestamptz NOT NULL DEFAULT now())`,
]

export function ensureSchema(d: Db, cfg: Cfg): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      // two first requests at once must not both create the tables
      await d.tx([['SELECT pg_advisory_xact_lock(4242000)', []], ...SCHEMA.map((t) => [t, []] as [string, unknown[]])])
      // Christmas (content/booking.json) is blocked once, the first time the database is used
      const seeded = await d.query(`INSERT INTO ape_meta (key, value) VALUES ('seeded_blocks', $1) ON CONFLICT DO NOTHING RETURNING key`, [new Date().toISOString()])
      if (seeded.length) {
        for (const day of (cfg.booking.initialBlockedDates || []).filter(isDay)) {
          await d.query(`INSERT INTO ape_blocks (day, time, note) VALUES ($1::date, NULL, $2) ON CONFLICT DO NOTHING`, [day, 'Christmas (set up by GYA)'])
        }
      }
    })().catch((err) => { schemaReady = null; throw err })
  }
  return schemaReady
}

/** The weekly booking times saved in the dashboard, if any. */
export async function readSchedule(d: Db): Promise<Schedule | null> {
  const r = await d.query<{ value: string }>(`SELECT value FROM ape_meta WHERE key = 'schedule'`)
  if (!r[0]) return null
  try {
    const s = JSON.parse(r[0].value) as Schedule
    if (Array.isArray(s.days) && Array.isArray(s.startTimes) && s.days.length && s.startTimes.length) return s
  } catch { /* fall through */ }
  return null
}

/** The opening special switches, dates and pop-up wording saved in the dashboard, if any. */
export async function readSpecial(d: Db): Promise<SpecialSettings | null> {
  const r = await d.query<{ value: string }>(`SELECT value FROM ape_meta WHERE key = 'special'`)
  if (!r[0]) return null
  try {
    const v = JSON.parse(r[0].value) as SpecialSettings
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}
/** Everything the dashboard can change, in one read. */
export async function readOverrides(d: Db): Promise<Overrides> {
  const [schedule, special] = await Promise.all([readSchedule(d), readSpecial(d)])
  return { schedule, special }
}

/** Settings and what is in the database, ready for availability(). */
export async function readState(): Promise<{ cfg: Cfg; state: State }> {
  const base = loadConfig()
  const d = db()
  if (!d) {
    // No database yet: the site still shows times (minus Christmas), but bookings cannot be taken until
    // DATABASE_URL is set, because the opening special and taken times could not be tracked.
    return { cfg: base, state: { db: false, blocks: (base.booking.initialBlockedDates || []).filter(isDay).map((day) => ({ day, time: null, note: '' })), taken: new Set(), specialUsed: 0, schedule: null } }
  }
  await ensureSchema(d, base)
  const [blocks, taken, used, schedule] = await Promise.all([
    d.query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, time, note FROM ape_blocks WHERE day >= current_date - 2 ORDER BY day, time NULLS FIRST`),
    d.query(`SELECT slot_start FROM ape_bookings WHERE status <> 'cancelled' AND slot_start >= now() - interval '2 days'`),
    d.query(`SELECT count(*)::int AS n FROM ape_bookings WHERE special AND status <> 'cancelled'`),
    readOverrides(d),
  ])
  return {
    cfg: loadConfig(schedule),
    state: {
      db: true,
      blocks: blocks.map((r) => ({ day: r.day, time: r.time || null, note: r.note || '' })),
      taken: new Set(taken.map((r) => new Date(r.slot_start).toISOString())),
      specialUsed: Number(used[0]?.n) || 0,
      schedule: schedule.schedule || null,
    },
  }
}

// ---------------------------------------------------------------- email (SMTP2GO or Resend, src/lib/email.ts)
export { sendEmail, emailConfigured } from '@/lib/email'
export type { Email } from '@/lib/email'

// ---------------------------------------------------------------- helpers
export function send(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers },
  })
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text()
  if (raw.length > 20000) throw new Error('too_large')
  const v = raw ? JSON.parse(raw) : {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('invalid')
  return v as Record<string, unknown>
}
// eslint-disable-next-line no-control-regex
export const clean = (v: unknown, max: number) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
export const oneLine = (v: string) => v.replace(/\s+/g, ' ')
export const escHtml = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
export const money = (n: number) => `$${Number(n).toLocaleString('en-AU')}`
