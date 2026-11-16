/**
 * Site Settings > Welcome pack (v1.9.0). Signed-in users; the switches and the notice approval are for GYA
 * administrators only.
 *
 *   GET    the two PDFs, the wording, when it is sent, who is told, the switches and what the online questionnaire
 *          still needs, a preview of the welcome email, and (administrators) who can read answers
 *   POST   { files?, words?, sendWhen?, notifyEmails?, switches? }  save any of these; applies straight away, no
 *          Publish needed. Changing the collection notice clears its approval.
 */
import { routeUser, json } from '@/dashboard/lib/routeAuth'
import * as q from '@/lib/questionnaire'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
const s = (v: unknown, max = 5000) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max).trim()

async function state(payload: Awaited<ReturnType<typeof routeUser>>['payload'], admin: boolean) {
  const [sw, files, words, where, settings] = await Promise.all([
    q.packSwitches(payload), q.packFiles(payload), q.loadWords(payload), q.place(payload),
    payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as Promise<Record<string, any>>,
  ])
  const sample = new Date(Date.now() + 7 * 86400000); sample.setUTCHours(23, 20, 0, 0)
  const preview = q.welcomeEmail({ words, name: 'Sam Example', slotStart: sample, link: sw.online ? 'https://theanxiouspatientexperience.com.au/questionnaire/(private link)' : null, where })
  return {
    ok: true,
    admin,
    switches: sw,
    files: {
      guide: { ...files.guide, original: q.ORIGINALS.guide.url, label: q.ORIGINALS.guide.label },
      questionnaire: { ...files.questionnaire, original: q.ORIGINALS.questionnaire.url, label: q.ORIGINALS.questionnaire.label },
    },
    words: { notice: words.noticeSaved ? words.notice : '', consent: words.consent === q.DEFAULT_CONSENT ? '' : words.consent, subject: words.subjectSaved ? words.subject : '', body: words.bodySaved ? words.body : '' },
    defaults: { notice: q.DEFAULT_NOTICE, consent: q.DEFAULT_CONSENT, subject: q.DEFAULT_SUBJECT, body: q.DEFAULT_BODY },
    sendWhen: sw.sendWhen,
    notifyEmails: ((settings?.questionnaire?.notifyEmails as { address?: string }[] | undefined) ?? []).map((r) => String(r.address || '')).filter(Boolean),
    preview: { subject: preview.subject, text: preview.text, attachments: [q.ORIGINALS.guide.attachName, q.ORIGINALS.questionnaire.attachName] },
    readers: admin ? await q.readers(payload) : null,
  }
}

export async function GET(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  return json(200, await state(payload, user.role === 'admin'))
}

export async function POST(req: Request) {
  const { payload, user } = await routeUser(req)
  if (!user) return json(401, { ok: false, error: 'signed_out' })
  const admin = user.role === 'admin'
  let b: Record<string, any>
  try { b = await req.json() } catch { return json(400, { ok: false, error: 'invalid' }) }

  const current = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as Record<string, any>
  const cur = current?.questionnaire || {}
  const group: Record<string, unknown> = {}

  // the two PDFs: a Media Library PDF, or null for the standard APE version in public/downloads
  if (b.files && typeof b.files === 'object') {
    for (const [key, field] of [['guide', 'guidePdf'], ['questionnaire', 'questionnairePdf']] as const) {
      if (!(key in b.files)) continue
      const id = b.files[key]
      if (id === null || id === '') { group[field] = null; continue }
      const m = await payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
      if (!m || !/pdf/i.test(String(m.mimeType || ''))) return json(400, { ok: false, error: 'not_pdf' })
      group[field] = m.id
    }
  }
  if (b.sendWhen !== undefined) group.sendWhen = b.sendWhen === 'requested' ? 'requested' : 'confirmed'
  if (Array.isArray(b.notifyEmails)) {
    const list = b.notifyEmails.map((x: unknown) => s(x, 200)).filter(Boolean)
    if (list.some((x: string) => !EMAIL.test(x))) return json(400, { ok: false, error: 'bad_email' })
    group.notifyEmails = list.slice(0, 10).map((address: string) => ({ address }))
  }

  // the words (blank means the drafted default)
  let noticeChanged = false
  if (b.words && typeof b.words === 'object') {
    const g = await payload.findGlobal({ slug: 'questionnaire', depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
    const data: Record<string, string> = {}
    if ('notice' in b.words) {
      data.collectionNotice = s(b.words.notice, 3000)
      noticeChanged = (data.collectionNotice || q.DEFAULT_NOTICE) !== (s(g?.collectionNotice) || q.DEFAULT_NOTICE)
    }
    if ('consent' in b.words) data.consentLabel = s(b.words.consent, 400)
    if ('subject' in b.words) data.welcomeSubject = s(b.words.subject, 200)
    if ('body' in b.words) {
      data.welcomeBody = s(b.words.body, 6000)
      if (data.welcomeBody && !data.welcomeBody.includes('{questionnaire}')) return json(400, { ok: false, error: 'needs_questionnaire_token' })
    }
    if (Object.keys(data).length) await payload.updateGlobal({ slug: 'questionnaire', data, overrideAccess: true, context: { noPublishNeeded: true } })
  }
  if (noticeChanged && cur.noticeApproved) { group.noticeApproved = false; group.noticeApprovedBy = ''; group.noticeApprovedAt = null }

  // the switches (GYA only)
  if (b.switches && typeof b.switches === 'object') {
    if (!admin) return json(403, { ok: false, error: 'admin_only' })
    const w = b.switches
    if (w.noticeApproved !== undefined) {
      group.noticeApproved = !!w.noticeApproved && !noticeChanged
      group.noticeApprovedBy = group.noticeApproved ? String(user.email) : ''
      group.noticeApprovedAt = group.noticeApproved ? new Date().toISOString() : null
    }
    if (w.welcomeEmailOn !== undefined) group.welcomeEmailOn = !!w.welcomeEmailOn
    if (w.onlineOn !== undefined) {
      if (w.onlineOn) {
        const sw = await q.packSwitches(payload)
        const approved = group.noticeApproved !== undefined ? !!group.noticeApproved : sw.noticeApproved
        const missing = [!sw.keyReady ? 'QUESTIONNAIRE_ENCRYPTION_KEY is not set in Vercel' : '', !approved ? 'the collection notice is not marked approved' : '', sw.emergencyOff ? 'QUESTIONNAIRE_ENABLED is set to false in Vercel' : ''].filter(Boolean)
        if (missing.length) return json(409, { ok: false, error: 'not_ready', reason: missing.join('; ') })
      }
      group.onlineOn = !!w.onlineOn
    }
  }

  if (Object.keys(group).length) {
    // the whole group, so nothing else in it is lost
    await payload.updateGlobal({ slug: 'site-settings', data: { questionnaire: { ...cur, ...group } }, overrideAccess: true, context: { noPublishNeeded: true } })
  }
  return json(200, await state(payload, admin))
}
