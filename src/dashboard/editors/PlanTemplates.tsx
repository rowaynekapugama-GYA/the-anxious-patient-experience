'use client'
/**
 * v1.19.0: Treatment plans > Templates and paragraphs. So the practice sets up its wording once and starts each plan
 * from it, instead of typing the same things for every patient:
 *  - templates: a plan's wording saved under a name (from a finished plan, or made here), to start new plans from;
 *  - the paragraph library: standard paragraphs added to any plan or template, starting with the form's own wording.
 * Both need "Can create and view treatment plans" and the feature on, and both are checked for wording before saving,
 * as a plan is before it is finalised. No patient details are ever part of a template or a paragraph.
 */
import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useToast } from '../ui/Toast'
import { Modal, Notice, TextInput, TextArea } from '../ui/fields'
import { EXTRA, extrasOf, fillText, isField, planTexts, planContext, MERGE_FIELDS, type Answers, type Extras, type FormDef, type MergeContext } from '@/plans/form'
import { phraseProblems } from '@/plans/phrases'
import { call, get, msg, when, FieldInput, SectionExtras, LibraryPicker, PhraseNotice, type Block, type TemplateSummary } from './Plans'

const SAMPLE: MergeContext = { firstName: '{first_name}', appointmentDate: '{appointment_date}', dentist: '{dentist}' }
const mergeHelp = `You can use ${MERGE_FIELDS.map((m) => `${m.key} (${m.label})`).join(', ')}; they are filled in from the booking on each plan.`

export function TemplatesScreen() {
  const toast = useToast()
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [err, setErr] = useState('')
  const [naming, setNaming] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id?: number; name: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { const j = await get<{ templates: TemplateSummary[]; blocks: Block[] }>('library=1'); setTemplates(j.templates); setBlocks(j.blocks) } catch (e) { setErr(msg(e)) }
  }, [])
  useEffect(() => { void load() }, [load])
  async function newTemplate() {
    setBusy(true)
    try { const r = await call<{ template: TemplateSummary }>({ action: 'template', name: naming, answers: {} }); window.location.href = `/admin/plans/templates/${r.template.id}` } catch (e) { toast(msg(e), 'bad'); setBusy(false) }
  }
  async function retireT(x: TemplateSummary) {
    try { await call({ action: 'retireTemplate', id: x.id, retired: !x.retiredAt }); toast(x.retiredAt ? `"${x.name}" is back in the list.` : `"${x.name}" is retired. Plans already started from it are not changed.`, 'good'); await load() } catch (e) { toast(msg(e), 'bad') }
  }
  async function saveBlock() {
    if (!editing) return
    setBusy(true)
    try { await call({ action: 'block', ...editing }); toast('Saved.', 'good'); setEditing(null); await load() } catch (e) { toast(msg(e), 'bad') } finally { setBusy(false) }
  }
  async function retireB(b: Block) {
    try { await call({ action: 'retireBlock', id: b.id, retired: !b.retiredAt }); await load() } catch (e) { toast(msg(e), 'bad') }
  }
  if (!templates) return <div className="panel"><p className="empty">{err || 'Loading...'}</p></div>
  const blockProblems = editing ? phraseProblems([{ where: 'this paragraph', text: editing.body }]) : []
  return (
    <>
      <div className="panel" data-templates={templates.filter((x) => !x.retiredAt).length}>
        <div className="panel-head"><h2>Templates</h2><button className="btn primary" onClick={() => setNaming('')} data-new-template>New template</button></div>
        <p className="help" style={{ marginTop: 0 }}>A template is your usual wording for a kind of plan, for example a first visit with inhalation sedation. Start a new plan from it (New plan from a booking, or the plan box on a booking) and change what is different for that patient. You can also save any plan as a template with &quot;Save as a template&quot;.</p>
        {!templates.length ? <p className="empty">No templates yet.</p> : (
          <ul className="list-plain">{templates.map((x) => (
            <li key={x.id} data-template={x.name}>
              <span className="grow"><b>{x.name}</b> {x.retiredAt ? <span className="chip grey">Retired</span> : null}<br /><span className="help">Changed {when(x.updatedAt)} by {x.updatedBy}</span></span>
              <Link className="btn small" href={`/admin/plans/templates/${x.id}`}>Edit</Link>
              <button className="btn small ghost" onClick={() => retireT(x)}>{x.retiredAt ? 'Restore' : 'Retire'}</button>
            </li>
          ))}</ul>
        )}
      </div>

      <div className="panel" data-blocks={blocks.filter((b) => !b.retiredAt).length}>
        <div className="panel-head"><h2>Paragraph library</h2><button className="btn" onClick={() => setEditing({ name: '', body: '' })} data-new-block>Add a paragraph</button></div>
        <p className="help" style={{ marginTop: 0 }}>Your standard paragraphs, ready to add to any plan or template with &quot;Add a paragraph from your library&quot;. It started with the wording already on your form. {mergeHelp}</p>
        {!blocks.length ? <p className="empty">No paragraphs yet.</p> : (
          <ul className="list-plain plan-library">{blocks.map((b) => (
            <li key={b.id} data-block={b.name}>
              <span className="grow"><b>{b.name}</b> {b.retiredAt ? <span className="chip grey">Retired</span> : null}<br /><span className="help plan-lib-body">{b.body}</span></span>
              <button className="btn small" onClick={() => setEditing({ id: b.id, name: b.name, body: b.body })}>Edit</button>
              <button className="btn small ghost" onClick={() => retireB(b)}>{b.retiredAt ? 'Restore' : 'Retire'}</button>
            </li>
          ))}</ul>
        )}
      </div>

      {naming !== null ? <Modal title="New template" narrow onClose={() => setNaming(null)} footer={<><button className="btn" onClick={() => setNaming(null)}>Cancel</button><button className="btn primary" disabled={busy || !naming.trim()} onClick={newTemplate}>Create and edit</button></>}>
        <TextInput label="Template name" value={naming} onChange={setNaming} maxLength={80} help='For example "First visit with inhalation sedation".' />
      </Modal> : null}
      {editing ? <Modal title={editing.id ? 'Edit paragraph' : 'Add a paragraph'} onClose={() => setEditing(null)} footer={<><button className="btn" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" disabled={busy || !editing.name.trim() || !editing.body.trim() || blockProblems.length > 0} onClick={saveBlock} data-save-block>Save paragraph</button></>}>
        <TextInput label="Name (only you see this)" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} maxLength={80} />
        <TextArea label="Wording" value={editing.body} onChange={(v) => setEditing({ ...editing, body: v })} rows={6} help={mergeHelp} />
        <PhraseNotice problems={blockProblems} />
      </Modal> : null}
    </>
  )
}

