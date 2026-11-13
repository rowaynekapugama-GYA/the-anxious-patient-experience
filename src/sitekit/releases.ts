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
]
