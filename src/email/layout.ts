/**
 * v1.14.0: the one branded layout every APE email uses (patient, team and login emails).
 *
 * Hand-built table HTML with inline styles, the same markup React Email or MJML would produce, kept in plain
 * TypeScript so it renders at send time inside the serverless functions with no extra packages. It follows the usual
 * rules for email: 600 px centred, role="presentation" layout tables, inline CSS, a bulletproof button with a VML
 * fallback for Outlook, a hidden preheader, lang="en-AU", light and dark colours, no scripts, no tracking pixels.
 *
 * Fonts: Playfair Display (headings) and Figtree (text) load from the website's own font files where the email app
 * allows it (Apple Mail, iOS). Everywhere else the fallbacks apply: Georgia for headings, Arial for text. Outlook on
 * Windows is told to use the fallbacks directly, so it never drops to Times New Roman.
 *
 * Every link and image uses the website's own address (NEXT_PUBLIC_SERVER_URL), never a vercel.app address.
 */

export const C = {
  navy: '#284858',
  navyDeep: '#2A3C4E',
  cream: '#F7F4EF',
  blush: '#F0E8E0',
  sand: '#D2B490',
  taupe: '#7E6548',
  line: '#E7DFD4',
  soft: '#4E5F6A',
  white: '#FFFFFF',
}
const SERIF = "'Playfair Display',Georgia,'Times New Roman',serif"
const SANS = "Figtree,Arial,Helvetica,sans-serif"

export const BANNERS = {
  armchair: { label: 'Armchair and candle', file: 'banner-armchair.jpg', alt: 'A soft cream armchair beside a small wooden table with a vase of olive branches and a lit candle' },
  candle: { label: 'Candle and book', file: 'banner-candle.jpg', alt: 'A lit candle in a glass resting on a plain white book, beside a vase of dried flowers' },
  napkin: { label: 'Textured napkin', file: 'banner-napkin.jpg', alt: 'A textured cream napkin with a small tooth outline, resting on soft draped fabric' },
  toothbrushes: { label: 'Toothbrushes and eucalyptus', file: 'banner-toothbrushes.jpg', alt: 'Bamboo toothbrushes in a glass jar beside a sprig of eucalyptus and folded white towels' },
} as const
export type BannerKey = keyof typeof BANNERS

/** A piece of the email body, as HTML and as plain text. */
export type Section = { html: string; text: string }

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const P = `margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.navy};`
const A = `color:${C.navy};text-decoration:underline;`

