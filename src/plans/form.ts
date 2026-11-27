/**
 * v1.18.0: treatment plans. The form a plan is written on, as data the dashboard can edit (Treatment plans > Form).
 *
 * A form has a title and sections. A section has a heading and items. An item is either something the clinician
 * fills in (a field) or fixed wording printed on every plan (a paragraph or a boxed note). Field types: short text,
 * long text, date, number, currency amount, tick box, choice list (one, or several) and rows (a small table, such as
 * the recommended treatments, with an optional total for a currency column).
 *
 * Every saved change to the form becomes a new numbered version. A plan keeps the version it was written on, so a
 * plan never changes shape after it has been sent. This file has no server code: the dashboard and the PDF both use it.
 */

export type ColumnType = 'text' | 'number' | 'currency'
export type Column = { id: string; label: string; type: ColumnType }
export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'currency' | 'checkbox' | 'choice' | 'rows'
export type ItemType = FieldType | 'paragraph' | 'callout'

export type Item = {
  id: string
  type: ItemType
  /** the field's label, or a boxed note's heading */
  label: string
  /** help under the field in the dashboard (never printed) */
  help?: string
  /** fixed wording: a paragraph's text, a boxed note's text. {first_name} becomes the patient's first name */
  text?: string
  required?: boolean
  /** choice: the options; multiple: tick several */
  options?: string[]
  multiple?: boolean
  /** rows: the columns, and whether a currency column is totalled */
  columns?: Column[]
  total?: boolean
}
export type Section = { id: string; heading: string; items: Item[] }
export type FormDef = {
  title: string
  subtitle?: string
  /** true for the placeholder GYA shipped: every page of the plan and its PDF says so */
  placeholder?: boolean
  sections: Section[]
}

export const FIELD_TYPES: { type: ItemType; label: string }[] = [
  { type: 'text', label: 'Short text' },
  { type: 'textarea', label: 'Long text' },
  { type: 'date', label: 'Date' },
  { type: 'number', label: 'Number' },
  { type: 'currency', label: 'Currency amount' },
  { type: 'checkbox', label: 'Tick box' },
  { type: 'choice', label: 'Choice list' },
  { type: 'rows', label: 'Rows (a small table)' },
  { type: 'paragraph', label: 'Fixed paragraph (printed as written)' },
  { type: 'callout', label: 'Boxed note (printed as written)' },
]
export const isField = (t: ItemType) => t !== 'paragraph' && t !== 'callout'

/**
 * The placeholder GYA ships, until Lorna's own form is loaded. Plain headings any treatment plan would have, each
 * marked as a placeholder. No clinical wording, treatments, fees or item numbers.
 */
export const PLACEHOLDER_FORM: FormDef = {
  title: 'Your treatment plan',
  subtitle: 'PLACEHOLDER FORM: not approved wording',
  placeholder: true,
  sections: [
    { id: 's1', heading: 'Placeholder: about this plan', items: [
      { id: 'p1', type: 'paragraph', label: 'Opening', text: 'Placeholder text. The practice\'s own opening wording goes here once the form is loaded.' },
    ] },
    { id: 's2', heading: 'Placeholder: what we found', items: [
      { id: 'f1', type: 'textarea', label: 'Placeholder: findings', help: 'Placeholder field.' },
    ] },
    { id: 's3', heading: 'Placeholder: recommended treatment', items: [
      { id: 'f2', type: 'rows', label: 'Placeholder: treatment', total: true, columns: [
        { id: 'c1', label: 'Placeholder: item', type: 'text' },
        { id: 'c2', label: 'Placeholder: notes', type: 'text' },
        { id: 'c3', label: 'Placeholder: fee', type: 'currency' },
      ] },
    ] },
    { id: 's4', heading: 'Placeholder: comfort and pacing', items: [
      { id: 'f3', type: 'choice', label: 'Placeholder: options', multiple: true, options: ['Placeholder option A', 'Placeholder option B'] },
      { id: 'f4', type: 'textarea', label: 'Placeholder: notes' },
    ] },
    { id: 's5', heading: 'Placeholder: next steps', items: [
      { id: 'f5', type: 'date', label: 'Placeholder: date' },
      { id: 'f6', type: 'checkbox', label: 'Placeholder: tick box' },
      { id: 'f7', type: 'text', label: 'Placeholder: short text' },
      { id: 'f8', type: 'number', label: 'Placeholder: number' },
      { id: 'f9', type: 'currency', label: 'Placeholder: amount' },
      { id: 'c1', type: 'callout', label: 'Placeholder: a boxed note', text: 'Placeholder text for a boxed note.' },
    ] },
  ],
}

