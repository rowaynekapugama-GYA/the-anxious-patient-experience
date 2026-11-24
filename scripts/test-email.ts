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

  // 7. v1.14.0: branded HTML emails, patient wording from the dashboard
  {
    const tpl = await import('../src/email/patient')
    const Q = await import('../src/lib/questionnaire')
    const D = await import('../src/booking/deposit')
    const A = await import('../src/lib/access')
    const where = { clinic: 'The Cronulla Dentists', address: '13 Cronulla Street, Cronulla NSW 2230', mapsUrl: 'https://maps.example/x', phone: '(02) 8599 9815', apeEmail: 'ape@example.com' }
    const words = { subject: Q.DEFAULT_SUBJECT, body: Q.DEFAULT_BODY }
    const teenB = { ...b, first_name: 'Zelda', last_name: 'Q', dob: '2010-06-01', slot_start: new Date('2026-12-02T23:00:00.000Z') }
    const all: [string, { subject: string; text: string; html: string }][] = [
      ['booking request (patient)', emails.patientEmail(cfg, teenB, 'ape@example.com')],
      ['welcome (patient)', Q.welcomeEmail({ words, ref: 'APE-UNIT01', name: 'Zelda Q', slotStart: new Date('2026-12-02T23:00:00.000Z'), link: 'https://theanxiouspatientexperience.com.au/questionnaire/abc', where, under18: true })],
      ['deposit received (patient)', D.depositEmails(cfg, b, 100, 'CAP1', 'ape@example.com', ['t@example.com']).patient],
      ['new booking (team)', team],
      ['deposit received (team)', D.depositEmails(cfg, b, 100, 'CAP1', 'ape@example.com', ['t@example.com']).team],
      ['questionnaire received (team)', Q.noticeEmail({ id: 9, bookingRef: 'APE-UNIT01', appointmentAt: new Date().toISOString() })],
      ['invite (login)', pw.passwordEmail('someone@example.com', 'invite', 'https://theanxiouspatientexperience.com.au/admin/reset-password?token=abc')],
      ['password changed (login)', pw.passwordChangedEmail('someone@example.com')],
      ['questionnaire access (login)', A.accessEmail({ email: 'a@example.com', name: 'Alex' }, 'lorna@example.com')],
    ]
    for (const [name, m] of all) {
      const ok = /<html lang="en-AU"/.test(m.html) && /role="presentation"/.test(m.html) && /ape-logo-320\.png/.test(m.html) && /alt="The Anxious Patient Experience"/.test(m.html)
        && !/<script/i.test(m.html) && !/vercel\.app/.test(m.html + m.text) && !/\u2014/.test(m.html + m.text + m.subject) && Buffer.byteLength(m.html) < 100 * 1024
        && !!m.text.trim() && !/\{[a-z_]+\}/.test(m.text + m.subject)
      check(`branded: ${name} (layout, logo, under 100 KB, plain text, no em dash, no vercel.app, no leftover merge fields)`, ok, `${(Buffer.byteLength(m.html) / 1024).toFixed(1)} KB`)
    }
    const pb = all[0][1]
    check('patient email: preheader, footer with location, contact, privacy link and the reason line', /display:none;max-height:0/.test(pb.html) && /Appointments are held at The Cronulla Dentists/.test(pb.html) && /privacy-policy/.test(pb.html) && /made a booking with The Anxious Patient Experience/.test(pb.html) && !/unsubscribe/i.test(pb.html))
    check('patient email: no note from the patient and no date of birth', !/Sample note|private note|2010|1 June/.test(emails.patientEmail(cfg, { ...teenB, notes: 'private note about my teeth' }, 'ape@example.com').html))
    check('booking email: default wording word for word (greeting, request line, deposit, policy, team will be in touch)', /Hi Zelda,/.test(pb.text) && pb.text.includes('Thank you for your booking request for The Anxious Patient Experience™ New Patient Appointment.')
      && pb.text.includes('Cancellations or changes made within 48 hours of your appointment will result in your deposit being forfeited. You can read the full deposit policy here:') && pb.text.includes('The APE team will be in touch to confirm your appointment and send your new patient information pack.') && pb.text.includes("As you're under 18"))
    const wl = all[1][1]
    check('welcome email: wording word for word, the Where to go box and the questionnaire button (VML for Outlook)', wl.subject === 'Your APE appointment is confirmed' && wl.text.includes("There's no pressure to answer everything, and there are no wrong answers.") && /Where to go/.test(wl.html) && /Croydon Street council car park/.test(wl.text)
      && /v:roundrect/.test(wl.html) && /Fill in your questionnaire/.test(wl.html) && wl.text.includes('https://theanxiouspatientexperience.com.au/questionnaire/abc') && /See you soon,<br>Dr Lorna, Alex and the APE team/.test(wl.html))
    check('team and login emails keep their wording (text version unchanged)', team.text.startsWith('New booking request for') && /Choose your password: https/.test(all[6][1].text))
    // v1.17.0: every email the team, GYA or a login receives is branded HTML, laid out for a quick read
    {
      const okOut = [{ label: 'New booking email to the team', ok: true, id: 'id-team-1', error: '' }, { label: 'Booking request received, to the patient', ok: true, id: 'id-pat-1', error: '' }]
      const gOk = emails.gyaNoticeEmail(cfg, b, okOut, 'gya@example.com')
      const gTest = emails.gyaNoticeEmail(cfg, b, okOut, 'gya@example.com', { test: true })
      const alert = emails.alertHtml('APE email failed: x APE-UNIT01', 'booking request received, to the patient', 'APE-UNIT01')
      const inbound: [string, { subject: string; text: string; html: string }][] = [
        ['GYA delivery check (all accepted)', gOk], ['GYA delivery check (a failure)', g], ['GYA alert', { subject: 'APE email failed', text: 'x', html: alert }],
        ['reset (login)', pw.passwordEmail('someone@example.com', 'reset', 'https://theanxiouspatientexperience.com.au/admin/reset-password?token=abc')],
        ...all.slice(3),
      ]
      for (const [name, m] of inbound) {
        const ok = /<html lang="en-AU"/.test(m.html) && /ape-logo-320\.png/.test(m.html) && /class="eyebrow"/.test(m.html) && /class="h1 serif"/.test(m.html)
          && !/<script/i.test(m.html) && !/vercel\.app/.test(m.html) && !/\u2014/.test(m.html) && Buffer.byteLength(m.html) < 100 * 1024
        check(`v1.17.0 formatted: ${name} (logo, eyebrow, heading, under 100 KB, no em dash)`, ok, `${(Buffer.byteLength(m.html) / 1024).toFixed(1)} KB`)
      }
      check('GYA check: green status, one tick per email, SMTP2GO ids, how to turn it off', /All emails accepted/.test(gOk.html) && (gOk.html.match(/&#10003;<\/div><\/td>/g) || []).length >= 2 && gOk.html.includes('id-team-1') && /Send GYA a delivery check for each booking/.test(gOk.html))
      check('GYA check with a failure: amber status, a cross, the email check button', /1 email failed/.test(g.html) && /&#10005;/.test(g.html) && /admin\/settings\/email/.test(g.html) && /v:roundrect/.test(g.html))
      check('GYA check: text version unchanged', gOk.text.includes(`APE booking ${b.ref}, appointment`) && /Nothing to do\./.test(gOk.text) && /accepted by SMTP2GO \(id-team-1\)/.test(gOk.text))
      check('GYA check and alert: still no name, email, phone or note', !/Zelda|Quartermaine|zelda\.patient|0499|private note/i.test(gOk.html + g.html + alert + gTest.html))
      check('GYA check test: yellow TEST strip', /TEST EMAIL/.test(gTest.html) && /#FFF5D6/.test(gTest.html) && gTest.subject.startsWith('[TEST] '))
      check('team email: Appointment, Patient, Next steps and Records groups, numbered steps, Open this booking', ['Appointment', 'Patient', 'Next steps', 'Records'].every((x) => team.html.includes(`>${x}</p>`)) && /Block this time in Core Practice\./.test(team.html) && team.html.includes(`/admin/bookings?ref=${b.ref}`) && /Open this booking/.test(team.html))
      check('team email: every detail row still in the HTML', ['Reference', 'Requested time', 'Fee', 'Deposit', 'Location', 'Date of birth', 'Age at appointment', 'Email', 'Phone', 'Note from patient', 'Deposit policy', 'Where they came from', 'Collection notice', 'Submitted'].every((k) => team.html.includes(`>${k}</td>`)))
      check('team email: text version unchanged (rows in the same order)', team.text.startsWith('New booking request for') && /Reference: APE-UNIT01\nRequested time:/.test(team.text) && /Note from patient: private note about my teeth\nDeposit policy:/.test(team.text) && /Replying to this email replies to the patient\.$/.test(team.text))
      const dep = D.depositEmails(cfg, b, 100, 'CAP1', 'ape@example.com', ['t@example.com']).team
      check('deposit (team): green status with the amount, transaction, button', /Deposit received: \$100/.test(dep.html) && /CAP1/.test(dep.html) && /admin\/bookings\?ref=APE-UNIT01/.test(dep.html))
      const qn = Q.noticeEmail({ id: 9, bookingRef: 'APE-UNIT01', appointmentAt: new Date().toISOString() })
      check('questionnaire received: button to the questionnaire, never an answer', /Read the questionnaire/.test(qn.html) && /admin\/questionnaires\/9/.test(qn.html) && /answers are never included/.test(qn.html))
      const pc = pw.passwordChangedEmail('someone@example.com')
      check('password changed: login and time box, "if it was not you" strip, reset button', /If it was not you/.test(pc.html) && /admin\/forgot-password/.test(pc.html) && />Changed</.test(pc.html))
      check('login emails: the link is only in the button and the text version', (inbound[3][1].html.match(/token=abc/g) || []).length === 2 && inbound[3][1].text.includes('token=abc'))
    }
    check('test notice from Email check links to the Tests list (not a missing page)', Q.noticeEmail({ id: 'test', bookingRef: 'APE-TEST01', appointmentAt: new Date().toISOString() }, true).text.includes('/admin/questionnaires?show=tests'))

    // the legacy Welcome pack wording converts to the template and back to the same words
    const conv = tpl.fromLegacyWelcome(Q.DEFAULT_SUBJECT, Q.DEFAULT_BODY)
    check('welcome default comes from the old wording: {first_name}, date and time, {where_to_go}, sign-off', conv.main.startsWith('Hi {first_name},') && conv.main.includes('{appointment_date}, {appointment_time} (Sydney time)') && /\n\{where_to_go\}\n/.test(`\n${conv.second}\n`) && conv.signoff === 'See you soon,' && conv.sender === 'Dr Lorna, Alex and the APE team')
    check('defaults pass their own checks', tpl.PATIENT_KINDS.every((k) => !tpl.check(k, tpl.defaultTemplate(k)).errors.length && !tpl.check(k, tpl.defaultTemplate(k)).warnings.length))

    // checks on save
    const base = tpl.defaultTemplate('booking-patient')
    const c1 = tpl.check('booking-patient', { ...base, main: 'Hi {firstname},' })
    check('unknown merge field is caught, with a suggestion', c1.errors.some((e) => /\{firstname\} is not a merge field\. Did you mean \{first_name\}\?/.test(e)), c1.errors.join(' | '))
    check('a field the email has no data for is caught', tpl.check('booking-patient', { ...base, main: '{questionnaire_link}' }).errors.length > 0)
    const wd = tpl.defaultTemplate('welcome')
    check('welcome: removing the questionnaire button without {questionnaire_link} is blocked', tpl.check('welcome', { ...wd, buttonTarget: 'home' }).errors.some((e) => /questionnaire link/.test(e)))
    check('welcome: {questionnaire_link} in the wording is enough', !tpl.check('welcome', { ...wd, buttonTarget: 'none', buttonLabel: '', main: `${wd.main}\n\nYour link: {questionnaire_link}` }).errors.length)
    check('required: subject, heading and main message', tpl.check('booking-patient', { ...base, subject: '', heading: ' ', main: '' }).errors.length === 3)
    check('a link must be https or mailto', tpl.check('booking-patient', { ...base, main: 'See [here](http://example.com)' }).errors.some((e) => /https:\/\//.test(e)) && !tpl.check('booking-patient', { ...base, main: 'See [our site](https://example.com)' }).errors.length)
    check('{where_to_go} only on a line of its own, and not in the subject', tpl.check('welcome', { ...wd, second: 'Come {where_to_go} soon' }).errors.length > 0 && tpl.check('welcome', { ...wd, subject: '{where_to_go}' }).errors.length > 0)
    const warn = tpl.check('booking-patient', { ...base, main: 'A pain-free visit' })
    check('AHPRA words warn but do not block', !warn.errors.length && warn.warnings.length === 1)
    check('a stray curly bracket is caught', tpl.check('booking-patient', { ...base, heading: 'Hello {there' }).errors.length > 0)

    // rendering edited wording safely
    const edited = { ...base, subject: 'Thanks {first_name}, see you on {appointment_date}', main: 'Hi {first_name},\n\n**Bold** and *italic* and [our site](https://theanxiouspatientexperience.com.au/).\n\n- one\n- two\n\n<script>alert(1)</script>', buttonTarget: 'book' as const, buttonLabel: 'Book another time', banner: 'napkin' as const }
    const em = emails.patientEmail(cfg, teenB, 'ape@example.com', { template: edited })
    check('edited wording: merge fields filled, formatting, bullet list, link, button and banner', em.subject === 'Thanks Zelda, see you on Thursday 3 December 2026' && /<strong>Bold<\/strong>/.test(em.html) && /<em>italic<\/em>/.test(em.html) && /<ul/.test(em.html)
      && /href="https:\/\/theanxiouspatientexperience\.com\.au\/book-now\/"/.test(em.html) && /banner-napkin\.jpg/.test(em.html) && /- one\n- two/.test(em.text) && em.text.includes('our site (https://theanxiouspatientexperience.com.au/)'))
    check('edited wording: HTML is escaped, never run', !/<script>/.test(em.html) && /&lt;script&gt;/.test(em.html))
    check('the deposit policy line follows the saved policy', emails.patientEmail(cfg, teenB, 'ape@example.com', { policyText: '## Ours\nPlease give us 48 hours notice to move your {deposit} deposit.' }).text.includes('Please give us 48 hours notice to move your $100 deposit.'))

    // storage: save, versions (last 10), reset and restore
    await d.query(`DELETE FROM ape_email_templates WHERE kind = 'deposit-patient'`)
    await d.query(`DELETE FROM ape_email_template_versions WHERE kind = 'deposit-patient'`)
    check('nothing saved: the default is in use', !(await tpl.load('deposit-patient')).saved && (await tpl.loadTemplate('deposit-patient')).subject === tpl.defaultTemplate('deposit-patient').subject)
    for (let n = 1; n <= 12; n++) await tpl.save('deposit-patient', { ...tpl.defaultTemplate('deposit-patient'), subject: `Deposit received ${n}` }, 'unit@example.com')
    const vs = await tpl.versions('deposit-patient')
    check('saved wording is used, and only the last 10 versions are kept', (await tpl.loadTemplate('deposit-patient')).subject === 'Deposit received 12' && vs.length === 10 && vs[0].template.subject === 'Deposit received 12' && vs[9].template.subject === 'Deposit received 3')
    const dm = D.depositEmails(cfg, b, 100, 'CAP1', 'ape@example.com', [], { template: await tpl.loadTemplate('deposit-patient') }).patient
    check('the saved wording reaches the email', dm.subject === 'Deposit received 12')
    await tpl.reset('deposit-patient', 'unit@example.com')
    check('reset: back to the default, and the reset is in the history', (await tpl.loadTemplate('deposit-patient')).subject === tpl.defaultTemplate('deposit-patient').subject && (await tpl.versions('deposit-patient'))[0].note === 'Reset to default')
    const old = (await tpl.versions('deposit-patient')).find((v) => v.template.subject === 'Deposit received 7')!
    await tpl.save('deposit-patient', old.template, 'unit@example.com', 'Restored')
    check('restore: an old version is the wording in use again', (await tpl.loadTemplate('deposit-patient')).subject === 'Deposit received 7')
    await d.query(`DELETE FROM ape_email_templates WHERE kind = 'deposit-patient'`)
    await d.query(`DELETE FROM ape_email_template_versions WHERE kind = 'deposit-patient'`)
  }

  await d.query(`DELETE FROM ape_bookings WHERE ref = 'APE-UNIT01'`)
  await d.query(`DELETE FROM ape_email_log WHERE ref = 'APE-UNIT01' OR recipient = 'x@example.com'`)
  server.close()
  console.log(failures ? `\n${failures} failed` : '\nall email tests passed')
  process.exit(failures ? 1 : 0)
}

void main()
