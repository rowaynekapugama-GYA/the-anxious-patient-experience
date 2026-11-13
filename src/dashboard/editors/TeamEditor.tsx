'use client'
/**
 * The Team screen (v1.8.2): the team cards on the homepage as a list of people, like the Precision Dental
 * Team editor (GYA dashboard standard). Drag to reorder, hide or show, edit in a side panel, add or remove.
 * It edits the homepage's own team section, so the page editor and this screen always show the same thing;
 * Save changes keeps it in the dashboard and Publish website puts it live, as everywhere else.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TeamData, TeamField, TeamMember, TeamSave } from '../team'
import { api } from '../lib/client'
import { linkForEditing, linkForSaving, textForEditing, textForSaving } from '../lib/text'
import { plain } from '../util'
import { Modal, Notice, useUnsavedWarning } from '../ui/fields'
import { ImageSlot } from '../ui/MediaPicker'
import { RichInline } from '../ui/RichInline'
import { PublishButton } from '../ui/PublishButton'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'

/** A card on this screen: a saved member (uid) or a new one (key only, until it is saved). */
type Row = TeamMember & { key: string; isNew?: boolean }

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const rowsOf = (d: TeamData | null): Row[] => (d?.members ?? []).map((m) => ({ ...m, key: m.uid }))
let seq = 0
const blank = (): Row => ({
  key: `new-${Date.now().toString(36)}-${seq++}`,
  uid: '',
  isNew: true,
  hidden: false,
  photo: { id: 'photo', kind: 'image', label: 'Photo', value: '', media: null, original: '' },
  alt: { id: 'alt', kind: 'alt', label: 'Photo description', value: '' },
  name: { id: 'name', kind: 'richtext', label: 'Name', value: '' },
  role: { id: 'role', kind: 'richtext', label: 'Role', value: '' },
  bios: [{ id: 'bio', kind: 'richtext', label: 'Short bio', value: '' }],
  links: [],
})

// AHPRA: Lorna is a general dentist, and the advertising guidelines rule out these words for everyone
const NEVER = /\bspecialists?\b/i
const CAREFUL = /\b(pain[\s-]?free|painless|best|expert|experts|guaranteed?|leading)\b/i

const nameOf = (r: Row) => plain(r.name?.value ?? '') || (r.isNew ? 'New team member' : 'Team member')
const roleOf = (r: Row) => plain(r.role?.value ?? '')
const wordsOf = (r: Row) => [r.name?.value, r.role?.value, ...r.bios.map((b) => b.value), ...r.links.map((l) => l.text?.value)].map((v) => plain(v ?? '')).join(' ')

/** What changed on a saved member: field id to value, for the fields that differ from the saved copy. */
function changedValues(r: Row, base: Row | undefined): NonNullable<TeamSave['members'][number]['values']> {
  const out: NonNullable<TeamSave['members'][number]['values']> = {}
  const all = (x: Row) => [x.photo, x.alt, x.name, x.role, ...x.bios, ...x.links.flatMap((l) => [l.href, l.text])].filter(Boolean) as TeamField[]
  const before = new Map((base ? all(base) : []).map((f) => [f.id, f]))
  for (const f of all(r)) {
    const b = before.get(f.id)
    if (!b || b.value !== f.value || (b.media ?? null) !== (f.media ?? null)) out[f.id] = { value: f.value, media: f.media ?? null }
  }
  return out
}

