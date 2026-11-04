import './load-env'

import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@payload-config'
import { docToPage, orderedPage, sectionDocToPart, mediaUrl, settingsFileFromGlobal, type PageDoc } from '../src/sitekit/sync'
import type { Part } from '../src/lib/parts'
import { cleanPostBody } from '../src/sitekit/sanitize'

const CONTENT = path.join(process.cwd(), 'content')

function write(rel: string, data: unknown) {
  const file = path.join(CONTENT, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

const clean = <T extends object>(o: T): T =>
  JSON.parse(JSON.stringify(o, (k, v) => (v === null ? undefined : v))) as T

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('pull: no DATABASE_URL, leaving the content files as they are')
    process.exit(0)
  }

  const payload = await getPayload({ config })

  // ---- an empty dashboard must never overwrite the site -------------------
  // Straight after Neon is connected, and before anyone presses Import, the
  // database exists but holds nothing. Pulling from it would write empty
  // redirects and an empty list of known pages, and every page on the site
  // would answer 404. Until the content has been imported, the files in the
  // repository are the only source of truth, so leave every one of them alone.
  const pages = await payload.find({ collection: 'pages', limit: 500, depth: 1, pagination: false })
  const realPages = (pages.docs as unknown as PageDoc[]).filter((p) => !p.isChrome)
  const status = (await payload.findGlobal({ slug: 'site-status', depth: 0 })) as { imported?: boolean }
  if (realPages.length === 0 || status?.imported !== true) {
    console.log(
      'pull: the dashboard has not been imported yet, so the site is built from the files in the repository',
    )
    process.exit(0)
  }

  // ---- pages and shared furniture ---------------------------------------
  const chromeParts: Record<string, Part> = {}
  let written = 0

  for (const raw of pages.docs as unknown as PageDoc[]) {
    if (raw.isChrome) {
      const name = raw.pageSlug.replace('_chrome-', '')
      chromeParts[name] = sectionDocToPart(raw.sections[0])
      continue
    }
    write(`pages/${raw.pageSlug}.json`, orderedPage(docToPage(raw)))
    written++
  }
  if (Object.keys(chromeParts).length > 0) {
    const previous = fs.existsSync(path.join(CONTENT, 'chrome.json'))
      ? (JSON.parse(fs.readFileSync(path.join(CONTENT, 'chrome.json'), 'utf8')) as {
          parts?: Record<string, unknown>
        })
      : {}
    // keep the parts in the order the file already has, so a pull with no
    // edits leaves the file byte for byte as it was and git shows no change
    const order = [
      ...Object.keys(previous.parts ?? {}),
      ...Object.keys(chromeParts).filter((k) => !(k in (previous.parts ?? {}))),
    ].filter((k) => k in chromeParts)
    const parts: Record<string, Part> = {}
    for (const k of order) parts[k] = chromeParts[k]
    write('chrome.json', { parts })
  }

  // ---- site settings -----------------------------------------------------
  const settings = clean(
    (await payload.findGlobal({ slug: 'site-settings', depth: 1 })) as unknown as Record<string, unknown>,
  )
  write('site-settings.json', settingsFileFromGlobal(settings))

  // ---- search engine defaults -------------------------------------------
  const seo = clean((await payload.findGlobal({ slug: 'seo', depth: 1 })) as unknown as Record<string, unknown>)
  write('seo.json', {
    defaultTitle: seo.defaultTitle,
    defaultDescription: seo.defaultDescription,
    defaultOgImage: mediaUrl(seo.defaultOgImage as never),
    noindexSite: Boolean(seo.noindexSite),
  })

  // ---- blog --------------------------------------------------------------
  const posts = await payload.find({
    collection: 'posts',
    limit: 500,
    depth: 1,
    pagination: false,
    where: {
      and: [
        { _status: { equals: 'published' } },
        { or: [{ publishedAt: { less_than_equal: new Date().toISOString() } }, { publishedAt: { exists: false } }] },
      ],
    },
    sort: '-publishedAt',
  })
  write(
    'posts.json',
    (posts.docs as unknown as Record<string, unknown>[]).map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? '',
      author: p.author ?? '',
      publishedAt: p.publishedAt ?? p.createdAt,
      category: (p.category as { title?: string; slug?: string } | null)?.title ?? null,
      categorySlug: (p.category as { slug?: string } | null)?.slug ?? null,
      featuredImage: mediaUrl(p.featuredImage as never),
      featuredImageAlt: (p.featuredImage as { alt?: string } | null)?.alt ?? '',
      body: cleanPostBody(String(p.body ?? '')),
      meta: {
        title: (p.meta as Record<string, unknown> | undefined)?.title ?? p.title,
        description: (p.meta as Record<string, unknown> | undefined)?.description ?? p.excerpt ?? '',
        ogImage:
          mediaUrl((p.meta as Record<string, unknown> | undefined)?.ogImage as never) ??
          mediaUrl(p.featuredImage as never),
        noindex: Boolean((p.meta as Record<string, unknown> | undefined)?.noindex),
      },
    })),
  )

  // ---- redirects ---------------------------------------------------------
  const redirects = await payload.find({
    collection: 'redirects',
    limit: 1000,
    depth: 0,
    pagination: false,
    sort: 'from',
  })
  write(
    'redirects.json',
    (redirects.docs as unknown as Record<string, unknown>[]).map((r) => ({
      from: r.from,
      to: r.to,
      type: r.type ?? 'permanent',
    })),
  )

  console.log(`pull complete: ${written} pages, ${Object.keys(chromeParts).length} shared parts, ${posts.docs.length} posts`)
  process.exit(0)
}

void main()
