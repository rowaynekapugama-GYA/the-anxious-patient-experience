'use client'
/**
 * Every photo in the Media Library: the website's own photos once GYA has run
 * Import, and anything uploaded since. Replacing a photo keeps it as the same
 * item, so every page that uses it shows the new one.
 */
import React, { useMemo, useState } from 'react'
import { api, mediaSrc, replaceMedia, uploadMedia, MAX_UPLOAD_MB } from '../lib/client'
import { DropZone, useMediaList, type MediaDoc } from '../ui/MediaPicker'
import { Modal, TextInput } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'


function kb(n?: number) {
  if (!n) return ''
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}

function LibraryItem({ doc, onClose, onSaved, onDeleted }: { doc: MediaDoc; onClose: () => void; onSaved: (d: MediaDoc) => void; onDeleted: () => void }) {
  const toast = useToast()
  const [alt, setAlt] = useState(doc.alt || '')
  const [busy, setBusy] = useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const src = mediaSrc(doc)
  async function saveAlt() {
    setBusy(true)
    try {
      const r = await api<{ doc: MediaDoc }>(`/api/media/${doc.id}?depth=0`, { method: 'PATCH', body: { alt } })
      onSaved(r.doc)
      toast('Saved.', 'good')
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function replace(f?: File) {
    if (!f) return
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { toast(`That photo is larger than ${MAX_UPLOAD_MB} MB.`, 'bad'); return }
    setBusy(true)
    try {
      const d = await replaceMedia(doc.id, f)
      onSaved(d)
      toast('Photo replaced everywhere it is used. Publish website to put it live.', 'good')
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function remove() {
    if (!window.confirm('Delete this photo? Any page still using it will lose the photo the next time you publish.')) return
    setBusy(true)
    try {
      await api(`/api/media/${doc.id}`, { method: 'DELETE' })
      onDeleted()
      toast('Photo deleted.', 'good')
    } catch (e) { toast((e as Error).message, 'bad'); setBusy(false) }
  }
  return (
    <Modal title={doc.filename || 'Photo'} onClose={onClose} footer={<>
      <button className="btn danger" disabled={busy} onClick={remove}>{Icon.trash()} Delete</button>
      <span style={{ flex: 1 }} />
      <button className="btn" onClick={onClose}>Close</button>
      <button className="btn primary" disabled={busy} onClick={saveAlt}>Save description</button>
    </>}>
      <div className="grid-2">
        <div><img src={src} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--pd-line)' }} /></div>
        <div>
          <p className="help">{doc.width} by {doc.height} pixels, {kb(doc.filesize)}. Uploaded {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-AU') : ''}.</p>
          <TextInput label="Default description (alt text)" value={alt} onChange={setAlt} help="Used when this photo is added to a page or post. Each page can still have its own." />
          <div className="field"><span className="lab">Replace this photo</span>
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>{Icon.upload()} Upload a replacement</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { replace(e.target.files?.[0]); e.target.value = '' }} />
            <div className="help">The new photo takes this one&apos;s place on every page that uses it.</div></div>
          <div className="field"><span className="lab">Address</span><input className="input" readOnly value={src} onFocus={(e) => e.target.select()} /></div>
        </div>
      </div>
    </Modal>
  )
}


export function MediaLibrary() {
  const toast = useToast()
  const { docs, setDocs, loading, more, loadMore } = useMediaList(true)
  const [sel, setSel] = useState<MediaDoc | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')

  async function upload(files: File[]) {
    if (!files.length) return
    setBusy(true)
    let n = 0
    try {
      for (const f of files) {
        if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { toast(`${f.name} is larger than ${MAX_UPLOAD_MB} MB.`, 'bad'); continue }
        const d = await uploadMedia(f, f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '))
        setDocs((x) => [d, ...x])
        n++
      }
      if (n) toast(n === 1 ? 'Photo uploaded. Click it to add a description.' : `${n} photos uploaded. Click each one to add a description.`, 'good')
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  const shown = useMemo(() => docs.filter((d) => !q || `${d.alt} ${d.filename}`.toLowerCase().includes(q.toLowerCase())), [docs, q])

  return (
    <>
      <div className="actions" style={{ marginBottom: 12 }}>
        <span className="help">Click a photo to change its description, replace it everywhere it is used, or delete it.</span>
        <span style={{ flex: 1 }} />
        <input className="input search" placeholder="Search photos" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <DropZone onFiles={upload} label={busy ? 'Uploading...' : 'Drag photos here, or'} />
      {loading && !docs.length ? <p className="empty">Loading...</p> : null}
      {!loading && !docs.length ? <p className="empty">No photos yet. GYA loads the website&apos;s photos with Import on the Dashboard, or upload your own above.</p> : null}
      <div className="media-grid">
        {shown.map((d) => (
          <button key={d.id} className="media-tile" onClick={() => setSel(d)}>
            <div className="im" style={{ backgroundImage: `url("${mediaSrc(d, 'thumb')}")` }} />
            <div className="cap">{d.alt || d.filename}</div>
          </button>
        ))}
      </div>
      {more ? <p style={{ textAlign: 'center', marginTop: 12 }}><button className="btn" onClick={loadMore}>Show more</button></p> : null}
      {sel ? (
        <LibraryItem doc={sel} onClose={() => setSel(null)}
          onSaved={(d) => { setDocs((x) => x.map((y) => (y.id === d.id ? d : y))); setSel((cur) => (cur && cur.id === d.id ? d : cur)) }}
          onDeleted={() => { setDocs((x) => x.filter((y) => y.id !== sel.id)); setSel(null) }} />
      ) : null}
    </>
  )
}