// ---------------------------------------------------------------- one card in the list
function Card({ r, onEdit, onToggle, onRemove }: { r: Row; onEdit: () => void; onToggle: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.key })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const src = (r.photo?.value ?? '').replace(/&amp;/g, '&')
  return (
    <li ref={setNodeRef} style={style} className={`team-card${isDragging ? ' dragging' : ''}${r.hidden ? ' is-hidden' : ''}`} data-member={r.key}>
      <div className="team-card-top">
        <button type="button" className="handle" aria-label={`Drag to move ${nameOf(r)}`} {...attributes} {...listeners}>{Icon.grip()}</button>
        {r.hidden ? <span className="chip warn">Hidden</span> : null}
        {r.isNew ? <span className="chip blue">Not saved yet</span> : null}
      </div>
      <button type="button" className="team-photo" onClick={onEdit} aria-label={`Edit ${nameOf(r)}`}>
        {src ? <img src={src} alt="" /> : <span className="none">{Icon.image()} No photo yet</span>}
      </button>
      <div className="team-card-text">
        <b>{nameOf(r)}</b>
        <span className="team-role">{roleOf(r) || 'No role yet'}</span>
      </div>
      <div className="team-card-actions">
        <button type="button" className="btn small" onClick={onEdit}>Edit</button>
        <button type="button" className="btn small ghost icon-only" onClick={onToggle}
          title={r.hidden ? 'Show on the website' : 'Hide from the website'} aria-label={r.hidden ? `Show ${nameOf(r)}` : `Hide ${nameOf(r)}`}>
          {r.hidden ? Icon.eye() : Icon.eyeOff()}
        </button>
        <button type="button" className="btn small ghost icon-only danger" onClick={onRemove} title="Remove" aria-label={`Remove ${nameOf(r)}`}>{Icon.trash()}</button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------- the side panel
function EditPanel({ r, onChange, onClose }: { r: Row; onChange: (next: Row) => void; onClose: () => void }) {
  const set = (patch: Partial<Row>) => onChange({ ...r, ...patch })
  const setField = (k: 'photo' | 'alt' | 'name' | 'role', patch: Partial<TeamField>) => set({ [k]: { ...(r[k] as TeamField), ...patch } } as Partial<Row>)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const words = wordsOf(r)
  let more = 0
  return (
    <div className="team-drawer-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="team-drawer" role="dialog" aria-modal="true" aria-label={`Edit ${nameOf(r)}`}>
        <div className="team-drawer-head">
          <h2>{r.isNew ? 'New team member' : `Edit ${nameOf(r)}`}</h2>
          <button type="button" className="btn small" onClick={onClose}>Done</button>
        </div>
        <div className="team-drawer-body">
          {NEVER.test(words) ? <Notice tone="bad" icon={Icon.warn()}><p>Please remove the word &quot;specialist&quot;. Lorna is a general dentist, and nobody on the team can be described as a specialist.</p></Notice> : null}
          {!NEVER.test(words) && CAREFUL.test(words) ? <Notice tone="warn" icon={Icon.warn()}><p>Check the wording: the advertising rules (AHPRA) rule out words like &quot;pain-free&quot;, &quot;best&quot;, &quot;expert&quot; and &quot;guaranteed&quot;.</p></Notice> : null}
          {r.photo ? (
            <ImageSlot label="Photo" value={r.photo.value} original={r.photo.original || undefined}
              onChange={(v) => set({ photo: { ...(r.photo as TeamField), value: v.value, media: v.media ?? null }, ...(v.alt && r.alt && !r.alt.value ? { alt: { ...r.alt, value: textForSaving(v.alt) } } : {}) })} />
          ) : null}
          {r.alt ? (
            <div className="field">
              <label htmlFor="tm-alt">Photo description</label>
              <input id="tm-alt" className="input" value={textForEditing(r.alt.value)} onChange={(e) => setField('alt', { value: textForSaving(e.target.value) })} />
              <div className="help">Describe the photo for someone who cannot see it, for example &quot;Lauren Bright, APE Dental Assistant&quot;.</div>
            </div>
          ) : null}
          {r.photo ? <p className="help" style={{ marginTop: -6 }}>Use a portrait photo like the others, so the cards stay the same shape.</p> : null}
          {r.name ? (
            <div className="field">
              <label htmlFor="tm-name">Name</label>
              <input id="tm-name" className="input" value={textForEditing(r.name.value)} onChange={(e) => setField('name', { value: textForSaving(e.target.value) })} />
            </div>
          ) : null}
          {r.role ? (
            <div className="field">
              <label htmlFor="tm-role">Role or title</label>
              <input id="tm-role" className="input" value={textForEditing(r.role.value)} onChange={(e) => setField('role', { value: textForSaving(e.target.value) })} />
              <div className="help">Shown in small capitals under the name, for example APE Lead | Patient Care &amp; Support.</div>
            </div>
          ) : null}
          {r.bios.map((b, i) => {
            const label = b.quote ? 'Quote' : i === 0 ? 'Short bio' : `More about them (${++more})`
            return (
              <div className="field" key={b.id}>
                <label htmlFor={`tm-bio-${b.id}`}>{label}</label>
                <RichInline id={`tm-bio-${b.id}`} value={b.value} onChange={(html) => set({ bios: r.bios.map((x) => (x.id === b.id ? { ...x, value: html } : x)) })} />
                {i === 0 && r.bios.length > 1 ? <div className="help">The first paragraph shows straight away; the rest open with Read more.</div> : null}
              </div>
            )
          })}
          {r.links.map((l, i) => (
            <div key={l.href.id} className="team-link">
              {l.text ? (
                <div className="field">
                  <label htmlFor={`tm-lt-${l.href.id}`}>Button words</label>
                  <input id={`tm-lt-${l.href.id}`} className="input" value={textForEditing(l.text.value)}
                    onChange={(e) => set({ links: r.links.map((x, j) => (j === i && x.text ? { ...x, text: { ...x.text, value: textForSaving(e.target.value) } } : x)) })} />
                </div>
              ) : null}
              <div className="field">
                <label htmlFor={`tm-lh-${l.href.id}`}>Button link</label>
                <input id={`tm-lh-${l.href.id}`} className="input" value={linkForEditing(l.href.value)}
                  onChange={(e) => set({ links: r.links.map((x, j) => (j === i ? { ...x, href: { ...x.href, value: linkForSaving(e.target.value) } } : x)) })} />
                <div className="help">#contact goes to the contact part of the homepage. A page on this website starts with /, another website with https://</div>
              </div>
            </div>
          ))}
          <p className="help">Changes are kept on this screen until you press <b>Save changes</b>, then <b>Publish website</b>.</p>
        </div>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------- the screen
export function TeamEditor({ initial }: { initial: TeamData | null }) {
  const toast = useToast()
  const [data, setData] = useState<TeamData | null>(initial)
  const [rows, setRows] = useState<Row[]>(() => rowsOf(initial))
  const [base, setBase] = useState<Row[]>(() => rowsOf(initial))
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(base), [rows, base])
  useUnsavedWarning(dirty)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = rows.findIndex((r) => r.key === active.id)
    const to = rows.findIndex((r) => r.key === over.id)
    setRows(arrayMove(rows, from, to))
  }

  const shown = rows.filter((r) => !r.hidden)
  const lone = shown.length > 3 && shown.length % 3 === 1
  const banned = rows.filter((r) => NEVER.test(wordsOf(r)))
  const careful = rows.filter((r) => !NEVER.test(wordsOf(r)) && CAREFUL.test(wordsOf(r)))
  const homeHref = data ? `/admin/pages/${data.pageId}?section=team` : '/admin/pages'
  const current = rows.find((r) => r.key === editing) ?? null

  function add() {
    const r = blank()
    setRows((all) => [...all, r])
    setEditing(r.key)
  }

  async function save() {
    setError('')
    const problems: string[] = []
    for (const r of rows) {
      if (!r.hidden && !plain(r.name?.value ?? '')) problems.push('Every team member on show needs a name.')
      if (r.isNew && !r.photo?.media) problems.push(`${nameOf(r)} needs a photo before saving (Edit, then Choose from library or Upload).`)
    }
    if (banned.length) problems.push(`Please remove the word "specialist" from ${banned.map(nameOf).join(', ')}.`)
    if (problems.length) { setError([...new Set(problems)].join(' ')); return }
    const byUid = new Map(base.map((b) => [b.uid, b]))
    const body: TeamSave = {
      version: data?.version,
      members: rows.map((r) => r.isNew
        ? { hidden: r.hidden, add: { name: r.name?.value ?? '', role: r.role?.value ?? '', bio: r.bios[0]?.value ?? '', alt: r.alt?.value ?? '', media: r.photo?.media ?? null } }
        : { uid: r.uid, hidden: r.hidden, values: changedValues(r, byUid.get(r.uid)) }),
    }
    setSaving(true)
    try {
      const fresh = await api<TeamData>('/api/dashboard/team', { method: 'POST', body })
      setData(fresh)
      const next = rowsOf(fresh)
      setRows(next)
      setBase(clone(next))
      setEditing(null)
      toast('Team saved. Press Publish website to put it live.', 'good')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    setRows(clone(base))
    setEditing(null)
    setError('')
  }

  return (
    <>
      <div className="pd-head">
        <div className="grow">
          <h1>Team</h1>
          <p className="pd-sub">The team cards on the homepage. Edit a person, drag to change the order, or hide someone without deleting them.</p>
        </div>
        <Link className="btn" href={homeHref}>{Icon.external()} Edit on the homepage</Link>
        {dirty ? <button type="button" className="btn ghost" onClick={discard} disabled={saving}>Undo changes</button> : null}
        <button type="button" className="btn primary" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        <PublishButton />
      </div>

      <Notice tone="info" icon={Icon.info()}>
        <p><b>Wording rules:</b> Lorna is a general dentist, so please never use the word &quot;specialist&quot; for her or anyone on the team. The advertising rules for health practices (AHPRA) also apply: no testimonials, and no &quot;pain-free&quot;, &quot;best&quot; or &quot;expert&quot;.</p>
      </Notice>
      {data?.problem ? <Notice tone="warn" icon={Icon.warn()}><p>{data.problem} You can still edit the words on the homepage with <b>Edit on the homepage</b>, or ask GYA.</p></Notice> : null}
      {data?.sectionHidden ? <Notice tone="warn" icon={Icon.warn()}><p>The whole team section is hidden on the homepage at the moment. Show it again from <b>Edit on the homepage</b>, Sections tab.</p></Notice> : null}
      {lone ? <Notice tone="warn" icon={Icon.warn()}><p>On a computer the team shows three across, so with {shown.length} people on show the last card sits on its own row. That is fine if intended; otherwise add or hide someone.</p></Notice> : null}
      {careful.length ? <Notice tone="warn" icon={Icon.warn()}><p>Check the wording for {careful.map(nameOf).join(', ')}: the advertising rules rule out words like &quot;pain-free&quot;, &quot;best&quot;, &quot;expert&quot; and &quot;guaranteed&quot;.</p></Notice> : null}
      {error ? <Notice tone="bad" icon={Icon.warn()}><p>{error}</p></Notice> : null}
      {!data ? <Notice tone="bad" icon={Icon.warn()}><p>The homepage could not be found. Please contact GYA.</p></Notice> : null}

      {data && !data.problem ? (
        <div className="panel">
          <div className="panel-head">
            <h2>{shown.length} on the website{rows.length > shown.length ? `, ${rows.length - shown.length} hidden` : ''}</h2>
            <span className="help">Drag the dots to change the order</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((r) => r.key)} strategy={rectSortingStrategy}>
              <ul className="team-list-edit" ref={listRef}>
                {rows.map((r) => (
                  <Card key={r.key} r={r} onEdit={() => setEditing(r.key)}
                    onToggle={() => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, hidden: !x.hidden } : x)))}
                    onRemove={() => setRemoving(r)} />
                ))}
                <li className="team-card add">
                  <button type="button" onClick={add}>{Icon.plus()}<span>Add a team member</span></button>
                </li>
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      {current ? <EditPanel r={current} onChange={(n) => setRows((all) => all.map((x) => (x.key === n.key ? n : x)))} onClose={() => setEditing(null)} /> : null}

      {removing ? (
        <Modal title={`Remove ${nameOf(removing)}?`} narrow onClose={() => setRemoving(null)}
          footer={<>
            <button type="button" className="btn" onClick={() => setRemoving(null)}>Keep</button>
            <button type="button" className="btn danger" onClick={() => { const k = removing.key; setRemoving(null); setRows((all) => all.filter((x) => x.key !== k)); if (editing === k) setEditing(null) }}>Remove</button>
          </>}>
          <p>{nameOf(removing)} and their photo, role and bio come off the team. To take someone off the website for a while instead, use the eye to hide them.</p>
          <p className="help">Nothing changes until you press Save changes, and the website only changes when you Publish.</p>
        </Modal>
      ) : null}
    </>
  )
}
