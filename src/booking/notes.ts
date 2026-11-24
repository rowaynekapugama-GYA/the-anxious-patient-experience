/**
 * v1.16.0: the team's notes on each booking and the Onboarding call tick (server side). Dashboard routes only.
 *
 * Privacy: a note is read only by people signed in to the dashboard. Nothing here is called by an email, the public
 * pages or the CSV, and nothing here writes a note's text to the server logs (errors log the database error code only).
 * Notes live in ape_booking_notes, in the same database as the bookings, and are deleted with their booking.
 */
import type * as core from './core'
import { NOTE_MAX, QUICK_NOTES, SYSTEM_LINES, cleanNote, type NoteKind, type NoteView } from './followup'

export type Who = { id: string; name: string; admin: boolean }

/** The signed-in person, as the notes log shows them. */
export function whoOf(user: Record<string, any>): Who {
  return { id: String(user.id), name: String(user.name || '').trim() || String(user.email || ''), admin: user.role === 'admin' }
}

type Row = { id: string | number; booking_ref: string; kind: string; body: string; author_id: string; author_name: string; created_at: string | Date; edited_at: string | Date | null }

function view(r: Row, who: Who): NoteView {
  const mine = r.author_id === who.id
  return {
    id: String(r.id), kind: (r.kind as NoteKind) || 'note', body: r.body, by: r.author_name,
    at: new Date(r.created_at).toISOString(), editedAt: r.edited_at ? new Date(r.edited_at).toISOString() : null,
    canEdit: mine && r.kind !== 'system',
    canDelete: mine || who.admin,
  }
}

/** Every note on these bookings, newest first, by booking reference. */
export async function notesFor(d: core.Db, refs: string[], who: Who): Promise<Record<string, NoteView[]>> {
  const out: Record<string, NoteView[]> = {}
  if (!refs.length) return out
  const rows = await d.query<Row>(
    `SELECT n.id, b.ref AS booking_ref, n.kind, n.body, n.author_id, n.author_name, n.created_at, n.edited_at
       FROM ape_booking_notes n JOIN ape_bookings b ON b.id = n.booking_id
      WHERE b.ref = ANY($1::text[]) ORDER BY n.created_at DESC, n.id DESC`, [refs])
  for (const r of rows) (out[r.booking_ref] ||= []).push(view(r, who))
  return out
}

export type NoteResult = { ok: true } | { ok: false; status: number; error: string }

/** Add a note (typed, or one of the quick notes by its number). */
export async function addNote(d: core.Db, ref: string, input: { body?: unknown; quick?: unknown }, who: Who): Promise<NoteResult> {
  let kind: NoteKind = 'note'
  let body: string
  if (input.quick !== undefined && input.quick !== null && input.quick !== '') {
    const i = Number(input.quick)
    if (!Number.isInteger(i) || i < 0 || i >= QUICK_NOTES.length) return { ok: false, status: 400, error: 'invalid' }
    kind = 'quick'
    body = QUICK_NOTES[i]
  } else {
    body = cleanNote(input.body)
    if (!body) return { ok: false, status: 400, error: 'note_empty' }
    if (body.length > NOTE_MAX) return { ok: false, status: 400, error: 'note_too_long' }
  }
  const r = await d.query(
    `INSERT INTO ape_booking_notes (booking_id, kind, body, author_id, author_name)
       SELECT id, $2, $3, $4, $5 FROM ape_bookings WHERE ref = $1 RETURNING id`, [ref, kind, body, who.id, who.name])
  return r.length ? { ok: true } : { ok: false, status: 404, error: 'not_found' }
}

/** Change a note: only the person who wrote it, and never an automatic line. */
export async function editNote(d: core.Db, id: string, input: { body?: unknown }, who: Who): Promise<NoteResult> {
  if (!/^\d{1,18}$/.test(id)) return { ok: false, status: 400, error: 'invalid' }
  const body = cleanNote(input.body)
  if (!body) return { ok: false, status: 400, error: 'note_empty' }
  if (body.length > NOTE_MAX) return { ok: false, status: 400, error: 'note_too_long' }
  const found = await d.query<{ author_id: string; kind: string }>(`SELECT author_id, kind FROM ape_booking_notes WHERE id = $1::bigint`, [id])
  if (!found.length) return { ok: false, status: 404, error: 'note_gone' }
  if (found[0].author_id !== who.id || found[0].kind === 'system') return { ok: false, status: 403, error: 'not_your_note' }
  await d.query(`UPDATE ape_booking_notes SET body = $2, kind = 'note', edited_at = now() WHERE id = $1::bigint AND author_id = $3`, [id, body, who.id])
  return { ok: true }
}

/** Delete a note: the person who wrote it, or an administrator. */
export async function deleteNote(d: core.Db, id: string, who: Who): Promise<NoteResult> {
  if (!/^\d{1,18}$/.test(id)) return { ok: false, status: 400, error: 'invalid' }
  const found = await d.query<{ author_id: string }>(`SELECT author_id FROM ape_booking_notes WHERE id = $1::bigint`, [id])
  if (!found.length) return { ok: false, status: 404, error: 'note_gone' }
  if (found[0].author_id !== who.id && !who.admin) return { ok: false, status: 403, error: 'not_your_note' }
  await d.query(`DELETE FROM ape_booking_notes WHERE id = $1::bigint`, [id])
  return { ok: true }
}

/**
 * Tick or undo the Onboarding call, and add a line to the notes log, in one go. Changes nothing else: no email, no
 * status, no deposit, no welcome pack, nothing sent to Google.
 */
export async function setOnboarding(d: core.Db, ref: string, done: boolean, who: Who): Promise<NoteResult> {
  const cur = await d.query<{ id: string; onboarding_done_at: string | null }>(`SELECT id, onboarding_done_at FROM ape_bookings WHERE ref = $1`, [ref])
  if (!cur.length) return { ok: false, status: 404, error: 'not_found' }
  // one statement: the line is only added when the tick really changed (two people pressing at once add one line)
  const set = done
    ? `onboarding_done_at = now(), onboarding_by = $3 WHERE id = $1 AND onboarding_done_at IS NULL`
    : `onboarding_done_at = NULL, onboarding_by = '' WHERE id = $1 AND onboarding_done_at IS NOT NULL AND $3::text IS NOT NULL`
  await d.query(
    `WITH u AS (UPDATE ape_bookings SET ${set} RETURNING id)
     INSERT INTO ape_booking_notes (booking_id, kind, body, author_id, author_name) SELECT id, 'system', $2, $4, $3 FROM u`,
    [cur[0].id, done ? SYSTEM_LINES.done : SYSTEM_LINES.undone, who.name, who.id])
  return { ok: true }
}
