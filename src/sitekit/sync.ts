/**
 * The bridge between the JSON the website builds from and the documents the dashboard edits.
 * Everything here has to be reversible: importing the JSON into the database and pulling it back out
 * again must produce the same bytes (scripts/qa-roundtrip.ts).
 */

import type { Field, Part, Page } from '@/lib/parts'

export type MediaLike = { id?: string | number; url?: string | null; filename?: string | null; alt?: string | null }

export type SectionDoc = {
  key: string
  kind: string
  label: string
  tag: string
  attrs: string
  template: string
  hidden?: boolean | null
  content: FieldDoc[]
}

export type FieldDoc = {
  fieldId: string
  kind: string
  label: string
  text?: string | null
  link?: string | null
  image?: MediaLike | string | number | null
  builtIn?: string | null
  /** srcset: the photo field it follows */
  of?: string | null
  w?: string | null
  h?: string | null
}

export type PageDoc = {
  title: string
  pageSlug: string
  path: string
  group?: string | null
  isChrome?: boolean | null
  sortOrder?: number | null
  sections: SectionDoc[]
  order: string
  headHtml?: string | null
  tailHtml?: string | null
  meta?: Record<string, unknown> | null
}

/** Media URLs are stored root relative so the built pages never hard code a host. */
export function mediaUrl(value: MediaLike | string | number | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') return null
  const url = value.url
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? url : `/${url}`
}

// ---------------------------------------------------------------- to the DB

function fieldToDoc(field: Field): FieldDoc {
  const doc: FieldDoc = { fieldId: field.id, kind: field.type, label: field.label }
  if (field.type === 'image') {
    doc.builtIn = field.original ?? field.value ?? ''
    if (field.width) doc.w = field.width
    if (field.height) doc.h = field.height
  } else if (field.type === 'href') doc.link = field.value ?? ''
  else {
    doc.text = field.value ?? ''
    if (field.type === 'srcset' && field.of) doc.of = field.of
  }
  return doc
}

export function partToSectionDoc(part: Part): SectionDoc {
  return {
    key: part.key,
    kind: part.kind,
    label: part.label,
    tag: part.tag,
    attrs: JSON.stringify(part.attrs),
    template: part.template,
    hidden: false,
    content: part.fields.map(fieldToDoc),
  }
}

export function pageToDoc(page: Page, extra?: { title?: string; isChrome?: boolean; sortOrder?: number }): PageDoc {
  return {
    title: extra?.title ?? page.name ?? page.meta?.title ?? page.slug,
    pageSlug: page.slug,
    path: page.path,
    group: page.group ?? '',
    isChrome: extra?.isChrome ?? false,
    sortOrder: extra?.sortOrder ?? 0,
    sections: page.sections.map(partToSectionDoc),
    order: JSON.stringify(page.order),
    headHtml: page.head,
    tailHtml: page.tail,
    meta: {
      title: page.meta?.title ?? '',
      description: page.meta?.description ?? '',
      ogImagePath: page.meta?.ogImage ?? '',
      canonical: page.meta?.canonical ?? '',
      noindex: !!page.meta?.noindex,
    },
  }
}

// -------------------------------------------------------------- back out again

function docToField(doc: FieldDoc): Field {
  const type = doc.kind as Field['type']
  if (type === 'image') {
    const out: Field = { id: doc.fieldId, label: doc.label, type, value: mediaUrl(doc.image) ?? doc.builtIn ?? '', original: doc.builtIn ?? '' }
    if (doc.w) out.width = doc.w
    if (doc.h) out.height = doc.h
    return out
  }
  if (type === 'href') return { id: doc.fieldId, label: doc.label, type, value: doc.link ?? '' }
  if (type === 'srcset') return { id: doc.fieldId, label: doc.label, type, value: doc.text ?? '', of: doc.of ?? '' }
  return { id: doc.fieldId, label: doc.label, type, value: doc.text ?? '' }
}

