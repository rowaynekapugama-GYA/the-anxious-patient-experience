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
import { partToSectionDoc, type FieldDoc, type SectionDoc } from '@/sitekit/sync'

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
]
