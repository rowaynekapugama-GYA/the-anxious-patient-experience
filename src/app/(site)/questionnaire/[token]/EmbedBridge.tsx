'use client'
/**
 * v1.9.3: when the questionnaire is shown inside the Book Now page (?embed=1), tell that page how tall it is so the
 * frame grows with the form, and when the answers have been sent. Same website only; nothing else is sent.
 */
import { useEffect } from 'react'

export function EmbedBridge() {
  useEffect(() => {
    if (window.parent === window) return
    const post = (data: Record<string, unknown>) => window.parent.postMessage({ source: 'ape-questionnaire', ...data }, window.location.origin)
    // the content's own height (the page's scrollHeight never shrinks below the frame, so it could only grow)
    const main = (document.getElementById('main') || document.body) as HTMLElement
    const size = () => post({ type: 'height', height: Math.ceil(main.getBoundingClientRect().bottom + window.scrollY + 8) })
    const ro = new ResizeObserver(size)
    ro.observe(main)
    size()
    // after sending: where the thank-you sits, so the booking page can bring it into view
    const done = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      const t = document.querySelector('.qn-thanks') as HTMLElement | null
      post({ type: 'done', offset: t ? Math.round(t.getBoundingClientRect().top + window.scrollY) : 0 })
    }))
    const saved = () => post({ type: 'saved' })
    window.addEventListener('ape-q-done', done)
    window.addEventListener('ape-q-saved', saved)
    return () => { ro.disconnect(); window.removeEventListener('ape-q-done', done); window.removeEventListener('ape-q-saved', saved) }
  }, [])
  return null
}
