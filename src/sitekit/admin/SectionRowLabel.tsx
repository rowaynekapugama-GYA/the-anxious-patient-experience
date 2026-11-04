'use client'

import { useRowLabel } from '@payloadcms/ui'

type Row = { label?: string; kind?: string; hidden?: boolean }

const KIND: Record<string, string> = {
  hero: 'Hero banner',
  content: 'Content section',
  cta: 'Call to action',
  faq: 'Questions and answers',
  related: 'Related pages',
  map: 'Map and address',
  disclaimer: 'Disclaimer',
  crumbs: 'Breadcrumbs',
  offers: 'Offer strip',
}

export function SectionRowLabel() {
  const { data, rowNumber } = useRowLabel<Row>()
  const raw = data?.label || KIND[data?.kind ?? ''] || 'Section'
  const name = raw.replace(/&amp;/g, '&').replace(/&rsquo;/g, '\u2019').replace(/&#39;/g, "'")
  return (
    <span>
      {String((rowNumber ?? 0) + 1).padStart(2, '0')}. {name}
      {data?.hidden ? ' (hidden)' : ''}
    </span>
  )
}

export default SectionRowLabel
