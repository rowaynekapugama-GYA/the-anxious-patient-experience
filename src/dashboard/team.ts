/**
 * The Team screen (v1.8.2): the team cards in the homepage's team section, as a list of people.
 *
 * There is no separate store. The cards are the <article class="member"> blocks in the team section's markup,
 * and their words and photos are that section's fields, so the Team screen and the page editor always edit the
 * same thing. Saving here rewrites only the team section: the order of the cards, which are hidden (kept in
 * the markup between the HIDDEN markers, never rendered), new cards (built like the existing ones) and the
 * values of the fields that belong to each card. Everything else on the homepage is left exactly as it was.
 */
import type { Payload } from 'payload'
import { HIDDEN_CLOSE, HIDDEN_OPEN } from '@/lib/parts'
import { mediaUrl, type FieldDoc, type PageDoc, type SectionDoc } from '@/sitekit/sync'

export const TEAM_KEY = 'team'

export type TeamField = {
  id: string
  kind: string
  label: string
  value: string
  media?: number | string | null
  original?: string
}
export type TeamText = TeamField & { quote?: boolean }
export type TeamLink = { href: TeamField; text: TeamField | null }
export type TeamMember = {
  uid: string
  hidden: boolean
  photo: TeamField | null
  alt: TeamField | null
  name: TeamField | null
  role: TeamField | null
  bios: TeamText[]
  links: TeamLink[]
}
export type TeamData = {
  pageId: number | string
  version: string
  /** the whole team section is hidden in the page editor */
  sectionHidden: boolean
  members: TeamMember[]
  /** set when the section's markup is not a plain list of cards, so the Team screen cannot change its layout */
  problem: string | null
}

/** What the Team screen sends back. A member with no uid is a new card. */
export type TeamSave = {
  version?: string
  members: {
    uid?: string | null
    hidden?: boolean
    /** field id to new value (existing members) */
    values?: Record<string, { value: string; media?: number | string | null }>
    /** new members only */
    add?: { name: string; role: string; bio: string; alt: string; media: number | string | null }
  }[]
}

const PH = /\{\{([a-z][a-z0-9-]*)\}\}/g
const CARD = /(<!--pd:hidden-->)?(<article class="member"[\s\S]*?<\/article>)(<!--\/pd:hidden-->)?/g
const relId = (v: unknown): number | string | null =>
  v && typeof v === 'object' ? ((v as { id?: number | string }).id ?? null) : ((v as number | string | null) ?? null)

type Card = { uid: string; hidden: boolean; html: string; ids: string[] }
type Parsed = { prefix: string; suffix: string; cards: Card[]; problem: string | null }

/** Split the team section's markup into the part before the cards, the cards, and the part after. */
export function parseCards(template: string): Parsed {
  const cards: Card[] = []
  let prefix = ''
  let last = -1
  let problem: string | null = null
  for (const m of template.matchAll(CARD)) {
    const at = m.index ?? 0
    if (last < 0) prefix = template.slice(0, at)
    else if (template.slice(last, at).trim()) problem = 'Something other than team cards sits between the cards.'
    if (!!m[1] !== !!m[3]) problem = 'A hidden card is not closed properly.'
    const html = m[2]
    const uid = /^<article\b[^>]*\bid="([^"]+)"/.exec(html)?.[1] ?? `card-${cards.length + 1}`
    cards.push({ uid, hidden: !!m[1], html, ids: [...html.matchAll(PH)].map((x) => x[1]) })
    last = at + m[0].length
  }
  if (!cards.length) return { prefix: template, suffix: '', cards, problem: 'No team cards were found in the team section.' }
  if (new Set(cards.map((c) => c.uid)).size !== cards.length) problem = 'Two team cards share the same name in the markup.'
  return { prefix, suffix: template.slice(last), cards, problem }
}

function fieldOf(row: FieldDoc | undefined): TeamField | null {
  if (!row) return null
  if (row.kind === 'image') return { id: row.fieldId, kind: row.kind, label: row.label, value: mediaUrl(row.image as never) ?? row.builtIn ?? '', media: relId(row.image), original: row.builtIn ?? '' }
  if (row.kind === 'href') return { id: row.fieldId, kind: row.kind, label: row.label, value: row.link ?? '' }
  return { id: row.fieldId, kind: row.kind, label: row.label, value: row.text ?? '' }
}

