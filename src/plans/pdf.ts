/**
 * v1.18.0: the treatment plan as an A4 PDF, in the APE look of the patient emails: the logo, Playfair Display
 * headings, Figtree text, generous spacing. It prints properly in black and white (dark text, light lines, no
 * meaning carried by colour alone). Every page has the patient, the booking reference, the version and "Page 1 of 3".
 *
 * Only what is on the form and what was typed is printed; empty optional fields are left out. Fonts are the SIL Open
 * Font License files in src/pdf/fonts, embedded in the PDF. The same PDF is used for Print, the download, the patient
 * link and the email attachment (optionally password protected).
 */
import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { isField, fillText, fmtDayLong, fmtMoney, rowsTotal, ESTIMATE_LINE, type Answers, type FormDef, type Item, type Row } from './form'

const ROOT = process.cwd()
const FONT = (f: string) => path.join(ROOT, 'src', 'pdf', 'fonts', f)
const LOGO = path.join(ROOT, 'public', 'email', 'ape-logo-320.png')
const C = { navy: '#284858', ink: '#1F2D3A', soft: '#4E5F6A', taupe: '#7E6548', sand: '#D2B490', line: '#D9D0C3', fill: '#F7F4EF' }

export type PdfInput = {
  form: FormDef
  answers: Answers
  identity: { name: string; firstName: string; dob: string | null; ref: string; appointmentAt: string | null }
  version: number
  /** the date the plan was finalised (ISO), or null for a draft preview */
  finalisedAt: string | null
  clinician: string
  /** 'draft': a preview of an unfinished plan; 'sample': made-up details for Lorna */
  mark?: 'draft' | 'sample' | null
  /** a password the patient types to open it (never stored) */
  password?: string
}

const sydneyDay = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
const sydneyWhen = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

