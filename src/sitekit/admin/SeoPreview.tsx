'use client'

import { useFormFields } from '@payloadcms/ui'

/** A rough copy of how Google lays out a result, so wording can be judged in place. */
export function SeoPreview() {
  const title = useFormFields(([f]) => (f?.['meta.title']?.value as string) || '')
  const description = useFormFields(([f]) => (f?.['meta.description']?.value as string) || '')
  const path = useFormFields(([f]) => (f?.path?.value as string) || (f?.slug?.value ? `/blog/${f.slug.value}` : '/'))
  const fallbackTitle = useFormFields(([f]) => (f?.title?.value as string) || 'The Anxious Patient Experience')

  return (
    <div className="tnc-serp">
      <span className="tnc-serp__url">the-anxious-patient-experience.vercel.app{path}</span>
      <span className="tnc-serp__title">{title || fallbackTitle}</span>
      <span className="tnc-serp__desc">
        {description || 'Add a description so Google shows the wording you want here.'}
      </span>
    </div>
  )
}

export default SeoPreview