/** One template: its name and wording, laid out like a plan (no patient, and no dates: those are per plan). */
export function TemplateEditor({ id }: { id: number }) {
  const toast = useToast()
  const [tpl, setTpl] = useState<(TemplateSummary & { form: FormDef; answers: Answers }) | null>(null)
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState<Answers>({})
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [picking, setPicking] = useState<null | ((body: string) => void)>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    get<{ template: TemplateSummary & { form: FormDef; answers: Answers } }>(`template=${id}`).then((j) => { setTpl(j.template); setName(j.template.name); setAnswers(j.template.answers) }).catch((e) => setErr(msg(e)))
  }, [id])
  const change = (k: string, v: Answers[string] | undefined) => {
    setAnswers((cur) => { const next = { ...cur }; if (v === undefined || v === '') delete next[k]; else next[k] = v; return next })
    setDirty(true)
  }
  const library = (then: (body: string) => void) => {
    setPicking(() => then)
    if (!blocks) get<{ blocks: Block[] }>('library=1').then((j) => setBlocks(j.blocks)).catch((e) => { toast(msg(e), 'bad'); setPicking(null) })
  }
  async function save() {
    setBusy(true)
    try { const r = await call<{ template: TemplateSummary }>({ action: 'template', id, name, answers }); setTpl((t) => (t ? { ...t, ...r.template } : t)); setDirty(false); toast('Template saved.', 'good') } catch (e) { toast(msg(e), 'bad') } finally { setBusy(false) }
  }
  if (!tpl) return <div className="panel"><p className="empty">{err || 'Loading...'}</p></div>
  const problems = phraseProblems(planTexts(tpl.form, answers), planContext(tpl.form, answers))
  const extras = extrasOf(answers)
  const setExtras = (secId: string, l: string[]) => { const next: Extras = { ...extras, [secId]: l }; if (!l.length) delete next[secId]; change(EXTRA, Object.keys(next).length ? next : undefined) }
  return (
    <>
      <div className="panel plan-head">
        <div className="plan-who">
          <TextInput label="Template name" value={name} onChange={(v) => { setName(v); setDirty(true) }} maxLength={80} />
          <p className="help">{dirty ? 'Changes not saved yet.' : `Saved ${when(tpl.updatedAt)} by ${tpl.updatedBy}.`} Dates are filled in on each plan, so they are not part of a template. {tpl.retiredAt ? 'This template is retired.' : ''}</p>
        </div>
        <div className="actions plan-actions">
          <button className="btn primary" disabled={busy || !name.trim() || problems.length > 0} onClick={save} data-save-template-edit>Save template</button>
        </div>
      </div>
      <PhraseNotice problems={problems} />
      <form className="plan-form" onSubmit={(e) => e.preventDefault()}>
        {tpl.form.sections.map((sec) => (
          <section className="panel plan-section" key={sec.id}>
            {sec.heading ? <h2>{fillText(sec.heading, SAMPLE)}</h2> : null}
            {sec.items.map((it) => !isField(it.type)
              ? <div key={it.id} className={`plan-fixed ${it.type}`}>{it.type === 'callout' && it.label ? <b>{it.label}</b> : null}<p>{it.text}</p><span className="help">Printed as written</span></div>
              : it.type === 'date' ? <p key={it.id} className="help">{it.label}: filled in on each plan.</p>
              : <FieldInput key={it.id} it={it} value={answers[it.id]} onChange={(v) => change(it.id, v)} locked={false}
                  onLibrary={() => library((body) => { const cur = typeof answers[it.id] === 'string' ? String(answers[it.id]) : ''; change(it.id, cur ? `${cur}\n\n${body}` : body) })} />)}
            <SectionExtras list={extras[sec.id] || []} locked={false} ctx={SAMPLE} onChange={(l) => setExtras(sec.id, l)}
              onLibrary={() => library((body) => setExtras(sec.id, [...(extras[sec.id] || []), body]))} />
          </section>
        ))}
      </form>
      {!problems.length ? null : <Notice tone="info">The template cannot be saved until the wording above is changed.</Notice>}
      {picking ? (blocks ? <LibraryPicker blocks={blocks} onPick={(b) => picking(b)} onClose={() => setPicking(null)} /> : <Modal title="Your library" narrow onClose={() => setPicking(null)}><p className="empty">Loading...</p></Modal>) : null}
    </>
  )
}
