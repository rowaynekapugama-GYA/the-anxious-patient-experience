/**
 * Welcome pack and questionnaire tests (v1.9.0), with SMTP2GO replaced by a local stand-in. Needs a TEST database
 * (DATABASE_URL) that has been migrated: it adds bookings APE-UNIT1x and test rows and removes them again. Never run
 * it against the live database.
 *
 *   DATABASE_URL=<a test database> PAYLOAD_SECRET=<any> npm run test:questionnaire
 *
 * Checks: answers are cleaned against Lorna's form; encryption round trip; both switches are off by default and
 * nothing is sent while off; the online questionnaire needs the key and the approved notice; Mark confirmed sends
 * once with both PDFs; who can read answers; no answer ever appears in an email; test rows stay apart and expire.
 */
import './load-env'
import http from 'node:http'
import crypto from 'node:crypto'
import type { AddressInfo } from 'node:net'

type Sent = { to: string[]; subject: string; text: string; html: string; attachments: { filename: string; fileblob: string }[] }
const sent: Sent[] = []
const server = http.createServer((q, r) => {
  let b = ''
  q.on('data', (c) => (b += c))
  q.on('end', () => {
    const body = JSON.parse(b || '{}')
    sent.push({ to: body.to || [], subject: body.subject, text: body.text_body, html: body.html_body, attachments: body.attachments || [] })
    r.setHeader('content-type', 'application/json')
    r.end(JSON.stringify({ data: { succeeded: 1, failed: 0, email_id: `unit-${sent.length}` } }))
  })
})

let failures = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  if (!ok) failures++
}

const SECRET_ANSWER = 'ZEBRA-PRIVATE-ANSWER-7731'

