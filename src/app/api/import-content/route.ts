import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { importContent } from '@/sitekit/importContent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The Import button. Loads the website wording and pictures into the
 * dashboard. Safe to run more than once: it skips anything already there
 * unless ?overwrite=1 is passed, which puts every page back to how the site
 * was built. Same code as `npm run seed`, see src/sitekit/importContent.ts.
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 })
  if ((user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Only a GYA administrator can import content.' }, { status: 403 })
  }

  const overwrite = req.nextUrl.searchParams.get('overwrite') === '1'
  const { created, updated } = await importContent(payload, { overwrite })

  return NextResponse.json({
    message: `Import finished. ${created} items added${updated ? `, ${updated} replaced` : ''}.`,
  })
}
