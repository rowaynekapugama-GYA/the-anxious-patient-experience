import Link from 'next/link'
import { payloadClient, requireUser, siteStatus } from '@/dashboard/lib/server'
import { PublishButton } from '@/dashboard/ui/PublishButton'
import { Icon } from '@/dashboard/ui/icons'
import { when } from '@/dashboard/lib/format'
import { ImportButtons } from '@/dashboard/editors/ImportButtons'
import { BRAND } from '@/dashboard/brand'
import { db } from '@/booking/core'
import { countUnreviewed } from '@/lib/questionnaire'
import { failedCount, gyaToldSince } from '@/lib/mailer'
import { sourceLabel } from '@/booking/source'

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
  const unpaid = d ? Number((await d.query(`SELECT count(*)::int AS n FROM ape_bookings WHERE status <> 'cancelled' AND NOT deposit_paid AND slot_start >= now()`).catch(() => [{ n: 0 }]))[0]?.n) || 0 : 0
  // v1.11.0: where bookings came from in the last 30 days (cancelled ones too: they still found the website)
  const srcRows = d ? await d.query<{ source: string; n: number }>(`SELECT source, count(*)::int AS n FROM ape_bookings WHERE created_at >= now() - interval '30 days' GROUP BY source`).catch(() => []) : []
  const sources = Object.entries(srcRows.reduce((acc: Record<string, number>, r) => { const k = sourceLabel(r.source); acc[k] = (acc[k] || 0) + Number(r.n); return acc }, {}))
    .sort((a, b) => (a[0] === 'Not recorded' ? 1 : 0) - (b[0] === 'Not recorded' ? 1 : 0) || b[1] - a[1]) // most first, older bookings last
  const pages = await payload.find({ collection: 'pages', where: { isChrome: { not_equals: true } }, limit: 5, sort: '-updatedAt', depth: 0, overrideAccess: true, select: { title: true, updatedAt: true } })
  const posts = await payload.find({ collection: 'posts', limit: 5, sort: '-updatedAt', depth: 0, overrideAccess: true, select: { title: true, updatedAt: true, _status: true } })
  const counts = {
    pages: (await payload.count({ collection: 'pages', where: { isChrome: { not_equals: true } }, overrideAccess: true })).totalDocs,
    posts: (await payload.count({ collection: 'posts', where: { _status: { equals: 'published' } }, overrideAccess: true })).totalDocs,
    drafts: (await payload.count({ collection: 'posts', where: { _status: { equals: 'draft' } }, overrideAccess: true })).totalDocs,
  }
  const canView = !!(u as { canViewQuestionnaires?: boolean }).canViewQuestionnaires
  const toReview = canView ? await countUnreviewed(payload) : null
  // v1.8.3: one line on whether email is working (GYA sees the detail on Site Settings > Email)
  const failed7 = await failedCount(7)
  const gyaTold = failed7 ? await gyaToldSince(7) : false
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

      <p className={`email-status-line${failed7 ? ' bad' : ''}`}><span className="dot" aria-hidden="true" />
        {!failed7 ? <span><b>Emails:</b> working</span>
          : <span><b>Emails:</b> {failed7} failed in the last 7 days, {gyaTold ? 'GYA has been notified' : 'please let GYA know on 1300 889 840'}.{u.role === 'admin' ? <> <Link href="/admin/settings/email">Open the email check</Link></> : null}</span>}
      </p>
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
        <div className="stat"><b>{unpaid}</b><span>Deposits not paid</span></div>
        {toReview !== null ? <div className="stat"><b>{toReview}</b><span>Questionnaires to review</span></div> : null}
      </div>

      <div className="panel" id="sources">
        <div className="panel-head"><h2>Where bookings came from (last 30 days)</h2><Link className="btn small" href="/admin/bookings">See bookings</Link></div>
        {!sources.length ? <p className="empty">No bookings in the last 30 days yet. Each new booking shows where the patient came from: Instagram, the Caringbah or Cronulla website, Google, an email or typing the address in (Direct).</p> : (
          <ul className="source-list">
            {sources.map(([label, n]) => <li key={label}><span className="grow">{label}</span><b>{n}</b></li>)}
          </ul>
        )}
        <p className="help" style={{ margin: '8px 0 0' }}>From the link the patient first arrived by. Bookings made before 18 November 2026 say Not recorded.</p>
      </div>

      <div className="panel">
        <h2>Quick actions</h2>
        <div className="quick">
          <Link href={homeId ? `/admin/pages/${homeId}` : '/admin/pages'}>{Icon.pages()}<span>Edit the homepage<small>Wording, photos and sections</small></span></Link>
          <Link href="/admin/posts/new">{Icon.posts()}<span>Write a blog post<small>Appears on the Blog</small></span></Link>
          <Link href="/admin/media">{Icon.media()}<span>Upload photos<small>Add to the Media Library</small></span></Link>
          <Link href="/admin/availability">{Icon.availability()}<span>Block time off<small>Leave or a closed day</small></span></Link>
          <a href="#qr">{Icon.download()}<span>QR code<small>For flyers, cards and the front desk</small></span></a>
        </div>
      </div>

      {/* v1.8.4: the website's QR code, ready to download (also in the Media Library) */}
      <div className="panel qr-panel" id="qr">
        <img src="/qr/ape-website-qr.svg" alt="QR code for theanxiouspatientexperience.com.au" width={120} height={120} />
        <div className="grow">
          <h2>QR code for the website</h2>
          <p className="help" style={{ margin: '4px 0 10px' }}>Opens theanxiouspatientexperience.com.au. Print it at least 2 cm wide on flyers and cards, and 8 cm or more for a poster or the front desk.</p>
          <div className="actions">
            <a className="btn small" href="/qr/ape-website-qr.png" download>{Icon.download()} PNG (print and email)</a>
            <a className="btn small" href="/qr/ape-website-qr.pdf" download>{Icon.download()} PDF (A4, ready to print)</a>
            <a className="btn small" href="/qr/ape-website-qr.svg" download>{Icon.download()} SVG (for a designer)</a>
          </div>
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
