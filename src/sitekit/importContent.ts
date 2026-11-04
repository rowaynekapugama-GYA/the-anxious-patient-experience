import fs from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import type { Chrome, Page, Part, Redirect } from '@/lib/parts'
import { pageToDoc, partToSectionDoc } from '@/sitekit/sync'
import { DEFAULTS } from '@/site.config'

/**
 * Loads the website into the dashboard from the files the site is built from.
 *
 * This is the only implementation. The Import button and `npm run seed` both
 * call it, so they cannot drift apart. They did once: the button skipped the
 * team and the search engine defaults, which only showed up after an Import on
 * a real deployment.
 *
 * It reads the same content/*.json files that pull-content.ts writes, so an
 * import followed by a pull gives back the same bytes.
 *
 * Safe to run more than once. Anything already there is left alone unless
 * `overwrite` is true, which puts it all back to how the repository has it.
 */

const CONTENT = path.join(process.cwd(), 'content')

const CHROME_TITLES: Record<string, string> = {
  footer: 'Site footer',
}
const ORDER: Record<string, number> = { home: -1, 'book-now': 0, 'privacy-policy': 1, 'not-found': 2 }

type Result = { created: number; updated: number }

function read<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(CONTENT, rel), 'utf8')) as T
}

function readIfThere<T>(rel: string): T | null {
  const file = path.join(CONTENT, rel)
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : null
}

export async function importContent(payload: Payload, { overwrite = false } = {}): Promise<Result> {
  let created = 0
  let updated = 0

  const upsertPage = async (pageSlug: string, data: Record<string, unknown>) => {
    const found = await payload.find({
      collection: 'pages',
      where: { pageSlug: { equals: pageSlug } },
      limit: 1,
      depth: 0,
    })
    if (found.docs[0]) {
      if (!overwrite) return
      await payload.update({ collection: 'pages', id: found.docs[0].id, data: data as never, depth: 0 })
      updated++
      return
    }
    await payload.create({ collection: 'pages', data: data as never, depth: 0 })
    created++
  }

  // ---- pages -------------------------------------------------------------
  const slugs = fs
    .readdirSync(path.join(CONTENT, 'pages'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort()

  for (const slug of slugs) {
    const page = read<Page>(`pages/${slug}.json`)
    await upsertPage(
      slug,
      pageToDoc(page, {
        title: page.name || page.meta?.title || slug,
        sortOrder: ORDER[slug] ?? 0,
      }) as unknown as Record<string, unknown>,
    )
  }

  // ---- header, footer and the rest of the shared furniture ---------------
  const chrome = read<Chrome>('chrome.json')
  for (const [name, part] of Object.entries(chrome.parts) as [string, Part][]) {
    await upsertPage(`_chrome-${name}`, {
      title: CHROME_TITLES[name] ?? name,
      pageSlug: `_chrome-${name}`,
      path: '/',
      isChrome: true,
      sortOrder: -10,
      sections: [partToSectionDoc(part)],
      order: '[]',
      headHtml: '',
      tailHtml: '',
    })
  }

  // ---- redirects ---------------------------------------------------------
  for (const r of read<Redirect[]>('redirects.json')) {
    const found = await payload.find({
      collection: 'redirects',
      where: { from: { equals: r.from } },
      limit: 1,
      depth: 0,
    })
    if (found.docs[0]) continue
    await payload.create({ collection: 'redirects', data: r as never, depth: 0 })
    created++
  }

  // ---- practice details --------------------------------------------------
  const settings = (await payload.findGlobal({ slug: 'site-settings', depth: 0 })) as { phone?: string }
  if (overwrite || !settings.phone) {
    const saved = readIfThere<Record<string, unknown>>('site-settings.json') ?? {}
    const m = { ...DEFAULTS, ...saved } as typeof DEFAULTS
    await payload.updateGlobal({
      slug: 'site-settings',
      depth: 0,
      data: {
        practiceName: m.practiceName,
        phone: m.phone,
        apeEmail: m.apeEmail,
        receptionEmail: m.receptionEmail,
        clinic: { ...DEFAULTS.clinic, ...(saved.clinic as object ?? {}) },
        bookingRecipients: (m.bookingRecipients ?? []).map((address) => ({ address })),
        tracking: { ...DEFAULTS.tracking, ...(saved.tracking as object ?? {}) },
      } as never,
    })
  }

  // ---- search engine defaults --------------------------------------------
  const seo = (await payload.findGlobal({ slug: 'seo', depth: 0 })) as { defaultTitle?: string }
  if (overwrite || !seo.defaultTitle) {
    const saved = readIfThere<{ defaultTitle?: string; defaultDescription?: string; noindexSite?: boolean }>(
      'seo.json',
    )
    const home = read<Page>('pages/home.json')
    await payload.updateGlobal({
      slug: 'seo',
      depth: 0,
      data: {
        defaultTitle: saved?.defaultTitle ?? home.meta?.title ?? DEFAULTS.practiceName,
        defaultDescription: saved?.defaultDescription ?? home.meta?.description ?? '',
        noindexSite: Boolean(saved?.noindexSite),
      } as never,
    })
  }

  await payload.updateGlobal({
    slug: 'site-status',
    depth: 0,
    data: { imported: true, lastChangedAt: new Date().toISOString() } as never,
  })

  return { created, updated }
}