/** The people on one card: which field is the photo, the name, the role, the bios and any buttons. */
function memberOf(card: Card, rows: Map<string, FieldDoc>): TeamMember {
  const h = card.html
  const one = (re: RegExp) => { const id = re.exec(h)?.[1]; return id ? fieldOf(rows.get(id)) : null }
  const img = /<img\b[^>]*>/.exec(h)?.[0] ?? ''
  const inImg = (re: RegExp) => { const id = re.exec(img)?.[1]; return id ? fieldOf(rows.get(id)) : null }
  const bios: TeamText[] = []
  for (const m of h.matchAll(/<p class="bio[^"]*">\{\{([a-z0-9-]+)\}\}<\/p>|<blockquote>\{\{([a-z0-9-]+)\}\}<\/blockquote>/g)) {
    const f = fieldOf(rows.get(m[1] ?? m[2]))
    if (f) bios.push(m[2] ? { ...f, quote: true } : f)
  }
  const links: TeamLink[] = []
  for (const m of h.matchAll(/<a href="\{\{([a-z0-9-]+)\}\}"[^>]*>\{\{([a-z0-9-]+)\}\}<\/a>/g)) {
    const href = fieldOf(rows.get(m[1]))
    if (href) links.push({ href, text: fieldOf(rows.get(m[2])) })
  }
  return {
    uid: card.uid,
    hidden: card.hidden,
    photo: inImg(/\bsrc="\{\{([a-z0-9-]+)\}\}"/),
    alt: inImg(/\balt="\{\{([a-z0-9-]+)\}\}"/),
    name: one(/<h3\b[^>]*class="member-name[^"]*"[^>]*>\{\{([a-z0-9-]+)\}\}<\/h3>/),
    role: one(/<p class="role[^"]*">\{\{([a-z0-9-]+)\}\}<\/p>/),
    bios,
    links,
  }
}

export function findTeam(doc: PageDoc): SectionDoc | null {
  return (doc.sections ?? []).find((s) => s.key === TEAM_KEY) ?? null
}

/** The team as the Team screen shows it (the homepage document read at depth 1). */
export function teamFromDoc(doc: PageDoc & { id: number | string; updatedAt?: string }): TeamData {
  const row = findTeam(doc)
  if (!row) return { pageId: doc.id, version: String(doc.updatedAt ?? ''), sectionHidden: false, members: [], problem: 'The homepage has no team section.' }
  const rows = new Map((row.content ?? []).map((c) => [c.fieldId, c]))
  const parsed = parseCards(row.template)
  return {
    pageId: doc.id,
    version: String(doc.updatedAt ?? ''),
    sectionHidden: !!row.hidden,
    members: parsed.cards.map((c) => memberOf(c, rows)),
    problem: parsed.problem,
  }
}

// ---------------------------------------------------------------- saving

/** The reveal delay on each photo follows its place in the row of three, as the original cards do. */
function withDelay(html: string, position: number): string {
  const d = position % 3 === 0 ? '' : ` d${position % 3}`
  return html.replace(/class="member-photo reveal pop(?: d\d)?"/, `class="member-photo reveal pop${d}"`)
}

const slug = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/** A new card, built like the existing ones: photo, name, role and a short bio. */
function newCard(uid: string, ids: { photo: string; alt: string; name: string; role: string; bio: string }, size: { w: string; h: string }): string {
  return `<article class="member" id="${uid}" aria-labelledby="${uid}-name"><div class="member-photo reveal pop"><div class="frame arch portrait">`
    + `<img src="{{${ids.photo}}}" width="${size.w}" height="${size.h}" alt="{{${ids.alt}}}" loading="lazy" decoding="async" style="object-position:50% 22%"/></div></div>`
    + `<div class="member-text"><h3 id="${uid}-name" class="member-name reveal">{{${ids.name}}}</h3><p class="role reveal">{{${ids.role}}}</p>`
    + `<p class="bio reveal">{{${ids.bio}}}</p></div></article>`
}

const UNSAFE = /<\s*(script|iframe|object|embed|style)\b|\son[a-z]+\s*=|javascript:/i

export class TeamError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/**
 * The homepage's section rows with the team section rebuilt from what the Team screen sent.
 * Throws TeamError for anything that cannot be applied.
 */
