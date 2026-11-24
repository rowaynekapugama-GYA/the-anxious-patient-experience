/**
 * v1.16.0: the follow-up the team does after a booking arrives, shared by the dashboard screens, the API and the
 * tests. No server imports here: the Bookings screen uses it in the browser.
 *
 *   - Notes: a team-only log on each booking (call attempts, admin notes). Never sent to the patient, never in an email,
 *     the CSV, the dataLayer, an address or the server logs.
 *   - Onboarding call: a tick on each booking, with who and when.
 *   - The questionnaire status, worded for what actually happened (Alex, 24 Nov 2026).
 */

export const NOTE_MAX = 2000

/** One-tap notes for call attempts. */
export const QUICK_NOTES = ['Called, no answer', 'Left a voicemail', 'Sent a text', 'Spoke to the patient'] as const

/** The lines added to the notes log by the Onboarding call tick, so there is a history. */
export const SYSTEM_LINES = { done: 'Onboarding call marked completed', undone: 'Onboarding call completed mark undone' } as const

export const NOTE_HELP = 'For call attempts and admin notes. Please keep clinical details in Core Practice.'

export type NoteKind = 'note' | 'quick' | 'system'
export type NoteView = {
  id: string; kind: NoteKind; body: string; by: string; at: string; editedAt: string | null
  /** the signed-in person may edit (their own note, not a system line) or delete (their own, or any as an administrator) */
  canEdit: boolean; canDelete: boolean
}

/** Plain text only: control characters out, Windows line ends made plain, trailing space trimmed. */
export function cleanNote(v: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+$/gm, '').trim()
}

/** The first line of a note, shortened for the Bookings list. */
export function firstLine(body: string, max = 70): string {
  const line = String(body || '').split('\n').find((l) => l.trim()) || ''
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}...` : line
}

// ---------------------------------------------------------------- Onboarding call
export type OnboardingInput = { status: string; start: string; heldUntil?: string | null; onboarding?: { doneAt: string | null; by: string } | null }
/**
 * done: ticked. todo: not ticked and the booking is still going ahead (not cancelled or released, not waiting for its
 * deposit to be paid online, appointment still to come). null: nothing to show (cancelled, released or past).
 */
export function onboardingState(b: OnboardingInput, now: number): 'done' | 'todo' | null {
  if (b.onboarding?.doneAt) return 'done'
  if (b.status === 'cancelled' || b.heldUntil) return null
  if (new Date(b.start).getTime() < now) return null
  return 'todo'
}

// ---------------------------------------------------------------- the questionnaire status
export type QuestionnaireInput = {
  status: string; submittedAt?: string | null; sentAt?: string | null; draftSavedAt?: string | null; expiresAt?: string | null
}
export type QuestionnaireLabel = { key: 'not_sent' | 'sent' | 'started' | 'completed' | 'expired'; text: string; tone: 'good' | 'grey' }

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' })

/**
 * What the dashboard says about a booking's questionnaire.
 *   q: the booking's questionnaire row (made when the private link is first issued), or null
 *   welcomeSentAt: when the welcome pack email (which carries the link and the printable copy) last went to the patient
 *   online: the online questionnaire is switched on
 * Null: nothing to say (the online questionnaire is off and there is no row).
 */
export function questionnaireLabel(q: QuestionnaireInput | null | undefined, welcomeSentAt: string | null | undefined, online: boolean, now: number): QuestionnaireLabel | null {
  if (q?.status === 'submitted') return { key: 'completed', text: `Questionnaire: completed${q.submittedAt ? ` ${shortDay(q.submittedAt)}` : ''}`, tone: 'good' }
  if (q && (q.status === 'expired' || (q.expiresAt && new Date(q.expiresAt).getTime() < now))) return { key: 'expired', text: 'Questionnaire: not completed, link expired', tone: 'grey' }
  if (q?.draftSavedAt) return { key: 'started', text: 'Questionnaire: started, not yet completed', tone: 'grey' }
  if (!q && !online) return null
  if (welcomeSentAt) return { key: 'sent', text: 'Questionnaire: sent, not yet completed', tone: 'grey' }
  return { key: 'not_sent', text: 'Questionnaire: not sent yet', tone: 'grey' }
}
