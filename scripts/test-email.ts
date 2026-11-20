/**
 * Email tests (v1.8.3) with SMTP2GO replaced by a local stand-in. Needs a TEST database (DATABASE_URL): it adds a
 * booking APE-UNIT01 and removes it again. Never run it against the live database.
 *
 *   DATABASE_URL=<a test database> PAYLOAD_SECRET=<any> npm run test:email
 *
 * Checks: who gets the team emails and in what order of fallbacks; the GYA delivery check has no patient details;
 * a failed send is logged, retried once and then flagged; reset links use the live address and last 1 hour; the
 * forgotten-password answer is the same for any address; test emails never reach the booking list.
 */
import './load-env'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

type Sent = { to: string[]; subject: string; text: string; html: string; bcc?: string[] }
const sent: Sent[] = []
let failFor = new Set<string>()
const server = http.createServer((q, r) => {
  let b = ''
  q.on('data', (c) => (b += c))
  q.on('end', () => {
    const body = JSON.parse(b || '{}')
    const to: string[] = body.to || []
    sent.push({ to, subject: body.subject, text: body.text_body, html: body.html_body, bcc: body.bcc })
    r.setHeader('content-type', 'application/json')
    if (to.some((t) => failFor.has(t))) return r.end(JSON.stringify({ data: { succeeded: 0, failed: 1, error: 'test failure' } }))
    r.end(JSON.stringify({ data: { succeeded: to.length, failed: 0, email_id: `unit-${sent.length}` } }))
  })
})

let failures = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  if (!ok) failures++
}

