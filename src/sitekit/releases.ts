/**
 * Content changes made by GYA in a release, applied to a dashboard that already holds the website.
 *
 * Once the website has been imported into the dashboard, the build pulls the pages from the database, so a page
 * changed in content/ would never reach the live site on its own. Each update here copies one change from the
 * repository into the database, and only while the database still has the old version: if the practice has already
 * changed that part in the dashboard, it is left alone. They run on every build (scripts/content-updates.ts) and do
 * nothing once applied, so they are safe to run again.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import type { Page } from '@/lib/parts'
import { partToSectionDoc, pageToDoc, type FieldDoc, type SectionDoc } from '@/sitekit/sync'
import { DEFAULTS } from '@/site.config'
import { gtmIdOf } from '@/lib/gtm'

type Doc = { id: number | string; sections?: (SectionDoc & { id?: string })[]; meta?: Record<string, unknown> }

const repoPage = (slug: string): Page =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'pages', `${slug}.json`), 'utf8')) as Page

async function pageDoc(payload: Payload, slug: string): Promise<Doc | null> {
  const r = await payload.find({ collection: 'pages', where: { pageSlug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
  return (r.docs[0] as unknown as Doc) ?? null
}

const relId = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id ?? null : v ?? null)
const plainRows = (rows: FieldDoc[]) => rows.map((c) => ({ ...c, image: relId(c.image) as never }))

export type Update = { id: string; describe: string; apply: (payload: Payload) => Promise<string> }

/**
 * v1.15.0: the Tag Manager container ID goes into Site Settings > Tracking, so GYA sees it in the dashboard.
 * Only a blank field is filled. A different ID typed in the dashboard, or "off", is kept. Returns one line for the
 * build log.
 */
export async function applyGtmContainer(payload: Payload): Promise<string> {
  const want = gtmIdOf(DEFAULTS.tracking)
  if (!want) return 'no default container in site.config.ts, nothing to do'
  const g = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as { tracking?: { ga4?: string | null; metaPixel?: string | null; gtm?: string | null } }
  const have = String(g.tracking?.gtm || '').trim()
  if (have) return /^off$/i.test(have) ? 'Tag Manager is switched off in the dashboard, left alone' : `the dashboard already has ${have}, left alone`
  await payload.updateGlobal({
    slug: 'site-settings', depth: 0, overrideAccess: true,
    data: { tracking: { ga4: g.tracking?.ga4 ?? '', metaPixel: g.tracking?.metaPixel ?? '', gtm: want } } as never,
  })
  return `Google Tag Manager ID set to ${want} (the field was blank)`
}