// ---------------------------------------------------------------- cleaning a form definition

const s = (v: unknown, max: number) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/[^\S\n]+\n/g, '\n').trim().slice(0, max)
const one = (v: unknown, max: number) => s(v, max).replace(/\s*\n\s*/g, ' ')
const slug = (v: unknown, fallback: string) => (String(v ?? '').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 24) || fallback)
const TYPES = new Set<ItemType>(['text', 'textarea', 'date', 'number', 'currency', 'checkbox', 'choice', 'rows', 'paragraph', 'callout'])

/** A form definition from the dashboard, made safe and checked. Throws a plain message if it cannot be used. */
export function cleanForm(raw: unknown): FormDef {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const title = one(r.title, 120)
  if (!title) throw new Error('The form needs a title.')
  const ids = new Set<string>()
  const unique = (id: string) => { let x = id, n = 2; while (ids.has(x)) x = `${id}_${n++}`; ids.add(x); return x }
  const sections: Section[] = (Array.isArray(r.sections) ? r.sections : []).slice(0, 30).map((sec: any, si: number) => {
    const items: Item[] = (Array.isArray(sec?.items) ? sec.items : []).slice(0, 60).map((it: any, ii: number) => {
      const type = (TYPES.has(it?.type) ? it.type : 'text') as ItemType
      const item: Item = { id: unique(slug(it?.id, `i${si + 1}_${ii + 1}`)), type, label: one(it?.label, 200) }
      if (it?.help) item.help = one(it.help, 300)
      if (type === 'paragraph' || type === 'callout') item.text = s(it?.text, 3000)
      if (isField(type) && it?.required) item.required = true
      if (type === 'choice') {
        item.options = [...new Set<string>((Array.isArray(it?.options) ? it.options : []).map((o: unknown) => one(o, 200)).filter(Boolean))].slice(0, 30)
        if (!item.options.length) throw new Error(`"${item.label || 'A choice list'}" needs at least one option.`)
        if (it?.multiple) item.multiple = true
      }
      if (type === 'rows') {
        const cids = new Set<string>()
        item.columns = (Array.isArray(it?.columns) ? it.columns : []).slice(0, 6).map((c: any, ci: number) => {
          let id = slug(c?.id, `c${ci + 1}`); while (cids.has(id)) id += 'x'; cids.add(id)
          return { id, label: one(c?.label, 80), type: (['text', 'number', 'currency'].includes(c?.type) ? c.type : 'text') as ColumnType }
        })
        if (!item.columns!.length) throw new Error(`"${item.label || 'A rows field'}" needs at least one column.`)
        if (it?.total && item.columns!.some((c) => c.type === 'currency')) item.total = true
      }
      if (isField(type) && !item.label) throw new Error('Every field needs a label.')
      if (type === 'paragraph' && !item.text) throw new Error('A fixed paragraph needs its text.')
      return item
    })
    return { id: unique(slug(sec?.id, `s${si + 1}`)), heading: one(sec?.heading, 160), items }
  })
  if (!sections.length) throw new Error('The form needs at least one section.')
  if (!sections.some((x) => x.items.some((i) => isField(i.type)))) throw new Error('The form needs at least one field to fill in.')
  const out: FormDef = { title, sections }
  const sub = one(r.subtitle, 160)
  if (sub) out.subtitle = sub
  if (r.placeholder) out.placeholder = true
  return out
}

// ---------------------------------------------------------------- the answers on a plan

