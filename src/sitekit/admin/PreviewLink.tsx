'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

export function PreviewLink() {
  const { collectionSlug } = useDocumentInfo()
  const path = useFormFields(([fields]) => fields?.path?.value as string | undefined)
  const slug = useFormFields(([fields]) => fields?.slug?.value as string | undefined)
  const href = collectionSlug === 'posts' ? (slug ? `/blog/${slug}` : null) : path || null
  if (!href) return null
  return (
    <a className="tnc-preview" href={href} target="_blank" rel="noopener noreferrer">
      Preview page
    </a>
  )
}

export default PreviewLink
