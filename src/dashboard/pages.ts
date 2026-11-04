/**
 * Between a page document in the database and what the page editor works on.
 *
 * The editor only ever sends back words, links, photo choices, the section
 * order and hidden flags. Section markup always comes from the database, so
 * nothing typed in the dashboard can change the approved design.
 */
import type { Payload } from 'payload'
import type { Chrome, Field, Page, Part } from '@/lib/parts'
import { getChrome, getSeoDefaults, seoInfoFrom } from '@/lib/content'
import { mergeSettings, tokensFor } from '@/lib/site'
import type { SeoDefaults, SeoInfo } from '@/dashboard/render'
import { docToPage, mediaUrl, sectionDocToPart, settingsFileFromGlobal, type FieldDoc, type PageDoc, type SectionDoc } from '@/sitekit/sync'

export type EField = Field & { media?: number | string | null; original?: string }
export type ESection = {
  key: string; label: string; kind: string; hidden: boolean; empty: boolean
  /** stays at the top of the page */
  pinned: boolean
  /** sits after the footer or a script, so it keeps its place */
  fixed: boolean
  fields: EField[]
}
export type SectionEdit = { key: string; hidden?: boolean; fields?: { id: string; value: string; media?: number | string | null }[] }

const PINNED = new Set(['crumbs', 'hero'])

const relId = (v: unknown): number | string | null =>
  v && typeof v === 'object' ? ((v as { id?: number | string }).id ?? null) : ((v as number | string | null) ?? null)

function fieldFromDoc(d: FieldDoc): EField {
  const type = d.kind as Field['type']
  if (type === 'image') {
    const url = mediaUrl(d.image as never)
    return { id: d.fieldId, label: d.label, type, value: url ?? d.builtIn ?? '', media: relId(d.image), original: d.builtIn ?? '' }
  }
  if (type === 'href') return { id: d.fieldId, label: d.label, type, value: d.link ?? '' }
  if (type === 'srcset') return { id: d.fieldId, label: d.label, type, value: d.text ?? '', of: d.of ?? '' }
  return { id: d.fieldId, label: d.label, type, value: d.text ?? '' }
}

/**
 * A page's sections come in runs between the other parts of the page (nearly
 * always one run between the menu and the footer). Which run a section belongs
 * to, by key, so reordering never moves a section past the footer or a script.
 */
function runOf(order: string[], keyAt: (i: number) => string | undefined): Map<string, number> {
  const out = new Map<string, number>()
  let run = -1
  let inRun = false
  for (const step of order) {
    if (!step.startsWith('section:')) { inRun = false; continue }
    if (!inRun) { run++; inRun = true }
    const k = keyAt(Number(step.slice(8)))
    if (k !== undefined) out.set(k, run)
  }
  return out
}

/** Lay the sections out in the order's slots, run by run, keeping the given sequence inside each run. */
function arrange<T extends { key: string }>(order: string[], runs: Map<string, number>, items: T[]): { items: T[]; order: string[] } {
  const outItems: T[] = []
  const outOrder: string[] = []
  let run = -1
  let inRun = false
  for (const step of order) {
    if (!step.startsWith('section:')) { outOrder.push(step); inRun = false; continue }
    if (inRun) continue
    inRun = true
    run++
    for (const it of items) {
      if ((runs.get(it.key) ?? 0) !== run) continue
      outOrder.push(`section:${outItems.length}`)
      outItems.push(it)
    }
  }
  return { items: outItems, order: outOrder }
}

const parseOrder = (raw: unknown): string[] => {
  try { return Array.isArray(raw) ? raw as string[] : JSON.parse(String(raw || '[]')) as string[] } catch { return [] }
}

/** The sections as the editor shows them (the page document read at depth 1). */
export function sectionsForEditor(doc: PageDoc): ESection[] {
  const rows = doc.sections ?? []
  const runs = runOf(parseOrder(doc.order), (i) => rows[i]?.key)
  return rows.map((s) => {
    // a photo's sizes follow the photo by themselves, so they are never shown
    const fields = (s.content ?? []).map(fieldFromDoc).filter((f) => f.type !== 'srcset')
    const images = fields.filter((f) => f.type === 'image')
    return {
      key: s.key,
      label: s.label || 'Section',
      kind: s.kind,
      hidden: !!s.hidden,
      empty: images.length > 0 && images.every((f) => !f.value),
      pinned: PINNED.has(s.kind),
      fixed: (runs.get(s.key) ?? 0) > 0,
      fields,
    }
  })
}

