'use client'
/**
 * The page editor, laid out like the Coastal Dental dashboard (29 October 2026):
 * the page itself on the left, exactly as it looks on the website, where any words
 * can be clicked and changed in place and any photo clicked to replace it; a panel
 * on the right with Content (the selected item and every photo on the page), SEO,
 * and Sections (drag to reorder, hide or show, or open a section as a form).
 * Desktop and Mobile switch the preview width. Nothing goes live until Publish website.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { EField as F, ESection as Section, SharedPart } from '../pages'
import { api, mediaSrc } from '../lib/client'
import { cleanInlineHtml, linkForEditing, linkForSaving, textForEditing, textForSaving } from '../lib/text'
import { when } from '../lib/format'
import { AutoTextarea, Notice, useUnsavedWarning } from '../ui/fields'
import { ImageSlot, MediaPicker, type MediaDoc } from '../ui/MediaPicker'
import { RichInline } from '../ui/RichInline'
import { SeoPanel, type SeoState } from '../ui/SeoPanel'
import { PublishButton } from '../ui/PublishButton'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { BRAND } from '../brand'

export type PageEditorProps = {
  id: number | string
  label: string
  url: string | null
  sections: Section[]
  /** the footer: its plain words can be changed from any page */
  shared: SharedPart[]
  seo: SeoState
  isAdmin: boolean
  defaultOg: string
  defaultTitle: string
  lastmod: string | null
  /** open with this section in view (the Team menu item opens the homepage at the team) */
  focusSection?: string | null
}

type Img = { ref: string; alt: string | null; link: string | null }
type Selected =
  | { kind: 'text'; ref: string; rich: boolean; link: string | null; section: string | null }
  | { kind: 'image'; ref: string; alt: string | null; link: string | null; section: string | null }
  | { kind: 'note'; title: string; body: React.ReactNode }
  | null

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 390

const HELP: Partial<Record<F['type'], string>> = {
  href: 'A page on this website starts with /, for example /contact. Other websites start with https://',
  alt: 'Describe the photo for someone who cannot see it. Leave it blank only if the photo is decoration.',
}

/** What the editor sends back: words, links and photo choices only. */
const edits = (sections: Section[]) =>
  sections.map((s) => ({ key: s.key, hidden: s.hidden, fields: s.fields.map((f) => ({ id: f.id, value: f.value, media: f.media ?? null })) }))

// ---------------------------------------------------------------- section forms (Sections tab)
function layoutFields(fields: F[]) {
  const counts: Record<string, number> = {}
  for (const f of fields) counts[f.label] = (counts[f.label] ?? 0) + 1
  const seen: Record<string, number> = {}
  return fields.map((f) => {
    if (counts[f.label] > 1 && f.type !== 'alt') {
      seen[f.label] = (seen[f.label] ?? 0) + 1
      return { f, label: `${f.label} ${seen[f.label]}` }
    }
    return { f, label: f.label }
  })
}

function FieldEditor({ f, label, onChange, prefix }: { f: F; label: string; onChange: (patch: Partial<F>) => void; prefix: string }) {
  const id = `fld-${prefix}-${f.id}`
  if (f.type === 'image') {
    return <ImageSlot label={label} value={f.value} original={f.original ?? f.value}
      onChange={(v) => onChange({ value: v.value, media: v.media ?? null })} />
  }
  if (f.type === 'richtext') {
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <RichInline id={id} value={f.value} onChange={(html) => onChange({ value: html })} />
      </div>
    )
  }
  if (f.type === 'href') {
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <input id={id} className="input" value={linkForEditing(f.value)} onChange={(e) => onChange({ value: linkForSaving(e.target.value) })} />
        <div className="help">{HELP.href}</div>
      </div>
    )
  }
  const text = textForEditing(f.value)
  const long = text.length > 70 || text.includes('\n')
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {long
        ? <AutoTextarea id={id} value={text} onChange={(v) => onChange({ value: textForSaving(v) })} />
        : <input id={id} className="input" value={text} onChange={(e) => onChange({ value: textForSaving(e.target.value) })} />}
      {f.type === 'alt' ? <div className="help">{HELP.alt}</div> : null}
    </div>
  )
}

