/**
 * Pages as HTML: the public site (scripts/render-site.ts) and the page editor's preview both use this,
 * so what the editor shows is what goes live (after the Coastal Dental, Precision Dental and Tooth n Care
 * editors, GYA standard dashboard).
 *
 * In the editor every editable spot is marked:
 * - words become <pd-e data-pde="s:<section>|f3" data-t="text|rich">...</pd-e>, clicked to edit in place;
 *   practice details inside them ({{site:phoneLink}}) are locked chips that fill in from Site Settings;
 * - photos get data-pdi (the photo field) and data-pda (its description field);
 * - links get data-pdh (the address field);
 * - each section's own element gets data-pds, so the Sections tab can scroll to it.
 * Words inside <option>, <script>, <style>, <title>, <textarea> or an SVG drawing are not marked.
 *
 * With marking off, renderPageHtml gives the page exactly as the website serves it, which
 * scripts/qa-editor.ts uses to prove the markers change nothing else.
 */
import type { Chrome, Field, Page, Part } from '@/lib/parts'
import { resolvedFields } from '@/lib/parts'
import { applyTokens } from '@/lib/tokens'

const RAW = new Set(['script', 'style', 'title', 'textarea', 'option'])
const PH = /\{\{([a-z][a-z0-9-]*)\}\}/g
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'track', 'wbr'])

const attrEsc = (v: string) => v.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;').replace(/"/g, '&quot;')
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function openTag(tag: string, attrs: Record<string, string | null>, extra = ''): string {
  let out = `<${tag}`
  for (const [k, v] of Object.entries(attrs)) out += v === null ? ` ${k}` : ` ${k}="${v}"`
  return `${out}${extra}>`
}

/** Practice details inside words become locked chips; tokens inside tags are left alone. */
function chips(v: string): string {
  return v
    .split(/(<[^>]*>)/)
    .map((seg) => (seg.startsWith('<') ? seg : seg.replace(/\{\{site:([a-zA-Z0-9]+)\}\}/g,
      '<span class="pd-tok" contenteditable="false" data-pdt="$1">{{site:$1}}</span>')))
    .join('')
}

/** Fill a part's {{fN}} placeholders with its values, marking each editable spot. */
export function markTemplate(template: string, scope: string, fields: Field[], canEdit: (f: Field) => boolean = () => true): string {
  const byId = new Map(fields.map((f) => [f.id, f]))
  const value = (id: string) => byId.get(id)?.value ?? ''
  const ref = (id: string) => `${scope}|${id}`
  let svg = 0
  let out = ''
  let i = 0
  const n = template.length

  const text = (s: string) => s.replace(PH, (_m, id: string) => {
    const f = byId.get(id)
    if (!f) return ''
    const v = value(id)
    if (svg > 0 || (f.type !== 'richtext' && f.type !== 'text') || !canEdit(f)) return v
    return `<pd-e data-pde="${ref(id)}" data-t="${f.type === 'richtext' ? 'rich' : 'text'}">${chips(v)}</pd-e>`
  })

  const tag = (t: string, name: string, closing: boolean) => {
    if (closing) return t
    const marks: string[] = []
    const filled = t.replace(/([\w:-]+)=("([^"]*)"|'([^']*)')/g, (whole, attrName: string) => {
      if (!/\{\{[a-z][a-z0-9-]*\}\}/.test(whole)) return whole
      const a = attrName.toLowerCase()
      const id = [...whole.matchAll(PH)].map((m) => m[1])[0]
      const f = byId.get(id)
      if (f && svg === 0 && canEdit(f)) {
        if (name === 'img' && a === 'src' && f.type === 'image') marks.push(`data-pdi="${ref(id)}"`)
        else if (name === 'img' && a === 'alt' && f.type === 'alt') marks.push(`data-pda="${ref(id)}"`)
        else if (name === 'a' && a === 'href' && f.type === 'href') marks.push(`data-pdh="${ref(id)}"`)
      }
      return whole.replace(PH, (_m, fid: string) => value(fid))
    })
    if (!marks.length) return filled
    return filled.replace(/^<([a-zA-Z][\w:-]*)/, `<$1 ${marks.join(' ')}`)
  }

  while (i < n) {
    const lt = template.indexOf('<', i)
    out += text(template.slice(i, lt < 0 ? n : lt))
    if (lt < 0) break
    if (template.startsWith('<!--', lt)) {
      const end = template.indexOf('-->', lt)
      const stop = end < 0 ? n : end + 3
      out += template.slice(lt, stop).replace(PH, (_m, id: string) => value(id))
      i = stop
      continue
    }
    const m = /^<(\/?)([a-zA-Z][\w:-]*)/.exec(template.slice(lt, lt + 64))
    if (!m) { out += '<'; i = lt + 1; continue }
    let j = lt + m[0].length
    let q: string | null = null
    while (j < n) {
      const c = template[j]
      if (q) { if (c === q) q = null } else if (c === '"' || c === "'") q = c
      else if (c === '>') break
      j++
    }
    const t = template.slice(lt, j + 1)
    const name = m[2].toLowerCase()
    const closing = m[1] === '/'
    out += tag(t, name, closing)
    i = j + 1
    if (closing) {
      if (name === 'svg' && svg > 0) svg--
      continue
    }
    if (name === 'svg' && !t.endsWith('/>')) svg++
    if (RAW.has(name)) {
      const close = template.toLowerCase().indexOf(`</${name}`, i)
      const stop = close < 0 ? n : close
      out += template.slice(i, stop).replace(PH, (_m, id: string) => value(id))
      i = stop
    }
  }
  return out
}