const cleanEdits = (raw: unknown): SectionEdit[] =>
  Array.isArray(raw)
    ? raw
      .filter((s) => s && typeof s.key === 'string')
      .map((s) => ({
        key: String(s.key),
        hidden: !!s.hidden,
        fields: Array.isArray(s.fields)
          ? s.fields
            .filter((f: unknown) => f && typeof (f as { id?: unknown }).id === 'string' && typeof (f as { value?: unknown }).value === 'string')
            .map((f: { id: string; value: string; media?: unknown }) => ({
              id: f.id,
              value: f.value,
              media: typeof f.media === 'number' || typeof f.media === 'string' ? f.media : null,
            }))
          : undefined,
      }))
    : []

/** The page with its sections in the given sequence, each kept in its own run. */
function withSections(page: Page, sections: Part[]): Page {
  const runs = runOf(page.order, (i) => page.sections[i]?.key)
  const r = arrange(page.order, runs, sections)
  return { ...page, sections: r.items, order: r.order }
}

/** The page with the editor's unsaved changes on top of what is saved. */
export function pageWithEdits(doc: PageDoc, rawEdits?: unknown): Page {
  const all = docToPage({ ...doc, sections: (doc.sections ?? []).map((s) => ({ ...s, hidden: false })) })
  const byKey = new Map(all.sections.map((p) => [p.key, p]))
  const hiddenSaved = new Map((doc.sections ?? []).map((s) => [s.key, !!s.hidden]))
  if (rawEdits === undefined) {
    return withSections(all, all.sections.filter((p) => !hiddenSaved.get(p.key)))
  }
  const edits = cleanEdits(rawEdits)
  const next: Part[] = []
  for (const e of edits) {
    const base = byKey.get(e.key)
    if (!base) continue
    byKey.delete(e.key)
    if (e.hidden) continue
    const vals = new Map((e.fields ?? []).map((f) => [f.id, f.value]))
    next.push({ ...base, fields: base.fields.map((f) => (vals.has(f.id) ? { ...f, value: vals.get(f.id)! } : f)) })
  }
  // anything the editor did not mention stays where it was
  for (const p of byKey.values()) if (!hiddenSaved.get(p.key)) next.push(p)
  return withSections(all, next)
}

/** The page document's section rows with the editor's changes applied, ready to save. */
export function rowsWithEdits(doc: { sections?: (SectionDoc & { id?: string })[]; order?: unknown }, rawEdits: unknown): (SectionDoc & { id?: string })[] {
  const edits = cleanEdits(rawEdits)
  const rows = doc.sections ?? []
  const order = parseOrder(doc.order)
  const runs = runOf(order, (i) => rows[i]?.key)
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const out: (SectionDoc & { id?: string })[] = []
  for (const e of edits) {
    const row = byKey.get(e.key)
    if (!row) continue
    byKey.delete(e.key)
    const vals = new Map((e.fields ?? []).map((f) => [f.id, f]))
    out.push({
      ...row,
      hidden: !!e.hidden,
      content: (row.content ?? []).map((c) => {
        const f = vals.get(c.fieldId)
        if (!f) return { ...c, image: relId(c.image) as never }
        if (c.kind === 'image') {
          // a photo from the Media Library, or back to the one the site shipped with
          return { ...c, image: (f.media ?? null) as never }
        }
        if (c.kind === 'href') return { ...c, link: f.value, image: relId(c.image) as never }
        return { ...c, text: f.value, image: relId(c.image) as never }
      }),
    })
  }
  for (const r of byKey.values()) out.push({ ...r, content: (r.content ?? []).map((c) => ({ ...c, image: relId(c.image) as never })) })
  // the order list points at sections by position, so each run keeps its own slots
  return order.length ? arrange(order, runs, out).items : out
}

/** Header, footer and the rest of the furniture, as saved in the dashboard (or the repository). */
export async function chromeFor(payload: Payload): Promise<Chrome> {
  const file = getChrome()
  const res = await payload.find({ collection: 'pages', where: { isChrome: { equals: true } }, limit: 50, depth: 1, overrideAccess: true, pagination: false })
  if (!res.docs.length) return file
  const parts: Record<string, Part> = { ...file.parts }
  for (const d of res.docs as unknown as PageDoc[]) {
    const s = d.sections?.[0]
    if (s) parts[d.pageSlug.replace('_chrome-', '')] = sectionDocToPart(s)
  }
  return { ...file, parts }
}

/** What {{site:...}} tokens resolve to with the practice details saved in the dashboard. */
export async function tokensFromDashboard(payload: Payload): Promise<Record<string, string>> {
  const g = await payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: true }).catch(() => null)
  const saved = g ? settingsFileFromGlobal(g as unknown as Record<string, unknown>) : {}
  const posts = await payload.count({ collection: 'posts', where: { _status: { equals: 'published' } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 }))
  return tokensFor(mergeSettings(saved), { blog: posts.totalDocs > 0 })
}

