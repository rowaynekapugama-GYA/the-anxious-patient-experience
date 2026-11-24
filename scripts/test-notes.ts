/**
 * v1.16.0: the team's notes on each booking, the Onboarding call tick and the questionnaire status wording, with
 * SMTP2GO replaced by a local stand-in. Needs a TEST database (DATABASE_URL) that has been migrated: it adds logins
 * and a booking marked UNIT and removes them again. Never run it against the live database.
 *
 *   DATABASE_URL=<a test database> PAYLOAD_SECRET=<any> npm run test:notes
 *
 * Checks: a request without a login is refused; notes are saved with who and when, newest first; only the author can
 * edit; the author or an administrator can delete; empty and too-long notes are refused; quick notes; text is kept as
 * plain text; ten notes added at once are all kept; the Onboarding call tick records who and when, adds a line to the
 * notes, can be undone, and sends no email; note text never appears in any email, in the server logs, or in anything
 * the website serves publicly; notes are deleted with their booking; the booking tables can be set up twice with no
 * change; the questionnaire wording for every state; the Onboarding call "to do" rule.
 */
import './load-env'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

type Sent = { to: string[]; subject: string; text: string; html: string }
const sent: Sent[] = []
const server = http.createServer((q, r) => {
  let b = ''
  q.on('data', (c) => (b += c))
  q.on('end', () => {
    const body = JSON.parse(b || '{}')
    sent.push({ to: body.to || [], subject: body.subject, text: body.text_body, html: body.html_body })
    r.setHeader('content-type', 'application/json')
    r.end(JSON.stringify({ data: { succeeded: 1, failed: 0, email_id: `unit-${sent.length}` } }))
  })
})

