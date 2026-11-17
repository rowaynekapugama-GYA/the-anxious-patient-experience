/** The booking terms as headings, paragraphs and lists (v1.10.0). Used by the pay-later page, /book-now/terms/ and the dashboard preview. */
import React from 'react'
import { blocks } from './terms'

export function TermsView({ text, className = 'terms-text' }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {blocks(text).map((b, i) => b.type === 'h' ? <h3 key={i}>{b.text}</h3>
        : b.type === 'ul' ? <ul key={i}>{b.items.map((x, n) => <li key={n}>{x}</li>)}</ul>
          : <p key={i}>{b.text}</p>)}
    </div>
  )
}
