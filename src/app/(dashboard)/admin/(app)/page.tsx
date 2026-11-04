import Link from 'next/link'
import { payloadClient, requireUser, siteStatus } from '@/dashboard/lib/server'
import { PublishButton } from '@/dashboard/ui/PublishButton'
import { Icon } from '@/dashboard/ui/icons'
import { when } from '@/dashboard/lib/format'
import { ImportButtons } from '@/dashboard/editors/ImportButtons'
import { BRAND } from '@/dashboard/brand'
import { db } from '@/booking/core'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard' }

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-AU', { timeZone: BRAND.timeZone, hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default async function Home() {
  const u = await requireUser()
  const payload = await payloadClient()
  const status = await siteStatus(payload)
  const home = await payload.find({ collection: 'pages', where: { pageSlug: { equals: 'home' } }, limit: 1, depth: 0, overrideAccess: true, select: { pageSlug: true } })
  const d = db()
  const bookings = d ? await d.query(`SELECT ref, name, slot_start, status, special FROM ape_bookings WHERE status <> 'cancelled' AND slot_start >= now() ORDER BY (status = 'requested') DESC, slot_start LIMIT 5`).catch(() => []) : []
  const toConfirm = d ? Number((await d.query(`SELECT count(*)::int AS n FROM ape_bookings WHERE status = 'requested' AND slot_start >= now()`).catch(() => [{ n: 0 }]))[0]?.n) || 0 : 0
  const pages = await payload.find({ collection: 'pages', where: { isChrome: { not_equals: true } }, limit: 5, sort: '-updatedAt', depth: 0, overrideAccess: true, select: { title: true, updatedAt: true } })
  const posts = await payload.find({ collection: 'posts', limit: 5, sort: '-updatedAt', depth: 0, overrideAccess: true, select: { title: true, updatedAt: true, _status: true } })
  const counts = {
    pages: (await payload.count({ collection: 'pages', where: { isChrome: { not_equals: true } }, overrideAccess: true })).totalDocs,
    posts: (await payload.count({ collection: 'posts', where: { _status: { equals: 'published' } }, overrideAccess: true })).totalDocs,
    drafts: (await payload.count({ collection: 'posts', where: { _status: { equals: 'draft' } }, overrideAccess: true })).totalDocs,
  }
  const empty = counts.pages === 0
  const homeId = home.docs[0]?.id
  const recent = [
    ...pages.docs.map((p) => ({ href: `/admin/pages/${p.id}`, label: String(p.title), at: String(p.updatedAt), kind: 'Page' })),
    ...posts.docs.map((p) => ({ href: `/admin/posts/${p.id}`, label: String(p.title), at: String(p.updatedAt), kind: p._status === 'published' ? 'Post' : 'Draft post' })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6)

  return (
    <>
      <div className="panel welcome">
        <h1>{greeting()}, {u.name || u.email.split('@')[0]}</h1>
        <p style={{ marginTop: 6 }}>This is where you keep {BRAND.name} website up to date and look after online bookings. Change wording and photos, write blog posts and update details, then press Publish website. Bookings and availability change on the website straight away.</p>
        <div className="actions" style={{ marginTop: 12 }}>
          <PublishButton />
          <a className="btn" href="/" target="_blank" rel="noopener">{Icon.external()} View the website</a>
        </div>
      </div>

      {empty ? (
        <div className="notice warn">{Icon.warn()}<div className="grow">
          <p><b>The dashboard has no content yet.</b> {u.role === 'admin' ? 'Load the website into it with Import below.' : 'Please ask GYA to finish setting it up.'}</p>
        </div></div>
      ) : status.waiting ? (
        <div className="notice warn">{Icon.warn()}<div className="grow">
          <p><b>You have changes waiting to publish.</b> They are saved in the dashboard but are not on the website yet.</p>
          <p className="help" style={{ margin: 0 }}>Last change {status.lastChangedAt ? new Date(status.lastChangedAt).toLocaleString('en-AU', { timeZone: BRAND.timeZone }) : ''}.</p>
        </div><PublishButton /></div>
      ) : (
        <div className="notice good">{Icon.check()}<div className="grow">
          <p><b>The website is up to date.</b> {status.lastPublishedAt ? `Last published ${new Date(status.lastPublishedAt).toLocaleString('en-AU', { timeZone: BRAND.timeZone })}${status.lastPublishedBy ? ` by ${status.lastPublishedBy}` : ''}.` : ''}</p>
        </div></div>
      )}
      {!status.hookConfigured ? (
        <div className="notice info">{Icon.info()}<div className="grow"><p>Publishing is not switched on yet: the publish hook has not been added. GYA will set this up.</p></div></div>
      ) : null}

      <div className="stat-row" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{counts.pages}</b><span>Pages</span></div>
        <div className="stat"><b>{counts.posts}</b><span>Published posts</span></div>
        <div className="stat"><b>{counts.drafts}</b><span>Draft posts</span></div>
        <div className="stat"><b>{toConfirm}</b><span>Bookings to confirm</span></div>
      </div>

      <div className="panel">
        <h2>Quick actions</h2>
        <div className="quick">
          <Link href={homeId ? `/admin/pages/${homeId}` : '/admin/pages'}>{Icon.pages()}<span>Edit the homepage<small>Wording, photos and sections</small></span></Link>
          <Link href="/admin/posts/new">{Icon.posts()}<span>Write a blog post<small>Appears on the Blog</small></span></Link>
          <Link href="/admin/media">{Icon.media()}<span>Upload photos<small>Add to the Media Library</small></span></Link>
          <Link href="/admin/availability">{Icon.availability()}<span>Block time off<small>Leave or a closed day</small></span></Link>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Upcoming bookings</h2><Link className="btn small" href="/admin/bookings">See all</Link></div>
          {!bookings.length ? <p className="empty">No bookings yet. Requests from the Book Now page appear here.</p> : (
            <ul className="list-plain">
              {bookings.map((b) => (
                <li key={String(b.ref)}><span className="grow"><b>{String(b.name)}</b>{b.special ? <span className="chip blue" style={{ marginLeft: 6 }}>Opening special</span> : null}<br />
                  <span className="help">{when(new Date(b.slot_start).toISOString())} &middot; {String(b.ref)}</span></span>
                  {b.status === 'confirmed' ? <span className="chip good">Confirmed</span> : <span className="chip warn">To confirm</span>}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>Recently edited</h2>
          {!recent.length ? <p className="empty">Nothing yet.</p> : (
            <ul className="list-plain">
              {recent.map((r) => (
                <li key={r.href}><span className="grow"><Link href={r.href}>{r.label}</Link><br /><span className="help">{r.kind} &middot; {new Date(r.at).toLocaleString('en-AU', { timeZone: BRAND.timeZone })}</span></span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {u.role === 'admin' ? <ImportPanel empty={empty} /> : null}
    </>
  )
}

function ImportPanel({ empty }: { empty: boolean }) {
  return (
    <div className="panel">
      <h2>Import (GYA only)</h2>
      <p className="help">Loads the website from the repository into the dashboard: the pages, footer, redirects, contact details and SEO defaults, then the website's photographs into the Media Library. Safe to run again: anything already in the dashboard is kept. Reset puts every page back to how the repository has it.</p>
      <ImportButtons empty={empty} />
    </div>
  )
}
