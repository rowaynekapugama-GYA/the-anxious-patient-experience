/**
 * The content model the public site is built from (content/pages/*.json).
 *
 * A page is its head (everything up to <main>, with the SEO values as {{seo:...}} tokens), its sections,
 * the shared footer and its tail (the offer pop-up, structured data and scripts). Each section is its own
 * original markup with every editable value replaced by a {{fN}} placeholder, plus the values (Heading,
 * Paragraph, Photo, Button link). An unedited page therefore renders back byte for byte by construction,
 * while the dashboard edits words and photos on the page itself.
 */

/** srcset: the sizes a photo comes in; follows its photo (`of`) and falls back to the one file once replaced. */
export type FieldType = 'richtext' | 'text' | 'href' | 'image' | 'alt' | 'srcset'

export type Field = {
  id: string
  label: string
  type: FieldType
  value: string
  /** image: the photo the site shipped with */
  original?: string
  /** srcset: the photo field it belongs to */
  of?: string
  width?: string | null
  height?: string | null
}

export type Part = {
  key: string
  kind: string
  label: string
  tag: string
  attrs: Record<string, string | null>
  template: string
  fields: Field[]
}

export type PageMeta = {
  title?: string
  description?: string
  /** a site path or full URL; blank uses the default share picture */
  ogImage?: string
  canonical?: string
  noindex?: boolean
}

export type ScriptRef = { inline?: string; src?: string | null; type?: string | null }

export type Page = {
  slug: string
  name?: string
  path: string
  group?: string
  meta: PageMeta
  /** <!DOCTYPE html> to <main id="main">, with tokens */
  head: string
  sections: Part[]
  order: string[]
  /** after the footer: pop-up, structured data, scripts */
  tail: string
  /** kept for the standard dashboard's data shape; unused on this site */
  jsonLd?: string[]
  bodyScripts?: ScriptRef[]
  headScripts?: ScriptRef[]
  chromeOverrides?: Record<string, Record<string, string>>
}

export type Chrome = { parts: Record<string, Part>; notes?: unknown[] }

export type Redirect = { from: string; to: string; type: 'permanent' | 'temporary' }

/** Field values as the page shows them: a photo's sizes follow the photo once it has been replaced. */
export function resolvedFields(fields: Field[]): Field[] {
  const byId = new Map(fields.map((f) => [f.id, f]))
  return fields.map((f) => {
    if (f.type !== 'srcset' || !f.of) return f
    const img = byId.get(f.of)
    if (!img || !img.original || img.value === img.original) return f
    return { ...f, value: img.value }
  })
}

/** Substitute the stored field values back into a part's template. */
export function renderPart(part: Part, overrides?: Record<string, string>): string {
  let out = part.template
  const fields = resolvedFields(part.fields.map((f) => (overrides?.[f.id] !== undefined ? { ...f, value: overrides[f.id] } : f)))
  for (const f of fields) out = out.split(`{{${f.id}}}`).join(f.value ?? '')
  return out
}

/** A part whose every image slot is empty is not rendered at all. */
export function isEmptySlot(part: Part): boolean {
  const images = part.fields.filter((f) => f.type === 'image')
  return images.length > 0 && images.every((f) => !f.value)
}