/** Plain sentences: blank lines make paragraphs, single line breaks stay, web addresses become links. */
export function paragraphs(text: string, o: { size?: number } = {}): Section {
  const style = o.size ? P.replace('font-size:16px', `font-size:${o.size}px`) : P
  const blocks = String(text).replace(/\r\n?/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return {
    html: blocks.map((b) => `<p class="t" style="${style}">${linkify(esc(b)).replace(/\n/g, '<br>')}</p>`).join(''),
    text: blocks.join('\n\n'),
  }
}

/** Web addresses in already-escaped text become links (a long map link reads "Open the map"). */
export function linkify(escaped: string): string {
  return escaped
    .replace(/Map: (https?:\/\/[^\s<]+)/g, `<a href="$1" style="${A}">Open the map</a>`)
    .replace(/(^|[^"=>])(https?:\/\/[^\s<]+)/g, (_m, pre: string, url: string) => {
      const trail = /[.,;:)]+$/.exec(url)?.[0] ?? ''
      const u = trail ? url.slice(0, -trail.length) : url
      return `${pre}<a href="${u}" style="${A}word-break:break-all;">${u}</a>${trail}`
    })
}

/** A soft, sand-edged details box: appointment, reference, location and so on. Built from data, never edited. */
export function panel(rows: [string, string][], o: { title?: string } = {}): Section {
  if (!rows.length) return { html: '', text: '' }
  const cells = rows.map(([k, v]) => `<tr>
<td class="t2" valign="top" style="padding:6px 14px 6px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.taupe};font-weight:bold;white-space:nowrap;width:1%;">${esc(k)}</td>
<td class="t" valign="top" style="padding:6px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.navy};">${linkify(esc(v)).replace(/\n/g, '<br>')}</td>
</tr>`).join('')
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border-collapse:separate;">
<tr><td class="panel" style="background:${C.cream};border:1px solid ${C.line};border-left:4px solid ${C.sand};border-radius:12px;padding:14px 18px;">
${o.title ? `<p class="t" style="margin:0 0 6px;font-family:${SERIF};font-size:18px;line-height:1.3;color:${C.navy};">${esc(o.title)}</p>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
</td></tr></table>`
  const text = `${o.title ? `${o.title}\n` : ''}${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`
  return { html, text }
}

/** A soft box holding a few paragraphs under a title ("Where to go"). */
export function box(title: string, text: string): Section {
  const inner = paragraphs(text, { size: 15 })
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border-collapse:separate;">
<tr><td class="panel" style="background:${C.cream};border:1px solid ${C.line};border-left:4px solid ${C.sand};border-radius:12px;padding:16px 18px 4px;">
<p class="t serif" style="margin:0 0 10px;font-family:${SERIF};font-size:19px;line-height:1.3;color:${C.navy};">${esc(title)}</p>
${inner.html}
</td></tr></table>`
  return { html, text: `${title}\n\n${inner.text}` }
}

/** A quiet, locked note (the deposit policy line, the under-18 line). */
export function note(text: string, o: { link?: { label: string; url: string } } = {}): Section {
  const l = o.link ? ` <a href="${esc(o.link.url)}" style="${A}">${esc(o.link.label)}</a>` : ''
  return {
    html: `<p class="t" style="${P}">${linkify(esc(text))}${l}</p>`,
    text: o.link ? `${text} ${o.link.label}: ${o.link.url}` : text,
  }
}

/** The one button: navy, rounded, and drawn with VML for Outlook on Windows. */
export function button(label: string, url: string): Section {
  const w = Math.min(520, Math.max(200, Math.round(label.length * 9.2 + 64)))
  const u = esc(url)
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;"><tr><td>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:48px;v-text-anchor:middle;width:${w}px;" arcsize="50%" stroke="f" fillcolor="${C.navy}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${esc(label)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!-- --><a class="btn" href="${u}" style="display:inline-block;background:${C.navy};color:#ffffff;font-family:${SANS};font-size:16px;font-weight:bold;line-height:48px;text-align:center;text-decoration:none;padding:0 28px;border-radius:999px;-webkit-text-size-adjust:none;mso-hide:all;">${esc(label)}</a><!--<![endif]-->
</td></tr></table>`
  return { html, text: `${label}: ${url}` }
}

/**
 * v1.17.0: the pieces that make the team, GYA and login emails easy to read at a glance. All built from data, never
 * edited, with the same inline-style table markup as the rest of the layout (Outlook safe, light and dark).
 */
export type Tone = 'ok' | 'warn' | 'info' | 'test'
const TONE: Record<Tone, { bg: string; edge: string; ink: string; mark: string; dot: string }> = {
  ok: { bg: '#EAF2EC', edge: '#5B8A69', ink: '#2F5A3E', mark: '&#10003;', dot: '#5B8A69' },
  warn: { bg: '#FBEDE3', edge: '#B8632F', ink: '#8A4317', mark: '!', dot: '#B8632F' },
  info: { bg: C.blush, edge: C.sand, ink: C.navy, mark: 'i', dot: C.taupe },
  test: { bg: '#FFF5D6', edge: '#C9A227', ink: '#6B5410', mark: 'T', dot: '#C9A227' },
}

/** A coloured status strip at the top of an email: a round mark, a bold line and an optional short sentence. */
export function status(tone: Tone, title: string, body = ''): Section {
  const t = TONE[tone]
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border-collapse:separate;">
<tr><td class="st st-${tone}" style="background:${t.bg};border-left:4px solid ${t.edge};border-radius:12px;padding:14px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" style="padding:1px 12px 0 0;"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${t.dot};color:#ffffff;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">${t.mark}</div></td>
<td valign="top"><p class="st-t" style="margin:0;font-family:${SANS};font-size:16px;line-height:1.45;font-weight:bold;color:${t.ink};">${esc(title)}</p>${body ? `<p class="st-t" style="margin:4px 0 0;font-family:${SANS};font-size:14.5px;line-height:1.5;color:${t.ink};">${linkify(esc(body))}</p>` : ''}</td>
</tr></table>
</td></tr></table>`
  return { html, text: [title, body].filter(Boolean).join('\n') }
}

/** A small heading inside the card ("Appointment", "Next steps"). */
export function subhead(label: string): Section {
  return {
    html: `<p class="eyebrow" style="margin:6px 0 8px;font-family:${SANS};font-size:12px;line-height:1.4;letter-spacing:1.8px;text-transform:uppercase;font-weight:bold;color:${C.taupe};">${esc(label)}</p>`,
    text: label.toUpperCase(),
  }
}

/** Numbered steps, each in a sand circle: what the team does next. */
export function steps(items: string[]): Section {
  if (!items.length) return { html: '', text: '' }
  const rows = items.map((x, n) => `<tr>
<td valign="top" style="padding:0 12px 12px 0;width:28px;"><div class="stepn" style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${C.blush};color:${C.taupe};text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;">${n + 1}</div></td>
<td class="t" valign="top" style="padding:2px 0 12px;font-family:${SANS};font-size:15.5px;line-height:1.5;color:${C.navy};">${linkify(esc(x))}</td>
</tr>`).join('')
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">${rows}</table>`,
    text: items.map((x, n) => `${n + 1}. ${x}`).join('\n'),
  }
}

/** One line per email that was sent: a green tick or an amber cross, what it was, and what SMTP2GO said. */
export function deliveries(rows: { ok: boolean; label: string; detail: string; id?: string }[]): Section {
  if (!rows.length) return { html: '', text: '' }
  const cells = rows.map((r, n) => {
    const t = TONE[r.ok ? 'ok' : 'warn']
    return `<tr>
<td class="rule" valign="top" style="padding:12px 12px 12px 0;width:26px;${n ? `border-top:1px solid ${C.line};` : ''}"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${t.dot};color:#ffffff;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;">${r.ok ? '&#10003;' : '&#10005;'}</div></td>
<td class="rule" valign="top" style="padding:12px 0;${n ? `border-top:1px solid ${C.line};` : ''}">
<p class="t" style="margin:0;font-family:${SANS};font-size:15px;line-height:1.45;font-weight:bold;color:${C.navy};">${esc(r.label)}</p>
<p class="${r.ok ? 't2' : 'st-t'}" style="margin:2px 0 0;font-family:${SANS};font-size:14px;line-height:1.45;color:${r.ok ? C.soft : t.ink};">${esc(r.detail)}</p>
${r.id ? `<p class="t2" style="margin:2px 0 0;font-family:Menlo,Consolas,'Courier New',monospace;font-size:12px;line-height:1.45;color:${C.soft};word-break:break-all;">${esc(r.id)}</p>` : ''}
</td></tr>`
  }).join('')
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border-collapse:separate;">
<tr><td class="panel" style="background:${C.cream};border:1px solid ${C.line};border-radius:12px;padding:4px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
</td></tr></table>`,
    text: rows.map((r) => `${r.ok ? 'OK' : 'FAILED'}  ${r.label}: ${r.detail}${r.id ? ` (${r.id})` : ''}`).join('\n'),
  }
}

/** A quiet small line under everything else ("No patient details are included in this notice."). */
export function small(text: string): Section {
  return { html: `<p class="t2" style="margin:0 0 14px;font-family:${SANS};font-size:13px;line-height:1.55;color:${C.soft};">${linkify(esc(text))}</p>`, text }
}

export type Footer = {
  /** patient emails: where appointments happen and how to reach the team */
  location?: string
  email?: string
  phone?: string
  /** why the person got this email */
  reason: string
  privacy?: boolean
}

export type ShellInput = {
  origin: string
  variant: 'patient' | 'team' | 'login'
  subject: string
  preheader?: string
  eyebrow?: string
  heading?: string
  banner?: BannerKey | 'none' | ''
  sections: Section[]
  signoff?: string
  sender?: string
  footer: Footer
}

const PREHEADER_FILL = '&#847;&zwnj;&nbsp;'.repeat(60)

/** The whole email: head, preheader, logo, optional banner, heading, the sections, sign-off and footer. */
export function shell(i: ShellInput): { html: string; text: string } {
  const o = i.origin.replace(/\/+$/, '')
  const team = i.variant !== 'patient'
  const logoW = team ? 88 : 128
  const banner = i.banner && i.banner !== 'none' ? BANNERS[i.banner] : null
  const font = (file: string, family: string, weight: number) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url('${o}/assets/fonts/${file}') format('woff2');}`
  const sign = [i.signoff, i.sender].filter(Boolean)

  const f = i.footer
  const contact = [f.email ? `<a href="mailto:${esc(f.email)}" style="color:${C.soft};text-decoration:underline;">${esc(f.email)}</a>` : '', f.phone ? `<a href="tel:${esc(f.phone.replace(/[^\d+]/g, ''))}" style="color:${C.soft};text-decoration:underline;">${esc(f.phone)}</a>` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')
  const links = [`<a href="${o}/" style="color:${C.soft};text-decoration:underline;">${esc(o.replace(/^https?:\/\//, ''))}</a>`, f.privacy !== false ? `<a href="${o}/privacy-policy/" style="color:${C.soft};text-decoration:underline;">Privacy policy</a>` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')
  const fs = `margin:0 0 6px;font-family:${SANS};font-size:12.5px;line-height:1.55;color:${C.soft};`

  const html = `<!DOCTYPE html>
<html lang="en-AU" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(i.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>td,p,a,li,span,div{font-family:Arial,Helvetica,sans-serif !important;}h1,.serif{font-family:Georgia,'Times New Roman',serif !important;}</style><![endif]-->
<style>
@media screen{${font('0a002f5319e6b358-s.p.woff2', 'Playfair Display', 400)}${font('7ba2591d4d0cdc48-s.p.woff2', 'Figtree', 400)}${font('e8bd9fc08858c4b1-s.p.woff2', 'Figtree', 700)}}
body{margin:0;padding:0;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block;}
a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}
@media only screen and (max-width:620px){.card{border-radius:0 !important;}.pad{padding-left:22px !important;padding-right:22px !important;}.h1{font-size:25px !important;}.banner img{height:auto !important;}}
@media (prefers-color-scheme:dark){
.bg{background:#16232D !important;}.card{background:#1E2E3A !important;}.panel{background:#26394A !important;border-color:#3A4E5E !important;border-left-color:${C.sand} !important;}
.t,.t a,.h1{color:#F3EEE7 !important;}.t2,.eyebrow{color:${C.sand} !important;}.foot,.foot a{color:#C9CFD4 !important;}
.btn{background:${C.sand} !important;color:${C.navy} !important;}.rule{border-color:#3A4E5E !important;}
.st{background:#26394A !important;}.st-t{color:#F3EEE7 !important;}.stepn{background:#3A4E5E !important;color:${C.sand} !important;}}
[data-ogsc] .t,[data-ogsc] .t a,[data-ogsc] .h1{color:#F3EEE7 !important;}[data-ogsc] .t2,[data-ogsc] .eyebrow{color:${C.sand} !important;}
[data-ogsc] .foot,[data-ogsc] .foot a{color:#C9CFD4 !important;}[data-ogsb] .bg{background:#16232D !important;}[data-ogsb] .card{background:#1E2E3A !important;}
[data-ogsb] .panel{background:#26394A !important;}[data-ogsb] .st{background:#26394A !important;}[data-ogsc] .st-t{color:#F3EEE7 !important;}[data-ogsb] .btn{background:${C.sand} !important;}[data-ogsc] .btn{color:${C.navy} !important;}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.cream};opacity:0;">${esc(i.preheader || '')}${PREHEADER_FILL}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
<tr><td align="center" style="padding:28px 12px 32px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding:0 0 20px;"><a href="${o}/" style="text-decoration:none;"><img src="${o}/email/ape-logo-320.png" width="${logoW}" height="${logoW}" alt="The Anxious Patient Experience" style="width:${logoW}px;height:${logoW}px;border-radius:${Math.round(logoW / 5.3)}px;font-family:${SANS};font-size:14px;color:${C.navy};"></a></td></tr>
<tr><td class="card" style="background:${C.white};border-radius:20px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${banner ? `<tr><td class="banner" style="padding:0;"><img src="${o}/email/${banner.file}" width="600" height="250" alt="${esc(banner.alt)}" style="width:100%;max-width:600px;height:auto;border-radius:20px 20px 0 0;"></td></tr>` : ''}
<tr><td class="pad" style="padding:${banner ? 30 : 36}px 44px 8px;">
${i.eyebrow ? `<p class="eyebrow" style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:1.4;letter-spacing:2.4px;text-transform:uppercase;font-weight:bold;color:${C.taupe};">${esc(i.eyebrow)}</p>` : ''}
${i.heading ? `<h1 class="h1 serif" style="margin:0 0 20px;font-family:${SERIF};font-size:${team ? 24 : 29}px;line-height:1.25;font-weight:normal;color:${C.navy};">${esc(i.heading)}</h1>` : ''}
${i.sections.map((s) => s.html).join('\n')}
${sign.length ? `<p class="t" style="${P}margin-top:8px;">${sign.map(esc).join('<br>')}</p>` : ''}
</td></tr>
<tr><td class="pad" style="padding:0 44px 30px;"><p class="rule" style="margin:8px 0 0;border-top:1px solid ${C.line};font-size:1px;line-height:1px;">&nbsp;</p></td></tr>
</table>
</td></tr>
<tr><td class="foot" align="center" style="padding:22px 28px 0;">
<p class="foot" style="${fs}font-weight:bold;">The Anxious Patient Experience&trade;</p>
${f.location ? `<p class="foot" style="${fs}">${esc(f.location)}</p>` : ''}
${contact ? `<p class="foot" style="${fs}">${contact}</p>` : ''}
<p class="foot" style="${fs}">${links}</p>
<p class="foot" style="${fs}margin-top:10px;">${esc(f.reason)}</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`

  const text = [
    i.heading || '',
    ...i.sections.map((s) => s.text),
    sign.join('\n'),
    '--',
    ['The Anxious Patient Experience™', f.location, [f.email, f.phone].filter(Boolean).join(' | '), `${o}/`, f.privacy !== false ? `Privacy policy: ${o}/privacy-policy/` : ''].filter(Boolean).join('\n'),
    f.reason,
  ].map((s) => s.trim()).filter(Boolean).join('\n\n')

  return { html: html.replace(/\n{2,}/g, '\n'), text }
}

/** The footer of a patient email, from the clinic details and the APE inbox. */
export function patientFooter(o: { clinicLine: string; email: string; phone: string }): Footer {
  return {
    location: `Appointments are held at ${o.clinicLine}`,
    email: o.email,
    phone: o.phone,
    reason: "You're receiving this because you made a booking with The Anxious Patient Experience.",
  }
}
export const TEAM_FOOTER: Footer = { reason: 'Sent by The Anxious Patient Experience website to the practice team. No reply is needed unless the email says so.', privacy: false }
export const GYA_FOOTER: Footer = { reason: 'Sent to GYA by The Anxious Patient Experience website. No patient details are included.', privacy: false }
export const LOGIN_FOOTER: Footer = { reason: 'You are receiving this because you have a login for The Anxious Patient Experience website dashboard.', privacy: false }

/** Wrap an existing team or login email's paragraphs in the branded shell, keeping its wording and text version. */
export function wrapFixed(origin: string, variant: 'team' | 'login', subject: string, heading: string, sections: Section[], footer: Footer): string {
  return shell({ origin, variant, subject, heading, sections, footer }).html
}
