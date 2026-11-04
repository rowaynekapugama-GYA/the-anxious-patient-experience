import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The Publish website button. Asks Vercel to rebuild and records that it did. */
export async function POST() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) {
    return NextResponse.json({ error: 'Please log in first.' }, { status: 401 })
  }

  const hook = process.env.PUBLISH_HOOK_URL
  if (!hook) {
    return NextResponse.json(
      {
        error:
          'Publishing is not set up yet. GYA needs to add the deploy hook address. '
          + 'Your changes are saved.',
      },
      { status: 503 },
    )
  }

  try {
    const res = await fetch(hook, { method: 'POST' })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'The website could not be told to rebuild. Your changes are saved. Please try again.' },
        { status: 502 },
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'The website could not be reached. Your changes are saved. Please try again.' },
      { status: 502 },
    )
  }

  await payload.updateGlobal({
    slug: 'site-status',
    depth: 0,
    data: {
      lastPublishedAt: new Date().toISOString(),
      lastPublishBy: (user as { email?: string }).email ?? '',
    } as never,
  })

  return NextResponse.json({
    message: 'Publishing. Your changes will be live in a couple of minutes.',
  })
}
