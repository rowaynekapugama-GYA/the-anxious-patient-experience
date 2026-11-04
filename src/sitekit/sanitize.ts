/** What a blog post body may contain: plain article markup and nothing that runs. */
import sanitizeHtml from 'sanitize-html'

export function cleanPostBody(html: string): string {
  const out = sanitizeHtml(html, {
    allowedTags: ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'strong', 'b', 'em', 'i', 'a', 'br', 'img', 'figure', 'figcaption', 'sup', 'sub'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
    transformTags: {
      // links to other websites open in a new tab
      a: (tagName, attribs) => {
        const href = attribs.href || ''
        const out: Record<string, string> = { href }
        if (/^https?:\/\//i.test(href)) Object.assign(out, { target: '_blank', rel: 'noopener' })
        return { tagName, attribs: out }
      },
    },
  })
  return out.replace(/\s*\/>/g, '>')
}