export type Row = Record<string, string>
/** v1.19.0: paragraphs added to a plan from the library, per section id (kept under the answers key EXTRA) */
export type Extras = Record<string, string[]>
export type Value = string | boolean | string[] | Row[] | Extras
export type Answers = Record<string, Value>
/** v1.19.0: the answers key that holds the paragraphs added from the library, by section */
export const EXTRA = '_extra'
export const extrasOf = (a: Answers): Extras => {
  const x = a[EXTRA]
  return x && typeof x === 'object' && !Array.isArray(x) ? x as Extras : {}
}

const money = (v: unknown): string => {
  const t = String(v ?? '').replace(/[$,\s]/g, '')
  if (!t) return ''
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? (Math.round(n * 100) / 100).toFixed(2) : ''
}
const num = (v: unknown): string => {
  const t = String(v ?? '').replace(/[,\s]/g, '')
  if (!t) return ''
  const n = Number(t)
  return Number.isFinite(n) && Math.abs(n) < 1e9 ? String(n) : ''
}
const day = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : '')

/** The answers kept for a form: only its fields, each in its own shape. Anything else is dropped. */
export function cleanAnswers(form: FormDef, raw: unknown): Answers {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const out: Answers = {}
  for (const sec of form.sections) for (const it of sec.items) {
    if (!isField(it.type)) continue
    const v = r[it.id]
    switch (it.type) {
      case 'text': { const x = one(v, 500); if (x) out[it.id] = x; break }
      case 'textarea': { const x = s(v, 8000); if (x) out[it.id] = x; break }
      case 'date': { const x = day(v); if (x) out[it.id] = x; break }
      case 'number': { const x = num(v); if (x) out[it.id] = x; break }
      case 'currency': { const x = money(v); if (x) out[it.id] = x; break }
      case 'checkbox': if (v === true || v === 'true' || v === 'on') out[it.id] = true; break
      case 'choice': {
        const opts = it.options || []
        if (it.multiple) { const x = (Array.isArray(v) ? v : []).map(String).filter((o) => opts.includes(o)); if (x.length) out[it.id] = [...new Set(x)] }
        else if (opts.includes(String(v ?? ''))) out[it.id] = String(v)
        break
      }
      case 'rows': {
        const cols = it.columns || []
        const rows: Row[] = (Array.isArray(v) ? v : []).slice(0, 40).map((row: any) => {
          const o: Row = {}
          for (const c of cols) {
            const x = c.type === 'currency' ? money(row?.[c.id]) : c.type === 'number' ? num(row?.[c.id]) : one(row?.[c.id], 400)
            if (x) o[c.id] = x
          }
          return o
        }).filter((o) => Object.keys(o).length)
        if (rows.length) out[it.id] = rows
        break
      }
    }
  }
  // v1.19.0: paragraphs from the library, only for sections on this form, up to 12 a section
  const ex = r[EXTRA] && typeof r[EXTRA] === 'object' && !Array.isArray(r[EXTRA]) ? r[EXTRA] as Record<string, unknown> : {}
  const extras: Extras = {}
  for (const sec of form.sections) {
    const list = (Array.isArray(ex[sec.id]) ? ex[sec.id] as unknown[] : []).map((x) => s(x, 4000)).filter(Boolean).slice(0, 12)
    if (list.length) extras[sec.id] = list
  }
  if (Object.keys(extras).length) out[EXTRA] = extras
  return out
}

/**
 * v1.19.0: answers reused for another patient.
 *  - 'template': a plan saved as a template keeps everything except dates (a template is the practice's own wording,
 *    which she can edit on the Templates screen).
 *  - 'previous': starting from an earlier plan keeps only the choices, the tick boxes and the paragraphs added from the
 *    library. Everything typed for that patient (text, notes, dates, numbers, amounts and table rows) is cleared.
 */
export function reuseAnswers(form: FormDef, a: Answers, mode: 'template' | 'previous'): Answers {
  const out: Answers = {}
  for (const sec of form.sections) for (const it of sec.items) {
    if (!isField(it.type) || a[it.id] === undefined) continue
    if (it.type === 'date') continue
    if (mode === 'previous' && it.type !== 'choice' && it.type !== 'checkbox') continue
    out[it.id] = a[it.id]
  }
  const ex = extrasOf(a)
  if (Object.keys(ex).length) out[EXTRA] = ex
  return cleanAnswers(form, out)
}

