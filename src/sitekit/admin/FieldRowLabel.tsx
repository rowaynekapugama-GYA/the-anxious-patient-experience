'use client'

import { useRowLabel } from '@payloadcms/ui'

type Row = { label?: string; kind?: string; text?: string; link?: string; builtIn?: string }

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c',
  hellip: '\u2026', rarr: '\u2192', larr: '\u2190', ndash: '-', mdash: '-',
}

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X')) {
      return String.fromCodePoint(parseInt(name.slice(2), 16))
    }
    if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)))
    return ENTITIES[name] ?? whole
  })
}

function preview(row?: Row) {
  if (!row) return ''
  const raw = row.kind === 'href' ? row.link : row.kind === 'image' ? row.builtIn : row.text
  if (!raw) return ''
  const clean = decode(raw.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  return clean.length > 54 ? `${clean.slice(0, 54)}...` : clean
}

export function FieldRowLabel() {
  const { data } = useRowLabel<Row>()
  const text = preview(data)
  return (
    <span>
      <strong>{data?.label || 'Item'}</strong>
      {text ? <span style={{ opacity: 0.7 }}>{` - ${text}`}</span> : null}
    </span>
  )
}

export default FieldRowLabel
