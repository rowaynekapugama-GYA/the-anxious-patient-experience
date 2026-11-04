import Link from 'next/link'
import { payloadClient, requireUser } from '@/dashboard/lib/server'
import { PostEditor } from '@/dashboard/editors/PostEditor'
import { postOptions } from '../postdata'
import { BRAND } from '@/dashboard/brand'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Write a new post' }

export default async function NewPost() {
  await requireUser()
  const payload = await payloadClient()
  const o = await postOptions(payload)
  return (
    <>
      <div className="pd-crumb"><Link href="/admin/posts">Blog Posts</Link> &rsaquo; New post</div>
      <div className="pd-head"><div className="grow"><h1>Write a new post</h1></div></div>
      <PostEditor isNew categories={o.categories} initial={{
        slug: '', title: '', status: 'draft', publishedAt: '', author: BRAND.defaultAuthor, category: null, excerpt: '',
        image: '', imageMedia: null, body: '',
        seo: { title: '', description: '', ogImage: '', ogImageMedia: null, canonical: '', noindex: false },
      }} />
    </>
  )
}
