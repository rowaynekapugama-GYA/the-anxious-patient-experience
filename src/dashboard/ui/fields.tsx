'use client'
/** Plain form controls with a label and a line of help under each. */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Field({ label, help, children, htmlFor }: { label: string; help?: React.ReactNode; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {help ? <div className="help">{help}</div> : null}
    </div>
  )
}

let uid = 0
export function useId(prefix = 'f') {
  const r = useRef<string>('')
  if (!r.current) r.current = `${prefix}${++uid}`
  return r.current
}

export function TextInput({ label, help, value, onChange, placeholder, type = 'text', maxLength, id: idIn, autoComplete }: {
  label: string; help?: React.ReactNode; value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; maxLength?: number; id?: string; autoComplete?: string
}) {
  const auto = useId()
  const id = idIn || auto
  return (
    <Field label={label} help={help} htmlFor={id}>
      <input id={id} className="input" type={type} value={value ?? ''} placeholder={placeholder} maxLength={maxLength}
        autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

export function AutoTextarea({ value, onChange, id, rows = 2, placeholder }: { value: string; onChange: (v: string) => void; id?: string; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight + 2, 640) + 'px'
  }, [value])
  return <textarea ref={ref} id={id} className="textarea" rows={rows} value={value ?? ''} placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)} />
}

export function TextArea({ label, help, value, onChange, rows = 3, placeholder }: {
  label: string; help?: React.ReactNode; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  const id = useId()
  return (
    <Field label={label} help={help} htmlFor={id}>
      <AutoTextarea id={id} rows={rows} value={value} onChange={onChange} placeholder={placeholder} />
    </Field>
  )
}

export function Toggle({ label, checked, onChange, help }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; help?: React.ReactNode }) {
  return (
    <div className="field">
      <label className="toggle">
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" aria-hidden="true" />
        <span>{label}</span>
      </label>
      {help ? <div className="help">{help}</div> : null}
    </div>
  )
}

export function Select({ label, value, onChange, options, help }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; help?: React.ReactNode
}) {
  const id = useId()
  return (
    <Field label={label} help={help} htmlFor={id}>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  )
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'good' | 'bad'; children: React.ReactNode; icon?: React.ReactNode }) {
  return <div className={`notice ${tone}`} role={tone === 'bad' ? 'alert' : undefined}>{icon}<div className="grow">{children}</div></div>
}

export function Modal({ title, onClose, children, footer, narrow }: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; narrow?: boolean
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null
  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal${narrow ? ' narrow' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="m-head"><h2>{title}</h2><button className="btn ghost small" onClick={onClose} aria-label="Close">Close</button></div>
        <div className="m-body">{children}</div>
        {footer ? <div className="m-foot">{footer}</div> : null}
      </div>
    </div>,
    host,
  )
}

/**
 * Warn before leaving a screen with unsaved changes: closing the tab, and
 * following any link in the dashboard (the menu moves between screens without
 * reloading, so the browser's own warning would not fire).
 */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || e.defaultPrevented) return
      if (!window.confirm('You have unsaved changes. Leave without saving?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', h)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('beforeunload', h)
      document.removeEventListener('click', click, true)
    }
  }, [dirty])
}
