/**
 * v1.18.0: treatment plans, with SMTP2GO replaced by a local stand-in. Needs a TEST database (DATABASE_URL) that has
 * been migrated: it adds logins and bookings marked UNIT-PLAN and removes them again. Never run it against the live
 * database. A throwaway encryption key is made in memory for the run and never printed.
 *
 *   DATABASE_URL=<a test database> PAYLOAD_SECRET=<any> npm run test:plans
 *
 * Checks: the four conditions and the emergency switch; every route refuses without a login (401) and without the
 * permission (403), including the PDF, the send and the patient link; content is encrypted at rest; drafts,
 * finalising, required fields and versions; form versions; the PDF; the three ways of sending; the patient link
 * (date of birth, expiry, revoke, made-up tokens, rate limits); no plan content in any email, subject, log line,
 * address or the audit log; the audit log records every action; retention; delete; the tables set up twice.
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
let passes = 0
function check(name: string, ok: boolean, extra = '') {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}\n`)
  if (ok) passes++; else failures++
}
const logged: string[] = []
function capture<T>(fn: () => Promise<T>): Promise<T> {
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info }
  const grab = (...a: unknown[]) => { logged.push(a.map((x) => (x instanceof Error ? `${x.message} ${x.stack}` : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')) }
  console.log = grab; console.error = grab; console.warn = grab; console.info = grab
  return fn().finally(() => Object.assign(console, orig))
}

async function main() {
  if (!process.env.DATABASE_URL) { console.log('test:plans needs a TEST database in DATABASE_URL'); process.exit(1) }
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
  const port = (server.address() as AddressInfo).port
  process.env.SMTP2GO_API_KEY = 'unit-test'
  process.env.SMTP2GO_ENDPOINT = `http://127.0.0.1:${port}/v3/email/send`
  process.env.BOOKING_FROM = 'The Anxious Patient Experience <bookings@example.com>'
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://theanxiouspatientexperience.com.au'
  delete process.env.RESEND_API_KEY
  delete process.env.TREATMENT_PLAN_ENCRYPTION_KEY
  delete process.env.TREATMENT_PLANS_ENABLED

  const core = await import('../src/booking/core')
  const store = await import('../src/plans/store')
  const form = await import('../src/plans/form')
  const access = await import('../src/lib/access')
  const cryptoLib = await import('../src/lib/crypto')
  const { getPayload } = await import('payload')
  const config = (await import('../src/payload.config')).default
  const payload = await getPayload({ config })
  const d = core.db()!
  await core.ensureSchema(d, core.loadConfig())
  await store.ensurePlanSchema(d)

  // ------------------------------------------------------------ a clean start for the test rows
  await d.query(`DELETE FROM ape_plans WHERE booking_ref LIKE 'APE-PLN%'`)
  await d.query(`DELETE FROM ape_plan_log WHERE booking_ref LIKE 'APE-PLN%' OR by_email LIKE 'unit-plan-%'`)
  await d.query(`DELETE FROM ape_rate`)
  const keepForms = await d.query(`SELECT max(version) AS v FROM ape_plan_forms`)
  const keepSettings = await d.query(`SELECT value FROM ape_meta WHERE key = 'plans'`)
  await d.query(`DELETE FROM ape_meta WHERE key = 'plans'`)
  const privacy = await d.query(`SELECT id, title FROM pages WHERE page_slug = 'privacy-policy'`)
  // v1.18.1: the build publishes privacy section 15; hide it for the test (put back at the end) so the condition can be seen to change
  const section15 = await d.query(`SELECT id, text FROM pages_sections_content WHERE text ~* '\\m\\d{1,2}\\.\\s+(your\\s+)?treatment\\s+plans?\\M'`) as { id: string; text: string }[]
  for (const r of section15) await d.query(`UPDATE pages_sections_content SET text = 'Unit test: section hidden' WHERE id = $1`, [r.id])
  await d.query(`UPDATE users SET can_treatment_plans = false`)

  const PW = 'unit-test-Password-1'
  const mk = async (email: string, role: 'admin' | 'editor', name: string, extra: Record<string, unknown> = {}) => {
    await payload.delete({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true }).catch(() => {})
    const u = await payload.create({ collection: 'users', data: { email, password: PW, role, name, mustChangePassword: false, ...extra } as any, overrideAccess: true })
    const r = await payload.login({ collection: 'users', data: { email, password: PW } })
    return { id: u.id, email, h: { Authorization: `JWT ${r.token}` } }
  }
  const lorna = await mk('unit-plan-lorna@example.com', 'editor', 'Lorna Unit', { practiceOwner: true })
  const alex = await mk('unit-plan-alex@example.com', 'editor', 'Alex Unit')
  const sam = await mk('unit-plan-sam@example.com', 'editor', 'Sam Unit')
  const gya = await mk('unit-plan-gya@example.com', 'admin', 'GYA Unit')
  const gya2 = await mk('unit-plan-gya2@example.com', 'admin', 'GYA Two')

  const PATIENT = { first: 'Zelda', last: 'Quartermaine', email: 'unit-plan-patient@example.com', dob: '1990-03-14' }
  const REF = 'APE-PLN001', TEEN = 'APE-PLN002', NODOB = 'APE-PLN003'
  await d.query(`DELETE FROM ape_bookings WHERE ref LIKE 'APE-PLN%'`)
  const addBooking = (ref: string, dob: string | null, daysAhead: number) => d.query(`INSERT INTO ape_bookings (ref, slot_start, name, email, phone, notes, price, status, first_name, last_name, dob, deposit_status, deposit_paid)
    VALUES ($1, now() + ($2 || ' days')::interval, $3, $4, '0499 111 222', 'UNIT-PLAN', 350, 'confirmed', $5, $6, $7, 'paid', true)`, [ref, String(daysAhead), `${PATIENT.first} ${PATIENT.last}`, PATIENT.email, PATIENT.first, PATIENT.last, dob])
  await addBooking(REF, PATIENT.dob, 7)
  await addBooking(TEEN, '2012-05-05', 7)
  await addBooking(NODOB, null, 7)

  const R = await import('../src/app/api/dashboard/plans/route')
  const PDF = await import('../src/app/api/dashboard/plans/pdf/route')
  const OPEN = await import('../src/app/(site)/plan/[token]/open/route')
  const post = async (h: Record<string, string> | null, body: unknown) => { const r = await R.POST(new Request('http://localhost/api/dashboard/plans', { method: 'POST', headers: { 'content-type': 'application/json', ...(h || {}) }, body: JSON.stringify(body) })); return { status: r.status, j: await r.json().catch(() => ({})) as any } }
  const get = async (h: Record<string, string> | null, qs = '') => { const r = await R.GET(new Request(`http://localhost/api/dashboard/plans${qs ? `?${qs}` : ''}`, { headers: h || {} })); return { status: r.status, j: await r.json().catch(() => ({})) as any } }
  const pdf = async (h: Record<string, string> | null, qs: string) => PDF.GET(new Request(`http://localhost/api/dashboard/plans/pdf?${qs}`, { headers: h || {} }))
  const open = async (token: string, fields: Record<string, string> = {}, ip = '10.0.0.1') => {
    const f = new URLSearchParams(fields)
    return OPEN.POST(new Request(`http://localhost/plan/${token}/open`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip }, body: f.toString() }), { params: Promise.resolve({ token }) })
  }

  const MARKER = 'UNIT-PLAN-FINDING-8842'
  const FEE = '4321.09'

  await capture(async () => {
    // ---------------------------------------------------------- 1. off until all four conditions hold
    let sw = await store.switches(payload)
    const cond = (k: string) => sw.conditions.find((c) => c.key === k)!.ok
    check('off at first: no key, placeholder form, no privacy section, nobody with the permission', !sw.on && !cond('key') && !cond('approved') && !cond('privacy') && !cond('people'), JSON.stringify(sw.conditions.map((c) => [c.key, c.ok])))
    const sg = await get(sam.h, 'switches=1')
    check('the dashboard lists the four conditions and which are missing, for anyone signed in', sg.status === 200 && sg.j.switches.conditions.length === 4 && sg.j.switches.conditions.every((c: any) => typeof c.ok === 'boolean' && c.text && c.detail))
    check('no login: refused (401)', (await get(null, 'switches=1')).status === 401 && (await post(null, { action: 'create', ref: REF })).status === 401 && (await pdf(null, 'id=1')).status === 401)

    process.env.TREATMENT_PLAN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
    sw = await store.switches(payload)
    check('the key set: that condition is met, still off', cond('key') && !sw.on)
    check('a key of the wrong length does not count', (() => { const k = process.env.TREATMENT_PLAN_ENCRYPTION_KEY; process.env.TREATMENT_PLAN_ENCRYPTION_KEY = 'c2hvcnQ='; const ok = !cryptoLib.planKeyReady(); process.env.TREATMENT_PLAN_ENCRYPTION_KEY = k; return ok })())

    // the permission: only the practice owner or GYA can give it, and it is logged
    const byEditor = await access.setPlanAccess(payload, { email: alex.email, role: 'editor' }, sam.id, true)
    check('an ordinary editor cannot give the permission', !byEditor.ok)
    check('the practice owner gives it to Alex and to herself', (await access.setPlanAccess(payload, { email: lorna.email, role: 'editor', practiceOwner: true }, alex.id, true)).ok && (await access.setPlanAccess(payload, { email: lorna.email, role: 'editor', practiceOwner: true }, lorna.id, true)).ok)
    check('GYA gives it to a second GYA login (for the delete test)', (await access.setPlanAccess(payload, { email: gya.email, role: 'admin' }, gya2.id, true)).ok)
    const accessLog = await d.query(`SELECT change FROM ape_access_log WHERE for_email IN ($1, $2) ORDER BY id DESC LIMIT 5`, [alex.email, gya2.email])
    check('giving the permission is logged', accessLog.some((x) => x.change === 'treatment plans: given'))
    sw = await store.switches(payload)
    check('people with the permission: that condition is met', cond('people') && sw.people >= 2)

    // the form: the placeholder cannot be approved; a new version saved by GYA waits for approval
    check('the placeholder form cannot be approved', (await post(gya.h, { action: 'approve', version: 1, by: 'x' })).status === 400)
    const FORM = {
      title: 'Your Personal Treatment Plan', subtitle: 'The Anxious Patient Experience',
      sections: [
        { id: 'a', heading: 'Dear {first_name}', items: [{ id: 'p1', type: 'paragraph', label: 'Opening', text: 'Thank you for trusting us with your care, {first_name}.' }] },
        { id: 'b', heading: 'What we discussed', items: [
          { id: 'found', type: 'textarea', label: 'What we found', required: true },
          { id: 'treat', type: 'rows', label: 'Recommended treatment', total: true, columns: [{ id: 'what', label: 'Treatment', type: 'text' }, { id: 'mins', label: 'Minutes', type: 'number' }, { id: 'fee', label: 'Fee', type: 'currency' }] },
        ] },
        { id: 'c', heading: 'Comfort', items: [
          { id: 'opts', type: 'choice', label: 'Comfort options', multiple: true, options: ['Breaks whenever you need them', 'Headphones and music'] },
          { id: 'pace', type: 'choice', label: 'Pace', options: ['Short visits', 'Longer visits'] },
          { id: 'next', type: 'date', label: 'Next appointment' }, { id: 'n', type: 'number', label: 'Visits' }, { id: 'dep', type: 'currency', label: 'Deposit taken' },
          { id: 'ok', type: 'checkbox', label: 'Payment plan discussed' }, { id: 'note', type: 'text', label: 'Note' },
          { id: 'box', type: 'callout', label: 'A reminder', text: 'This plan is yours.' },
        ] },
      ],
    }
    const saved = await post(gya.h, { action: 'form', form: FORM })
    check('GYA saves a new form version: it waits for approval', saved.status === 200 && saved.j.form.version >= 2 && !saved.j.form.approvedAt)
    const V2 = saved.j.form.version
    sw = await store.switches(payload)
    check('a form waiting for approval keeps it off', !cond('approved') && !sw.on)
    check('an ordinary editor cannot record approval', (await post(alex.h, { action: 'approve', version: V2, by: 'Dr Lorna Gladwin' })).status === 403)
    const appr = await post(gya.h, { action: 'approve', version: V2, by: 'Dr Lorna Gladwin, email 26 Nov 2026' })
    check('GYA records Lorna\'s approval with the date', appr.status === 200 && !!appr.j.form.approvedAt && /Dr Lorna Gladwin, email 26 Nov 2026/.test(appr.j.form.approvedBy))
    sw = await store.switches(payload)
    check('approved: that condition is met; still off without the privacy section', cond('approved') && !cond('privacy') && !sw.on)
    await d.query(`UPDATE pages SET title = 'Privacy Policy 15. Your treatment plan' WHERE page_slug = 'privacy-policy'`)
    sw = await store.switches(payload)
    check('all four met: on', sw.on && sw.conditions.every((c) => c.ok))
    process.env.TREATMENT_PLANS_ENABLED = 'false'
    sw = await store.switches(payload)
    check('TREATMENT_PLANS_ENABLED=false is an emergency off switch', !sw.on && sw.emergencyOff)
    process.env.TREATMENT_PLANS_ENABLED = 'true'
    sw = await store.switches(payload)
    check('TREATMENT_PLANS_ENABLED=true does not turn anything on by itself (it is on because the four are met)', sw.on)
    delete process.env.TREATMENT_PLANS_ENABLED

    // ---------------------------------------------------------- 2. the permission, on every route
    const created = await post(alex.h, { action: 'create', ref: REF })
    check('Alex (with the permission) creates a plan from a booking', created.status === 200 && created.j.id > 0)
    const ID = created.j.id
    const denied: [string, number][] = [
      ['list', (await get(sam.h)).status], ['open', (await get(sam.h, `id=${ID}`)).status], ['by booking', (await get(sam.h, `ref=${REF}`)).status],
      ['create', (await post(sam.h, { action: 'create', ref: REF })).status], ['save', (await post(sam.h, { action: 'save', id: ID, answers: {} })).status],
      ['finalise', (await post(sam.h, { action: 'finalise', id: ID })).status], ['version', (await post(sam.h, { action: 'version', id: ID })).status],
      ['send', (await post(sam.h, { action: 'send', planNo: 1, to: PATIENT.email, confirm: true })).status], ['revoke', (await post(sam.h, { action: 'revoke', planNo: 1 })).status],
      ['PDF', (await pdf(sam.h, `id=${ID}`)).status], ['print', (await pdf(sam.h, `id=${ID}&print=1`)).status], ['preview', (await pdf(sam.h, `id=${ID}&preview=1`)).status],
      ['GYA without the permission: list', (await get(gya.h)).status], ['GYA without the permission: open', (await get(gya.h, `id=${ID}`)).status], ['GYA without the permission: PDF', (await pdf(gya.h, `id=${ID}`)).status],
      ['GYA without the permission: delete', (await post(gya.h, { action: 'delete', planNo: 1, confirm: 'DELETE' })).status],
    ]
    check('without the permission every plan route refuses (403), including the PDF and the send', denied.every(([, s]) => s === 403), denied.filter(([, s]) => s !== 403).map(([n, s]) => `${n}:${s}`).join(', '))
    check('every refusal is logged', Number((await d.query(`SELECT count(*)::int AS n FROM ape_plan_log WHERE action = 'denied' AND by_email IN ($1, $2)`, [sam.email, gya.email]))[0].n) >= denied.length)
    check('the audit log is for administrators only', (await get(alex.h, 'log=1')).status === 403 && (await get(gya.h, 'log=1')).status === 200)
    check('a plan for a booking that does not exist is refused (404)', (await post(alex.h, { action: 'create', ref: 'APE-NOPE00' })).status === 404)

    // ---------------------------------------------------------- 3. content encrypted at rest
    const one = await get(alex.h, `id=${ID}`)
    check('the plan opens with the booking\'s name, date of birth and reference (never typed)', one.j.plan.identity.name === 'Zelda Quartermaine' && one.j.plan.identity.dob === PATIENT.dob && one.j.plan.bookingRef === REF && one.j.plan.formVersion === V2)
    const answers = { found: `${MARKER} lower left`, treat: [{ what: 'Filling upper right', mins: '45', fee: FEE }, { what: 'Clean and polish', mins: '30', fee: '180' }], opts: ['Breaks whenever you need them'], pace: 'Short visits', next: '2027-01-13', n: '3', dep: '100', ok: true, note: 'Prefers mornings', junk: 'dropped' }
    const sv = await post(alex.h, { action: 'save', id: ID, answers })
    check('a draft saves', sv.status === 200)
    const back = (await get(alex.h, `id=${ID}`)).j.plan.answers
    check('coming back: the answers read back as saved (unknown fields dropped, fees as typed)', back.found === answers.found && back.treat[0].fee === '4321.09' && back.treat[1].fee === '180.00' && back.ok === true && !('junk' in back))
    const raw = JSON.stringify(await d.query(`SELECT * FROM ape_plans WHERE id = $1`, [ID]))
    const rowNoCipher = JSON.stringify((await d.query(`SELECT * FROM ape_plans WHERE id = $1`, [ID])).map((x) => ({ ...x, sealed: '' })))
    const sealedOnly = JSON.parse((await d.query(`SELECT sealed FROM ape_plans WHERE id = $1`, [ID]))[0].sealed)
    check('a database row on its own gives nothing away (no name, date of birth, finding or fee)', !raw.includes(MARKER) && !/Zelda|Quartermaine|1990-03-14|4321\.09|Filling/.test(rowNoCipher) && !Buffer.from(sealedOnly.data, 'base64').toString('latin1').includes('Zelda') && !!sealedOnly.iv && !!sealedOnly.tag)
    const otherKey = crypto.randomBytes(32)
    const row0 = (await d.query(`SELECT sealed FROM ape_plans WHERE id = $1`, [ID]))[0]
    const { unseal } = await import('../src/lib/crypto')
    let wrong = false
    try { unseal(JSON.parse(row0.sealed), otherKey) } catch { wrong = true }
    check('another key (the questionnaire key, say) cannot read it', wrong)

    // ---------------------------------------------------------- 4. finalise, versions
    await post(alex.h, { action: 'save', id: ID, answers: { ...answers, found: '' } })
    const fin0 = await post(alex.h, { action: 'finalise', id: ID })
    check('finalising with a required field empty is refused, naming it', fin0.status === 400 && /What we found/.test(fin0.j.message || ''))
    await post(alex.h, { action: 'save', id: ID, answers })
    check('a draft cannot be printed or downloaded (only previewed)', (await pdf(alex.h, `id=${ID}`)).status === 409 && (await pdf(alex.h, `id=${ID}&preview=1`)).status === 200)
    check('a draft cannot be sent', (await post(alex.h, { action: 'send', planNo: one.j.plan.planNo, to: PATIENT.email, confirm: true })).status === 409)
    check('finalise', (await post(alex.h, { action: 'finalise', id: ID })).status === 200)
    const f1 = (await get(alex.h, `id=${ID}`)).j.plan
    check('finalising stamps the date and who', f1.status === 'final' && !!f1.finalisedAt && f1.finalisedBy === alex.email)
    const sealedV1 = (await d.query(`SELECT sealed FROM ape_plans WHERE id = $1`, [ID]))[0].sealed
    check('a finalised plan cannot be edited in place (409)', (await post(alex.h, { action: 'save', id: ID, answers: { found: 'changed' } })).status === 409 && (await d.query(`SELECT sealed FROM ape_plans WHERE id = $1`, [ID]))[0].sealed === sealedV1)
    check('nor finalised again', (await post(alex.h, { action: 'finalise', id: ID })).status === 409)
    const v2 = await post(lorna.h, { action: 'version', id: ID })
    check('"Change this plan" makes version 2 as a draft copy', v2.status === 200 && v2.j.id !== ID)
    const p2 = (await get(lorna.h, `id=${v2.j.id}`)).j.plan
    check('version 2 starts with version 1\'s answers, on the same form version', p2.version === 2 && p2.status === 'draft' && p2.answers.found === answers.found && p2.formVersion === V2)
    await post(lorna.h, { action: 'save', id: v2.j.id, answers: { ...answers, found: `${MARKER} lower left, and upper right` } })
    check('version 1 is kept exactly as it was', (await d.query(`SELECT sealed, status FROM ape_plans WHERE id = $1`, [ID]))[0].sealed === sealedV1 && (await get(lorna.h, `id=${ID}`)).j.plan.answers.found === answers.found)
    check('only the newest version can be changed again', (await post(lorna.h, { action: 'version', id: ID })).status === 409)
    check('finalise version 2', (await post(lorna.h, { action: 'finalise', id: v2.j.id })).status === 200)
    const planNo = p2.planNo

    // a later change to the form does not change plans already written
    const FORM3 = { ...FORM, sections: [...FORM.sections, { id: 'd', heading: 'Added later', items: [{ id: 'extra', type: 'text', label: 'Extra' }] }] }
    const s3 = await post(lorna.h, { action: 'form', form: FORM3 })
    check('the practice owner saves form version 3: approved by her when saving', s3.status === 200 && !!s3.j.form.approvedAt && /practice owner/.test(s3.j.form.approvedBy))
    check('plans already written keep their own form version', (await get(lorna.h, `id=${ID}`)).j.plan.form.sections.length === 3 && (await get(lorna.h, `id=${ID}`)).j.plan.formVersion === V2)
    check('a new plan uses the newest form', (await get(alex.h, `id=${(await post(alex.h, { action: 'create', ref: NODOB })).j.id}`)).j.plan.formVersion === s3.j.form.version)
    check('a form without a title or fields is refused', (await post(lorna.h, { action: 'form', form: { title: '', sections: [] } })).status === 400 && (await post(lorna.h, { action: 'form', form: { title: 'x', sections: [{ heading: 'y', items: [{ type: 'paragraph', text: 'only words' }] }] } })).status === 400)
    check('dashes in form wording are taken out', form.cleanForm({ title: `A${String.fromCharCode(0x2014)}B`, sections: [{ heading: 'x', items: [{ type: 'text', label: `One ${String.fromCharCode(0x2013)} two` }] }] }).sections[0].items[0].label === 'One, two')

    // ---------------------------------------------------------- 5. the PDF and printing
    const dl = await pdf(alex.h, `id=${v2.j.id}`)
    const bytes = Buffer.from(await dl.arrayBuffer())
    check('download: a PDF, never cached, as an attachment', dl.status === 200 && bytes.subarray(0, 5).toString() === '%PDF-' && dl.headers.get('cache-control') === 'no-store' && /attachment/.test(dl.headers.get('content-disposition') || ''))
    check('the file name has no patient name in it', !/Zelda|Quartermaine/.test(dl.headers.get('content-disposition') || ''))
    const pr = await pdf(alex.h, `id=${v2.j.id}&print=1`)
    check('print: the same PDF, shown in the browser', pr.status === 200 && /inline/.test(pr.headers.get('content-disposition') || '') && Buffer.from(await pr.arrayBuffer()).subarray(0, 5).toString() === '%PDF-')

    // ---------------------------------------------------------- 6. sending: the secure link
    const before = sent.length
    check('sending needs the confirm step', (await post(alex.h, { action: 'send', planNo, to: PATIENT.email })).status === 400)
    check('sending to any address but the booking\'s is refused', (await post(alex.h, { action: 'send', planNo, to: 'someone-else@example.com', confirm: true })).status === 409 && sent.length === before)
    const s1 = await post(alex.h, { action: 'send', planNo, to: PATIENT.email, confirm: true })
    check('send (secure link, the default)', s1.status === 200 && s1.j.method === 'link' && s1.j.version === 2 && !s1.j.password)
    const m1 = sent[sent.length - 1]
    check('the email goes to the address on the booking', m1.to.join() === PATIENT.email && !m1.attachments.length)
    const token1 = /\/plan\/([A-Za-z0-9_-]{30,60})\//.exec(m1.text)?.[1] || ''
    check('the email carries a private link (a long random token)', token1.length >= 40 && m1.html.includes(`/plan/${token1}/`))
    check('the link is never stored, only its hash', !JSON.stringify(await d.query(`SELECT * FROM ape_plan_links`)).includes(token1))
    const sendRow = (await d.query(`SELECT * FROM ape_plan_sends WHERE plan_id = $1 ORDER BY id DESC LIMIT 1`, [v2.j.id]))[0]
    check('the send is recorded: who, when, to which address, how and which version', sendRow.by_email === alex.email && sendRow.to_email === PATIENT.email && sendRow.method === 'link' && sendRow.version === 2 && sendRow.ok)

    // the patient opens it
    const look = await store.lookupLink(payload, token1)
    check('the link leads to version 2 and asks for the date of birth', look.state === 'ok' && (look as any).version === 2 && (look as any).askDob)
    const noDob = await open(token1, {})
    check('no date of birth: back to the page with a calm message', noDob.status === 303 && /\?e=dob$/.test(noDob.headers.get('location') || ''))
    const badDob = await open(token1, { d: '15', m: '3', y: '1990' })
    check('a wrong date of birth: back with the same message', badDob.status === 303 && /\?e=dob$/.test(badDob.headers.get('location') || ''))
    const good = await open(token1, { d: '14', m: '3', y: '1990' })
    const gb = Buffer.from(await good.arrayBuffer())
    check('the right date of birth: the PDF, not cached, no referrer', good.status === 200 && gb.subarray(0, 5).toString() === '%PDF-' && good.headers.get('cache-control') === 'no-store' && good.headers.get('referrer-policy') === 'no-referrer')
    check('the link records that it was opened', Number((await d.query(`SELECT open_count FROM ape_plan_links WHERE token_hash = $1`, [crypto.createHash('sha256').update(token1).digest('hex')]))[0].open_count) === 1)

    // made-up, revoked and expired links all look the same
    const fake = 'Zk3mQ9xT7bLp2VnR4sWd8YhCZk3mQ9xT7bLp2VnR4sW'
    const fk = await open(fake, { d: '14', m: '3', y: '1990' })
    check('a made-up token gives the same page as an expired one, and no plan', fk.status === 303 && fk.headers.get('location') === `/plan/${fake}/` && (await store.lookupLink(payload, fake)).state === 'gone' && (await store.lookupLink(payload, 'short')).state === 'gone')
    const resend = await post(alex.h, { action: 'send', planNo, to: PATIENT.email, confirm: true })
    const token2 = /\/plan\/([A-Za-z0-9_-]{30,60})\//.exec(sent[sent.length - 1].text)?.[1] || ''
    check('resend: a new link, and the earlier one stops working', resend.status === 200 && !!token2 && token2 !== token1 && (await store.lookupLink(payload, token1)).state === 'gone' && (await store.lookupLink(payload, token2)).state === 'ok')
    const rv = await post(alex.h, { action: 'revoke', planNo })
    check('revoke access: the link stops working', rv.status === 200 && rv.j.revoked === 1 && (await store.lookupLink(payload, token2)).state === 'gone')
    const afterRevoke = await open(token2, { d: '14', m: '3', y: '1990' })
    check('a revoked link gives the calm page, not an error', afterRevoke.status === 303 && afterRevoke.headers.get('location') === `/plan/${token2}/`)
    await post(alex.h, { action: 'send', planNo, to: PATIENT.email, confirm: true })
    const token3 = /\/plan\/([A-Za-z0-9_-]{30,60})\//.exec(sent[sent.length - 1].text)?.[1] || ''
    await d.query(`UPDATE ape_plan_links SET expires_at = now() - interval '1 minute' WHERE token_hash = $1`, [crypto.createHash('sha256').update(token3).digest('hex')])
    check('an expired link gives the calm page', (await store.lookupLink(payload, token3)).state === 'gone' && (await open(token3, { d: '14', m: '3', y: '1990' })).headers.get('location') === `/plan/${token3}/`)

    // five wrong dates of birth revoke the link; too many tries from one address are slowed
    await post(alex.h, { action: 'send', planNo, to: PATIENT.email, confirm: true })
    const token4 = /\/plan\/([A-Za-z0-9_-]{30,60})\//.exec(sent[sent.length - 1].text)?.[1] || ''
    for (let n = 0; n < 5; n++) await open(token4, { d: '1', m: '1', y: '2000' }, `10.0.1.${n}`)
    check('five wrong dates of birth revoke the link', (await store.lookupLink(payload, token4)).state === 'gone')
    await d.query(`DELETE FROM ape_rate`)
    let busy = 0
    for (let n = 0; n < 22; n++) { const r = await open(fake, {}, '10.9.9.9'); if (/e=busy/.test(r.headers.get('location') || '')) busy++ }
    check('rate limit: after 20 tries in 10 minutes from one address, "please wait"', busy === 2, String(busy))
    await d.query(`DELETE FROM ape_rate`)

    // the plan pages are off when the feature is off, whatever the link
    await post(alex.h, { action: 'send', planNo, to: PATIENT.email, confirm: true })
    const token5 = /\/plan\/([A-Za-z0-9_-]{30,60})\//.exec(sent[sent.length - 1].text)?.[1] || ''
    process.env.TREATMENT_PLANS_ENABLED = 'false'
    check('switched off: a live link opens nothing', (await store.lookupLink(payload, token5)).state === 'off' && (await open(token5, { d: '14', m: '3', y: '1990' })).status === 303)
    check('switched off: every dashboard plan route refuses, even with the permission (409)', (await get(alex.h)).status === 409 && (await pdf(alex.h, `id=${v2.j.id}`)).status === 409 && (await post(alex.h, { action: 'send', planNo, to: PATIENT.email, confirm: true })).status === 409)
    delete process.env.TREATMENT_PLANS_ENABLED
    await post(alex.h, { action: 'revoke', planNo })

    // ---------------------------------------------------------- 7. the password and the plain attachment
    check('settings: GYA chooses the password protected PDF', (await post(gya.h, { action: 'settings', sendMode: 'password' })).status === 200)
    const sp = await post(alex.h, { action: 'send', planNo, to: PATIENT.email, confirm: true })
    const mp = sent[sent.length - 1]
    const PWD = sp.j.password as string
    const att = Buffer.from(mp.attachments[0]?.fileblob || '', 'base64')
    check('password send: the PDF is attached and encrypted; the password comes back once', sp.status === 200 && /^[a-z]+-[a-z]+-[a-z]+-\d{4}$/.test(PWD || '') && mp.attachments.length === 1 && att.subarray(0, 5).toString() === '%PDF-' && att.includes(Buffer.from('/Encrypt')))
    check('the password is never in the email', !`${mp.subject} ${mp.text} ${mp.html}`.includes(PWD) && /phone or text message/.test(mp.text))
    check('the attachment name has no patient name in it', /^APE-treatment-plan-v2\.pdf$/.test(mp.attachments[0].filename))
    await post(gya.h, { action: 'settings', sendMode: 'attachment' })
    const sa = await post(alex.h, { action: 'send', planNo, to: PATIENT.email, confirm: true })
    const ma = sent[sent.length - 1]
    const plain = Buffer.from(ma.attachments[0]?.fileblob || '', 'base64')
    check('plain attachment: the PDF attached, no password', sa.status === 200 && !sa.j.password && plain.subarray(0, 5).toString() === '%PDF-' && !plain.includes(Buffer.from('/Encrypt')))
    await post(gya.h, { action: 'settings', sendMode: 'link' })

    // ---------------------------------------------------------- 8. no plan content anywhere it should not be
    const mails = sent.slice(before)
    const mailText = mails.map((m) => `${m.subject}\n${m.text}\n${m.html}`).join('\n')
    check('no plan content in any email or subject line (findings, treatments, fees, date of birth)', !mailText.includes(MARKER) && !/Filling|Clean and polish|4,?321|\$180|1990|14 March|Prefers mornings/.test(mailText))
    check('the subject line is the same for every patient', mails.every((m) => m.subject === 'Your treatment plan from The Anxious Patient Experience'))
    const sqlLogs = JSON.stringify(await d.query(`SELECT * FROM ape_plan_log`)) + JSON.stringify(await d.query(`SELECT * FROM ape_plan_sends`)) + JSON.stringify(await d.query(`SELECT * FROM ape_email_log WHERE ref LIKE 'APE-PLN%'`))
    check('no plan content or password in the audit log, the send records or the email log', !sqlLogs.includes(MARKER) && !/Filling|4321|Prefers mornings/.test(sqlLogs) && !sqlLogs.includes(PWD))
    check('no plan content, password or link token in anything written to the server logs', !logged.join('\n').includes(MARKER) && !logged.join('\n').includes(PWD) && ![token1, token2, token3, token4].some((t) => logged.join('\n').includes(t)))
    check('addresses carry only the plan id or the token, never content', mails.every((m) => !/\?[^"\s]*(found|treat|dob|name)=/i.test(m.html)))

    // ---------------------------------------------------------- 9. the audit log
    const acts = new Set((await d.query(`SELECT action FROM ape_plan_log WHERE booking_ref = $1 OR by_email LIKE 'unit-plan-%'`, [REF])).map((x) => x.action))
    const want = ['created', 'edited', 'finalised', 'new version', 'viewed', 'printed', 'downloaded', 'sent', 'revoked', 'patient opened', 'patient date of birth wrong', 'denied', 'form saved', 'form approved', 'settings changed']
    check('the audit log records every action', want.every((a) => acts.has(a)), want.filter((a) => !acts.has(a)).join(', '))
    const lg = await get(gya.h, `log=1&plan=${planNo}`)
    check('administrators read the log for one plan: who and when', lg.status === 200 && lg.j.log.length > 5 && lg.j.log.every((x: any) => x.at && x.by && x.action))
    const edits = await d.query(`SELECT times FROM ape_plan_log WHERE action = 'edited' AND plan_no = $1 AND version = 1`, [planNo])
    check('repeated saves by one person are counted on one line', edits.length >= 1 && edits.some((x) => Number(x.times) >= 2))

    // ---------------------------------------------------------- 10. retention and delete
    const teen = await post(alex.h, { action: 'create', ref: TEEN })
    const tp = (await get(alex.h, `id=${teen.j.id}`)).j.plan
    check('retention: under 18 at the appointment, kept until they turn 25', tp.retainUntil === '2037-05-05', tp.retainUntil)
    const ad = (await get(alex.h, `id=${ID}`)).j.plan
    const appt = new Date(ad.identity.appointmentAt)
    check('retention: an adult, 7 years after the appointment', ad.retainUntil === new Date(Date.UTC(appt.getUTCFullYear() + 7, appt.getUTCMonth(), appt.getUTCDate())).toISOString().slice(0, 10) || Math.abs(Date.parse(ad.retainUntil) - (appt.getTime() + 7 * 365.25 * 86400000)) < 3 * 86400000, ad.retainUntil)
    check('only administrators delete: an editor with the permission is refused', (await post(alex.h, { action: 'delete', planNo, confirm: 'DELETE' })).status === 403)
    check('delete needs the confirm word', (await post(gya2.h, { action: 'delete', planNo })).status === 400)
    check('GYA (with the permission) deletes every version', (await post(gya2.h, { action: 'delete', planNo, confirm: 'DELETE' })).status === 200 && !(await d.query(`SELECT 1 FROM ape_plans WHERE plan_no = $1`, [planNo])).length && !(await d.query(`SELECT 1 FROM ape_plan_sends s LEFT JOIN ape_plans p ON p.id = s.plan_id WHERE p.id IS NULL`)).length)
    check('the log keeps a line saying it was deleted', (await d.query(`SELECT 1 FROM ape_plan_log WHERE action = 'deleted' AND plan_no = $1`, [planNo])).length === 1)

    // ---------------------------------------------------------- 11. the tables set up twice
    const shape = async () => JSON.stringify(await d.query(`SELECT table_name, column_name, data_type, column_default FROM information_schema.columns WHERE table_name LIKE 'ape_plan%' ORDER BY 1, 2`))
    const sh1 = await shape()
    await d.query(`SELECT 1`)
    for (const stmt of ['CREATE TABLE IF NOT EXISTS ape_plans (id serial PRIMARY KEY)']) await d.query(stmt)
    core.setAdapter(null)
    const fresh = await import('../src/plans/store')
    await fresh.ensurePlanSchema(core.db()!)
    check('the plan tables set up a second time change nothing', sh1 === await shape())
  })

  // ------------------------------------------------------------ tidy up
  await d.query(`DELETE FROM ape_plans WHERE booking_ref LIKE 'APE-PLN%'`)
  await d.query(`DELETE FROM ape_bookings WHERE ref LIKE 'APE-PLN%'`)
  await d.query(`DELETE FROM ape_plan_forms WHERE version > $1`, [Number(keepForms[0].v) || 1])
  if (keepSettings[0]) await d.query(`INSERT INTO ape_meta (key, value) VALUES ('plans', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [keepSettings[0].value]); else await d.query(`DELETE FROM ape_meta WHERE key = 'plans'`)
  if (privacy[0]) await d.query(`UPDATE pages SET title = $2 WHERE id = $1`, [privacy[0].id, privacy[0].title])
  for (const r of section15) await d.query(`UPDATE pages_sections_content SET text = $2 WHERE id = $1`, [r.id, r.text])
  for (const u of [lorna, alex, sam, gya, gya2]) await payload.delete({ collection: 'users', where: { email: { equals: u.email } }, overrideAccess: true }).catch(() => {})
  await d.query(`DELETE FROM ape_rate`)
  server.close()
  console.log(`${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