export async function rowsWithTeam(payload: Payload, doc: PageDoc & { updatedAt?: string }, body: TeamSave): Promise<(SectionDoc & { id?: string })[]> {
  if (body.version && doc.updatedAt && body.version !== String(doc.updatedAt)) {
    throw new TeamError(409, 'The homepage was changed somewhere else (perhaps in the page editor) since this screen opened. Reload to see the latest, then make your change again.')
  }
  const rows = (doc.sections ?? []) as (SectionDoc & { id?: string })[]
  const row = rows.find((s) => s.key === TEAM_KEY)
  if (!row) throw new TeamError(404, 'The homepage has no team section.')
  const parsed = parseCards(row.template)
  if (parsed.problem) throw new TeamError(409, `The team section's layout has been changed by hand, so the Team screen cannot rearrange it: ${parsed.problem} Please edit it on the homepage or ask GYA.`)
  if (!Array.isArray(body.members)) throw new TeamError(400, 'Bad request')

  const byUid = new Map(parsed.cards.map((c) => [c.uid, c]))
  const content = (row.content ?? []).map((c) => ({ ...c, image: relId(c.image) as never }))
  const byId = new Map(content.map((c) => [c.fieldId, c]))
  // new field ids follow on from the highest on the whole page, so no two sections ever share one
  const num = (id: string) => Number(/^f(\d+)$/.exec(id)?.[1] ?? 0)
  let next = Math.max(0, ...rows.flatMap((r) => (r.content ?? []).map((c) => num(c.fieldId))), ...rows.flatMap((r) => [...r.template.matchAll(PH)].map((x) => num(x[1])))) + 1
  const newId = () => `f${next++}`
  const usedUids = new Set(parsed.cards.map((c) => c.uid))

  const kept = new Set<string>()
  const out: string[] = []
  const added: FieldDoc[] = []
  let shown = 0
  for (const m of body.members) {
    let html: string
    if (m.uid) {
      const card = byUid.get(m.uid)
      if (!card) throw new TeamError(409, 'A team member on this screen no longer exists. Reload and try again.')
      if (kept.has(m.uid)) throw new TeamError(400, 'Bad request')
      kept.add(m.uid)
      for (const [id, v] of Object.entries(m.values ?? {})) {
        const c = byId.get(id)
        if (!c || !card.ids.includes(id) || typeof v?.value !== 'string') continue
        if (UNSAFE.test(v.value)) throw new TeamError(400, 'Some of the wording contains code that is not allowed. Please retype it.')
        if (c.kind === 'image') c.image = ((typeof v.media === 'number' || typeof v.media === 'string') ? v.media : null) as never
        else if (c.kind === 'href') c.link = v.value
        else c.text = v.value
      }
      html = card.html
    } else {
      const a = m.add
      if (!a || !a.media) throw new TeamError(400, 'A new team member needs a photo before saving.')
      const vals = [a.name, a.role, a.bio, a.alt].map((x) => String(x ?? ''))
      if (vals.some((x) => UNSAFE.test(x))) throw new TeamError(400, 'Some of the wording contains code that is not allowed. Please retype it.')
      const ids = { photo: newId(), alt: newId(), name: newId(), role: newId(), bio: newId() }
      let uid = slug(vals[0]) || 'team-member'
      for (let i = 2; usedUids.has(uid); i++) uid = `${slug(vals[0]) || 'team-member'}-${i}`
      usedUids.add(uid)
      const media = await payload.findByID({ collection: 'media', id: a.media, depth: 0, overrideAccess: true }).catch(() => null) as { width?: number; height?: number } | null
      if (!media) throw new TeamError(400, 'The photo chosen for the new team member could not be found. Please choose it again.')
      const size = { w: String(media.width || 1086), h: String(media.height || 1448) }
      added.push(
        { fieldId: ids.photo, kind: 'image', label: 'Photo', image: a.media as never, builtIn: '' },
        { fieldId: ids.alt, kind: 'alt', label: 'Photo description', text: vals[3] },
        { fieldId: ids.name, kind: 'richtext', label: 'Small heading', text: vals[0] },
        { fieldId: ids.role, kind: 'richtext', label: 'Paragraph', text: vals[1] },
        { fieldId: ids.bio, kind: 'richtext', label: 'Paragraph', text: vals[2] },
      )
      html = newCard(uid, ids, size)
    }
    if (m.hidden) out.push(`${HIDDEN_OPEN}${html}${HIDDEN_CLOSE}`)
    else out.push(withDelay(html, shown++))
  }

  // cards left out were removed, with their words and photos
  const removedIds = new Set(parsed.cards.filter((c) => !kept.has(c.uid)).flatMap((c) => c.ids))
  const template = parsed.prefix + out.join('') + parsed.suffix
  const team = { ...row, template, content: [...content.filter((c) => !removedIds.has(c.fieldId)), ...added] }
  return rows.map((r) => (r.key === TEAM_KEY ? team : { ...r, content: (r.content ?? []).map((c) => ({ ...c, image: relId(c.image) as never })) }))
}