function plainInner(part: Part): string {
  let out = part.template
  for (const f of resolvedFields(part.fields)) out = out.split(`{{${f.id}}}`).join(f.value ?? '')
  return out
}

function isEmptySlot(part: Part): boolean {
  const images = part.fields.filter((f) => f.type === 'image')
  return images.length > 0 && images.every((f) => !f.value)
}

function partHtml(part: Part, inner: string, extra = ''): string {
  const open = openTag(part.tag, part.attrs, extra)
  if (VOID.has(part.tag)) return open
  return `${open}${inner}</${part.tag}>`
}

// ---------------------------------------------------------------- SEO and structured data
export type SeoDefaults = { defaultTitle?: string; defaultDescription?: string; defaultOgImage?: string | null; noindexSite?: boolean }

export type SeoInfo = {
  /** from Site Settings: the default share picture and its size and description */
  ogImage: string
  ogImageAlt: string
  ogImageWidth: string
  ogImageHeight: string
}

const abs = (origin: string, p: string) => (!p ? '' : /^https?:\/\//i.test(p) ? p : origin + (p.startsWith('/') ? p : '/' + p))

export function seoTokens(page: Page, origin: string, d: SeoDefaults, info: SeoInfo): Record<string, string> {
  const m = page.meta ?? {}
  const share = m.ogImage || d.defaultOgImage || info.ogImage
  const isDefault = share === info.ogImage
  const noindex = !!m.noindex || !!d.noindexSite
  return {
    title: esc(m.title || d.defaultTitle || ''),
    description: esc(m.description || d.defaultDescription || ''),
    url: esc(m.canonical || origin + page.path),
    ogImage: esc(abs(origin, share)),
    ogImageExtra: isDefault
      ? `<meta property="og:image:width" content="${esc(info.ogImageWidth)}"/><meta property="og:image:height" content="${esc(info.ogImageHeight)}"/><meta property="og:image:alt" content="${esc(info.ogImageAlt)}"/>`
      : '',
    robots: noindex ? '<meta name="robots" content="noindex, follow"/>' : '',
  }
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function plain(s: string): string {
  return String(s ?? '')
    .replace(/<!--.*?-->/gs, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      return NAMED[e] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** FAQPage structured data from the questions on the page, so it always matches what visitors read. */
export function faqSchema(mainHtml: string): string {
  const cards = [...mainHtml.matchAll(/<article class="faq-card"[^>]*>(.*?)<\/article>/gs)]
  if (!cards.length) return ''
  const mainEntity = cards.map((c) => {
    const q = /<h3[^>]*>(.*?)<\/h3>/s.exec(c[1])
    const answer = [...c[1].matchAll(/<(p|li)\b[^>]*>(.*?)<\/\1>/gs)].map((p) => plain(p[2])).filter(Boolean).join(' ')
    return { '@type': 'Question', name: plain(q ? q[1] : ''), acceptedAnswer: { '@type': 'Answer', text: answer } }
  })
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity })}</script>`
}

// ---------------------------------------------------------------- the page
export type RenderOptions = {
  chrome: Chrome
  /** {{site:...}} values (Site Settings) */
  tokens: Record<string, string>
  /** {{site:...}} values that depend on the page (links back to the homepage sections) */
  pageTokens?: Record<string, string>
  seo: SeoDefaults
  seoInfo: SeoInfo
  /** mark every editable spot for the visual editor */
  editable?: boolean
  /** extra markup for the end of <head> */
  head?: string
  /** shared parts whose words can be edited on the page, with the rule for which fields */
  editableChrome?: Record<string, (f: Field) => boolean>
}

function sectionsHtml(page: Page, o: RenderOptions): string {
  const out: string[] = []
  for (const step of page.order) {
    if (!step.startsWith('section:')) continue
    const s = page.sections[Number(step.slice(8))]
    if (!s || isEmptySlot(s)) continue
    out.push(o.editable
      ? partHtml(s, markTemplate(s.template, `s:${s.key}`, resolvedFields(s.fields)), ` data-pds="${attrEsc(s.key)}"`)
      : partHtml(s, plainInner(s)))
  }
  return out.join('')
}

function footerHtml(o: RenderOptions): string {
  const part = o.chrome.parts.footer
  if (!part) return ''
  const rule = o.editable ? o.editableChrome?.footer : undefined
  if (rule) return partHtml(part, markTemplate(part.template, 'c:footer', resolvedFields(part.fields), rule), ' data-pdc="footer" data-pds="c:footer"')
  return partHtml(part, plainInner(part), o.editable ? ' data-pdc="footer"' : '')
}

/** A whole HTML document for the page: the public file, or the editor's preview with o.editable. */
export function renderPageHtml(page: Page, o: RenderOptions): string {
  const origin = o.tokens.origin ?? ''
  const seo = seoTokens(page, origin, o.seo, o.seoInfo)
  const tokens = { ...o.tokens, ...(o.pageTokens ?? {}) }
  let head = page.head.replace(/\{\{seo:([a-zA-Z]+)\}\}/g, (m, k: string) => seo[k] ?? m)
  if (o.head) head = head.replace('</head>', `${o.head}</head>`)
  // the menu is GYA's to change: clicking it in the editor explains that
  if (o.editable) head = head.replace('<header class="site-header"', '<header class="site-header" data-pdc="header"')
  const main = sectionsHtml(page, o)
  let tail = page.tail
  if (o.editable) tail = tail.replace(/<dialog class="special-pop".*?<\/dialog>/s, '')
  tail = tail.replace('{{gen:faqSchema}}', () => faqSchema(applyTokens(main, tokens)))
  return applyTokens(head + main + '</main>' + footerHtml(o) + tail, tokens)
}

/** Styles that make the page editable without changing how it looks. */
export const EDIT_CSS = `<style id="pd-edit-css">
pd-e{outline:1px dashed transparent;outline-offset:3px;border-radius:2px;cursor:text;transition:outline-color .15s,background-color .15s}
pd-e:hover{outline-color:rgba(186,156,126,.95)}
pd-e:focus{outline:2px solid #BA9C7E;background-color:rgba(210,180,144,.14)}
pd-e:empty{display:inline-block;min-width:4ch}
pd-e:empty::before{content:'Add words';opacity:.45;font-style:italic}
.pd-tok{background:rgba(210,180,144,.32);border-radius:3px;padding:0 2px;cursor:default}
img[data-pdi]{cursor:pointer}
img[data-pdi]:hover{outline:3px solid rgba(186,156,126,.95);outline-offset:-3px}
img.pd-sel,img.pd-sel:hover{outline:3px solid #BA9C7E;outline-offset:-3px}
.pd-flash{animation:pdflash 1.4s ease}
@keyframes pdflash{0%,40%{box-shadow:inset 0 0 0 4px #BA9C7E}100%{box-shadow:inset 0 0 0 4px rgba(186,156,126,0)}}
.js .reveal,.js .reveal:not(.in){opacity:1!important;transform:none!important;translate:none!important}
.scroll-progress{display:none!important}
.bio-more.is-collapsed{grid-template-rows:1fr!important}
.bio-more.is-collapsed .bio-more-inner{visibility:visible!important}
.read-more{display:none!important}
.faq-deck{grid-template-columns:minmax(0,1fr)!important}
.faq-index,.faq-nav,.faq-controls{display:none!important}
.faq-track{flex-direction:column!important;overflow:visible!important;scroll-snap-type:none!important}
.faq-card{flex:none!important;width:auto!important;max-width:none!important}
.site-header{position:relative!important}
</style>`
