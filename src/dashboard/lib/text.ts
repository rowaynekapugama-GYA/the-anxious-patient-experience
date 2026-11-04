/**
 * Field values are stored as HTML exactly as they appear in the page. The editor
 * shows plain words, with practice details as {phone}-style placeholders, and
 * turns them back into HTML only when something is actually changed.
 */
import { escText, friendlyToTokens, tokensToFriendly, unescapeHtml } from '../util'

export function textForEditing(value: string): string {
  return unescapeHtml(tokensToFriendly(value))
}

export function textForSaving(text: string): string {
  return friendlyToTokens(escText(text).replace(/"/g, '&quot;'))
}

export function linkForEditing(value: string): string {
  return tokensToFriendly(value).replace(/&amp;/g, '&')
}

export function linkForSaving(text: string): string {
  return friendlyToTokens(String(text).trim().replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E'))
}

const ALLOWED_INLINE = new Set(['A', 'STRONG', 'B', 'EM', 'I', 'BR', 'SUP', 'SUB', 'SPAN', 'SMALL', 'U'])
const SAFE_STYLE = /^[\w\s:;.,%#()'-]*$/

/**
 * Clean the HTML a contenteditable produced down to the inline formatting the
 * site's own wording uses: accent spans, links, bold, italic and line breaks.
 */
export function cleanInlineHtml(root: HTMLElement): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escText(node.textContent || '')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const inner = Array.from(el.childNodes).map(walk).join('')
    if (!ALLOWED_INLINE.has(el.tagName)) return inner
    const tag = el.tagName.toLowerCase()
    if (tag === 'br') return '<br>'
    if (tag === 'a') {
      const href = el.getAttribute('href') || ''
      if (!href || /^\s*javascript:/i.test(href)) return inner
      const extra = el.getAttribute('target') === '_blank' ? ` target="_blank" rel="${el.getAttribute('rel') || 'noopener'}"` : ''
      return `<a href="${href.replace(/"/g, '%22')}"${extra}>${inner}</a>`
    }
    if (tag === 'span') {
      const cls = el.getAttribute('class')
      return cls && /^[\w -]+$/.test(cls) ? `<span class="${cls}">${inner}</span>` : inner
    }
    const style = el.getAttribute('style')
    if (style && SAFE_STYLE.test(style) && !/url\(|expression/i.test(style)) return `<${tag} style="${style}">${inner}</${tag}>`
    return `<${tag}>${inner}</${tag}>`
  }
  return friendlyToTokens(Array.from(root.childNodes).map(walk).join(''))
}

export function richForEditing(value: string): string {
  return tokensToFriendly(value)
}

/** Count of characters and a Good / Short / Too long verdict for SEO fields. */
export function seoVerdict(len: number, min: number, max: number): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (len === 0) return { label: 'Missing', tone: 'bad' }
  if (len < min) return { label: 'Short', tone: 'warn' }
  if (len > max) return { label: 'Too long', tone: 'warn' }
  return { label: 'Good', tone: 'good' }
}
