'use client'
/** Choose a photo from the Media Library or upload a new one. */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api, mediaSrc, uploadMedia, MAX_UPLOAD_MB } from '../lib/client'
import { Modal } from './fields'
import { useToast } from './Toast'
import { Icon } from './icons'

export type MediaDoc = { id: number | string; filename?: string; alt?: string; url?: string; sizes?: any; width?: number; height?: number; createdAt?: string; filesize?: number }

export function useMediaList(open: boolean) {
  const [docs, setDocs] = useState<MediaDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await api<{ docs: MediaDoc[]; hasNextPage: boolean }>(`/api/media?limit=60&page=${p}&sort=-createdAt&depth=0`)
      setDocs((d) => (p === 1 ? res.docs : [...d, ...res.docs]))
      setMore(res.hasNextPage)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { if (open) load(1) }, [open, load])
  return { docs, setDocs, loading, more, loadMore: () => load(page + 1), reload: () => load(1) }
}

export function DropZone({ onFiles, multiple = true, label }: { onFiles: (f: File[]) => void; multiple?: boolean; label?: string }) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))) }}>
      <p>{label || 'Drag photos here, or'}</p>
      <button type="button" className="btn primary" onClick={() => input.current?.click()}>{Icon.upload()} Upload from your computer</button>
      <input ref={input} type="file" accept="image/*" multiple={multiple} hidden
        onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = '' }} />
      <div className="help" style={{ marginTop: 8 }}>JPG, PNG or WebP up to {MAX_UPLOAD_MB} MB. Large photos are resized automatically.</div>
    </div>
  )
}

export function MediaPicker({ onPick, onClose, title = 'Choose a photo' }: { onPick: (doc: MediaDoc) => void; onClose: () => void; title?: string }) {
  const toast = useToast()
  const { docs, setDocs, loading, more, loadMore } = useMediaList(true)
  const [sel, setSel] = useState<MediaDoc | null>(null)
  const [busy, setBusy] = useState(false)
  async function upload(files: File[]) {
    if (!files.length) return
    setBusy(true)
    try {
      const made: MediaDoc[] = []
      for (const f of files) {
        if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { toast(`${f.name} is larger than ${MAX_UPLOAD_MB} MB.`, 'bad'); continue }
        made.push(await uploadMedia(f, ''))
      }
      if (made.length) {
        setDocs((d) => [...made, ...d])
        setSel(made[0])
        toast(made.length === 1 ? 'Photo uploaded.' : `${made.length} photos uploaded.`, 'good')
      }
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!sel} onClick={() => sel && onPick(sel)}>Use this photo</button>
    </>}>
      <DropZone onFiles={upload} label={busy ? 'Uploading...' : 'Drag a photo here, or'} />
      {loading && !docs.length ? <p className="empty">Loading the Media Library...</p> : null}
      {!loading && !docs.length ? <p className="empty">The Media Library is empty. Upload a photo above.</p> : null}
      <div className="media-grid">
        {docs.map((d) => (
          <button key={d.id} type="button" className={`media-tile${sel?.id === d.id ? ' on' : ''}`} onClick={() => setSel(d)} onDoubleClick={() => onPick(d)}>
            <div className="im" style={{ backgroundImage: `url("${mediaSrc(d, 'thumb')}")` }} />
            <div className="cap">{d.alt || d.filename}</div>
          </button>
        ))}
      </div>
      {more ? <p style={{ textAlign: 'center', marginTop: 12 }}><button className="btn" onClick={loadMore}>Show more photos</button></p> : null}
    </Modal>
  )
}

/** One photo on a page: preview, choose from the library, upload, or go back to the original. */
export function ImageSlot({ value, original, onChange, label = 'Photo' }: {
  value: string
  original?: string
  label?: string
  onChange: (v: { value: string; media: number | string | null; alt?: string }) => void
}) {
  const toast = useToast()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const src = value ? value.replace(/&amp;/g, '&') : ''
  async function upload(f?: File) {
    if (!f) return
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { toast(`That photo is larger than ${MAX_UPLOAD_MB} MB.`, 'bad'); return }
    setBusy(true)
    try {
      const d = await uploadMedia(f, '')
      onChange({ value: mediaSrc(d), media: d.id, alt: d.alt })
      toast('Photo uploaded. Save to keep it.', 'good')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="field">
      <span className="lab">{label}</span>
      <div className="slot">
        <div className="thumb">{src ? <img src={src} alt="" /> : 'No photo'}</div>
        <div className="slot-actions">
          <button type="button" className="btn small" onClick={() => setPicking(true)}>{Icon.image()} Choose from library</button>
          <button type="button" className="btn small" disabled={busy} onClick={() => file.current?.click()}>{Icon.upload()} {busy ? 'Uploading...' : 'Upload'}</button>
          {original && original !== value ? (
            <button type="button" className="btn small ghost" onClick={() => onChange({ value: original, media: null })}>Put back the original photo</button>
          ) : null}
          <span className="file">{src ? decodeURIComponent(src.split('/').pop() || '') : ''}</span>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </div>
      {picking ? <MediaPicker onClose={() => setPicking(false)} onPick={(d) => { setPicking(false); onChange({ value: mediaSrc(d), media: d.id, alt: d.alt }) }} /> : null}
    </div>
  )
}