export const UPDATES: Update[] = [
  {
    id: 'v1.6.0-privacy-policy',
    describe: 'The privacy policy replaces the "to be supplied" placeholder',
    async apply(payload) {
      const doc = await pageDoc(payload, 'privacy-policy')
      if (!doc) return 'no privacy page in the dashboard'
      const words = JSON.stringify(doc.sections ?? [])
      if (!/Privacy policy to be supplied/i.test(words)) return 'already has its own wording, left alone'
      const repo = repoPage('privacy-policy')
      await payload.update({
        collection: 'pages', id: doc.id, depth: 0, overrideAccess: true,
        data: {
          sections: repo.sections.map(partToSectionDoc),
          order: JSON.stringify(repo.order),
          meta: {
            ...(doc.meta ?? {}),
            ogImage: relId(doc.meta?.ogImage),
            title: repo.meta.title ?? '',
            description: repo.meta.description ?? '',
            noindex: !!repo.meta.noindex,
          },
        } as never,
      })
      return 'applied'
    },
  },
  {
    id: 'v1.6.0-lauren-photo',
    describe: "Lauren's photo replaces the monogram on the homepage team card",
    async apply(payload) {
      const doc = await pageDoc(payload, 'home')
      const rows = doc?.sections ?? []
      const i = rows.findIndex((s) => s.key === 'team')
      if (!doc || i < 0) return 'no team section in the dashboard'
      const row = rows[i]
      const photo = (row.content ?? []).find((c) => c.fieldId === 'f21')
      if (!photo || relId(photo.image) || photo.builtIn !== '/images/team-lauren-bright.jpg' || !row.template.includes('<!-- LAUREN')) {
        return 'photo already changed, left alone'
      }
      const repo = repoPage('home').sections.find((s) => s.key === 'team')!
      const fresh = partToSectionDoc(repo).content
      const have = new Map((row.content ?? []).map((c) => [c.fieldId, c]))
      // every word the practice may have changed is kept; only the photo and its new sizes come from the release
      const content = fresh.map((c) => {
        if (c.fieldId === 'f21' || c.fieldId === 'f60') return c
        return have.get(c.fieldId) ?? c
      })
      const sections = rows.map((s, n) => (n === i
        ? { ...s, template: repo.template, content: plainRows(content) }
        : { ...s, content: plainRows(s.content ?? []) }))
      await payload.update({ collection: 'pages', id: doc.id, depth: 0, overrideAccess: true, data: { sections } as never })
      return 'applied'
    },
  },
  {
    id: 'v1.7.0-review-page',
    describe: 'The Google review page (/review/) is added to the dashboard',
    async apply(payload) {
      if (await pageDoc(payload, 'review')) return 'already there, left alone'
      const repo = repoPage('review')
      await payload.create({ collection: 'pages', depth: 0, overrideAccess: true, data: pageToDoc(repo, { title: repo.name, sortOrder: 2 }) as never })
      return 'applied'
    },
  },
  {
    id: 'v1.7.0-privacy-questionnaire',
    describe: 'The privacy policy gains a section on the new patient questionnaire (for Lorna to approve)',
    async apply(payload) {
      const doc = await pageDoc(payload, 'privacy-policy')
      const rows = doc?.sections ?? []
      const i = rows.findIndex((r) => (r.content ?? []).some((c) => c.fieldId === 'f60'))
      if (!doc || i < 0) return 'no privacy policy section in the dashboard'
      const row = rows[i]
      if (row.template.includes('{{f64}}') || (row.content ?? []).some((c) => c.fieldId === 'f64')) return 'already has the questionnaire section, left alone'
      if (!row.template.includes('<h2>{{f60}}</h2>')) return 'the policy has been restructured, left alone (add the section by hand)'
      const repo = repoPage('privacy-policy').sections[0]
      const fresh = partToSectionDoc(repo).content
      const added = fresh.filter((c) => ['f64', 'f65', 'f66', 'f67'].includes(c.fieldId))
      const content = (row.content ?? []).map((c) => {
        // the contact section moves from 14 to 15, only if its heading is still the standard one
        if (c.fieldId === 'f60' && /^14\. Changes to this policy/.test(String(c.text ?? ''))) return { ...c, ...(fresh.find((f) => f.fieldId === 'f60') ?? {}) }
        if (c.fieldId === 'f2') return { ...c, ...(fresh.find((f) => f.fieldId === 'f2') ?? {}) }
        return c
      })
      const sections = rows.map((r, n) => (n === i
        ? { ...r, template: r.template.replace('<h2>{{f60}}</h2>', '<h2>{{f64}}</h2><p>{{f65}}</p><p>{{f66}}</p><p>{{f67}}</p><h2>{{f60}}</h2>'), content: plainRows([...content, ...added]) }
        : { ...r, content: plainRows(r.content ?? []) }))
      await payload.update({ collection: 'pages', id: doc.id, depth: 0, overrideAccess: true, data: { sections } as never })
      return 'applied'
    },
  },
  {
    id: 'v1.8.3-booking-recipients',
    describe: 'Who receives booking emails shows the address that gets them today, so the practice can see and change it',
    async apply(payload) {
      const core = await import('@/booking/core')
      const { resolveTeam } = await import('@/lib/recipients')
      const d = core.db()
      if (!d) return 'no database'
      await core.ensureSchema(d, core.loadConfig())
      // once only: if the practice later empties the list on purpose, it stays empty
      const first = await d.query(`INSERT INTO ape_meta (key, value) VALUES ('release:v1.8.3-booking-recipients', $1) ON CONFLICT DO NOTHING RETURNING key`, [new Date().toISOString()])
      if (!first.length) return 'already applied'
      const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as { bookingRecipients?: { address?: string }[] }
      if ((s.bookingRecipients ?? []).some((r) => r?.address)) return 'already has a list, left alone'
      const today = resolveTeam([]).list
      await payload.updateGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, context: { noPublishNeeded: true }, data: { bookingRecipients: today.map((address) => ({ address })) } as never })
      return `set to ${today.join(', ')} (the address booking emails already go to)`
    },
  },
  {
    id: 'v1.8.4-qr-media',
    describe: 'The website QR code (PNG and A4 PDF) in the Media Library, so the team can download it',
    async apply(payload) {
      const core = await import('@/booking/core')
      const d = core.db()
      if (!d) return 'no database'
      await core.ensureSchema(d, core.loadConfig())
      // once only (the Media Library may store the PNG under another name, so a name check is not enough)
      const first = await d.query(`INSERT INTO ape_meta (key, value) VALUES ('release:v1.8.4-qr-media', $1) ON CONFLICT DO NOTHING RETURNING key`, [new Date().toISOString()])
      if (!first.length) return 'already applied'
      const out: string[] = []
      for (const [file, alt] of [
        ['ape-website-qr.png', 'QR code for theanxiouspatientexperience.com.au'],
        ['ape-website-qr.pdf', 'QR code for theanxiouspatientexperience.com.au, A4 ready to print'],
      ] as const) {
        const have = await payload.find({ collection: 'media', where: { filename: { equals: file } }, limit: 1, depth: 0, overrideAccess: true })
        if (have.docs.length) { out.push(`${file} already there`); continue }
        try {
          await payload.create({ collection: 'media', overrideAccess: true, depth: 0, filePath: path.join(process.cwd(), 'public', 'qr', file), data: { alt } as never })
          out.push(`${file} added`)
        } catch (err) {
          out.push(`${file} not added (${(err as Error).message}); it is still at /qr/${file}`)
        }
      }
      return out.join('; ')
    },
  },
  {
    id: 'v1.10.0-book-now-steps',
    describe: 'v1.10.0 changed "four simple steps" to five; v1.11.0 went back to four steps, so this no longer does anything',
    async apply() {
      return 'superseded by v1.11.0, nothing to do'
    },
  },
  {
    id: 'v1.11.0-book-now-steps',
    describe: 'Book Now is back to four steps (the terms step became a pop-up), so the introduction says four again',
    async apply(payload) {
      const OLD = 'Book your first appointment and pay your deposit online in five simple steps.'
      const NEW = 'Book your first appointment and pay your deposit online in four simple steps.'
      const doc = await pageDoc(payload, 'book-now')
      if (!doc) return 'no Book Now page in the dashboard'
      let changed = false
      const sections = (doc.sections ?? []).map((r) => ({
        ...r,
        content: plainRows((r.content ?? []).map((c) => {
          // only while it still says five: if the practice has changed it since, it is left alone
          if (String(c.text ?? '').trim() === OLD) { changed = true; return { ...c, text: NEW } }
          return c
        })),
      }))
      if (!changed) return 'not "five simple steps", left alone'
      await payload.update({ collection: 'pages', id: doc.id, depth: 0, overrideAccess: true, data: { sections } as never })
      return 'applied'
    },
  },
  {
    id: 'v1.11.0-deposit-policy',
    describe: "Lorna's deposit policy (her email of 18 Nov 2026) replaces the v1.10.0 draft terms, marked approved by her",
    async apply(payload) {
      const terms = await import('@/booking/terms')
      const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as { bookingTerms?: Record<string, any> }
      const cur = s.bookingTerms || {}
      const text = String(cur.text || '').trim()
      // nothing saved: the default is already Lorna's wording. Saved and changed from the v1.10.0 draft: left alone.
      if (!text) return "nothing saved, Lorna's wording is the default"
      if (text !== terms.V1_DRAFT_TERMS.trim()) return 'the practice has its own wording, left alone'
      const label = String(cur.consentLabel || '').trim()
      await payload.updateGlobal({
        slug: 'site-settings', depth: 0, overrideAccess: true, context: { noPublishNeeded: true },
        data: {
          bookingTerms: {
            ...cur,
            text: terms.LORNA_V2_TERMS,
            consentLabel: !label || label === terms.V1_CONSENT ? terms.DEFAULT_CONSENT : label,
            version: Math.max(1, Number(cur.version) || 1) + 1,
            changedAt: '2026-11-18T00:00:00.000Z',
            changedBy: 'v1.11.0 release',
            approvedBy: terms.APPROVED_BY_LORNA,
            approvedAt: '2026-11-18T00:00:00.000Z',
          },
        } as never,
      })
      return "applied (Lorna's wording, approved)"
    },
  },
  {
    id: 'v1.12.0-welcome-email-on',
    describe: 'The welcome email is switched on once (it is the patient\'s confirmation on Mark confirmed; Lorna agreed on her call of 18 Nov 2026)',
    async apply(payload) {
      const core = await import('@/booking/core')
      const d = core.db()
      if (!d) return 'no database'
      // once only: if someone switches it off in the dashboard afterwards, that stays
      await d.query(`CREATE TABLE IF NOT EXISTS ape_meta (key text PRIMARY KEY, value text NOT NULL DEFAULT '')`)
      const first = await d.query(`INSERT INTO ape_meta (key, value) VALUES ('release:v1.12.0-welcome-email-on', now()::text) ON CONFLICT DO NOTHING RETURNING key`)
      if (!first.length) return 'already applied once, the dashboard setting is kept'
      const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as { questionnaire?: Record<string, any> }
      const q = s.questionnaire || {}
      if (q.welcomeEmailOn) return 'already on'
      await payload.updateGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, context: { noPublishNeeded: true }, data: { questionnaire: { ...q, welcomeEmailOn: true } } as never })
      return 'switched on (sent when a booking is marked confirmed; the online questionnaire stays as it is)'
    },
  },
  {
    id: 'v1.12.0-welcome-subject',
    describe: 'The welcome email says the appointment is confirmed: subject "Your APE appointment is confirmed" and its first line (only where unchanged)',
    async apply(payload) {
      const qn = await import('@/lib/questionnaire')
      const g = await payload.findGlobal({ slug: 'questionnaire', depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
      const subject = String(g?.welcomeSubject || '').trim()
      const body = String(g?.welcomeBody || '')
      const data: Record<string, string> = {}
      if (subject === qn.OLD_SUBJECT) data.welcomeSubject = qn.DEFAULT_SUBJECT
      if (body.includes(qn.OLD_FIRST_LINE)) data.welcomeBody = body.split(qn.OLD_FIRST_LINE).join(qn.NEW_FIRST_LINE)
      if (!Object.keys(data).length) return subject || body ? 'nothing to change (new wording already, or the practice has its own)' : 'nothing saved, the new wording is the default'
      await payload.updateGlobal({ slug: 'questionnaire', depth: 0, overrideAccess: true, context: { noPublishNeeded: true }, data: data as never })
      return `applied (${Object.keys(data).join(', ')})`
    },
  },
  {
    id: 'v1.13.0-deposit-policy-age',
    describe: "The deposit policy becomes version 3: Lorna's version 2 plus the age rule (15 and over; under 18 needs a parent or guardian's name), waiting for her approval",
    async apply(payload) {
      const terms = await import('@/booking/terms')
      const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as { bookingTerms?: Record<string, any> }
      const cur = s.bookingTerms || {}
      const text = String(cur.text || '').trim()
      if (!text) return 'nothing saved, version 3 is the default'
      if (text !== terms.LORNA_V2_TERMS.trim()) return 'the practice has its own wording, left alone (add the age sentence by hand if wanted)'
      await payload.updateGlobal({
        slug: 'site-settings', depth: 0, overrideAccess: true, context: { noPublishNeeded: true },
        data: { bookingTerms: { ...cur, text: terms.DEFAULT_TERMS, version: Math.max(1, Number(cur.version) || 1) + 1, changedAt: '2026-11-19T00:00:00.000Z', changedBy: 'v1.13.0 release', approvedBy: '', approvedAt: null } } as never,
      })
      return 'applied (version 3, waiting for Lorna\'s approval of the age sentence)'
    },
  },
  {
    id: 'v1.13.0-questionnaire-optional-line',
    describe: 'The questionnaire collection notice gets Lorna\'s line: "Every question is optional, but we kindly request you fill out as much as possible..."',
    async apply(payload) {
      const qn = await import('@/lib/questionnaire')
      const g = await payload.findGlobal({ slug: 'questionnaire', depth: 0, overrideAccess: true }).catch(() => null) as Record<string, any> | null
      const notice = String(g?.collectionNotice || '')
      if (!notice.trim()) return 'nothing saved, the new wording is the default'
      if (!notice.includes(qn.OLD_OPTIONAL_SENTENCE)) return notice.includes('we kindly request') ? 'already has the line' : 'the practice has its own wording, left alone'
      await payload.updateGlobal({ slug: 'questionnaire', depth: 0, overrideAccess: true, context: { noPublishNeeded: true }, data: { collectionNotice: notice.split(qn.OLD_OPTIONAL_SENTENCE).join(qn.NEW_OPTIONAL_SENTENCE) } as never })
      return 'applied'
    },
  },
  {
    id: 'v1.13.0-questionnaire-approved',
    describe: 'Lorna approved the questionnaire wording, the collection notice and privacy section 14 (email of 19 Nov 2026): recorded, and the online questionnaire switched on (it only runs once QUESTIONNAIRE_ENCRYPTION_KEY is set)',
    async apply(payload) {
      const core = await import('@/booking/core')
      const qn = await import('@/lib/questionnaire')
      const d = core.db()
      if (!d) return 'no database'
      // once only: switching it off later in Site Settings > Welcome pack stays off
      await d.query(`CREATE TABLE IF NOT EXISTS ape_meta (key text PRIMARY KEY, value text NOT NULL DEFAULT '')`)
      const first = await d.query(`INSERT INTO ape_meta (key, value) VALUES ('release:v1.13.0-questionnaire-approved', now()::text) ON CONFLICT DO NOTHING RETURNING key`)
      if (!first.length) return 'already applied once, the dashboard settings are kept'
      const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }) as { questionnaire?: Record<string, any> }
      const q = s.questionnaire || {}
      await payload.updateGlobal({
        slug: 'site-settings', depth: 0, overrideAccess: true, context: { noPublishNeeded: true },
        data: { questionnaire: { ...q, noticeApproved: true, noticeApprovedBy: qn.APPROVED_BY_LORNA_QN, noticeApprovedAt: '2026-11-19T03:35:00.000Z', onlineOn: true } } as never,
      })
      return qn.encryptionKeySet() ? 'approved and switched on (the encryption key is set)' : 'approved and switched on; it stays off until QUESTIONNAIRE_ENCRYPTION_KEY is set in Vercel'
    },
  },
  {
    id: 'v1.13.0-privacy-guardian',
    describe: "The privacy policy says a parent or guardian's name is collected for patients under 18 (for Lorna to approve)",
    async apply(payload) {
      const doc = await pageDoc(payload, 'privacy-policy')
      const SENTENCE = " If the patient is under 18 at the appointment, we also collect a parent or guardian's name, so we know who is responsible for the booking."
      const rows = doc?.sections ?? []
      let found = false
      let changed = false
      const sections = rows.map((r) => ({
        ...r,
        content: plainRows((r.content ?? []).map((c) => {
          const t = String((c as { text?: unknown }).text ?? '')
          if (!/When you book online or contact us/.test(t)) return c
          found = true
          if (/guardian/i.test(t)) return c
          changed = true
          return { ...c, text: t.replace(/\s*$/, '') + SENTENCE }
        })),
      }))
      if (!doc || !found) return 'no booking paragraph in the privacy policy, left alone (add it by hand)'
      if (!changed) return 'already mentions a parent or guardian, left alone'
      await payload.update({ collection: 'pages', id: doc.id, depth: 0, overrideAccess: true, data: { sections } as never })
      return 'applied'
    },
  },
  {
    id: 'v1.13.0-hands-photo',
    describe: 'The homepage hands photo (it shows six fingers) is replaced by Lorna\'s napkin photo, with its own description',
    async apply(payload) {
      const doc = await pageDoc(payload, 'home')
      const rows = doc?.sections ?? []
      const i = rows.findIndex((r) => (r.content ?? []).some((c) => c.builtIn === '/images/ape-hands-comfort.jpg' || String(c.text ?? '').includes('ape-hands-comfort')))
      if (!doc || i < 0) return 'the hands photo is not on the homepage any more, left alone'
      const row = rows[i]
      const photo = (row.content ?? []).find((c) => c.builtIn === '/images/ape-hands-comfort.jpg')
      if (photo && relId(photo.image)) return 'a photo from the Media Library is in that spot, left alone'
      const repo = repoPage('home').sections.find((r) => r.key === row.key)
      if (!repo) return 'section not found in the release, left alone'
      const fresh = new Map(partToSectionDoc(repo).content.map((c) => [c.fieldId, c]))
      // only the photo, its description and its sizes change; every word the practice edited is kept
      const content = (row.content ?? []).map((c) => {
        const isPhoto = c.builtIn === '/images/ape-hands-comfort.jpg' || String(c.text ?? '').includes('ape-hands-comfort') || /One hand resting gently on another/.test(String(c.text ?? ''))
        return isPhoto ? (fresh.get(c.fieldId) ?? c) : c
      })
      const sections = rows.map((r, n) => (n === i ? { ...r, content: plainRows(content) } : { ...r, content: plainRows(r.content ?? []) }))
      await payload.update({ collection: 'pages', id: doc.id, depth: 0, overrideAccess: true, data: { sections } as never })
      return 'applied'
    },
  },
  {
    id: 'v1.15.0-gtm-container',
    describe: 'Site Settings > Tracking gets the Google Tag Manager ID, if the field is blank',
    apply: applyGtmContainer,
  },
]