let failures = 0
let passes = 0
function check(name: string, ok: boolean, extra = '') {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}\n`)
  if (ok) passes++; else failures++
}

// everything the server code writes to the console while notes are handled, to prove no note text is logged
const logged: string[] = []
function capture<T>(fn: () => Promise<T>): Promise<T> {
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info }
  const grab = (...a: unknown[]) => { logged.push(a.map((x) => (x instanceof Error ? `${x.message} ${x.stack}` : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')) }
  console.log = grab; console.error = grab; console.warn = grab; console.info = grab
  return fn().finally(() => Object.assign(console, orig))
}

async function main() {
  if (!process.env.DATABASE_URL) { console.log('test:notes needs a TEST database in DATABASE_URL'); process.exit(1) }
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
  const port = (server.address() as AddressInfo).port
  process.env.SMTP2GO_API_KEY = 'unit-test'
  process.env.SMTP2GO_ENDPOINT = `http://127.0.0.1:${port}/v3/email/send`
  process.env.BOOKING_FROM = 'The Anxious Patient Experience <bookings@example.com>'
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://theanxiouspatientexperience.com.au'
  delete process.env.RESEND_API_KEY

  const F = await import('../src/booking/followup')
  const core = await import('../src/booking/core')
  const emails = await import('../src/booking/emails')

  // ------------------------------------------------------------ pure rules
  const now = Date.parse('2026-11-24T03:00:00Z')
  const future = '2026-12-02T23:00:00Z'
  const past = '2026-11-20T23:00:00Z'
  check('onboarding: an upcoming booking going ahead is to do', F.onboardingState({ status: 'confirmed', start: future }, now) === 'todo')
  check('onboarding: a request still to confirm is to do', F.onboardingState({ status: 'requested', start: future }, now) === 'todo')
  check('onboarding: a ticked booking is done', F.onboardingState({ status: 'confirmed', start: future, onboarding: { doneAt: '2026-11-24T01:00:00Z', by: 'Alex' } }, now) === 'done')
  check('onboarding: cancelled is not to do', F.onboardingState({ status: 'cancelled', start: future }, now) === null)
  check('onboarding: released (not paid) is not to do', F.onboardingState({ status: 'cancelled', start: future }, now) === null)
  check('onboarding: still paying the deposit online is not to do', F.onboardingState({ status: 'requested', start: future, heldUntil: '2026-11-24T03:20:00Z' }, now) === null)
  check('onboarding: a past appointment is not to do', F.onboardingState({ status: 'confirmed', start: past }, now) === null)
  check('onboarding: a ticked cancelled booking still shows done', F.onboardingState({ status: 'cancelled', start: future, onboarding: { doneAt: '2026-11-24T01:00:00Z', by: 'Alex' } }, now) === 'done')

  const L = (q: Parameters<typeof F.questionnaireLabel>[0], w: string | null, online = true) => F.questionnaireLabel(q, w, online, now)
  const exp = '2026-12-09T23:00:00Z'
  check('questionnaire: welcome pack not sent yet', L({ status: 'sent', sentAt: '2026-11-24T01:00:00Z', expiresAt: exp }, null)?.text === 'Questionnaire: not sent yet')
  check('questionnaire: no row yet, online on', L(null, null)?.text === 'Questionnaire: not sent yet')
  check('questionnaire: online off and no row says nothing', L(null, null, false) === null)
  check('questionnaire: sent, nothing back', L({ status: 'sent', sentAt: '2026-11-24T01:00:00Z', expiresAt: exp }, '2026-11-24T01:00:00Z')?.text === 'Questionnaire: sent, not yet completed')
  check('questionnaire: started and saved', L({ status: 'sent', draftSavedAt: '2026-11-24T02:00:00Z', expiresAt: exp }, '2026-11-24T01:00:00Z')?.text === 'Questionnaire: started, not yet completed')
  const done = L({ status: 'submitted', submittedAt: '2026-11-24T02:30:00Z', expiresAt: exp }, '2026-11-24T01:00:00Z')
  check('questionnaire: completed with the date (Sydney)', done?.text === 'Questionnaire: completed 24 Nov' && done.tone === 'good', done?.text)
  check('questionnaire: link expired without being sent in', L({ status: 'sent', draftSavedAt: '2026-11-24T02:00:00Z', expiresAt: '2026-11-23T00:00:00Z' }, '2026-11-20T01:00:00Z')?.text === 'Questionnaire: not completed, link expired')
  check('questionnaire: completed wins over an expired link', L({ status: 'submitted', submittedAt: '2026-11-22T02:30:00Z', expiresAt: '2026-11-23T00:00:00Z' }, null)?.key === 'completed')
  check('questionnaire: the old words are gone', !/received/i.test(JSON.stringify([L(null, null), L({ status: 'sent', expiresAt: exp }, 'x')])))

  const { sourceLabel } = await import('../src/booking/source')
  check('source: the Google Business Profile links show as Google Business Profile', sourceLabel('gbp') === 'Google Business Profile' && sourceLabel('google') === 'Google')
  const site = await import('../src/lib/site')
  const base = site.getSettings()
  const schemaOf = (link: string) => JSON.parse(site.tokensFor({ ...base, googleProfileLink: link } as any).schema.replace(/^<script[^>]*>|<\/script>$/g, ''))
  check('structured data: no profile link, no sameAs (as before)', schemaOf('').department.sameAs === undefined)
  check('structured data: a profile link becomes sameAs on the APE department', JSON.stringify(schemaOf('https://maps.app.goo.gl/AbC123').department.sameAs) === '["https://maps.app.goo.gl/AbC123"]')
  check('structured data: anything that is not a Google profile link is left out', schemaOf('https://example.com/x').department.sameAs === undefined && schemaOf('javascript:alert(1)').department.sameAs === undefined && schemaOf('https://maps.app.goo.gl/a"><script>').department.sameAs === undefined)
  check('note text: line ends made plain, control characters removed', F.cleanNote('one\r\ntwo\u0007  \r\n') === 'one\ntwo')
  check('note list: first line shortened', F.firstLine('\nA long first line that keeps going and going and going beyond seventy characters for sure\nsecond') .endsWith('...'))

  // ------------------------------------------------------------ the route, with real logins
  const { getPayload } = await import('payload')
  const config = (await import('../src/payload.config')).default
  const payload = await getPayload({ config })
  const d = core.db()!
  await core.ensureSchema(d, core.loadConfig())

  // the booking tables set up twice: nothing changes
  const shape = async () => JSON.stringify(await d.query(`SELECT table_name, column_name, data_type, column_default FROM information_schema.columns WHERE table_name LIKE 'ape_%' ORDER BY 1, 2`))
  const s1 = await shape()
  core.setAdapter(null)
  await core.ensureSchema(core.db()!, core.loadConfig())
  check('schema: setting the booking tables up a second time changes nothing', s1 === await shape())
  const dd = core.db()!

  const PW = 'unit-test-Password-1'
  const mk = async (email: string, role: 'admin' | 'editor', name: string) => {
    await payload.delete({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true }).catch(() => {})
    await payload.create({ collection: 'users', data: { email, password: PW, role, name, mustChangePassword: false } as any, overrideAccess: true })
    const r = await payload.login({ collection: 'users', data: { email, password: PW } })
    return { Authorization: `JWT ${r.token}` }
  }
  const alex = await mk('unit-notes-alex@example.com', 'editor', 'Alex Unit')
  const lauren = await mk('unit-notes-lauren@example.com', 'editor', 'Lauren Unit')
  const admin = await mk('unit-notes-admin@example.com', 'admin', 'GYA Unit')

  const REF = 'APE-NOTE01'
  await dd.query(`DELETE FROM ape_bookings WHERE ref = $1`, [REF])
  await dd.query(`INSERT INTO ape_bookings (ref, slot_start, name, email, phone, notes, price, status, first_name, last_name, dob, deposit_status, deposit_paid)
    VALUES ($1, now() + interval '20 days', 'Unit Patient', 'unit-patient@example.com', '0400 000 000', 'UNIT v1.16.0', 350, 'confirmed', 'Unit', 'Patient', '1990-01-01', 'paid', true)`, [REF])
  const before = await dd.query(`SELECT status, deposit_status, deposit_paid, welcome_status, welcome_sent_at, updated_at FROM ape_bookings WHERE ref = $1`, [REF])

  const { GET, POST } = await import('../src/app/api/dashboard/bookings/route')
  const post = (h: Record<string, string> | null, body: unknown) => POST(new Request('http://localhost/api/dashboard/bookings', { method: 'POST', headers: { 'content-type': 'application/json', ...(h || {}) }, body: JSON.stringify(body) }))
  const get = async (h: Record<string, string>) => (await (await GET(new Request('http://localhost/api/dashboard/bookings', { headers: h }))).json()) as any
  const mine = async (h: Record<string, string>) => ((await get(h)).bookings as any[]).find((b) => b.ref === REF)

  const NOTE_TEXT = 'Tried mobile at 10am <img src=x onerror=alert(1)> NOTE-MARKER-7731'
  const mailsBefore = sent.length

  await capture(async () => {
    const anon = await post(null, { action: 'note-add', ref: REF, body: NOTE_TEXT })
    check('a request without a login is refused (401)', anon.status === 401)
    const anonGet = await GET(new Request('http://localhost/api/dashboard/bookings'))
    check('reading bookings without a login is refused (401)', anonGet.status === 401)

    check('add a note', (await post(alex, { action: 'note-add', ref: REF, body: NOTE_TEXT })).status === 200)
    check('a quick note', (await post(lauren, { action: 'note-add', ref: REF, quick: 0 })).status === 200)
    check('an unknown quick note is refused', (await post(lauren, { action: 'note-add', ref: REF, quick: 9 })).status === 400)
    check('an empty note is refused', (await post(alex, { action: 'note-add', ref: REF, body: '   \n ' })).status === 400)
    check('a note over 2,000 characters is refused', (await post(alex, { action: 'note-add', ref: REF, body: 'x'.repeat(2001) })).status === 400)
    check('a note of exactly 2,000 characters is kept', (await post(alex, { action: 'note-add', ref: REF, body: 'y'.repeat(2000) })).status === 200)
    check('a note on a booking that does not exist is refused (404)', (await post(alex, { action: 'note-add', ref: 'APE-NOPE00', body: 'x' })).status === 404)

    let b = await mine(alex)
    const n = b.teamNotes as any[]
    const s = n.find((x) => x.body === NOTE_TEXT)
    check('the note is saved as typed (plain text, nothing removed or added)', !!s && s.body === NOTE_TEXT)
    check('the note records who wrote it (the signed-in name)', s?.by === 'Alex Unit')
    check('the note records when', !!s && Math.abs(Date.parse(s.at) - Date.now()) < 60000)
    check('newest first', n.length === 3 && n[0].body.startsWith('y') && n[2].body === NOTE_TEXT, n.map((x) => x.body.slice(0, 10)).join('|'))
    check('the quick note reads as a call attempt', n[1].body === 'Called, no answer' && n[1].kind === 'quick' && n[1].by === 'Lauren Unit')
    check('the author may edit and delete their own note', s?.canEdit && s?.canDelete)
    const asLauren = ((await mine(lauren)).teamNotes as any[]).find((x) => x.body === NOTE_TEXT)
    check('someone else may not edit or delete it', asLauren && !asLauren.canEdit && !asLauren.canDelete)
    const asAdmin = ((await mine(admin)).teamNotes as any[]).find((x) => x.body === NOTE_TEXT)
    check('an administrator may delete it but not edit it', asAdmin && !asAdmin.canEdit && asAdmin.canDelete)

    check('editing someone else\'s note is refused (403)', (await post(lauren, { action: 'note-edit', id: s.id, body: 'changed' })).status === 403)
    check('an administrator editing someone else\'s note is refused (403)', (await post(admin, { action: 'note-edit', id: s.id, body: 'changed' })).status === 403)
    check('deleting someone else\'s note is refused (403)', (await post(lauren, { action: 'note-delete', id: s.id })).status === 403)
    check('the author edits their note', (await post(alex, { action: 'note-edit', id: s.id, body: `${NOTE_TEXT} (left a voicemail)` })).status === 200)
    b = await mine(alex)
    const e = (b.teamNotes as any[]).find((x) => x.id === s.id)
    check('an edited note shows when it was edited', !!e?.editedAt && e.body.endsWith('(left a voicemail)'))
    const y = (b.teamNotes as any[]).find((x) => x.body.startsWith('y'))
    check('an administrator deletes any note', (await post(admin, { action: 'note-delete', id: y.id })).status === 200)
    check('a deleted note is gone', !((await mine(alex)).teamNotes as any[]).some((x) => x.id === y.id))
    check('deleting it again says it has gone (404)', (await post(alex, { action: 'note-delete', id: y.id })).status === 404)
    check('a bad note id is refused', (await post(alex, { action: 'note-delete', id: '1; DROP TABLE ape_bookings' })).status === 400)

    // two people at once: each note is its own row
    const many = await Promise.all(Array.from({ length: 10 }, (_, i) => post(i % 2 ? alex : lauren, { action: 'note-add', ref: REF, body: `at once ${i}` })))
    const after = (await mine(alex)).teamNotes as any[]
    check('ten notes added at the same moment are all kept', many.every((r) => r.status === 200) && after.filter((x) => x.body.startsWith('at once')).length === 10)

    // Onboarding call
    check('tick the onboarding call', (await post(alex, { action: 'onboarding', ref: REF, done: true })).status === 200)
    b = await mine(lauren)
    check('the tick records who and when', b.onboarding.by === 'Alex Unit' && Math.abs(Date.parse(b.onboarding.doneAt) - Date.now()) < 60000)
    check('the tick adds a line to the notes', b.teamNotes[0].kind === 'system' && b.teamNotes[0].body === 'Onboarding call marked completed' && b.teamNotes[0].by === 'Alex Unit')
    check('an automatic line cannot be edited, even by its author', !((await mine(alex)).teamNotes[0].canEdit) && (await post(alex, { action: 'note-edit', id: b.teamNotes[0].id, body: 'x' })).status === 403)
    await Promise.all([post(alex, { action: 'onboarding', ref: REF, done: true }), post(lauren, { action: 'onboarding', ref: REF, done: true })])
    b = await mine(alex)
    check('pressing it again (two people at once) adds no second line', b.teamNotes.filter((x: any) => x.kind === 'system').length === 1 && b.onboarding.by === 'Alex Unit')
    check('undo the tick', (await post(lauren, { action: 'onboarding', ref: REF, done: false })).status === 200)
    b = await mine(alex)
    check('undo clears who and when', b.onboarding.doneAt === null && b.onboarding.by === '')
    check('undo adds a line too', b.teamNotes[0].kind === 'system' && b.teamNotes[0].body === 'Onboarding call completed mark undone' && b.teamNotes[0].by === 'Lauren Unit')
    const after2 = await dd.query(`SELECT status, deposit_status, deposit_paid, welcome_status, welcome_sent_at, updated_at FROM ape_bookings WHERE ref = $1`, [REF])
    check('notes and the tick change nothing else on the booking (status, deposit, welcome pack)', JSON.stringify(before) === JSON.stringify(after2))
    check('notes and the tick send no email at all', sent.length === mailsBefore, `${sent.length - mailsBefore} sent`)

    // a server error on a note logs the error code only
    const realQuery = dd.query
    dd.query = (async () => { throw Object.assign(new Error(`boom ${NOTE_TEXT}`), { code: 'XX000' }) }) as any
    const boom = await post(alex, { action: 'note-add', ref: REF, body: NOTE_TEXT })
    dd.query = realQuery
    check('a database error while adding a note answers 500', boom.status === 500)
  })
  check('nothing written to the server logs contains a note\'s text', !logged.some((l) => l.includes('NOTE-MARKER-7731') || l.includes('at once') || l.includes('left a voicemail')), `${logged.length} log lines`)
  check('the database error was logged by its code', logged.some((l) => l.includes('bookings: error') && l.includes('XX000')))

  // ------------------------------------------------------------ no note text in any email
  const cfg = core.loadConfig(await core.readOverrides(dd))
  sent.length = 0
  await emails.sendBookingEmails(dd, cfg, REF, ['patient', 'team'], 'final').catch((err) => check('booking emails sent', false, (err as Error).message))
  const q = await import('../src/lib/questionnaire')
  const row = (await dd.query(`SELECT * FROM ape_bookings WHERE ref = $1`, [REF]))[0]
  await q.sendWelcome(payload, row as any, { manual: true, by: 'unit' }).catch(() => null)
  await q.sendWelcome(payload, row as any, { test: { email: 'unit-test@example.com', withLink: false } }).catch(() => null)
  const all = sent.map((m) => `${m.subject}\n${m.text}\n${m.html}`).join('\n')
  check('emails were produced for the check', sent.length >= 2, `${sent.length} emails: ${sent.map((m) => m.subject).join(' | ')}`)
  check('no note text in the patient, team, GYA or welcome emails', !all.includes('NOTE-MARKER-7731') && !all.includes('at once') && !all.includes('Called, no answer') && !all.includes('Onboarding call'))

  // ------------------------------------------------------------ nothing public carries notes
  const fs = await import('node:fs')
  const pathm = await import('node:path')
  const walk = (dir: string, out: string[] = []): string[] => { if (!fs.existsSync(dir)) return out; for (const n of fs.readdirSync(dir)) { const f = pathm.join(dir, n); if (fs.statSync(f).isDirectory()) walk(f, out); else out.push(f) } return out }
  const pub = walk(pathm.join(process.cwd(), 'public')).filter((f) => /\.(html|js|json)$/.test(f))
  check('no public page or script refers to notes or the notes API actions', !pub.some((f) => /note-add|teamNotes|ape_booking_notes|NOTE-MARKER/.test(fs.readFileSync(f, 'utf8'))), `${pub.length} files`)
  const mailCode = ['src/booking/emails.ts', 'src/lib/questionnaire.ts', 'src/lib/mailer.ts', 'src/lib/email.ts', 'src/email'].flatMap((p) => fs.statSync(p).isDirectory() ? walk(p) : [p])
  check('no email code reads the notes table', !mailCode.some((f) => /ape_booking_notes|teamNotes|notesFor/.test(fs.readFileSync(f, 'utf8'))))
  const csvCode = fs.readFileSync('src/dashboard/editors/Bookings.tsx', 'utf8').match(/function csv\(\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  check('the Bookings CSV leaves the notes out', csvCode.length > 100 && !/teamNotes|onboarding/.test(csvCode))

  // ------------------------------------------------------------ deleted with the booking
  const id = (await dd.query(`SELECT id FROM ape_bookings WHERE ref = $1`, [REF]))[0].id
  await dd.query(`DELETE FROM ape_bookings WHERE ref = $1`, [REF])
  const left = await dd.query(`SELECT count(*)::int AS n FROM ape_booking_notes WHERE booking_id = $1`, [id])
  check('deleting a booking deletes its notes', left[0].n === 0)

  for (const e of ['unit-notes-alex@example.com', 'unit-notes-lauren@example.com', 'unit-notes-admin@example.com']) await payload.delete({ collection: 'users', where: { email: { equals: e } }, overrideAccess: true }).catch(() => {})
  await payload.delete({ collection: 'questionnaires', where: { bookingRef: { equals: REF } }, overrideAccess: true }).catch(() => {})
  server.close()
  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
