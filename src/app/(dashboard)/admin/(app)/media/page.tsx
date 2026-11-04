import { requireUser } from '@/dashboard/lib/server'
import { MediaLibrary } from '@/dashboard/editors/MediaLibrary'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Media Library' }

export default async function Media() {
  await requireUser()
  return (
    <>
      <div className="pd-head"><div className="grow"><h1>Media Library</h1><p className="pd-sub">Photos to use on pages and posts. Uploads are resized to 2400 pixels and saved as WebP automatically.</p></div></div>
      <MediaLibrary />
    </>
  )
}
