/**
 * Build step: apply this release's content changes to a dashboard that already holds the website
 * (src/sitekit/releases.ts). Skipped without a database or before the content has been imported.
 */
import './load-env'
import { getPayload } from 'payload'
import config from '@payload-config'
import { UPDATES } from '../src/sitekit/releases'

async function main() {
  if (!process.env.DATABASE_URL) { console.log('content updates: no DATABASE_URL, nothing to do'); process.exit(0) }
  const payload = await getPayload({ config })
  const status = (await payload.findGlobal({ slug: 'site-status', depth: 0 })) as { imported?: boolean }
  if (!status?.imported) { console.log('content updates: the dashboard has not been imported yet, nothing to do'); process.exit(0) }
  for (const u of UPDATES) {
    try {
      console.log(`content updates: ${u.id}: ${await u.apply(payload)}`)
    } catch (err) {
      console.log(`content updates: ${u.id}: could not be applied (${(err as Error).message}); the build carries on`)
    }
  }
  process.exit(0)
}

void main()