async function main() {
  if (!process.env.DATABASE_URL) { console.log('test:questionnaire needs a TEST database in DATABASE_URL'); process.exit(1) }
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
  const port = (server.address() as AddressInfo).port
  process.env.SMTP2GO_API_KEY = 'unit-test'
  process.env.SMTP2GO_ENDPOINT = `http://127.0.0.1:${port}/v3/email/send`
  process.env.BOOKING_FROM = 'The Anxious Patient Experience <bookings@example.com>'
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://theanxiouspatientexperience.com.au'
  process.env.BOOKING_NOTIFY_EMAIL = 'team-unit@example.com'
  delete process.env.RESEND_API_KEY
  delete process.env.QUESTIONNAIRE_ENABLED
  const KEY = crypto.randomBytes(32).toString('base64')
  delete process.env.QUESTIONNAIRE_ENCRYPTION_KEY

  const form = await import('../src/lib/ape-questionnaire')
  const cr = await import('../src/lib/crypto')
  const q = await import('../src/lib/questionnaire')
  const core = await import('../src/booking/core')
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const d = core.db()!
  await core.ensureSchema(d, core.loadConfig())

  // ---------------------------------------------------------------- 1. Lorna's form
  check('11 questions, numbered 01 to 11 in page order', form.QUESTIONS.map((x) => x.num).join(',') === '01,02,03,04,05,06,07,08,09,10,11')
  check('"anything else" is last, and PDF 10 and 11 come before it', form.QUESTIONS[10].title.startsWith('Is there anything else') && form.PDF_NUMBER.q09 === '10' && form.PDF_NUMBER.q10 === '11' && form.PDF_NUMBER.q11 === '09')
  check('question 07 is marked optional', form.QUESTIONS[6].optional === true && form.QUESTIONS.filter((x) => x.optional).length === 1)
  check('"Circle" reads "Choose" on screen', form.QUESTIONS[0].helper!.startsWith('Choose the number') && !JSON.stringify(form.QUESTIONS).includes('Circle'))
  const raw = { q01: '7', q02: ['Fear of being in pain', 'Other', 'Not on the form'], q02_other: 'The sound of the drill', q03: ['I\'d like a stop signal I can use at any time'], q05: 'No', q05_more: 'should be dropped', q07: 'Yes', q07_more: 'Walking', q09: '1–2 years', q11: SECRET_ANSWER, junk: 'x' }
  const clean = form.cleanAnswers(raw)
  check('cleaning keeps real answers', clean.q01 === '7' && (clean.q02 as string[]).join('|') === 'Fear of being in pain|Other' && clean.q02_other === 'The sound of the drill' && clean.q07_more === 'Walking')
  check('cleaning drops unknown keys, off-form choices and a follow-up without Yes', !('junk' in clean) && !('q05_more' in clean) && clean.q05 === 'No')
  check('the Other box is dropped when Other is not ticked', !('q02_other' in form.cleanAnswers({ q02: ['Fear of being in pain'], q02_other: 'x' })))
  check('nothing is required (an empty form is fine)', Object.keys(form.problems({})).length === 0)
  check('a scale of 11 is a problem', !!form.problems({ q01: '11' }).q01)
  const g = form.glance(clean)
  check('At a glance: score, what makes them anxious, question 03', g.score === 7 && g.anxious.includes('Other: The sound of the drill') && g.prefs.find((p) => p.heading === 'Control')!.picked.length === 1)
  check('answer rows follow the form order', form.answerRows(clean).map((r) => r.num).join(',') === '01,02,03,04,05,06,07,08,09,10,11')

  // ---------------------------------------------------------------- 2. encryption
  const key = Buffer.from(KEY, 'base64')
  const box = cr.seal(JSON.stringify(clean), key)
  check('encryption round trip', cr.unseal(box, key) === JSON.stringify(clean))
  check('the sealed text does not contain the answer', !JSON.stringify(box).includes(SECRET_ANSWER))
  let wrongKeyFails = false
  try { cr.unseal(box, crypto.randomBytes(32)) } catch { wrongKeyFails = true }
  check('a different key cannot read it', wrongKeyFails)

  // ---------------------------------------------------------------- 3. off by default
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as Record<string, any>
  const cleanSwitches = { ...(settings.questionnaire || {}), welcomeEmailOn: false, onlineOn: false, noticeApproved: false, noticeApprovedBy: '', noticeApprovedAt: null, sendWhen: 'confirmed' }
  check('fresh database: both switches off', !settings.questionnaire?.welcomeEmailOn && !settings.questionnaire?.onlineOn)
  await payload.updateGlobal({ slug: 'site-settings', data: { questionnaire: cleanSwitches }, overrideAccess: true, context: { noPublishNeeded: true } })
  let sw = await q.packSwitches(payload)
  check('switches off: no welcome, no online', !sw.welcome && !sw.online)
  for (const ref of ['APE-UNIT11', 'APE-UNIT12']) {
    await d.query(`DELETE FROM ape_bookings WHERE ref = $1`, [ref])
    await d.query(`INSERT INTO ape_bookings (ref, slot_start, name, email, phone, notes, price, special, status) VALUES ($1, now() + interval '${ref === 'APE-UNIT11' ? 401 : 402} days', 'Zelda Quartermaine', 'zelda.patient@example.com', '0499 111 222', '', 250, false, 'confirmed')`, [ref])
  }
  await payload.delete({ collection: 'questionnaires', where: { bookingRef: { in: ['APE-UNIT11', 'APE-UNIT12', 'APE-TEST01'] } }, overrideAccess: true })
  const b11 = (await d.query(`SELECT ref, name, email, slot_start FROM ape_bookings WHERE ref = 'APE-UNIT11'`))[0] as any
  let before = sent.length
  const off = await q.onBookingConfirmed(payload, b11)
  check('Mark confirmed with the welcome email off: nothing sent', !off.sent && off.reason === 'off' && sent.length === before)
  const manualOff = await q.sendWelcome(payload, b11, { manual: true, by: 'unit@example.com' })
  check('Send welcome pack by hand while off: refused', !manualOff.sent && sent.length === before)

  // ---------------------------------------------------------------- 4. welcome on, online off
  await payload.updateGlobal({ slug: 'site-settings', data: { questionnaire: { ...cleanSwitches, welcomeEmailOn: true } }, overrideAccess: true, context: { noPublishNeeded: true } })
  before = sent.length
  const on = await q.onBookingConfirmed(payload, b11)
  const m = sent[sent.length - 1]
  check('Mark confirmed with it on: sent', on.sent && sent.length === before + 1 && m.to[0] === 'zelda.patient@example.com')
  check('subject is "Your APE welcome pack and questionnaire"', m.subject === 'Your APE welcome pack and questionnaire', m.subject)
  check('both PDFs attached', m.attachments.map((a) => a.filename).sort().join(',') === 'APE-Patient-Guide.pdf,APE-Pre-appointment-Questionnaire.pdf' && m.attachments.every((a) => Buffer.from(a.fileblob, 'base64').subarray(0, 5).toString() === '%PDF-'))
  check('online off: no link, "bring it with you" instead', !/\/questionnaire\//.test(m.text) && /bring it with you/.test(m.text))
  check('where to go: address, train, parking, phone', /Cronulla Street/.test(m.text) && /Cronulla station/.test(m.text) && /Croydon Street council car park/.test(m.text) && /\(02\) 8599 9815/.test(m.text))
  check('no em dash in the email', !/\u2014/.test(m.text + m.html))
  const row11 = (await d.query(`SELECT welcome_status, welcome_count, welcome_sent_at FROM ape_bookings WHERE ref = 'APE-UNIT11'`))[0]
  check('the booking records the welcome email', row11.welcome_status === 'sent' && row11.welcome_count === 1 && !!row11.welcome_sent_at)
  before = sent.length
  const twice = await q.onBookingConfirmed(payload, b11)
  check('Mark confirmed again: not sent twice', !twice.sent && twice.reason === 'already sent' && sent.length === before)
  const byHand = await q.sendWelcome(payload, b11, { manual: true, by: 'lorna@example.com' })
  const row11b = (await d.query(`SELECT welcome_count, welcome_by FROM ape_bookings WHERE ref = 'APE-UNIT11'`))[0]
  check('Send welcome pack by hand: sent and logged', byHand.sent && row11b.welcome_count === 2 && row11b.welcome_by === 'lorna@example.com')
  const logged = await d.query(`SELECT count(*)::int AS n FROM ape_email_log WHERE ref = 'APE-UNIT11' AND kind = 'welcome' AND status = 'accepted'`)
  check('each welcome email is in the email log', logged[0].n === 2)

  // ---------------------------------------------------------------- 5. the online questionnaire needs the key and the approved notice
  await payload.updateGlobal({ slug: 'site-settings', data: { questionnaire: { ...cleanSwitches, welcomeEmailOn: true, onlineOn: true } }, overrideAccess: true, context: { noPublishNeeded: true } })
  sw = await q.packSwitches(payload)
  check('switched on without the key or approval: not live', !sw.online && sw.blockers.some((x) => /ENCRYPTION_KEY/.test(x)) && sw.blockers.some((x) => /not marked approved/.test(x)))
  process.env.QUESTIONNAIRE_ENCRYPTION_KEY = KEY
  sw = await q.packSwitches(payload)
  check('with the key but no approval: still not live', !sw.online && sw.blockers.length === 1)
  await payload.updateGlobal({ slug: 'site-settings', data: { questionnaire: { ...cleanSwitches, welcomeEmailOn: true, onlineOn: true, noticeApproved: true, noticeApprovedBy: 'unit@example.com', noticeApprovedAt: new Date().toISOString() } }, overrideAccess: true, context: { noPublishNeeded: true } })
  sw = await q.packSwitches(payload)
  check('key and approval: live', sw.online)
  process.env.QUESTIONNAIRE_ENABLED = 'false'
  check('QUESTIONNAIRE_ENABLED=false is an emergency off switch', !(await q.packSwitches(payload)).online)
  process.env.QUESTIONNAIRE_ENABLED = 'true'
  check('QUESTIONNAIRE_ENABLED=true does not turn anything on by itself', (await q.packSwitches(payload)).online)
  delete process.env.QUESTIONNAIRE_ENABLED

  const b12 = (await d.query(`SELECT ref, name, email, slot_start FROM ape_bookings WHERE ref = 'APE-UNIT12'`))[0] as any
  before = sent.length
  await q.onBookingConfirmed(payload, b12)
  const w12 = sent[sent.length - 1]
  const link = /https:\/\/theanxiouspatientexperience\.com\.au\/questionnaire\/([A-Za-z0-9_-]{43})/.exec(w12.text)
  check('online on: the email carries the private link', sent.length === before + 1 && !!link)
  const token = link![1]
  const stored = await payload.find({ collection: 'questionnaires', where: { bookingRef: { equals: 'APE-UNIT12' } }, overrideAccess: true, depth: 0 })
  check('the database keeps only the token hash', stored.docs.length === 1 && (stored.docs[0] as any).tokenHash === cr.hashToken(token) && !JSON.stringify(stored.docs[0]).includes(token))

  // key missing guard on the public side
  delete process.env.QUESTIONNAIRE_ENCRYPTION_KEY
  check('key missing: the link reads as off', (await q.lookupToken(payload, token)).state === 'off')
  process.env.QUESTIONNAIRE_ENCRYPTION_KEY = KEY

  // save and come back
  const saved = await q.saveDraft(payload, token, { q01: '4', q11: SECRET_ANSWER })
  const rowAfterSave = (await payload.find({ collection: 'questionnaires', where: { bookingRef: { equals: 'APE-UNIT12' } }, overrideAccess: true, depth: 0 })).docs[0] as any
  check('save for later: stored encrypted', saved.ok && !!rowAfterSave.draft && !rowAfterSave.draft.includes(SECRET_ANSWER) && rowAfterSave.status === 'sent')
  check('coming back: the saved answers are read back', q.readDraft(rowAfterSave).q01 === '4' && q.readDraft(rowAfterSave).q11 === SECRET_ANSWER)
  before = sent.length
  const noConsent = await q.submitAnswers(payload, token, raw, false)
  check('sending without the tick is refused', !noConsent.ok && (noConsent as any).state === 'consent')
  const teamList = (await (await import('../src/lib/recipients')).liveRecipients()).team.list
  const sub = await q.submitAnswers(payload, token, { ...raw, q02: ['Fear of being in pain', 'Other'] }, true)
  const rowAfterSubmit = (await payload.find({ collection: 'questionnaires', where: { bookingRef: { equals: 'APE-UNIT12' } }, overrideAccess: true, depth: 0 })).docs[0] as any
  check('sending: stored encrypted, draft cleared, team told', sub.ok && rowAfterSubmit.status === 'submitted' && !rowAfterSubmit.draft && !rowAfterSubmit.sealed.includes(SECRET_ANSWER) && sent.length === before + 1 && sent[sent.length - 1].to.join() === teamList.join())
  check('the link shows thank you once sent', (await q.lookupToken(payload, token)).state === 'submitted')
  check('no email so far contains an answer', sent.every((s) => !`${s.subject} ${s.text} ${s.html}`.includes(SECRET_ANSWER) && !/drill|Walking/.test(`${s.text} ${s.html}`)))
  check('the team notice has no patient name', !/Zelda|Quartermaine/.test(`${sent[sent.length - 1].subject} ${sent[sent.length - 1].text}`))

  // ---------------------------------------------------------------- 6. who can read answers
  const id = String(rowAfterSubmit.id)
  let denied = false
  try { await q.openQuestionnaire(payload, id, { id: 'e1', email: 'editor@example.com', role: 'editor', canViewQuestionnaires: false }) } catch (e) { denied = (e as { status?: number }).status === 403 }
  check('an editor without access is refused', denied)
  denied = false
  try { await q.openQuestionnaire(payload, id, { id: 'a1', email: 'admin@example.com', role: 'admin', canViewQuestionnaires: false }) } catch (e) { denied = (e as { status?: number }).status === 403 }
  check('an administrator without access is refused for a real patient', denied)
  const opened = await q.openQuestionnaire(payload, id, { id: 'l1', email: 'lorna@example.com', role: 'editor', canViewQuestionnaires: true })
  check('a person with access reads the answers', !!opened && opened.answers.q11 === SECRET_ANSWER && opened.form === form.FORM_ID)
  const logRows = await payload.find({ collection: 'questionnaire-log', where: { questionnaire: { equals: id } }, overrideAccess: true, depth: 0 })
  check('the refusals and the view are logged', logRows.docs.filter((x: any) => x.action === 'denied').length === 2 && logRows.docs.some((x: any) => x.action === 'viewed'))

  // ---------------------------------------------------------------- 7. test rows stay apart
  const tLink = await q.testLink(payload, 'tester@example.com', { ref: 'APE-TEST01', name: 'Test Patient GYA', email: 'tester@example.com', slot_start: new Date(Date.now() + 7 * 86400000) })
  const tToken = /questionnaire\/([A-Za-z0-9_-]+)/.exec(tLink || '')![1]
  check('a test row is made', (await q.lookupToken(payload, tToken)).test === true)
  check('test rows are not in the real list', !(await q.listQuestionnaires(payload)).some((r) => r.test) && (await q.listQuestionnaires(payload, { tests: true })).length >= 1)
  before = sent.length
  await q.submitAnswers(payload, tToken, { q01: '3' }, true)
  check('a test submission tells only the test address, marked TEST', sent.length === before + 1 && sent[sent.length - 1].to.join() === 'tester@example.com' && sent[sent.length - 1].subject.startsWith('[TEST]'))
  check('test rows do not count as "to review"', (await q.countUnreviewed(payload)) === (await payload.count({ collection: 'questionnaires', where: { and: [{ status: { equals: 'submitted' } }, { reviewed: { not_equals: true } }, { test: { not_equals: true } }] }, overrideAccess: true })).totalDocs)
  const tRow = (await q.listQuestionnaires(payload, { tests: true })).find((r) => r.testEmail === 'tester@example.com')!
  const adminOpen = await q.openQuestionnaire(payload, tRow.id, { id: 'a1', email: 'admin@example.com', role: 'admin', canViewQuestionnaires: false })
  check('an administrator can open a test row', !!adminOpen && adminOpen.answers.q01 === '3')
  await d.query(`UPDATE questionnaires SET created_at = now() - interval '25 hours' WHERE id = $1`, [tRow.id])
  await q.lookupToken(payload, 'x'.repeat(43))
  check('test rows are deleted after 24 hours', !(await q.listQuestionnaires(payload, { tests: true })).some((r) => r.id === tRow.id))

  // ---------------------------------------------------------------- tidy up
  await payload.delete({ collection: 'questionnaires', where: { bookingRef: { in: ['APE-UNIT11', 'APE-UNIT12', 'APE-TEST01'] } }, overrideAccess: true })
  await payload.delete({ collection: 'questionnaire-log', where: { bookingRef: { in: ['APE-UNIT11', 'APE-UNIT12', 'APE-TEST01'] } }, overrideAccess: true })
  await d.query(`DELETE FROM ape_bookings WHERE ref IN ('APE-UNIT11', 'APE-UNIT12')`)
  await d.query(`DELETE FROM ape_email_log WHERE ref IN ('APE-UNIT11', 'APE-UNIT12', 'APE-TEST01')`)
  await payload.updateGlobal({ slug: 'site-settings', data: { questionnaire: cleanSwitches }, overrideAccess: true, context: { noPublishNeeded: true } })
  server.close()
  console.log(failures ? `\n${failures} failed` : '\nall questionnaire tests passed')
  process.exit(failures ? 1 : 0)
}

void main()