function FieldsList({ fields, onField, prefix }: { fields: F[]; onField: (id: string, patch: Partial<F>) => void; prefix: string }) {
  const rows = useMemo(() => layoutFields(fields), [fields])
  if (!fields.length) return <p className="help">Nothing to edit in this section.</p>
  return (
    <>
      {rows.map(({ f, label }) => (
        <FieldEditor key={f.id} f={f} label={label} prefix={prefix} onChange={(p) => onField(f.id, p)} />
      ))}
    </>
  )
}

const sectionName = (s: Section) => s.label || 'Section'

function SectionRow({ s, open, onToggle, onShow, onHide, children, sortable }: {
  s: Section; open: boolean; onToggle: () => void; onShow: () => void; onHide?: () => void; children: React.ReactNode; sortable: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.key, disabled: !sortable })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const badge = s.empty ? <span className="chip grey">No photos yet</span>
    : s.fixed ? <span className="chip grey">Bottom</span>
      : s.pinned ? <span className="chip grey">Top</span> : null
  return (
    <div ref={setNodeRef} style={style} className={`sec${open ? ' open' : ''}${isDragging ? ' dragging' : ''}${s.hidden ? ' is-hidden' : ''}`}>
      <div className="sec-head" onClick={() => { onToggle(); onShow() }}>
        <button type="button" className="handle" aria-label={sortable ? `Drag to move ${sectionName(s)}` : 'This section cannot be moved'}
          disabled={!sortable} {...(sortable ? attributes : {})} {...(sortable ? listeners : {})} onClick={(e) => e.stopPropagation()}>
          {Icon.grip()}
        </button>
        <span className="sec-title">{sectionName(s)}</span>
        {s.hidden ? <span className="chip warn">Hidden</span> : badge}
        {onHide ? (
          <button type="button" className="btn small ghost icon-only" onClick={(e) => { e.stopPropagation(); onHide() }}
            title={s.hidden ? 'Show this section on the page' : 'Hide this section from the page'} aria-label={s.hidden ? `Show ${sectionName(s)}` : `Hide ${sectionName(s)}`}>
            {s.hidden ? Icon.eye() : Icon.eyeOff()}
          </button>
        ) : null}
        <span className="chev">{Icon.chevron()}</span>
      </div>
      {open ? <div className="sec-body">{children}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------- the editor
export function PageEditor(props: PageEditorProps) {
  const toast = useToast()
  const [sections, setSections] = useState<Section[]>(() => clone(props.sections))
  const [shared, setShared] = useState<SharedPart[]>(() => clone(props.shared))
  const [sharedDirty, setSharedDirty] = useState(false)
  const [seo, setSeo] = useState<SeoState>(props.seo)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'content' | 'seo' | 'sections'>('content')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selected, setSelected] = useState<Selected>(null)
  const [images, setImages] = useState<Img[]>([])
  const [loading, setLoading] = useState(true)
  const [previewError, setPreviewError] = useState('')
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  useUnsavedWarning(dirty)

  const frame = useRef<HTMLIFrameElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const live = useRef({ sections, shared })
  live.current = { sections, shared }
  const keepScroll = useRef(0)
  const request = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const range = useRef<Range | null>(null)
  const selRef = useRef<string | null>(null)
  const saveRef = useRef<() => void>(() => {})

  // the editor uses the whole width of the dashboard
  useEffect(() => {
    document.body.classList.add('pe-full')
    return () => document.body.classList.remove('pe-full')
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const touch = () => { setDirty(true); setSaved(false) }

  // ------------------------------------------------ field access by reference ("s:<section>|f3" or "c:footer|text-1")
  const parseRef = (ref: string) => {
    const [scope, fid] = ref.split('|')
    return { shared: scope.startsWith('c:'), key: scope.slice(2), fid }
  }
  const getField = useCallback((ref: string): F | null => {
    const { shared: isShared, key, fid } = parseRef(ref)
    const list = isShared ? live.current.shared.find((p) => p.name === key)?.fields : live.current.sections.find((s) => s.key === key)?.fields
    return list?.find((f) => f.id === fid) ?? null
  }, [])

  function setField(secKey: string, fid: string, patch: Partial<F>) {
    setSections((all) => all.map((s) => (s.key !== secKey ? s : {
      ...s,
      fields: s.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)),
      empty: s.empty && !(patch.value && s.fields.find((f) => f.id === fid)?.type === 'image'),
    })))
    touch()
  }
  const setRef = (ref: string, patch: Partial<F>) => {
    const { shared: isShared, key, fid } = parseRef(ref)
    if (isShared) {
      setShared((all) => all.map((p) => (p.name !== key ? p : { ...p, fields: p.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) })))
      setSharedDirty(true)
      touch()
      return
    }
    setField(key, fid, patch)
  }
  const sharedEdits = () => live.current.shared.map((p) => ({ name: p.name, fields: p.fields.map((f) => ({ id: f.id, value: f.value })) }))

  // ------------------------------------------------ the preview
  const refresh = useCallback(async () => {
    const n = ++request.current
    const win = frame.current?.contentWindow
    if (win) keepScroll.current = win.scrollY
    setLoading(true)
    try {
      const res = await fetch('/admin/preview/edit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: props.id, sections: edits(live.current.sections), shared: sharedEdits() }),
      })
      const html = await res.text()
      if (n !== request.current) return
      if (!res.ok) {
        let msg = 'The preview could not be loaded.'
        try { msg = JSON.parse(html).error || msg } catch { /* not JSON */ }
        setPreviewError(msg)
        setLoading(false)
        return
      }
      setPreviewError('')
      if (frame.current) frame.current.srcdoc = html
    } catch {
      if (n === request.current) { setPreviewError('The preview could not be loaded. Check your internet connection.'); setLoading(false) }
    }
  }, [props.id])

  // a refresh runs after React has rendered the new state, so the preview never shows the old one
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick((t) => t + 1), [])
  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(bump, 400)
  }, [bump])

  useEffect(() => { refresh() }, [refresh, tick])

  const doc = () => frame.current?.contentDocument ?? null
  const focused = useRef(false)

  function markSelected(ref: string | null) {
    selRef.current = ref
    const d = doc()
    if (!d) return
    d.querySelectorAll('.pd-sel').forEach((el) => el.classList.remove('pd-sel'))
    if (ref) d.querySelectorAll(`img[data-pdi="${CSS_escape(ref)}"]`).forEach((el) => el.classList.add('pd-sel'))
  }

  const sectionOf = (el: Element): string | null => {
    const host = el.closest('[data-pds]')
    if (!host) return null
    const k = host.getAttribute('data-pds') || ''
    if (k.startsWith('c:')) return live.current.shared.find((p) => p.name === k.slice(2))?.label ?? 'Footer'
    const s = live.current.sections.find((x) => x.key === k)
    return s ? sectionName(s) : null
  }

  function readEditable(el: HTMLElement): string {
    const c = el.cloneNode(true) as HTMLElement
    // practice details go back to the token they came from
    c.querySelectorAll('.pd-tok').forEach((t) => {
      t.replaceWith(c.ownerDocument.createTextNode(`{{site:${t.getAttribute('data-pdt')}}}`))
    })
    if (el.getAttribute('data-t') === 'rich') return cleanInlineHtml(c)
    return textForSaving(c.textContent || '')
  }

  function scrollToSection(s: Section) {
    const d = doc()
    if (!d) return
    const el = d.querySelector(`[data-pds="${CSS_escape(s.key)}"]`) as HTMLElement | null
    if (!el) {
      if (s.hidden) toast('This section is hidden, so it is not on the page. Press the eye to show it.', 'bad')
      else if (s.empty) toast('This section shows once it has photos. Open it below to add them.', 'bad')
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.remove('pd-flash')
    void el.offsetWidth
    el.classList.add('pd-flash')
  }

  function noteFor(target: Element): Selected {
    if (target.closest('[data-pdc], .sticky-bar')) {
      return {
        kind: 'note', title: 'Menu and footer',
        body: <p>The menu and footer are the same on every page. The phone number, email addresses and clinic address in the footer come from <a href="/admin/settings">Site Settings</a>. The tagline, disclaimer and other plain words in the footer can be clicked and changed here, and the change shows on every page. For menu changes, ask GYA.</p>,
      }
    }
    if (target.closest('#booking, form')) {
      return { kind: 'note', title: 'Online booking', body: <p>Patients choose a time here. The times come from <a href="/admin/availability">Availability</a>, and requests arrive under <a href="/admin/bookings">Bookings</a>. The words around it can be clicked and changed here.</p> }
    }
    if (target.closest('iframe')) {
      return { kind: 'note', title: 'Map', body: <p>The map shows the address in <a href="/admin/settings">Site Settings</a>.</p> }
    }
    return null
  }

  // ------------------------------------------------ wire up the page once it has loaded
  function onFrameLoad() {
    const d = doc()
    const win = frame.current?.contentWindow
    if (!d || !win || !d.body) return
    setLoading(false)
    win.scrollTo(0, keepScroll.current)
    if (props.focusSection && !focused.current) {
      focused.current = true
      const target = live.current.sections.find((x) => x.key === props.focusSection)
      if (target) setTimeout(() => scrollToSection(target), 150)
    }

    // links and photos are not dragged around while words inside them are being selected
    d.querySelectorAll('a, img').forEach((el) => el.setAttribute('draggable', 'false'))
    d.querySelectorAll<HTMLElement>('pd-e').forEach((el) => {
      const rich = el.getAttribute('data-t') === 'rich'
      if (rich) el.contentEditable = 'true'
      else {
        try { el.contentEditable = 'plaintext-only' } catch { el.contentEditable = 'true' }
        if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'
      }
      el.spellcheck = true
    })

    const list: Img[] = []
    const seen = new Set<string>()
    d.querySelectorAll('img[data-pdi]').forEach((img) => {
      const ref = img.getAttribute('data-pdi') || ''
      if (seen.has(ref)) return
      seen.add(ref)
      list.push({ ref, alt: img.getAttribute('data-pda'), link: img.closest('a[data-pdh]')?.getAttribute('data-pdh') ?? null })
    })
    setImages(list)
    markSelected(selRef.current)

    d.addEventListener('click', (e) => {
      const t = e.target as Element
      if (!t || !t.closest) return
      const link = t.closest('a')
      if (link) e.preventDefault()
      const tok = t.closest('.pd-tok')
      const ed = t.closest('pd-e') as HTMLElement | null
      // a photo with words or a shade laid over it (the hero banners) is still picked
      // when the click lands on the layer above it, as long as that is not a button or link
      const img = t.closest('img[data-pdi]')
        ?? (!ed && !tok && !link && !t.closest('button, input, select, textarea, label')
          ? d.elementsFromPoint((e as MouseEvent).clientX, (e as MouseEvent).clientY).find((el) => el.matches('img[data-pdi]')) ?? null
          : null)
      if (tok) {
        e.stopPropagation()
        setSelected({ kind: 'note', title: 'Practice details', body: <p>Shaded words such as the phone number fill in from <a href="/admin/settings">Site Settings</a>, so they stay the same everywhere on the website.</p> })
        setTab('content')
        return
      }
      if (ed) {
        e.stopPropagation()
        const ref = ed.getAttribute('data-pde') || ''
        markSelected(null)
        setSelected({ kind: 'text', ref, rich: ed.getAttribute('data-t') === 'rich', link: ed.closest('a[data-pdh]')?.getAttribute('data-pdh') ?? null, section: sectionOf(ed) })
        setTab('content')
        return
      }
      if (img) {
        e.stopPropagation()
        e.preventDefault()
        const ref = img.getAttribute('data-pdi') || ''
        markSelected(ref)
        setSelected({ kind: 'image', ref, alt: img.getAttribute('data-pda'), link: img.closest('a[data-pdh]')?.getAttribute('data-pdh') ?? null, section: sectionOf(img) })
        setTab('content')
        return
      }
      const note = noteFor(t)
      if (note) {
        e.stopPropagation()
        setSelected(note)
        setTab('content')
      }
    }, true)

    d.addEventListener('submit', (e) => e.preventDefault(), true)

    d.addEventListener('input', (e) => {
      const el = (e.target as Element)?.closest?.('pd-e') as HTMLElement | null
      if (!el) return
      const ref = el.getAttribute('data-pde') || ''
      d.querySelectorAll<HTMLElement>('pd-e').forEach((o) => { if (o !== el && o.getAttribute('data-pde') === ref) o.innerHTML = el.innerHTML })
      setRef(ref, { value: readEditable(el) })
    }, true)

    d.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current(); return }
      const el = (e.target as Element)?.closest?.('pd-e') as HTMLElement | null
      if (!el) return
      if (e.key === 'Escape') { el.blur(); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey && el.getAttribute('data-t') === 'rich') d.execCommand('insertLineBreak')
      }
      // keep the space bar and Enter inside the words, not on a button around them
      if (e.key === ' ') e.stopPropagation()
    }, true)
    d.addEventListener('keyup', (e) => {
      if ((e.target as Element)?.closest?.('pd-e') && e.key === ' ') { e.stopPropagation(); e.preventDefault() }
    }, true)

    d.addEventListener('paste', (e) => {
      const el = (e.target as Element)?.closest?.('pd-e')
      if (!el) return
      e.preventDefault()
      const text = (e.clipboardData?.getData('text/plain') || '').replace(/\s*\n\s*/g, ' ')
      d.execCommand('insertText', false, text)
    }, true)

    d.addEventListener('selectionchange', () => {
      const s = d.getSelection()
      if (s && s.rangeCount && (s.anchorNode?.parentElement?.closest('pd-e'))) range.current = s.getRangeAt(0).cloneRange()
    })
  }

  // bold, italic and links for the words on the page
  function format(cmd: 'bold' | 'italic' | 'createLink' | 'unlink') {
    const d = doc()
    const win = frame.current?.contentWindow
    if (!d || !win || !range.current) { toast('Click into the words on the page first.', 'bad'); return }
    const host = range.current.startContainer.parentElement?.closest('pd-e') as HTMLElement | null
    if (!host) return
    let arg: string | undefined
    if (cmd === 'createLink') {
      const url = window.prompt('Link address (for example /contact or https://...)')
      if (!url) return
      arg = url.trim()
    }
    win.focus()
    host.focus()
    const s = d.getSelection()
    s?.removeAllRanges()
    s?.addRange(range.current)
    d.execCommand('styleWithCSS', false, 'false')
    d.execCommand(cmd, false, arg)
    host.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // ------------------------------------------------ save
  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await api(`/api/dashboard/pages/${props.id}`, { method: 'POST', body: { sections: edits(sections), seo, ...(sharedDirty ? { shared: sharedEdits() } : {}) } })
      setDirty(false)
      setSharedDirty(false)
      setSaved(true)
      toast('Saved. Press Publish website when you are ready for it to go live.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }
  saveRef.current = save

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ------------------------------------------------ sections tab
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const pinned = sections.filter((s) => s.pinned && !s.fixed)
  const fixed = sections.filter((s) => s.fixed)
  const movable = sections.filter((s) => !s.pinned && !s.fixed)

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = movable.findIndex((s) => s.key === active.id)
    const to = movable.findIndex((s) => s.key === over.id)
    setSections([...pinned, ...arrayMove(movable, from, to), ...fixed])
    touch()
    bump()
  }
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const hide = (k: string) => {
    setSections((all) => all.map((s) => (s.key === k ? { ...s, hidden: !s.hidden } : s)))
    touch()
    bump()
  }

  const renderBody = (s: Section) => (
    <>
      {s.empty ? <Notice tone="info" icon={Icon.info()}><p>This section only shows on the page once its photos are added. Choose them below.</p></Notice> : null}
      <FieldsList prefix={s.key} fields={s.fields} onField={(fid, p) => { setField(s.key, fid, p); scheduleRefresh() }} />
    </>
  )

  // ------------------------------------------------ panel pieces
  const altInput = (ref: string | null, id: string) => {
    if (!ref) return null
    const f = getField(ref)
    if (!f) return null
    return (
      <div className="field">
        <label htmlFor={id}>Photo description</label>
        <input id={id} className="input" value={textForEditing(f.value)} placeholder="What the photo shows"
          onChange={(e) => { setRef(ref, { value: textForSaving(e.target.value) }); doc()?.querySelectorAll(`img[data-pda="${CSS_escape(ref)}"]`).forEach((im) => im.setAttribute('alt', e.target.value)) }} />
        <div className="help">{HELP.alt}</div>
      </div>
    )
  }

  const linkInput = (ref: string | null, id: string) => {
    if (!ref) return null
    const f = getField(ref)
    if (!f) return null
    return (
      <div className="field">
        <label htmlFor={id}>Link goes to</label>
        <input id={id} className="input" value={linkForEditing(f.value)}
          onChange={(e) => { setRef(ref, { value: linkForSaving(e.target.value) }); doc()?.querySelectorAll(`a[data-pdh="${CSS_escape(ref)}"]`).forEach((a) => a.setAttribute('href', e.target.value)) }} />
        <div className="help">{HELP.href}</div>
      </div>
    )
  }

  const applyPhoto = (ref: string, d: MediaDoc) => {
    setRef(ref, { value: mediaSrc(d), media: d.id })
    const img = doc()?.querySelector(`img[data-pdi="${CSS_escape(ref)}"]`)
    const altRef = img?.getAttribute('data-pda')
    if (altRef && d.alt && !textForEditing(getField(altRef)?.value || '').trim()) setRef(altRef, { value: textForSaving(d.alt) })
    bump()
    toast('Photo replaced. Press Save changes to keep it.', 'good')
  }

  const selectImage = (im: Img) => {
    markSelected(im.ref)
    setSelected({ kind: 'image', ref: im.ref, alt: im.alt, link: im.link, section: null })
    const el = doc()?.querySelector(`img[data-pdi="${CSS_escape(im.ref)}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const selectionCard = () => {
    if (!selected) return null
    if (selected.kind === 'note') {
      return (
        <div className="pe-card">
          <div className="pe-card-head"><b>{selected.title}</b><button className="btn small ghost" onClick={() => setSelected(null)} aria-label="Close">&times;</button></div>
          {selected.body}
        </div>
      )
    }
    if (selected.kind === 'text') {
      return (
        <div className="pe-card">
          <div className="pe-card-head"><b>Editing words</b>{selected.section ? <span className="chip grey">{selected.section}</span> : null}<button className="btn small ghost" onClick={() => setSelected(null)} aria-label="Close">&times;</button></div>
          {selected.ref.startsWith('c:') ? <p className="help">This is part of the footer, which is the same on every page. A change here updates all of them.</p> : null}
          {selected.rich ? (
            <div className="pe-format" role="toolbar" aria-label="Formatting">
              <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('bold')}><b>B</b> Bold</button>
              <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('italic')}><i>I</i> Italic</button>
              <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('createLink')}>Link</button>
              <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('unlink')}>Unlink</button>
            </div>
          ) : null}
          <p className="help">Type straight onto the page. Press Esc when you are done with this part.</p>
          {linkInput(selected.link, 'pe-sel-link')}
        </div>
      )
    }
    const f = getField(selected.ref)
    return (
      <div className="pe-card">
        <div className="pe-card-head"><b>Photo</b>{selected.section ? <span className="chip grey">{selected.section}</span> : null}<button className="btn small ghost" onClick={() => { setSelected(null); markSelected(null) }} aria-label="Close">&times;</button></div>
        {f ? <ImageSlot label="Photo" value={f.value} original={f.original ?? f.value}
          onChange={(v) => { setRef(selected.ref, { value: v.value, media: v.media ?? null }); bump() }} /> : null}
        {altInput(selected.alt, 'pe-sel-alt')}
        {linkInput(selected.link, 'pe-sel-imglink')}
      </div>
    )
  }

  const status = saving ? 'Saving...' : dirty ? 'Unsaved changes' : saved ? 'All changes saved' : 'No changes yet'
  const width = device === 'desktop' ? DESKTOP_WIDTH : MOBILE_WIDTH
  const scale = stage.w ? Math.min(1, stage.w / width) : 1
  const frameHeight = stage.h ? Math.max(200, stage.h / scale) : 800

  return (
    <div className="pe">
      <div className="pe-bar">
        <a className="btn" href="/admin/pages">&larr; Pages</a>
        <h1 className="pe-title" title={props.url ? `${BRAND.domain}${props.url}` : undefined}>{props.label}</h1>
        <div className="pe-seg" role="group" aria-label="Preview size">
          <button type="button" className={device === 'desktop' ? 'on' : ''} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>Desktop</button>
          <button type="button" className={device === 'mobile' ? 'on' : ''} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>Mobile</button>
        </div>
        <span className={`pe-status${dirty ? ' warn' : ''}`} aria-live="polite">{status}</span>
        {props.url ? <a className="btn" href={props.url} target="_blank" rel="noopener">{Icon.external()} View</a> : null}
        <button className="btn primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</button>
        <PublishButton />
      </div>

      <div className="pe-body">
        <div className={`pe-stage ${device}`} ref={stageRef}>
          <div className="pe-frame" style={{ width: width * scale }}>
            <iframe ref={frame} title={`Editing ${props.label}`} onLoad={onFrameLoad}
              style={{ width, height: frameHeight, transform: `scale(${scale})` }} />
          </div>
          {loading ? <div className="pe-loading" role="status">Updating the preview...</div> : null}
          {previewError ? <div className="pe-error"><Notice tone="bad" icon={Icon.warn()}><p>{previewError}</p><button className="btn small" onClick={() => refresh()}>Try again</button></Notice></div> : null}
        </div>

        <aside className="pe-panel" aria-label="Page settings">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'content'} className={tab === 'content' ? 'on' : ''} onClick={() => setTab('content')}>Content</button>
            <button role="tab" aria-selected={tab === 'seo'} className={tab === 'seo' ? 'on' : ''} onClick={() => setTab('seo')}>SEO</button>
            <button role="tab" aria-selected={tab === 'sections'} className={tab === 'sections' ? 'on' : ''} onClick={() => setTab('sections')}>Sections</button>
          </div>
          <div className="pe-scroll">
            {tab === 'content' ? (
              <>
                <div className="pe-tip">
                  <p><b>Click any words on the page</b> to change them in place.</p>
                  <p><b>Click any photo</b> to replace it.</p>
                  <p>Press <b>Save changes</b> when you are done, then <b>Publish website</b> to put it live.</p>
                </div>
                {selectionCard()}
                <h3 className="pe-h">Photos on this page ({images.length})</h3>
                {!images.length && !loading ? <p className="help">This page has no photos that can be changed here.</p> : null}
                <div className="pe-imgs">
                  {images.map((im, i) => {
                    const f = getField(im.ref)
                    const alt = im.alt ? getField(im.alt) : null
                    const src = (f?.value || '').replace(/&amp;/g, '&')
                    return (
                      <div key={im.ref} className={`pe-img${selected?.kind === 'image' && selected.ref === im.ref ? ' on' : ''}`}>
                        <button type="button" className="pe-thumb" onClick={() => selectImage(im)} aria-label={`Show photo ${i + 1} on the page`}>
                          {src ? <img src={src} alt="" loading="lazy" /> : null}
                        </button>
                        {alt ? (
                          <input className="input" aria-label={`Description of photo ${i + 1}`} value={textForEditing(alt.value)} placeholder="Describe the photo"
                            onChange={(e) => { setRef(im.alt!, { value: textForSaving(e.target.value) }); doc()?.querySelectorAll(`img[data-pda="${CSS_escape(im.alt!)}"]`).forEach((x) => x.setAttribute('alt', e.target.value)) }} />
                        ) : <span className="help grow">No description needed</span>}
                        <button type="button" className="btn small" onClick={() => setPickFor(im.ref)}>Replace</button>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : null}
            {tab === 'seo' ? (
              <SeoPanel seo={seo} onChange={(s) => { setSeo(s); touch() }} url={props.url || '/'} defaultOg={props.defaultOg}
                titleHint={props.defaultTitle} showCanonical={props.isAdmin} />
            ) : null}
            {tab === 'sections' ? (
              <>
                <p className="help" style={{ marginBottom: 12 }}>Drag the dots to change the order. The eye hides or shows a section. Click a section to jump to it, and open it to edit everything in it as a form.</p>
                <div className="sections">
                  {pinned.map((s) => (
                    <SectionRow key={s.key} s={s} open={open.has(s.key)} onToggle={() => toggle(s.key)} onShow={() => scrollToSection(s)} sortable={false}>{renderBody(s)}</SectionRow>
                  ))}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={movable.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                      {movable.map((s) => (
                        <SectionRow key={s.key} s={s} sortable open={open.has(s.key)} onToggle={() => toggle(s.key)} onShow={() => scrollToSection(s)} onHide={() => hide(s.key)}>{renderBody(s)}</SectionRow>
                      ))}
                    </SortableContext>
                  </DndContext>
                  {fixed.map((s) => (
                    <SectionRow key={s.key} s={s} open={open.has(s.key)} onToggle={() => toggle(s.key)} onShow={() => scrollToSection(s)} onHide={() => hide(s.key)} sortable={false}>{renderBody(s)}</SectionRow>
                  ))}
                </div>
              </>
            ) : null}
            {props.lastmod ? <p className="help" style={{ marginTop: 14 }}>Last saved {when(props.lastmod)}.</p> : null}
          </div>
        </aside>
      </div>
      {pickFor ? <MediaPicker onClose={() => setPickFor(null)} onPick={(d) => { const r = pickFor; setPickFor(null); applyPhoto(r, d) }} /> : null}
    </div>
  )
}

/** CSS.escape for attribute selectors, kept local so it works in every browser the dashboard supports. */
function CSS_escape(s: string): string {
  return s.replace(/["\\]/g, '\\$&')
}
