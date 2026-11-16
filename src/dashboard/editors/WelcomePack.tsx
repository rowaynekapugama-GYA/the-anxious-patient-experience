'use client'
/**
 * Site Settings > Welcome pack (v1.9.0): Lorna's two PDFs, the welcome email, the questionnaire's collection notice,
 * who is told when a questionnaire arrives, and (GYA only) the two switches. Data from /api/dashboard/welcome-pack.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Modal, Notice, Select, TextArea, TextInput, Toggle, useUnsavedWarning } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { Icon } from '../ui/icons'
import { api, uploadMedia, MAX_UPLOAD_MB } from '../lib/client'

const API = '/api/dashboard/welcome-pack'
type FileInfo = { key: 'guide' | 'questionnaire'; url: string; filename: string; source: 'original' | 'media'; mediaId: string | number | null; original: string; label: string; attachName: string }
type Sw = { welcome: boolean; sendWhen: string; online: boolean; onlineWanted: boolean; keyReady: boolean; noticeApproved: boolean; noticeApprovedBy: string; noticeApprovedAt: string | null; emergencyOff: boolean; emailReady: boolean; blockers: string[] }
type Words = { notice: string; consent: string; subject: string; body: string }
type Data = {
  ok: boolean; admin: boolean; switches: Sw; files: Record<'guide' | 'questionnaire', FileInfo>; words: Words; defaults: Words
  sendWhen: 'confirmed' | 'requested'; notifyEmails: string[]; preview: { subject: string; text: string; attachments: string[] }
  readers: { email: string; name: string; role: string }[] | null
}
const ERR: Record<string, string> = {
  admin_only: 'Only a GYA administrator can change the switches.',
  not_pdf: 'Please choose a PDF.',
  bad_email: 'One of the notification addresses does not look right.',
  needs_questionnaire_token: 'Please keep {questionnaire} in the email wording: it becomes the questionnaire paragraph.',
  not_ready: 'The online questionnaire cannot go on yet',
}
const day = (s: string | null) => (s ? new Date(s).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

async function post(body: unknown): Promise<Data> {
  const r = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) { window.location.href = '/admin/login'; throw new Error('Please sign in again.') }
  if (!r.ok || !j.ok) throw new Error(`${ERR[j.error] || 'Something went wrong. Please try again.'}${j.reason ? `: ${j.reason}.` : ''}`)
  return j
}

export function WelcomePack() {
  const toast = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [words, setWords] = useState<Words>({ notice: '', consent: '', subject: '', body: '' })
  const [sendWhen, setSendWhen] = useState<'confirmed' | 'requested'>('confirmed')
  const [notify, setNotify] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState<FileInfo | null>(null)
  useUnsavedWarning(dirty)

  const take = useCallback((j: Data) => { setData(j); setWords(j.words); setSendWhen(j.sendWhen); setNotify(j.notifyEmails); setDirty(false) }, [])
  useEffect(() => {
    fetch(API, { credentials: 'include' }).then((r) => r.json()).then((j) => { if (!j.ok) throw new Error('Could not load.'); take(j) }).catch((e) => setError((e as Error).message))
  }, [take])
  if (error) return <Notice tone="warn" icon={Icon.warn()}><p>{error}</p></Notice>
  if (!data) return <div className="panel"><p className="empty">Loading...</p></div>
  const sw = data.switches

  const edit = (k: keyof Words, v: string) => { setWords({ ...words, [k]: v }); setDirty(true) }
  async function save() {
    setBusy(true)
    try { take(await post({ words, sendWhen, notifyEmails: notify })); toast('Saved. It applies to the next welcome email straight away.', 'good') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function flip(key: 'welcomeEmailOn' | 'onlineOn' | 'noticeApproved', v: boolean, done: string) {
    if (dirty) { toast('Please save your other changes first.', 'bad'); return }
    setBusy(true)
    try { take(await post({ switches: { [key]: v } })); toast(done, 'good') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function setFile(f: FileInfo, id: string | number | null) {
    setBusy(true)
    try { take(await post({ files: { [f.key]: id } })); toast(id === null ? `Back to Lorna's original ${f.label}.` : `${f.label} replaced. The next welcome email attaches the new file.`, 'good') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false); setPicking(null) }
  }

  return (
    <>
      <div className="panel" id="status">
        <h2>Status</h2>
        <div className="stat-row">
          <div className="stat"><b className={sw.welcome ? 'ok-text' : ''}>{sw.welcome ? 'On' : 'Off'}</b><span>Welcome email</span></div>
          <div className="stat"><b className={sw.online ? 'ok-text' : ''}>{sw.online ? 'Live' : 'Off'}</b><span>Online questionnaire</span></div>
        </div>
        <p className="help" style={{ margin: '12px 0 0' }}>
          {sw.welcome ? <>When a booking is {sendWhen === 'requested' ? 'received' : 'marked confirmed'}, the patient is emailed both PDFs{sw.online ? ' and a private link to the online questionnaire' : ''}. </> : <>No welcome emails are sent. Lorna&apos;s wording is waiting for approval; GYA switches it on. </>}
          Bookings made before it was switched on are not emailed automatically: use <b>Send welcome pack</b> on the Bookings screen.
        </p>
      </div>

      <div className="panel" id="files">
        <h2>Lorna&apos;s PDFs</h2>
        <p className="help">Both are attached to every welcome email. To update one, upload the new PDF here; the original stays available.</p>
        {[data.files.guide, data.files.questionnaire].map((f) => (
          <div key={f.key} className="pack-file">
            <div className="grow">
              <b>{f.label}</b>
              <div className="help">{f.source === 'original' ? <>Lorna&apos;s original ({f.filename})</> : <>From the Media Library: {f.filename}</>}. Attached as {f.attachName}.</div>
            </div>
            <div className="actions">
              <a className="btn small" href={f.url} target="_blank" rel="noopener">{Icon.external()} View</a>
              <button className="btn small" disabled={busy} onClick={() => setPicking(f)}>Choose another PDF</button>
              {f.source === 'media' ? <button className="btn small ghost" disabled={busy} onClick={() => setFile(f, null)}>Use the original</button> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="panel" id="email">
        <h2>Welcome email</h2>
        <Select label="Send it when" value={sendWhen} onChange={(v) => { setSendWhen(v === 'requested' ? 'requested' : 'confirmed'); setDirty(true) }}
          options={[{ value: 'confirmed', label: 'a booking is marked confirmed (recommended)' }, { value: 'requested', label: 'a booking request is received' }]} />
        <TextInput label="Subject" value={words.subject} onChange={(v) => edit('subject', v)} placeholder={data.defaults.subject} />
        <TextArea label="Wording" value={words.body} onChange={(v) => edit('body', v)} rows={16} placeholder={data.defaults.body}
          help={<>Leave empty to use the draft shown. {'{first}'} is the first name, {'{when}'} the appointment, {'{questionnaire}'} the questionnaire paragraph (the online link when it is live, otherwise &quot;bring it with you&quot;), {'{where}'} the address and Lorna&apos;s train and parking directions, {'{phone}'} the phone number. A line starting with &quot;- &quot; becomes a bullet point. Never put health details in this email.</>} />
        <details className="pack-preview">
          <summary>Preview with sample details</summary>
          <p><b>Subject:</b> {data.preview.subject}<br /><b>Attached:</b> {data.preview.attachments.join(', ')}</p>
          <pre>{data.preview.text}</pre>
          <p className="help">The preview shows what is saved. Press Save to see your changes here.</p>
        </details>
      </div>

      <div className="panel" id="notice">
        <h2>Online questionnaire: collection notice</h2>
        <p className="help">Shown above the Send button with a tick box. Lorna&apos;s questions are used exactly as in her PDF.{sw.noticeApproved ? <> Approved by {sw.noticeApprovedBy} on {day(sw.noticeApprovedAt)}. Changing the wording clears the approval and stops the online questionnaire until it is approved again.</> : null}</p>
        <TextArea label="Collection notice" value={words.notice} onChange={(v) => edit('notice', v)} rows={6} placeholder={data.defaults.notice} help="Leave empty to use the draft shown." />
        <TextInput label="Tick box wording" value={words.consent} onChange={(v) => edit('consent', v)} placeholder={data.defaults.consent} />
      </div>

      <div className="panel" id="notify">
        <h2>Questionnaire received emails</h2>
        <p className="help">Who is told when a patient sends their questionnaire: the booking reference and appointment date only, never answers. Empty uses the booking email list.</p>
        {notify.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="input" aria-label={`Notification address ${i + 1}`} value={r} onChange={(e) => { setNotify(notify.map((x, n) => (n === i ? e.target.value : x))); setDirty(true) }} />
            <button className="btn small danger" onClick={() => { setNotify(notify.filter((_x, n) => n !== i)); setDirty(true) }}>{Icon.trash()} Remove</button>
          </div>
        ))}
        <button className="btn small" onClick={() => { setNotify([...notify, '']); setDirty(true) }}>{Icon.plus()} Add an address</button>
      </div>

      <div className="panel"><div className="actions"><button className="btn primary" disabled={busy || !dirty} onClick={save}>Save</button>{dirty ? <span className="help">Unsaved changes</span> : null}</div></div>

      {data.admin ? (
        <div className="panel" id="switches">
          <h2>Switches (GYA only)</h2>
          <Toggle label="Send the welcome email automatically" checked={sw.welcome} onChange={(v) => flip('welcomeEmailOn', v, v ? 'The welcome email is on.' : 'The welcome email is off.')}
            help={sw.emailReady ? 'On once Lorna has approved the email wording. Bookings made before then are not emailed.' : 'Email is not set up (SMTP2GO_API_KEY and BOOKING_FROM), so nothing can be sent.'} />
          <Toggle label="Lorna has approved the collection notice and the privacy policy wording" checked={sw.noticeApproved} onChange={(v) => flip('noticeApproved', v, v ? 'Marked approved.' : 'Approval removed.')}
            help="Tick only once Lorna has approved both in writing. It records your email and the time." />
          <Toggle label="Online questionnaire" checked={sw.onlineWanted} onChange={(v) => flip('onlineOn', v, v ? 'The online questionnaire is live.' : 'The online questionnaire is off. Welcome emails go back to the PDF only.')}
            help="Adds the private link to welcome emails. Links already sent stop working while it is off." />
          <ul className="checklist">
            <li className={sw.keyReady ? 'ok' : 'no'}>{sw.keyReady ? Icon.check() : Icon.warn()} Encryption key {sw.keyReady ? 'is set' : <>is not set: add <code>QUESTIONNAIRE_ENCRYPTION_KEY</code> in Vercel (Production and Preview, Sensitive), then redeploy. Without it answers cannot be stored safely.</>}</li>
            <li className={sw.noticeApproved ? 'ok' : 'no'}>{sw.noticeApproved ? Icon.check() : Icon.warn()} Collection notice {sw.noticeApproved ? 'approved' : 'not yet approved'}</li>
            <li className={!sw.emergencyOff ? 'ok' : 'no'}>{!sw.emergencyOff ? Icon.check() : Icon.warn()} {sw.emergencyOff ? <>The emergency off switch is set (<code>QUESTIONNAIRE_ENABLED=false</code> in Vercel)</> : 'Emergency off switch not set'}</li>
            <li className={sw.emailReady ? 'ok' : 'no'}>{sw.emailReady ? Icon.check() : Icon.warn()} Email {sw.emailReady ? 'is set up' : 'is not set up'}</li>
          </ul>
          {sw.onlineWanted && !sw.online ? <Notice tone="warn" icon={Icon.warn()}><p>Switched on but not live, because {sw.blockers.join('; ')}.</p></Notice> : null}
          <h3 style={{ marginTop: 20 }}>Who can read answers</h3>
          {data.readers?.length ? <ul>{data.readers.map((r) => <li key={r.email}>{r.name ? `${r.name}, ` : ''}{r.email}</li>)}</ul> : <p className="help">Nobody yet. Once Lorna names who should read questionnaires, tick &quot;Can view patient questionnaires&quot; for each of them on the <a href="/admin/users">Users</a> screen.</p>}
          <p className="help">Test the welcome email and a test questionnaire from <a href="/admin/settings/email">Email check</a>.</p>
        </div>
      ) : null}

      {picking ? <PdfPicker title={`Choose the ${picking.label} PDF`} onClose={() => setPicking(null)} onPick={(id) => setFile(picking, id)} /> : null}
    </>
  )
}

type MediaDoc = { id: string | number; filename?: string; url?: string; createdAt?: string; filesize?: number }

function PdfPicker({ title, onClose, onPick }: { title: string; onClose: () => void; onPick: (id: string | number) => void }) {
  const toast = useToast()
  const [docs, setDocs] = useState<MediaDoc[] | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api<{ docs: MediaDoc[] }>('/api/media?limit=100&sort=-createdAt&depth=0&where[mimeType][equals]=application/pdf').then((r) => setDocs(r.docs)).catch(() => setDocs([])) }, [])
  async function upload(f: File | undefined) {
    if (!f) return
    if (f.type !== 'application/pdf') { toast('Please choose a PDF.', 'bad'); return }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { toast(`That file is larger than ${MAX_UPLOAD_MB} MB.`, 'bad'); return }
    setBusy(true)
    try { const doc = await uploadMedia(f, f.name.replace(/\.pdf$/i, '')); onPick(doc.id) } catch (e) { toast((e as Error).message, 'bad'); setBusy(false) }
  }
  return (
    <Modal title={title} onClose={onClose} narrow>
      <label className="btn primary" style={{ marginBottom: 14 }}>{Icon.upload()} Upload a PDF from your computer<input type="file" accept="application/pdf" hidden disabled={busy} onChange={(e) => upload(e.target.files?.[0])} /></label>
      {!docs ? <p className="empty">Loading...</p> : !docs.length ? <p className="help">No PDFs in the Media Library yet.</p> : (
        <ul className="pdf-list">
          {docs.map((d) => (
            <li key={String(d.id)}>
              <span className="grow">{d.filename}<span className="help"> {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-AU') : ''}</span></span>
              <a className="btn small ghost" href={d.url} target="_blank" rel="noopener">View</a>
              <button className="btn small" disabled={busy} onClick={() => onPick(d.id)}>Use this</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
