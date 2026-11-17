/**
 * The patient's details on a booking (v1.10.0): first and last name, an Australian phone number and a date of birth,
 * all required on Book Now. Pure functions only, shared by the booking route, the questionnaire, the dashboard and
 * the tests. The browser repeats the same checks in public/assets/site.js so mistakes show before sending.
 */

export const MAX_AGE_YEARS = 120

const oneLine = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export function cleanName(v: unknown): string {
  return oneLine(v, 60)
}

/** "First Last" for emails and the dashboard. */
export const fullName = (first: string, last: string) => `${first} ${last}`.replace(/\s+/g, ' ').trim()

/**
 * Australian mobile or landline in any common form: spaces, brackets, dashes, dots, +61 or 61 in front.
 * Returns the number as it is written in Australia ("0412 345 678", "(02) 8599 9815"), or null when it is not a
 * mobile or landline with its area code.
 */
export function normalisePhone(v: unknown): string | null {
  let s = String(v ?? '').trim()
  if (!s || s.length > 40) return null
  if (/[^\d\s()+\-.]/.test(s)) return null
  s = s.replace(/[\s()\-.]/g, '')
  if (s.startsWith('+')) {
    if (!s.startsWith('+61')) return null
    s = '0' + s.slice(3)
  } else if (/^61\d{9}$/.test(s)) {
    s = '0' + s.slice(2)
  }
  s = s.replace(/^0+(?=0\d{9}$)/, '')
  // +61 (0)4... written with the trunk zero kept
  if (/^00\d{9}$/.test(s)) s = s.slice(1)
  if (/^04\d{8}$/.test(s) || /^05\d{8}$/.test(s)) return `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`
  if (/^0[2378]\d{8}$/.test(s)) return `(${s.slice(0, 2)}) ${s.slice(2, 6)} ${s.slice(6)}`
  return null
}

/** A date of birth from its parts (or "YYYY-MM-DD"). Checks it is a real date, not in the future, not over 120 years ago. */
export function parseDob(input: unknown, now = new Date()): { ok: true; iso: string } | { ok: false; error: 'required' | 'invalid' | 'future' | 'too_old' } {
  let y: number, m: number, d: number
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>
    if ([o.day, o.month, o.year].every((x) => x === undefined || x === null || String(x).trim() === '')) return { ok: false, error: 'required' }
    d = Number(o.day); m = Number(o.month); y = Number(o.year)
  } else {
    const s = String(input ?? '').trim()
    if (!s) return { ok: false, error: 'required' }
    const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!mt) return { ok: false, error: 'invalid' }
    y = Number(mt[1]); m = Number(mt[2]); d = Number(mt[3])
  }
  if (![y, m, d].every(Number.isInteger) || y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return { ok: false, error: 'invalid' }
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return { ok: false, error: 'invalid' }
  const today = sydneyToday(now)
  if (dt.getTime() > today.getTime()) return { ok: false, error: 'future' }
  const oldest = new Date(Date.UTC(today.getUTCFullYear() - MAX_AGE_YEARS, today.getUTCMonth(), today.getUTCDate()))
  if (dt.getTime() < oldest.getTime()) return { ok: false, error: 'too_old' }
  return { ok: true, iso: dt.toISOString().slice(0, 10) }
}

/** Today's date in Sydney, as a UTC midnight. */
export function sydneyToday(now = new Date()): Date {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(now)
  return new Date(`${s}T00:00:00Z`)
}

/** Age in whole years on a given day (birthdays on 29 February count from 1 March in other years). */
export function ageOn(dobIso: string, on: Date): number {
  const [y, m, d] = dobIso.split('-').map(Number)
  const day = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate()))
  let age = day.getUTCFullYear() - y
  const birthdayThisYear = new Date(Date.UTC(day.getUTCFullYear(), m - 1, d))
  if (day.getTime() < birthdayThisYear.getTime()) age--
  return age
}

/** The date someone turns `years` old. */
export function birthdayAt(dobIso: string, years: number): Date {
  const [y, m, d] = dobIso.split('-').map(Number)
  return new Date(Date.UTC(y + years, m - 1, d))
}

/**
 * How long a patient's health record (the questionnaire) is kept: 7 years after the appointment, or until the patient
 * turns 25 if they were under 18 at the appointment, whichever is later.
 */
export function retainUntil(appointment: Date, dobIso: string | null | undefined): Date {
  const seven = new Date(appointment.getTime()); seven.setUTCFullYear(seven.getUTCFullYear() + 7)
  if (!dobIso) return seven
  if (ageOn(dobIso, appointment) >= 18) return seven
  const twentyFive = birthdayAt(dobIso, 25)
  return twentyFive > seven ? twentyFive : seven
}

/** "14 March 1990" */
export const fmtDob = (iso: string | null | undefined) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Plain words for each problem, the same as the browser shows. */
export const MESSAGES: Record<string, string> = {
  firstName: 'Please enter your first name.',
  lastName: 'Please enter your last name.',
  email: 'Please enter a valid email address.',
  phone: 'Please enter an Australian mobile or landline number, including the area code.',
  'dob.required': 'Please enter your date of birth.',
  'dob.invalid': 'Please check your date of birth: that date does not exist.',
  'dob.future': 'Your date of birth cannot be in the future.',
  'dob.too_old': 'Please check the year of your date of birth.',
}

export type Details = { firstName: string; lastName: string; email: string; phone: string; dob: string }

/** Check the booking details. Returns the cleaned details, or the problems keyed by field. */
export function checkDetails(body: Record<string, unknown>, now = new Date()): { ok: true; details: Details } | { ok: false; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  const firstName = cleanName(body.firstName)
  const lastName = cleanName(body.lastName)
  const email = String(body.email ?? '').trim().slice(0, 200)
  const phone = normalisePhone(body.phone)
  const dob = parseDob(body.dob, now)
  if (!firstName) fields.firstName = 'required'
  if (!lastName) fields.lastName = 'required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'invalid'
  if (!phone) fields.phone = String(body.phone ?? '').trim() ? 'invalid' : 'required'
  if (!dob.ok) fields.dob = dob.error
  if (Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, details: { firstName, lastName, email, phone: phone!, dob: (dob as { iso: string }).iso } }
}
