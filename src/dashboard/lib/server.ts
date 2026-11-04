/** Server-side helpers for the /admin dashboard. */
import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

export type DashUser = { id: number | string; email: string; name?: string; role: 'admin' | 'editor'; mustChangePassword?: boolean }

export async function payloadClient(): Promise<Payload> {
  return getPayload({ config })
}

export async function currentUser(): Promise<DashUser | null> {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: await headers() })
    if (!user || (user as { collection?: string }).collection !== 'users') return null
    return user as unknown as DashUser
  } catch {
    return null
  }
}

/** Every dashboard page calls this itself (layouts render in parallel with pages). */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<DashUser> {
  const u = await currentUser()
  if (!u) redirect('/admin/login')
  if (u.mustChangePassword && !opts.allowPasswordChange) redirect('/admin/change-password')
  return u
}

export async function requireAdmin(): Promise<DashUser> {
  const u = await requireUser()
  if (u.role !== 'admin') notFound()
  return u
}

export async function siteStatus(payload: Payload) {
  const s = await payload.findGlobal({ slug: 'site-status', overrideAccess: true, depth: 0 }) as unknown as Record<string, string | null>
  const changed = s?.lastChangedAt ? new Date(s.lastChangedAt).getTime() : 0
  const published = s?.lastPublishedAt ? new Date(s.lastPublishedAt).getTime() : 0
  return {
    lastChangedAt: s?.lastChangedAt ?? null,
    lastPublishedAt: s?.lastPublishedAt ?? null,
    lastPublishedBy: s?.lastPublishBy ?? null,
    waiting: changed > published,
    hookConfigured: Boolean(process.env.PUBLISH_HOOK_URL),
  }
}