const filled = (v: Value | undefined) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length) && v !== false

/** Required fields still empty (labels), checked when the plan is finalised. */
export function missingRequired(form: FormDef, a: Answers): string[] {
  const out: string[] = []
  for (const sec of form.sections) for (const it of sec.items) if (isField(it.type) && it.required && !filled(a[it.id])) out.push(it.label)
  return out
}

/** The total of a rows field's currency column (cents, to avoid rounding drift), or null when it has none. */
export function rowsTotal(it: Item, rows: Row[] | undefined): number | null {
  if (it.type !== 'rows' || !it.total) return null
  const col = (it.columns || []).find((c) => c.type === 'currency')
  if (!col) return null
  return (rows || []).reduce((sum, r) => sum + Math.round(Number(r[col.id] || 0) * 100), 0) / 100
}

export const fmtMoney = (n: number | string) => `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const fmtDayLong = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d))) }
/** v1.19.0: what the merge fields in fixed wording and library paragraphs are filled with, from the booking and settings */
export type MergeContext = { firstName: string; appointmentDate?: string; dentist?: string }
export const MERGE_FIELDS = [
  { key: '{first_name}', label: "the patient's first name" },
  { key: '{appointment_date}', label: 'the appointment date' },
  { key: '{dentist}', label: 'the clinician on the plan' },
]
/** Fixed wording with the patient's first name (and, from v1.19.0, the appointment date and the dentist) filled in. */
export const fillText = (t: string, ctx: string | MergeContext) => {
  const c: MergeContext = typeof ctx === 'string' ? { firstName: ctx } : ctx
  return String(t || '')
    .split('{first_name}').join(c.firstName || 'there')
    .split('{appointment_date}').join(c.appointmentDate || 'your appointment')
    .split('{dentist}').join(c.dentist || 'your dentist')
}

// ---------------------------------------------------------------- v1.19.0: the wording checks before a plan is finalised
// (the words themselves are in ./phrases.ts, the one file the build's wording check skips because it names them)

/** All the wording on a plan as the patient reads it: fixed wording, chosen options, ticked boxes and everything typed. */
export function planContext(form: FormDef, a: Answers): string {
  const out: string[] = []
  const ex = extrasOf(a)
  for (const sec of form.sections) {
    out.push(sec.heading)
    for (const it of sec.items) {
      if (!isField(it.type)) { out.push(it.label, it.text || ''); continue }
      const v = a[it.id]
      if (typeof v === 'string') out.push(v)
      else if (v === true) out.push(it.label)
      else if (Array.isArray(v)) out.push(...(v as (string | Row)[]).map((x) => (typeof x === 'string' ? x : Object.values(x).join(' '))))
    }
    out.push(...(ex[sec.id] || []))
  }
  return out.join('\n')
}
/** Every piece of text typed or added for this plan, with where it is (fixed form wording was approved with the form). */
export function planTexts(form: FormDef, a: Answers): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = []
  const ex = extrasOf(a)
  for (const sec of form.sections) {
    for (const it of sec.items) {
      if (!isField(it.type)) continue
      const v = a[it.id]
      if (typeof v === 'string' && (it.type === 'text' || it.type === 'textarea')) out.push({ where: it.label, text: v })
      if (it.type === 'rows' && Array.isArray(v)) (v as Row[]).forEach((r, n) => out.push({ where: `${it.label}, row ${n + 1}`, text: Object.values(r).join(' ') }))
    }
    ;(ex[sec.id] || []).forEach((p, n) => out.push({ where: `${sec.heading || 'Section'}, added paragraph ${n + 1}`, text: p }))
  }
  return out
}

/** The one line printed under a totalled table. */
export const ESTIMATE_LINE = 'This total is an estimate for your treatment as planned today, not an advertised price. It may change if your treatment changes.'
