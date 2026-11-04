import Link from 'next/link'
import { notFound } from 'next/navigation'
import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { PostEditor } from '@/dashboard/editors/PostEditor'
import { postFromDoc, postOptions } from '../postdata'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit post' }

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const payload = await payloadClient()
  const d = await payload.findByID({ collection: 'posts', id, depth: 1, overrideAccess: true, draft: true }).catch(() => null)
  if (!d) notFound()
  const o = await postOptions(payload)
  return (
    <>
      <div className="pd-crumb"><Link href="/admin/posts">Blog Posts</Link> &rsaquo; {String(d.title)}</div>
      <div className="pd-head"><div className="grow"><h1>Edit post</h1></div></div>
      <PostEditor isNew={false} categories={o.categories} initial={postFromDoc(d as unknown as Record<string, unknown>)} />
    </>
  )
}
