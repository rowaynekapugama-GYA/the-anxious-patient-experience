'use client'
/** A one-paragraph editor with bold, italic and links, for text that has formatting in it. */
import React, { useEffect, useRef } from 'react'
import { cleanInlineHtml, richForEditing } from '../lib/text'

export function RichInline({ value, onChange, id }: { value: string; onChange: (html: string) => void; id?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef<string>('')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (last.current !== value) {
      el.innerHTML = richForEditing(value)
      last.current = value
    }
  }, [value])
  const emit = () => {
    const el = ref.current
    if (!el) return
    const html = cleanInlineHtml(el)
    last.current = html
    onChange(html)
  }
  const cmd = (c: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(c, false, arg)
    emit()
  }
  return (
    <div className="rich-wrap">
      <div className="bar" role="toolbar" aria-label="Formatting">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('bold')} title="Bold"><b>B</b></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('italic')} title="Italic"><i>I</i></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => {
          const url = window.prompt('Link address (for example /contact/ or https://...)')
          if (url) cmd('createLink', url.trim())
        }} title="Add a link">Link</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('unlink')} title="Remove the link">Unlink</button>
      </div>
      <div ref={ref} id={id} className="rich" contentEditable suppressContentEditableWarning onInput={emit}
        onPaste={(e) => {
          e.preventDefault()
          const t = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, t)
        }} />
    </div>
  )
}