export function sectionDocToPart(doc: SectionDoc): Part {
  let attrs: Record<string, string | null> = {}
  try {
    attrs = JSON.parse(doc.attrs || '{}') as Record<string, string | null>
  } catch {
    attrs = {}
  }
  return {
    key: doc.key,
    kind: doc.kind,
    label: doc.label,
    tag: doc.tag,
    attrs,
    template: doc.template,
    fields: (doc.content ?? []).map(docToField),
  }
}

function parse<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export function docToPage(doc: PageDoc): Page {
  const meta = (doc.meta ?? {}) as Record<string, unknown>
  const ogImage = mediaUrl(meta.ogImage as MediaLike) ?? ((meta.ogImagePath as string) || undefined)

  // only write the keys the original had, so a pull matches the source byte for byte
  const m: Page['meta'] = {}
  if (typeof meta.title === 'string' && meta.title) m.title = meta.title
  if (typeof meta.description === 'string' && meta.description) m.description = meta.description
  if (ogImage) m.ogImage = ogImage
  if (typeof meta.canonical === 'string' && meta.canonical) m.canonical = meta.canonical
  m.noindex = !!meta.noindex

  const out: Page = {
    slug: doc.pageSlug,
    name: doc.title,
    path: doc.path,
    group: doc.group || undefined,
    meta: m,
    head: doc.headHtml ?? '',
    sections: (doc.sections ?? []).map(sectionDocToPart),
    order: parse<string[]>(doc.order, []),
    tail: doc.tailHtml ?? '',
  }

  // sections the editor has hidden are dropped from the built site
  const keep = new Set<number>()
  ;(doc.sections ?? []).forEach((s, i) => {
    if (!s.hidden) keep.add(i)
  })
  if (keep.size !== (doc.sections ?? []).length) {
    const remap = new Map<number, number>()
    let next = 0
    ;(doc.sections ?? []).forEach((_, i) => {
      if (keep.has(i)) remap.set(i, next++)
    })
    out.sections = out.sections.filter((_, i) => keep.has(i))
    out.order = out.order
      .map((step) => {
        if (!step.startsWith('section:')) return step
        const i = Number(step.slice(8))
        return remap.has(i) ? `section:${remap.get(i)}` : null
      })
      .filter((s): s is string => s !== null)
  }
  return out
}

/** The key order the page JSON files are written with (the same as the extraction wrote them). */
export function orderedPage(page: Page): Record<string, unknown> {
  return {
    slug: page.slug,
    name: page.name,
    path: page.path,
    ...(page.group ? { group: page.group } : {}),
    meta: page.meta,
    head: page.head,
    sections: page.sections,
    order: page.order,
    tail: page.tail,
  }
}

/**
 * Site Settings as content/site-settings.json holds them. The build writes the file from this, and the
 * dashboard preview uses it directly, so both resolve {{site:...}} tokens the same way.
 * Expects the global read at depth 1. Empty values are left out, so the defaults apply.
 */
export function settingsFileFromGlobal(raw: Record<string, unknown>): Record<string, unknown> {
  const s = JSON.parse(JSON.stringify(raw, (_k, v) => (v === null || v === '' ? undefined : v))) as Record<string, any>
  const out: Record<string, unknown> = {}
  const copy = (k: string) => { if (s[k] !== undefined) out[k] = s[k] }
  ;['practiceName', 'phone', 'apeEmail', 'receptionEmail'].forEach(copy)
  if (s.clinic) {
    const c: Record<string, string> = {}
    for (const k of ['name', 'street', 'suburb', 'state', 'postcode', 'mapsUrl']) if (s.clinic[k]) c[k] = s.clinic[k]
    if (Object.keys(c).length) out.clinic = c
  }
  const recipients = ((s.bookingRecipients as { address?: string }[] | undefined) ?? []).map((r) => r.address).filter(Boolean)
  if (recipients.length) out.bookingRecipients = recipients
  if (s.tracking && (s.tracking.ga4 || s.tracking.metaPixel)) out.tracking = { ga4: s.tracking.ga4 ?? '', metaPixel: s.tracking.metaPixel ?? '' }
  return out
}
