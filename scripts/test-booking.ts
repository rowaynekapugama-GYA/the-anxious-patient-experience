/**
 * Booking details, deposit policy, payments, booking sources and questionnaire access tests (v1.10.0, v1.11.0), with
 * SMTP2GO replaced by a local
 * stand-in. Needs a TEST database (DATABASE_URL) that has been migrated: it adds logins and bookings marked UNIT and
 * removes them again. Never run it against the live database.
 *
 *   DATABASE_URL=<a test database> PAYLOAD_SECRET=<any> npm run test:booking
 *
 * Checks: required fields and their messages; dates of birth (future, over 120 years, under 18, 29 February); phone
 * numbers in every common form; the retention rule; the terms text, version and tick record on a real booking; the
 * team email has the date of birth and the patient and GYA emails do not; 3D Secure decisions; who can change
 * questionnaire access (owner yes, editor no, admin yes) and the access log; the questionnaire notification list
 * fallback; the "Name or DOB differs from the booking" flag.
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
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  if (ok) passes++; else failures++
}

async function main() {
  if (!process.env.DATABASE_URL) { console.log('test:booking needs a TEST database in DATABASE_URL'); process.exit(1) }
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
  const port = (server.address() as AddressInfo).port
  process.env.SMTP2GO_API_KEY = 'unit-test'
  process.env.SMTP2GO_ENDPOINT = `http://127.0.0.1:${port}/v3/email/send`
  process.env.BOOKING_FROM = 'The Anxious Patient Experience <bookings@example.com>'
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://theanxiouspatientexperience.com.au'
  process.env.BOOKING_NOTIFY_EMAIL = 'team-unit@example.com'
  delete process.env.RESEND_API_KEY
  delete process.env.PAYPAL_CLIENT_ID
  delete process.env.PAYPAL_CLIENT_SECRET

  const P = await import('../src/booking/patient')
  const T = await import('../src/booking/terms')
  const pp = await import('../src/lib/paypal')
  const rec = await import('../src/lib/recipients')
  const form = await import('../src/lib/ape-questionnaire')
  const emails = await import('../src/booking/emails')
  const access = await import('../src/lib/access')
  const core = await import('../src/booking/core')

  // ------------------------------------------------------------ phone numbers
  const phones: [string, string | null][] = [
    ['0412 345 678', '0412 345 678'], ['0412345678', '0412 345 678'], ['+61 412 345 678', '0412 345 678'], ['+61412345678', '0412 345 678'],
    ['61412345678', '0412 345 678'], ['(04) 1234 5678', '0412 345 678'], ['0412-345-678', '0412 345 678'], ['+61 (0)412 345 678', '0412 345 678'],
    ['(02) 8599 9815', '(02) 8599 9815'], ['02 8599 9815', '(02) 8599 9815'], ['+61 2 8599 9815', '(02) 8599 9815'], ['0385999815', '(03) 8599 9815'],
    ['8599 9815', null], ['12', null], ['', null], ['+44 20 7946 0958', null], ['0412 345 67a', null], ['1300 123 456', null], ['04123456789', null],
  ]
  for (const [input, want] of phones) check(`phone "${input}" becomes ${want === null ? 'invalid' : `"${want}"`}`, P.normalisePhone(input) === want, String(P.normalisePhone(input)))

  // ------------------------------------------------------------ dates of birth (fixed "today": 17 Nov 2026 in Sydney)
  const now = new Date('2026-11-17T02:00:00Z')
  const dob = (day: unknown, month: unknown, year: unknown) => P.parseDob({ day, month, year }, now)
  check('DOB: a normal date', JSON.stringify(dob(14, 3, 1990)) === JSON.stringify({ ok: true, iso: '1990-03-14' }))
  check('DOB: all empty is "required"', !dob('', '', '').ok && (dob('', '', '') as { error: string }).error === 'required')
  check('DOB: 31 February is invalid', (dob(31, 2, 1990) as { error?: string }).error === 'invalid')
  check('DOB: 29 February 2000 (leap year) is fine', dob(29, 2, 2000).ok)
  check('DOB: 29 February 2001 is invalid', (dob(29, 2, 2001) as { error?: string }).error === 'invalid')
  check('DOB: tomorrow is in the future', (dob(18, 11, 2026) as { error?: string }).error === 'future')
  check('DOB: today is allowed (a newborn)', dob(17, 11, 2026).ok)
  check('DOB: exactly 120 years ago is allowed', dob(17, 11, 1906).ok)
  check('DOB: 120 years and a day ago is too old', (dob(16, 11, 1906) as { error?: string }).error === 'too_old')
  check('DOB: a two-digit year is invalid', (dob(1, 1, 90) as { error?: string }).error === 'invalid')
  check('DOB: missing day is invalid', (dob('', 3, 1990) as { error?: string }).error === 'invalid')
  check('DOB: "YYYY-MM-DD" form works', P.parseDob('1990-03-14', now).ok)
  check('DOB: in Sydney it is already 17 Nov at 23:30 UTC on the 16th', P.parseDob({ day: 17, month: 11, year: 2026 }, new Date('2026-11-16T23:30:00Z')).ok)
  check('age: 36 the day before the 37th birthday', P.ageOn('1989-11-18', new Date('2026-11-17T00:00:00Z')) === 36)
  check('age: 37 on the birthday', P.ageOn('1989-11-17', new Date('2026-11-17T00:00:00Z')) === 37)
  check('age: under 18 is worked out (not blocked)', P.ageOn('2010-06-01', new Date('2026-11-17T00:00:00Z')) === 16)

  // ------------------------------------------------------------ required fields
  const full = { firstName: 'Zelda', lastName: 'Quartermaine', email: 'zelda@example.com', phone: '0499 111 222', dob: { day: '5', month: '6', year: '1988' } }
  const ok = P.checkDetails(full, now)
  check('details: all filled in is accepted', ok.ok && ok.details.dob === '1988-06-05' && ok.details.phone === '0499 111 222')
  for (const k of ['firstName', 'lastName', 'email', 'phone', 'dob'] as const) {
    const r = P.checkDetails({ ...full, [k]: k === 'dob' ? { day: '', month: '', year: '' } : '' }, now)
    check(`details: missing ${k} is refused`, !r.ok && !!(r as { fields: Record<string, string> }).fields[k], JSON.stringify((r as { fields?: unknown }).fields))
  }
  const bad = P.checkDetails({ ...full, phone: '12345' }, now)
  check('details: an invalid phone says "invalid", not "required"', !bad.ok && (bad as { fields: Record<string, string> }).fields.phone === 'invalid')
  check('details: names are trimmed and one line', (P.checkDetails({ ...full, firstName: '  Zel\nda  ' }, now) as { details: { firstName: string } }).details.firstName === 'Zel da')
  check('details: every message is plain words', Object.values(P.MESSAGES).every((m) => /^[A-Z][^<>]*\.$/.test(m)))

  // ------------------------------------------------------------ retention: 7 years, or until 25 if under 18
  const appt = new Date('2026-12-01T00:00:00Z')
  check('retention: adult, 7 years after the appointment', P.retainUntil(appt, '1988-06-05').toISOString().slice(0, 10) === '2033-12-01')
  check('retention: no DOB (older booking), 7 years', P.retainUntil(appt, null).toISOString().slice(0, 10) === '2033-12-01')
  check('retention: aged 10, until the 25th birthday', P.retainUntil(appt, '2016-04-10').toISOString().slice(0, 10) === '2041-04-10')
  check('retention: aged 17, until the 25th birthday (later than 7 years)', P.retainUntil(appt, '2009-02-01').toISOString().slice(0, 10) === '2034-02-01')
  check('retention: aged 18 on the day, 7 years', P.retainUntil(appt, '2008-12-01').toISOString().slice(0, 10) === '2033-12-01')
  check('retention: aged 17 turning 25 after 7 years uses the 25th birthday', P.retainUntil(appt, '2009-12-20').toISOString().slice(0, 10) === '2034-12-20')

  // ------------------------------------------------------------ terms
  const t0 = T.fromSettings(null)
  check("policy: Lorna's wording is the default, version 2 (2026-11-18), approved by her", !t0.saved && t0.label === '2 (2026-11-18)' && /Lorna Gladwin/.test(t0.approvedBy))
  const lorna = [
    '## Your Appointment Deposit',
    'To secure your appointment, a {deposit} deposit is required at the time of booking. This deposit will be deducted from the cost of your appointment on the day.',
    '## Cancellations and Rescheduling',
    'We understand that sometimes plans change. If you need to cancel or rearrange your appointment, please contact us more than 48 hours in advance. Your deposit can be transferred to a future appointment or refunded where applicable.',
    'Cancellations or changes made within 48 hours of your appointment will result in your deposit being forfeited.',
    'If you do not attend your appointment without notifying us, your deposit will be non-refundable and non-transferable.',
    "## We're Here to Help",
    "We understand that dental anxiety can make attending an appointment feel difficult. If you're feeling overwhelmed or something unexpected has happened, please contact us as early as possible. We'd much rather hear from you and talk things through.",
  ]
  check("policy: Lorna's wording word for word, in order", lorna.every((l) => t0.text.includes(l)) && lorna.map((l) => t0.text.indexOf(l)).every((v, i, a) => i === 0 || v > a[i - 1]))
  check("policy: Lorna's tick box word for word", t0.consentLabel === 'I understand and agree to the deposit policy, including how my deposit will be applied to my appointment and the conditions under which it may be forfeited.')
  const filled = T.fill(t0.text, { phone: '(02) 8599 9815', deposit: '$150' })
  check('policy: the amount follows the deposit setting (never a typed $100)', filled.includes('a $150 deposit is required') && !/\$100/.test(filled) && !/\$100/.test(T.DEFAULT_TERMS))
  check("policy: the patient email reminder is Lorna's sentence", T.REMINDER === 'Cancellations or changes made within 48 hours of your appointment will result in your deposit being forfeited.')
  const t3 = T.fromSettings({ text: '## A\n- one\n- two\n\npara', version: 3, changedAt: '2026-12-02T01:00:00.000Z' })
  check('terms: a saved version keeps its number and date', t3.saved && t3.label === '3 (2026-12-02)')
  const bl = T.blocks('## Heading\nline one\nline two\n\n- a\n- b\npara')
  check('terms: headings, paragraphs and lists', JSON.stringify(bl) === JSON.stringify([{ type: 'h', text: 'Heading' }, { type: 'p', text: 'line one line two' }, { type: 'ul', items: ['a', 'b'] }, { type: 'p', text: 'para' }]))
  check('terms: {phone} and {deposit} are filled in', T.fill('{deposit} {phone}', { phone: '(02) 8599 9815', deposit: '$100' }) === '$100 (02) 8599 9815')
  const nowMs = Date.parse('2026-11-17T02:00:00Z')
  check('tick time: a time a minute ago is kept', T.tickTime('2026-11-17T01:59:00.000Z', nowMs).toISOString() === '2026-11-17T01:59:00.000Z')
  check('tick time: a future time is not trusted', T.tickTime('2026-11-18T01:59:00.000Z', nowMs).getTime() === nowMs)
  check('tick time: rubbish is not trusted', T.tickTime('yesterday', nowMs).getTime() === nowMs)
  check('tick time: two days ago is not trusted', T.tickTime('2026-11-15T01:59:00.000Z', nowMs).getTime() === nowMs)

  // ------------------------------------------------------------ payments
  const card = pp.orderBody('APE-ABC123', 100, 'https://x.example', 'card') as { payment_source: { card: { attributes: { verification: { method: string } } } }; purchase_units: { custom_id: string }[] }
  check('card order: 3D Secure when required', card.payment_source.card.attributes.verification.method === 'SCA_WHEN_REQUIRED')
  check('card order: custom_id is the booking reference', card.purchase_units[0].custom_id === 'APE-ABC123')
  const ap = pp.orderBody('APE-ABC123', 100, 'https://x.example', 'apple_pay') as { payment_source?: unknown; purchase_units: { amount: { value: string } }[] }
  check('Apple Pay order: same reference and amount, wallet confirms it', !ap.payment_source && ap.purchase_units[0].amount.value === '100.00')
  check('PayPal order: unchanged (PayPal experience)', !!(pp.orderBody('APE-ABC123', 100, 'https://x.example', 'paypal') as { payment_source: { paypal?: unknown } }).payment_source.paypal)
  check('source: anything unknown is treated as PayPal', pp.asSource('bitcoin') === 'paypal' && pp.asSource('google_pay') === 'google_pay')
  const o = (ar: Record<string, unknown> | null) => ({ id: 'X', status: 'APPROVED', payment_source: { card: ar ? { authentication_result: ar } : {} } })
  check('3DS: liability shift POSSIBLE goes ahead', pp.threeDs(o({ liability_shift: 'POSSIBLE', three_d_secure: { enrollment_status: 'Y', authentication_status: 'Y' } })) === 'continue')
  check('3DS: failed check (Y, N, NO) is stopped', pp.threeDs(o({ liability_shift: 'NO', three_d_secure: { enrollment_status: 'Y', authentication_status: 'N' } })) === 'failed')
  check('3DS: rejected (Y, R, NO) is stopped', pp.threeDs(o({ liability_shift: 'NO', three_d_secure: { enrollment_status: 'Y', authentication_status: 'R' } })) === 'failed')
  check('3DS: unknown asks to retry', pp.threeDs(o({ liability_shift: 'UNKNOWN', three_d_secure: { enrollment_status: 'Y', authentication_status: 'U' } })) === 'retry')
  check('3DS: card not enrolled goes ahead', pp.threeDs(o({ liability_shift: 'NO', three_d_secure: { enrollment_status: 'N' } })) === 'continue')
  check('3DS: no check needed goes ahead', pp.threeDs(o(null)) === 'continue')
  check('payment method from the order', pp.methodOf({ id: 'X', status: 'COMPLETED', payment_source: { google_pay: {} } }) === 'google_pay')
  process.env.PAYPAL_CLIENT_ID = 'x'; process.env.PAYPAL_CLIENT_SECRET = 'y'
  delete process.env.PAYPAL_ADVANCED
  check('Advanced Checkout is off unless PAYPAL_ADVANCED=on', !pp.paypalAdvanced())
  process.env.PAYPAL_ADVANCED = 'on'
  check('PAYPAL_ADVANCED=on switches it on', pp.paypalAdvanced())
  delete process.env.PAYPAL_ADVANCED; delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET

  // ------------------------------------------------------------ questionnaire notifications
  const team = { list: ['team@example.com'], source: 'Site Settings' as const }
  check('notifications: their own list when filled in', JSON.stringify(rec.questionnaireRecipients({ questionnaire: ['lorna@example.com', 'lorna@example.com'], team }).list) === '["lorna@example.com"]')
  check('notifications: empty uses the booking list', JSON.stringify(rec.questionnaireRecipients({ questionnaire: [], team }).list) === '["team@example.com"]')
  check('notifications: and the booking list falls back to the APE inbox', rec.resolveTeam([]).list.length > 0)

  // ------------------------------------------------------------ name and DOB on the questionnaire
  const a = form.cleanAnswers({ patient_name: '  Zelda   Quartermaine ', patient_dob: '1988-06-05', q01: '7' })
  check('questionnaire: name and DOB are kept with the answers', a.patient_name === 'Zelda Quartermaine' && a.patient_dob === '1988-06-05' && a.q01 === '7')
  check('questionnaire: an impossible DOB is dropped', !form.cleanAnswers({ patient_dob: '1988-02-31' }).patient_dob)
  check('questionnaire: name and DOB needed to send', Object.keys(form.identityProblems({})).length === 2)
  check('questionnaire: a draft can save without them', Object.keys(form.problems({ q01: '7' })).length === 0)
  check('mismatch: same name (case, accents, spaces) and DOB is not flagged', !form.identityDiffers({ patient_name: 'zélda  QUARTERMAINE', patient_dob: '1988-06-05' }, { name: 'Zelda Quartermaine', dob: '1988-06-05' }))
  check('mismatch: a different DOB is flagged', form.identityDiffers({ patient_name: 'Zelda Quartermaine', patient_dob: '1988-06-06' }, { name: 'Zelda Quartermaine', dob: '1988-06-05' }))
  check('mismatch: a different name is flagged', form.identityDiffers({ patient_name: 'Zelda Smith', patient_dob: '1988-06-05' }, { name: 'Zelda Quartermaine', dob: '1988-06-05' }))
  check('mismatch: an older booking with no DOB compares the name only', !form.identityDiffers({ patient_name: 'Zelda Quartermaine', patient_dob: '1988-06-05' }, { name: 'Zelda Quartermaine', dob: null }))

  // ------------------------------------------------------------ the database: a real booking through /api/booking
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const d = core.db()!
  await core.ensureSchema(d, core.loadConfig())
  await d.query(`DELETE FROM ape_bookings WHERE notes = 'UNIT v1.10.0'`)
  const SRC = await import('../src/booking/source')
  check('source: utm source kept, cleaned', JSON.stringify(SRC.cleanSource({ source: 'Instagram<script>', medium: 'social', campaign: 'ape-launch' })) === JSON.stringify({ source: 'instagramscript', medium: 'social', campaign: 'ape-launch' }))
  check('source: nothing sent is empty', SRC.cleanSource(null).source === '')
  check('source: labels', SRC.sourceLabel('instagram') === 'Instagram' && SRC.sourceLabel('l.instagram.com') === 'Instagram' && SRC.sourceLabel('caringbah-website') === 'Caringbah website'
    && SRC.sourceLabel('cronulla-website') === 'Cronulla website' && SRC.sourceLabel('google.com.au') === 'Google' && SRC.sourceLabel('direct') === 'Direct' && SRC.sourceLabel('') === 'Not recorded' && SRC.sourceLabel('example.org') === 'example.org')
  const state = await core.readState()
  const slots = core.availability(state.cfg, state.state, Date.now()).slots as { start: string }[]
  check('a time is free to book in the test database', slots.length > 0)
  const { POST } = await import('../src/app/api/booking/route')
  const post = (body: unknown) => POST(new Request('http://localhost/api/booking', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  const consentAt = new Date(Date.now() - 120_000).toISOString()
  const base = { slotStart: slots[slots.length - 1].start, ...full, notes: 'UNIT v1.10.0', consent: true, policyAgreed: true, policyAgreedAt: consentAt, policyVersion: '2 (2026-11-18)', source: { source: 'instagram', medium: 'social', campaign: 'ape-launch' } }
  const { policyAgreed: _drop, ...noAgree } = base
  const miss = await post(noAgree)
  check('booking: a direct POST without agreeing to the deposit policy is refused', miss.status === 400 && JSON.stringify(await miss.json()).includes('"policy":"required"'))
  const miss1 = await post({ ...base, policyAgreed: 'yes' })
  check('booking: only a real agreement counts (not "yes")', miss1.status === 400)
  const miss2 = await post({ ...base, dob: { day: '', month: '', year: '' } })
  check('booking: refused without a date of birth', miss2.status === 400)
  sent.length = 0
  const res = await post(base)
  const body = await res.json() as { ok: boolean; ref: string }
  check('booking: accepted with everything filled in', res.status === 200 && body.ok, JSON.stringify(body).slice(0, 200))
  const row = (await d.query(`SELECT *, to_char(dob, 'YYYY-MM-DD') AS dob_s FROM ape_bookings WHERE ref = $1`, [body.ref]))[0]
  check('record: first and last name, and the full name', row?.first_name === 'Zelda' && row?.last_name === 'Quartermaine' && row?.name === 'Zelda Quartermaine')
  check('record: phone stored normalised', row?.phone === '0499 111 222')
  check('record: date of birth', row?.dob_s === '1988-06-05')
  check('record: deposit policy agreed, with the time and version', row?.terms_version === '2 (2026-11-18)' && new Date(row.terms_consent_at).toISOString() === consentAt && row.terms_read_at === null)
  const tv = T.termsView(row)
  check('record: shown in the dashboard', tv.version === '2 (2026-11-18)' && tv.consentAt === consentAt && tv.readAt === null)
  check('record: where the booking came from', row?.source === 'instagram' && row?.source_medium === 'social' && row?.source_campaign === 'ape-launch')
  const teamMail = sent.find((m) => /New booking request/.test(m.subject))
  const patientMail = sent.find((m) => /We have received/.test(m.subject))
  check('team email: first name, last name, phone and DOB', !!teamMail && /First name: Zelda/.test(teamMail.text) && /Last name: Quartermaine/.test(teamMail.text) && /Date of birth: 5 June 1988 \(age 38\)/.test(teamMail.text) && /Phone: 0499 111 222/.test(teamMail.text), teamMail?.text.slice(0, 80))
  check('team email: deposit policy agreement recorded', !!teamMail && /Deposit policy: Agreed .*version 2 \(2026-11-18\)/.test(teamMail.text) && /Where they came from: Instagram/.test(teamMail.text))
  check('patient email: no date of birth', !!patientMail && !/1988|5 June|Date of birth/.test(patientMail.text + patientMail.html))
  check("patient email: Lorna's 48-hour sentence and the link to the full policy", !!patientMail && patientMail.text.includes('Cancellations or changes made within 48 hours of your appointment will result in your deposit being forfeited.') && patientMail.text.includes('https://theanxiouspatientexperience.com.au/book-now/terms/'))
  check('patient email: first name only in the greeting', !!patientMail && /Hi Zelda,/.test(patientMail.text))
  const gya = emails.gyaNoticeEmail(core.loadConfig(), { ref: body.ref, slot_start: row.slot_start }, [], 'gya@example.com')
  check('GYA notice: no name, phone or DOB', !/Zelda|Quartermaine|0499|1988/.test(gya.text + gya.html))
  // an older booking with no DOB or first name
  const old = emails.teamEmail(core.loadConfig(), { ref: 'APE-OLD001', slot_start: new Date(), name: 'Old Booking', email: 'o@example.com', phone: '', notes: '', price: 350, special: false, status: 'requested', created_at: new Date() }, { team, bcc: [] })
  check('older booking: single name, DOB "Not given"', /Name: Old Booking/.test(old.text) && /Date of birth: Not given/.test(old.text))
  await d.query(`DELETE FROM ape_bookings WHERE notes = 'UNIT v1.10.0'`)

  // ------------------------------------------------------------ v1.11.0 release: Lorna's policy replaces the v1.10.0 draft
  const { UPDATES } = await import('../src/sitekit/releases')
  const upd = UPDATES.find((u) => u.id === 'v1.11.0-deposit-policy')!
  const keepTerms = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as Record<string, any>).bookingTerms
  await payload.updateGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, context: { noPublishNeeded: true }, data: { bookingTerms: { text: T.V1_DRAFT_TERMS, consentLabel: T.V1_CONSENT, version: 1, changedAt: '2026-11-17T00:00:00.000Z' } } as never })
  const r1 = await upd.apply(payload)
  const after1 = T.fromSettings((await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as Record<string, any>).bookingTerms)
  check('release: the v1.10.0 draft becomes Lorna\'s wording, version 2, approved', /applied/.test(r1) && after1.text === T.DEFAULT_TERMS && after1.version === 2 && after1.consentLabel === T.DEFAULT_CONSENT && /Lorna/.test(after1.approvedBy), r1)
  check('release: running it again changes nothing', /left alone/.test(await upd.apply(payload)))
  await payload.updateGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, context: { noPublishNeeded: true }, data: { bookingTerms: { text: '## Our own\nWords about 48 hours.', version: 5 } } as never })
  check('release: wording the practice changed itself is left alone', /left alone/.test(await upd.apply(payload)))
  await payload.updateGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, context: { noPublishNeeded: true }, data: { bookingTerms: { ...(keepTerms || {}), text: keepTerms?.text || '' } } as never })

  // ------------------------------------------------------------ questionnaire access: owner yes, editor no, admin yes
  check('permissions: practice owner can manage access', access.canManageAccess({ email: 'o', role: 'editor', practiceOwner: true }))
  check('permissions: an ordinary editor cannot', !access.canManageAccess({ email: 'e', role: 'editor', practiceOwner: false }))
  check('permissions: GYA admin can', access.canManageAccess({ email: 'a', role: 'admin' }))
  check('permissions: only GYA can make a practice owner', access.canSetOwner({ email: 'a', role: 'admin' }) && !access.canSetOwner({ email: 'o', role: 'editor', practiceOwner: true }))
  const mk = async (email: string, role: 'admin' | 'editor', practiceOwner = false) => {
    await payload.delete({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })
    return payload.create({ collection: 'users', data: { email, name: `Unit ${role}`, role, password: `Unit-${Math.random().toString(36).slice(2)}-Aa1!`, practiceOwner }, overrideAccess: true }) as Promise<Record<string, any>>
  }
  const owner = await mk('unit-owner@example.com', 'editor', true)
  const editor = await mk('unit-editor@example.com', 'editor')
  const other = await mk('unit-other@example.com', 'editor')
  const admin = await mk('unit-admin@example.com', 'admin')
  const logCount = async () => Number((await d.query(`SELECT count(*)::int AS n FROM ape_access_log WHERE for_email LIKE 'unit-%'`))[0].n)
  await d.query(`DELETE FROM ape_access_log WHERE for_email LIKE 'unit-%'`)
  sent.length = 0
  const asOwner = await access.setAccess(payload, { email: owner.email, role: 'editor', practiceOwner: true }, other.id, true)
  check('owner ticks access for another login', asOwner.ok && !!(asOwner as { user: Record<string, any> }).user.canViewQuestionnaires)
  check('the person given access is emailed', sent.some((m) => m.to.includes('unit-other@example.com') && /You can now open patient questionnaires/.test(m.subject)))
  check('that email has no patient details', sent.every((m) => !/APE-[0-9A-F]{6}|date of birth/i.test(m.text)))
  const self = await access.setAccess(payload, { email: owner.email, role: 'editor', practiceOwner: true }, owner.id, true)
  check('owner can tick herself', self.ok)
  const asEditor = await access.setAccess(payload, { email: editor.email, role: 'editor', practiceOwner: false }, other.id, false)
  check('an editor is refused (403) and nothing changes', !asEditor.ok && (asEditor as { status: number }).status === 403 && !!((await payload.findByID({ collection: 'users', id: other.id, overrideAccess: true })) as Record<string, any>).canViewQuestionnaires)
  const asAdmin = await access.setAccess(payload, { email: admin.email, role: 'admin' }, other.id, false)
  check('GYA admin can untick', asAdmin.ok && !(asAdmin as { user: Record<string, any> }).user.canViewQuestionnaires)
  const ownerByOwner = await access.setOwner(payload, { email: owner.email, role: 'editor', practiceOwner: true }, editor.id, true)
  check('owner cannot make someone else an owner', !ownerByOwner.ok)
  const ownerByAdmin = await access.setOwner(payload, { email: admin.email, role: 'admin' }, editor.id, true)
  check('GYA admin can make someone a practice owner', ownerByAdmin.ok)
  const log = (await access.accessLog(100)).filter((e) => e.for.startsWith('unit-'))
  check('access log: every change, with who, for whom and when', (await logCount()) === 4 && log.some((e) => e.by === 'unit-owner@example.com' && e.for === 'unit-other@example.com' && e.change === 'questionnaire access: given' && !!e.at)
    && log.some((e) => e.by === 'unit-admin@example.com' && e.change === 'questionnaire access: removed') && log.some((e) => e.change === 'practice owner: on'), JSON.stringify(log.map((e) => e.change)))
  const editorTries = await payload.update({ collection: 'users', id: editor.id, data: { canViewQuestionnaires: true }, overrideAccess: false, user: { ...editor, collection: 'users' } as never }).catch(() => null) as Record<string, any> | null
  check('an editor cannot tick it through the API directly either', !editorTries?.canViewQuestionnaires)
  for (const u of [owner, editor, other, admin]) await payload.delete({ collection: 'users', id: u.id, overrideAccess: true })
  await d.query(`DELETE FROM ape_access_log WHERE for_email LIKE 'unit-%'`)

  console.log(`\n${passes} passed, ${failures} failed`)
  server.close()
  process.exit(failures ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
