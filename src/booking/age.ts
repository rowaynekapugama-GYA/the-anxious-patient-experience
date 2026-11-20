/**
 * The APE age rule (v1.13.0, Lorna's email of 19 Nov 2026): for patients aged 15 and over; patients under 18 need a
 * parent or guardian's name to book. Age is worked out from the date of birth on the APPOINTMENT date in Sydney, not
 * today, because a birthday can fall between booking and the appointment.
 *
 * Book Now uses the same rule in public/assets/age.js; scripts/test-booking.ts checks the two agree.
 * GUARDIAN_REQUIRED_UNDER is the one place to change if Lorna means "up to and including 18" (then 19).
 */
export const MIN_AGE = 15
export const GUARDIAN_REQUIRED_UNDER = 18
export const AGE_RULE = { minAge: MIN_AGE, guardianRequiredUnder: GUARDIAN_REQUIRED_UNDER }

export type AgeStatus = 'under_min' | 'guardian' | 'ok' | 'unknown'

/** The appointment's date in Sydney, as YYYY-MM-DD. */
export function appointmentDay(slotStart: Date | string, timeZone = 'Australia/Sydney'): string {
  const d = slotStart instanceof Date ? slotStart : new Date(slotStart)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Age in whole years on a day (YYYY-MM-DD). A 29 February birthday counts from 1 March in other years. */
export function ageOnDay(dobIso: string, dayIso: string): number {
  const b = dobIso.split('-').map(Number)
  const t = dayIso.split('-').map(Number)
  if (b.length !== 3 || t.length !== 3 || b.some(Number.isNaN) || t.some(Number.isNaN)) return Number.NaN
  let age = t[0] - b[0]
  if (Date.UTC(t[0], t[1] - 1, t[2]) < Date.UTC(t[0], b[1] - 1, b[2])) age--
  return age
}

/** Age at the appointment and what it means for booking. */
export function ageRule(dobIso: string | null | undefined, slotStart: Date | string, rule = AGE_RULE): { age: number | null; status: AgeStatus } {
  const day = appointmentDay(slotStart)
  const age = day && dobIso ? ageOnDay(dobIso, day) : Number.NaN
  if (Number.isNaN(age)) return { age: null, status: 'unknown' }
  return { age, status: age < rule.minAge ? 'under_min' : age < rule.guardianRequiredUnder ? 'guardian' : 'ok' }
}

/** The parent or guardian's name as saved: spaces tidied, at most 120 characters. Valid from 2 characters. */
export const cleanGuardian = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
export const guardianOk = (v: unknown) => cleanGuardian(v).length >= 2