export function renderPlanPdf(i: PdfInput): Promise<Buffer> {
  const M = 56
  const doc = new PDFDocument({
    size: 'A4', margins: { top: M, bottom: 78, left: M, right: M }, bufferPages: true, font: FONT('figtree-latin-400-normal.woff'),
    info: { Title: `Treatment plan, version ${i.version}`, Author: 'The Anxious Patient Experience', Subject: 'Treatment plan' },
    ...(i.password ? { userPassword: i.password, ownerPassword: crypto.randomUUID(), pdfVersion: '1.7ext3' as const, permissions: { printing: 'highResolution' as const, copying: true } } : {}),
  })
  doc.registerFont('body', FONT('figtree-latin-400-normal.woff'))
  doc.registerFont('bold', FONT('figtree-latin-600-normal.woff'))
  doc.registerFont('italic', FONT('figtree-latin-400-italic.woff'))
  doc.registerFont('serif', FONT('playfair-display-latin-400-normal.woff'))
  doc.registerFont('serifItalic', FONT('playfair-display-latin-400-italic.woff'))
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const W = doc.page.width - M * 2
  const bottom = () => doc.page.height - 78
  const room = (h: number) => { if (doc.y + h > bottom()) doc.addPage() }
  const textH = (t: string, font: string, size: number, width = W) => { doc.font(font).fontSize(size); return doc.heightOfString(t, { width, lineGap: 2 }) }

  // ---------------- the top of page 1
  if (fs.existsSync(LOGO)) doc.image(LOGO, M, M - 6, { width: 54, height: 54 })
  doc.font('serif').fontSize(22).fillColor(C.navy).text(i.form.title, M + 70, M - 2, { width: W - 70 })
  doc.font('body').fontSize(10.5).fillColor(C.soft).text(i.form.subtitle || 'The Anxious Patient Experience', M + 70, doc.y + 2, { width: W - 70 })
  doc.y = Math.max(doc.y, M + 56) + 14
  doc.x = M

  const notes: string[] = []
  if (i.mark === 'sample') notes.push('SAMPLE: made-up details, to show the layout. Not a real patient\'s plan.')
  if (i.mark === 'draft') notes.push('DRAFT PREVIEW: not finalised, not for the patient.')
  if (i.form.placeholder) notes.push('PLACEHOLDER FORM: the wording on this form is not approved.')
  for (const n of notes) {
    const h = textH(n, 'bold', 10, W - 24) + 16
    doc.lineWidth(1.2).rect(M, doc.y, W, h).stroke(C.ink)
    doc.font('bold').fontSize(10).fillColor(C.ink).text(n, M + 12, doc.y + 8, { width: W - 24 })
    doc.y += 14
    doc.x = M
  }

  // the details box
  const id = i.identity
  const details: [string, string][] = [
    ['Patient', id.name],
    ['Date of birth', id.dob ? fmtDayLong(id.dob) : 'Not on the booking'],
    ['Booking reference', id.ref],
    ['Appointment', id.appointmentAt ? sydneyWhen(id.appointmentAt) : 'Not recorded'],
    ['Plan date', i.finalisedAt ? sydneyDay(i.finalisedAt) : 'Not finalised'],
    ['Version', String(i.version)],
    ['Clinician', i.clinician],
  ]
  const colW = (W - 32) / 2
  const cellH = 30
  const boxH = Math.ceil(details.length / 2) * cellH + 14
  room(boxH)
  const top = doc.y
  doc.lineWidth(0.8).roundedRect(M, top, W, boxH, 8).fillAndStroke(C.fill, C.line)
  details.forEach(([k, v], n) => {
    const x = M + 16 + (n % 2) * (colW + 0)
    const y = top + 10 + Math.floor(n / 2) * cellH
    doc.font('bold').fontSize(8).fillColor(C.taupe).text(k.toUpperCase(), x, y, { width: colW - 8, characterSpacing: 0.6, lineBreak: false })
    doc.font('body').fontSize(10.5).fillColor(C.ink).text(v, x, y + 11, { width: colW - 8, height: 14, ellipsis: true, lineBreak: false })
  })
  doc.y = top + boxH + 22
  doc.x = M

  // ---------------- the sections
  const firstName = id.firstName
  const filled = (it: Item) => {
    const v = i.answers[it.id]
    return !(v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length))
  }
  for (const sec of i.form.sections) {
    const printable = sec.items.filter((it) => !isField(it.type) || filled(it))
    if (!printable.length) continue
    room(60)
    if (sec.heading) {
      doc.font('serif').fontSize(15).fillColor(C.navy).text(fillText(sec.heading, firstName), M, doc.y, { width: W })
      doc.moveTo(M, doc.y + 4).lineTo(M + 120, doc.y + 4).lineWidth(0.8).stroke(C.sand)
      doc.y += 12
    }
    for (const it of printable) item(it)
    doc.y += 10
  }

  function para(t: string, o: { font?: string; size?: number; color?: string; x?: number; width?: number; gap?: number } = {}) {
    const font = o.font || 'body', size = o.size || 10.5, width = o.width || W
    const paras = String(t).split(/\n{2,}/)
    for (const p of paras) {
      const h = textH(p, font, size, width)
      room(Math.min(h, 40))
      doc.font(font).fontSize(size).fillColor(o.color || C.ink).text(p, o.x ?? M, doc.y, { width, lineGap: 2 })
      doc.y += o.gap ?? 6
    }
  }
  function label(t: string) {
    room(40)
    doc.font('bold').fontSize(9).fillColor(C.soft).text(t, M, doc.y, { width: W, lineGap: 1 })
    doc.y += 2
  }
  function item(it: Item) {
    const v = i.answers[it.id]
    switch (it.type) {
      case 'paragraph': para(fillText(it.text || '', firstName)); break
      case 'callout': {
        const body = fillText(it.text || '', firstName)
        const h = (it.label ? textH(it.label, 'serif', 12.5, W - 34) + 4 : 0) + textH(body, 'body', 10.5, W - 34) + 22
        room(Math.min(h, bottom() - doc.page.margins.top))
        const y0 = doc.y
        doc.roundedRect(M, y0, W, h, 8).fill(C.fill)
        doc.rect(M, y0, 3.5, h).fill(C.sand)
        doc.y = y0 + 11
        if (it.label) { doc.font('serif').fontSize(12.5).fillColor(C.navy).text(it.label, M + 20, doc.y, { width: W - 34 }); doc.y += 2 }
        doc.font('body').fontSize(10.5).fillColor(C.ink).text(body, M + 20, doc.y, { width: W - 34, lineGap: 2 })
        doc.y = Math.max(doc.y, y0 + h) + 12
        doc.x = M
        break
      }
      case 'text': case 'textarea': label(it.label); para(String(v)); doc.y += 4; break
      case 'number': label(it.label); para(String(v)); doc.y += 4; break
      case 'date': label(it.label); para(fmtDayLong(String(v))); doc.y += 4; break
      case 'currency': label(it.label); para(fmtMoney(String(v))); doc.y += 4; break
      case 'checkbox': room(20); doc.font('body').fontSize(10.5).fillColor(C.ink).text(`Yes: ${it.label}`, M, doc.y, { width: W }); doc.y += 8; break
      case 'choice': {
        label(it.label)
        if (Array.isArray(v)) for (const o of v as string[]) bullet(o)
        else para(String(v))
        doc.y += 4
        break
      }
      case 'rows': table(it, (v as Row[]) || []); break
    }
  }
  function bullet(t: string) {
    const h = textH(t, 'body', 10.5, W - 16)
    room(Math.min(h, 40))
    const y = doc.y
    doc.circle(M + 4, y + 6.5, 1.8).fill(C.ink)
    doc.font('body').fontSize(10.5).fillColor(C.ink).text(t, M + 14, y, { width: W - 16, lineGap: 2 })
    doc.y += 3
  }
  function table(it: Item, rows: Row[]) {
    const cols = it.columns || []
    if (!cols.length) return
    label(it.label)
    const fixed = (t: string) => (t === 'text' ? 0 : 84)
    const free = W - cols.reduce((s, c) => s + fixed(c.type), 0)
    const texts = cols.filter((c) => c.type === 'text').length || 1
    const widths = cols.map((c) => (c.type === 'text' ? free / texts : fixed(c.type)))
    const xs = widths.map((_, n) => M + widths.slice(0, n).reduce((a, b) => a + b, 0))
    const pad = 6
    const cell = (c: (typeof cols)[number], r: Row) => { const x = r[c.id] || ''; return !x ? '' : c.type === 'currency' ? fmtMoney(x) : x }
    const header = () => {
      const h = Math.max(...cols.map((c, n) => textH(c.label, 'bold', 9, widths[n] - pad * 2))) + 10
      room(h + 24)
      const y = doc.y
      doc.rect(M, y, W, h).fill(C.fill)
      cols.forEach((c, n) => doc.font('bold').fontSize(9).fillColor(C.ink).text(c.label, xs[n] + pad, y + 5, { width: widths[n] - pad * 2, align: c.type === 'text' ? 'left' : 'right' }))
      doc.y = y + h
      doc.moveTo(M, doc.y).lineTo(M + W, doc.y).lineWidth(0.8).stroke(C.ink)
    }
    header()
    for (const r of rows) {
      const h = Math.max(...cols.map((c, n) => textH(cell(c, r) || ' ', 'body', 10, widths[n] - pad * 2))) + 10
      if (doc.y + h > bottom()) { doc.addPage(); header() }
      const y = doc.y
      cols.forEach((c, n) => doc.font('body').fontSize(10).fillColor(C.ink).text(cell(c, r), xs[n] + pad, y + 5, { width: widths[n] - pad * 2, align: c.type === 'text' ? 'left' : 'right', lineGap: 1.5 }))
      doc.y = y + h
      doc.moveTo(M, doc.y).lineTo(M + W, doc.y).lineWidth(0.5).stroke(C.line)
    }
    const total = rowsTotal(it, rows)
    if (total !== null) {
      room(60)
      const y = doc.y + 2
      const ci = cols.findIndex((c) => c.type === 'currency')
      doc.font('bold').fontSize(10.5).fillColor(C.ink).text('Estimated total', M + pad, y + 5, { width: xs[ci] - M - pad * 2 })
      doc.font('bold').fontSize(10.5).text(fmtMoney(total), xs[ci] + pad, y + 5, { width: widths[ci] - pad * 2, align: 'right' })
      doc.y = y + 24
      doc.moveTo(M, doc.y).lineTo(M + W, doc.y).lineWidth(0.8).stroke(C.ink)
      doc.y += 6
      para(ESTIMATE_LINE, { font: 'italic', size: 9, color: C.soft })
    }
    doc.y += 8
    doc.x = M
  }

  // ---------------- every page: the footer, and "Page 1 of 3"
  const range = doc.bufferedPageRange()
  const mark = i.mark === 'sample' ? 'SAMPLE' : i.mark === 'draft' ? 'DRAFT PREVIEW' : i.form.placeholder ? 'PLACEHOLDER FORM' : ''
  for (let n = 0; n < range.count; n++) {
    doc.switchToPage(range.start + n)
    doc.page.margins.bottom = 0   // writing the footer below the text area must not start a new page
    const y = doc.page.height - 56
    doc.moveTo(M, y - 8).lineTo(M + W, y - 8).lineWidth(0.6).stroke(C.line)
    const left = [`Treatment plan for ${id.name}`, `Booking ${id.ref}`, `Version ${i.version}`, mark].filter(Boolean).join('  |  ')
    doc.font('body').fontSize(8.5).fillColor(C.soft).text(left, M, y, { width: W - 90, lineBreak: false, ellipsis: true, height: 12 })
    doc.font('bold').fontSize(8.5).fillColor(C.ink).text(`Page ${n + 1} of ${range.count}`, M + W - 90, y, { width: 90, align: 'right', lineBreak: false })
    doc.font('body').fontSize(7.5).fillColor(C.soft).text('The Anxious Patient Experience at The Cronulla Dentists. Confidential: this plan contains health information.', M, y + 13, { width: W, lineBreak: false, ellipsis: true, height: 11 })
  }
  doc.end()
  return done
}
