import { notFound } from 'next/navigation'
import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { PageEditor } from '@/dashboard/editors/PageEditor'
import { sectionsForEditor, sharedPartsForEditor } from '@/dashboard/pages'
import { mediaUrl, type PageDoc } from '@/sitekit/sync'
import { BRAND } from '@/dashboard/brand'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await payloadClient()
  const d = await payload.findByID({ collection: 'pages', id, depth: 0, overrideAccess: true, select: { title: true } }).catch(() => null)
  return { title: d ? `Edit ${d.title}` : 'Page' }
}

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> }) {
  const u = await requireUser()
  const { id } = await params
  const { section } = await searchParams
  const payload = await payloadClient()
  const doc = await payload.findByID({ collection: 'pages', id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!doc || (doc as { isChrome?: boolean }).isChrome) notFound()
  const d = doc as unknown as PageDoc & { id: number | string; updatedAt?: string }
  const meta = (d.meta ?? {}) as Record<string, unknown>
  const ogMedia = meta.ogImage && typeof meta.ogImage === 'object' ? (meta.ogImage as { id: number }).id : (meta.ogImage as number | null) ?? null
  const seoGlobal = await payload.findGlobal({ slug: 'seo', depth: 1, overrideAccess: true }).catch(() => null) as Record<string, unknown> | null
  const defaultOg = String(mediaUrl(seoGlobal?.defaultOgImage as never) || (meta.ogImagePath as string) || BRAND.defaultOg)
  return (
    <PageEditor
      id={d.id}
      label={String(d.title)}
      url={d.pageSlug === 'not-found' ? null : d.path}
      sections={sectionsForEditor(d)}
      shared={await sharedPartsForEditor(payload)}
      isAdmin={u.role === 'admin'}
      seo={{
        title: String(meta.title ?? ''),
        description: String(meta.description ?? ''),
        ogImage: mediaUrl(meta.ogImage as never) ?? '',
        ogImageMedia: ogMedia,
        canonical: String(meta.canonical ?? ''),
        noindex: !!meta.noindex,
      }}
      defaultOg={defaultOg}
      defaultTitle={String(seoGlobal?.defaultTitle || `${String(d.title)} | ${BRAND.name}`)}
      lastmod={d.updatedAt ? String(d.updatedAt) : null}
      focusSection={section ?? null}
    />
  )
}
