import './load-env'

import { getPayload } from 'payload'
import config from '@payload-config'
import { importContent } from '../src/sitekit/importContent'

/**
 * Loads content/*.json into the database. The same code runs behind the
 * Import button in the dashboard, see src/sitekit/importContent.ts.
 *
 *   npm run seed                  add anything missing
 *   npm run seed -- --overwrite   put everything back to how the repository has it
 *   npm run seed -- --if-empty    only when nothing has been imported yet (the build runs this)
 */
async function main() {
  const payload = await getPayload({ config })
  if (process.argv.includes('--if-empty')) {
    const status = (await payload.findGlobal({ slug: 'site-status', depth: 0 })) as { imported?: boolean }
    if (status?.imported) {
      console.log('seed: the dashboard already has the website, nothing to do')
      process.exit(0)
    }
  }
  const { created, updated } = await importContent(payload, {
    overwrite: process.argv.includes('--overwrite'),
  })
  console.log(`seed complete: ${created} created, ${updated} updated`)
  process.exit(0)
}

void main()