/** Everything the page preview needs besides the page: tokens, the SEO defaults and the share picture. */
export async function renderContext(payload: Payload): Promise<{ tokens: Record<string, string>; seo: SeoDefaults; seoInfo: SeoInfo }> {
  const tokens = await tokensFromDashboard(payload)
  const g = await payload.findGlobal({ slug: 'seo', depth: 1, overrideAccess: true }).catch(() => null) as Record<string, unknown> | null
  const file = getSeoDefaults()
  const seo: SeoDefaults = g ? {
    defaultTitle: (g.defaultTitle as string) || file.defaultTitle,
    defaultDescription: (g.defaultDescription as string) || file.defaultDescription,
    defaultOgImage: mediaUrl(g.defaultOgImage as never) ?? file.defaultOgImage ?? null,
    noindexSite: !!g.noindexSite,
  } : file
  return { tokens, seo, seoInfo: seoInfoFrom(mergeSettings({})) }
}

// ---------------------------------------------------------------- the footer
/**
 * The footer is the same on every page and can be edited from any of them, but
 * only its plain words: the tagline, the disclaimer and the copyright line. Menu
 * links, and anything holding practice details, stay as they are (the details
 * come from Site Settings, and the menu is GYA's to change).
 */
export const EDITABLE_CHROME = ['footer'] as const
export const chromeFieldEditable = (f: { type: string; value: string }) =>
  f.type === 'richtext' && !/<a\b|\{\{site:/.test(f.value)

export type SharedPart = { name: string; id: number | string; label: string; fields: EField[] }

export async function sharedPartsForEditor(payload: Payload): Promise<SharedPart[]> {
  const out: SharedPart[] = []
  for (const name of EDITABLE_CHROME) {
    const r = await payload.find({ collection: 'pages', where: { pageSlug: { equals: `_chrome-${name}` } }, limit: 1, depth: 0, overrideAccess: true })
    const d = r.docs[0] as unknown as (PageDoc & { id: number | string }) | undefined
    const s = d?.sections?.[0]
    if (!d || !s) continue
    out.push({ name, id: d.id, label: d.title, fields: (s.content ?? []).map(fieldFromDoc) })
  }
  return out
}

type ChromeEdit = { name: string; fields: { id: string; value: string }[] }

const cleanChromeEdits = (raw: unknown): ChromeEdit[] =>
  Array.isArray(raw)
    ? raw.filter((c) => c && (EDITABLE_CHROME as readonly string[]).includes(c.name) && Array.isArray(c.fields))
      .map((c) => ({ name: String(c.name), fields: c.fields.filter((f: { id?: unknown; value?: unknown }) => typeof f?.id === 'string' && typeof f?.value === 'string') }))
    : []

/** The furniture with unsaved footer words applied, for the preview. */
export function chromeWithEdits(chrome: Chrome, raw: unknown): Chrome {
  const parts = { ...chrome.parts }
  for (const e of cleanChromeEdits(raw)) {
    const part = parts[e.name]
    if (!part) continue
    const vals = new Map(e.fields.map((f) => [f.id, f.value]))
    parts[e.name] = { ...part, fields: part.fields.map((f) => (chromeFieldEditable(f) && vals.has(f.id) ? { ...f, value: vals.get(f.id)! } : f)) }
  }
  return { ...chrome, parts }
}

/** Save footer words. Only fields that are editable on the page are ever changed. */
export async function saveChromeEdits(payload: Payload, user: unknown, raw: unknown): Promise<void> {
  for (const e of cleanChromeEdits(raw)) {
    const r = await payload.find({ collection: 'pages', where: { pageSlug: { equals: `_chrome-${e.name}` } }, limit: 1, depth: 0, overrideAccess: true })
    const d = r.docs[0] as unknown as (PageDoc & { id: number | string; sections: (SectionDoc & { id?: string })[] }) | undefined
    if (!d?.sections?.[0]) continue
    const vals = new Map(e.fields.map((f) => [f.id, f.value]))
    let changed = false
    const content = (d.sections[0].content ?? []).map((c) => {
      const next = { ...c, image: relId(c.image) as never }
      if (c.kind === 'richtext' && chromeFieldEditable({ type: 'richtext', value: c.text ?? '' }) && vals.has(c.fieldId) && vals.get(c.fieldId) !== c.text) {
        next.text = vals.get(c.fieldId)!
        changed = true
      }
      return next
    })
    if (!changed) continue
    await payload.update({
      collection: 'pages', id: d.id, depth: 0, user: user as never, overrideAccess: false,
      data: { sections: [{ ...d.sections[0], content }, ...d.sections.slice(1)] } as never,
    })
  }
}