async function main() {
  if (!process.env.DATABASE_URL) { console.log('test:email needs a TEST database in DATABASE_URL'); process.exit(1) }
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
  const port = (server.address() as AddressInfo).port
  process.env.SMTP2GO_API_KEY = 'unit-test'
  process.env.SMTP2GO_ENDPOINT = `http://127.0.0.1:${port}/v3/email/send`
  process.env.BOOKING_FROM = 'The Anxious Patient Experience <bookings@example.com>'
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://theanxiouspatientexperience.com.au'
  delete process.env.RESEND_API_KEY

  const { resolveTeam } = await import('../src/lib/recipients')
  const core = await import('../src/booking/core')
  const emails = await import('../src/booking/emails')
  const mailer = await import('../src/lib/mailer')
  const pw = await import('../src/dashboard/lib/passwordLink')

  // 1. recipients and their fallbacks
  const keep = { a: process.env.BOOKING_NOTIFY_EMAIL, b: process.env.BOOKING_NOTIFY_TO }
  process.env.BOOKING_NOTIFY_EMAIL = 'env-a@example.com'; process.env.BOOKING_NOTIFY_TO = 'env-b@example.com'
  check('team list: Site Settings first', JSON.stringify(resolveTeam(['one@example.com', 'two@example.com'])) === JSON.stringify({ list: ['one@example.com', 'two@example.com'], source: 'Site Settings' }))
  check('team list: then BOOKING_NOTIFY_EMAIL', resolveTeam([]).source === 'BOOKING_NOTIFY_EMAIL' && resolveTeam([])!.list[0] === 'env-a@example.com')
  process.env.BOOKING_NOTIFY_EMAIL = ''
  check('team list: then BOOKING_NOTIFY_TO', resolveTeam([]).source === 'BOOKING_NOTIFY_TO')
  process.env.BOOKING_NOTIFY_TO = ''
  check('team list: never empty (APE inbox built in)', JSON.stringify(resolveTeam(['not an email'])) === JSON.stringify({ list: [core.DEFAULT_NOTIFY_TO], source: 'built-in fallback' }))
  process.env.BOOKING_NOTIFY_EMAIL = keep.a ?? ''; process.env.BOOKING_NOTIFY_TO = keep.b ?? ''

  // 2. the GYA delivery check carries no patient details
  const cfg = core.loadConfig()
  const b: import('../src/booking/emails').BookingRow = { ref: 'APE-UNIT01', slot_start: new Date(Date.now() + 9 * 86400000), name: 'Zelda Quartermaine', email: 'zelda.patient@example.com', phone: '0499 111 222', notes: 'private note about my teeth', price: 250, special: true, status: 'requested', created_at: new Date() }
  const g = emails.gyaNoticeEmail(cfg, b, [{ label: 'New booking email to the team', ok: false, id: '', error: 'x', retrying: true }, { label: 'Booking request received, to the patient', ok: true, id: 'abc', error: '' }], 'gya@example.com')
  const gAll = `${g.subject} ${g.text} ${g.html} ${g.to.join(' ')}`
  check('GYA notice has no name, email, phone or note', !/Zelda|Quartermaine|zelda\.patient|0499|private note/i.test(gAll))
  check('GYA notice has the reference and the outcome', gAll.includes('APE-UNIT01') && /FAILED/.test(g.text) && /accepted by SMTP2GO \(abc\)/.test(g.text))
  const team = emails.teamEmail(cfg, b, { team: { list: ['team@example.com'], source: 'Site Settings' }, bcc: [] })
  check('team email: subject starts with the reference', team.subject.startsWith('New booking request APE-UNIT01,'), team.subject)
  check('team email: Reply-To is the patient', team.reply_to === b.email)
  const pat = emails.patientEmail(cfg, b, 'ape@example.com')
  check('patient email: Reply-To is the APE inbox', pat.reply_to === 'ape@example.com' && pat.to[0] === b.email)
  // v1.13.0: age at the appointment and the parent or guardian; the under-18 line for the patient (can be switched off)
  const at = new Date('2026-12-02T23:00:00.000Z') // 10am, 3 Dec 2026 in Sydney
  const teen = { ...b, slot_start: at, first_name: 'Zelda', last_name: 'Quartermaine', dob: '2010-06-01', guardian_name: 'Mary Quartermaine' }
  const teamTeen = emails.teamEmail(cfg, teen, { team: { list: ['team@example.com'], source: 'Site Settings' }, bcc: [] })
  check('team email (16): age at appointment and the parent or guardian', /Age at appointment: 16/.test(teamTeen.text) && /Parent or guardian: Mary Quartermaine/.test(teamTeen.text))
  const adult = { ...teen, dob: '1990-06-01', guardian_name: null }
  const teamAdult = emails.teamEmail(cfg, adult, { team: { list: ['team@example.com'], source: 'Site Settings' }, bcc: [] })
  check('team email (36): age shown, no guardian row', /Age at appointment: 36/.test(teamAdult.text) && !/Parent or guardian/.test(teamAdult.text))
  check('team email (no DOB, older booking): "Not given"', /Age at appointment: Not given/.test(team.text))
  const U18 = "As you're under 18, please bring your parent or guardian to your first visit."
  check('patient email (16): the under-18 line', emails.patientEmail(cfg, teen, 'ape@example.com').text.includes(U18))
  check('patient email (16), line switched off: not there', !emails.patientEmail({ ...cfg, booking: { ...cfg.booking, under18GuardianLine: false } }, teen, 'ape@example.com').text.includes(U18))
  check('patient email (36 or no DOB): no under-18 line', !emails.patientEmail(cfg, adult, 'ape@example.com').text.includes(U18) && !pat.text.includes(U18))
  check('patient email: never the guardian name or the DOB', !/Mary Quartermaine|2010|1 June/.test(emails.patientEmail(cfg, teen, 'ape@example.com').text))

  // 3. a failed send: logged, retried after a minute, then flagged
  const d = core.db()!
  await core.ensureSchema(d, cfg)
  await d.query(`DELETE FROM ape_bookings WHERE ref = 'APE-UNIT01'`)
  await d.query(`DELETE FROM ape_email_log WHERE ref = 'APE-UNIT01'`)
  await d.query(`INSERT INTO ape_bookings (ref, slot_start, name, email, phone, notes, price, special) VALUES ('APE-UNIT01', now() + interval '400 days', $1, $2, $3, $4, 250, false)`, [b.name, b.email, b.phone, b.notes])
  const live = { team: { list: ['team-unit@example.com'], source: 'Site Settings' as const }, apeInbox: 'ape@example.com', gya: { on: true, to: 'gya-unit@example.com', source: 'Site Settings' as const }, questionnaire: [], bcc: [] }
  failFor = new Set(['team-unit@example.com'])
  const first = await emails.sendBookingEmails(d, cfg, 'APE-UNIT01', ['team', 'patient'], 'first', { live, payLink: '' })
  let row = (await d.query(`SELECT email_patient, email_team, email_retry_at > now() AS later FROM ape_bookings WHERE ref = 'APE-UNIT01'`))[0]
  check('first failure: team marked retry, patient sent', !first.team?.ok && !!first.patient?.ok && row.email_team === 'retry' && row.email_patient === 'sent' && row.later)
  let log = await d.query(`SELECT kind, status FROM ape_email_log WHERE ref = 'APE-UNIT01' ORDER BY id`)
  check('both attempts logged (retrying, accepted)', JSON.stringify(log.map((x) => `${x.kind}:${x.status}`)) === JSON.stringify(['booking-team:retrying', 'booking-patient:accepted']))
  check('nothing retried before the minute is up', (await emails.retryDue(d, cfg, 'APE-UNIT01')) === 0)
  await d.query(`UPDATE ape_bookings SET email_retry_at = now() - interval '1 second' WHERE ref = 'APE-UNIT01'`)
  const before = sent.length
  // the retry reads the live recipients from the dashboard, so point the team list at the failing address there
  process.env.BOOKING_NOTIFY_EMAIL = 'team-unit@example.com'
  failFor = new Set(['team-unit@example.com', core.DEFAULT_NOTIFY_TO])
  const retried = await emails.retryDue(d, cfg, 'APE-UNIT01')
  row = (await d.query(`SELECT email_patient, email_team FROM ape_bookings WHERE ref = 'APE-UNIT01'`))[0]
  log = await d.query(`SELECT kind, status FROM ape_email_log WHERE ref = 'APE-UNIT01' ORDER BY id`)
  check('retry once, then flagged as failed', retried === 1 && row.email_team === 'failed' && row.email_patient === 'sent', JSON.stringify(row))
  check('the second failure is logged as failed and GYA is alerted', log.some((x) => x.kind === 'booking-team' && x.status === 'failed') && log.some((x) => x.kind === 'alert') && sent.slice(before).some((m) => /^APE email failed/.test(m.subject)))
  check('the alert has no patient details', sent.slice(before).filter((m) => /^APE email failed/.test(m.subject)).every((m) => !/Zelda|zelda\.patient|0499|private note/i.test(`${m.subject} ${m.text} ${m.html}`)))
  check('the patient email is not sent again by the retry', sent.slice(before).filter((m) => m.to.includes(b.email)).length === 0)
  failFor = new Set()
  const again = await emails.sendBookingEmails(d, cfg, 'APE-UNIT01', ['team'], 'final', { live })
  row = (await d.query(`SELECT email_team FROM ape_bookings WHERE ref = 'APE-UNIT01'`))[0]
  check('Resend to team clears the flag', !!again.team?.ok && row.email_team === 'sent')
  process.env.BOOKING_NOTIFY_EMAIL = keep.a ?? ''

  // 4. password emails
  const inv = pw.passwordEmail('someone@example.com', 'invite', 'https://theanxiouspatientexperience.com.au/admin/reset-password?token=abc')
  const res = pw.passwordEmail('someone@example.com', 'reset', 'https://theanxiouspatientexperience.com.au/admin/reset-password?token=abc')
  check('login links use the live address', pw.origin() === 'https://theanxiouspatientexperience.com.au' && inv.text.includes('https://theanxiouspatientexperience.com.au/admin') && !/vercel\.app/.test(inv.text + res.text))
  check('reset says 1 hour, invite says 72 hours', /expires in 1 hour/.test(res.text) && /expires in 72 hours/.test(inv.text))
  check('password changed notice exists', /was changed/.test(pw.passwordChangedEmail('someone@example.com').text))

  // 5. the log never holds a link or token
  await mailer.logAttempt({ kind: 'reset', to: ['x@example.com'], status: 'failed', error: 'oops https://theanxiouspatientexperience.com.au/admin/reset-password?token=SECRET123' })
  const last = (await d.query(`SELECT error FROM ape_email_log ORDER BY id DESC LIMIT 1`))[0]
  check('a link in an error is not stored', !/SECRET123/.test(last.error))

  // 6. limits
  const key = `unit-${Date.now()}`
  const ok = [await mailer.allow(key, 3, 60), await mailer.allow(key, 3, 60), await mailer.allow(key, 3, 60), await mailer.allow(key, 3, 60)]
  check('limit: the 4th of 3 an hour is refused', JSON.stringify(ok) === '[true,true,true,false]')

  await d.query(`DELETE FROM ape_bookings WHERE ref = 'APE-UNIT01'`)
  await d.query(`DELETE FROM ape_email_log WHERE ref = 'APE-UNIT01' OR recipient = 'x@example.com'`)
  server.close()
  console.log(failures ? `\n${failures} failed` : '\nall email tests passed')
  process.exit(failures ? 1 : 0)
}

void main()
