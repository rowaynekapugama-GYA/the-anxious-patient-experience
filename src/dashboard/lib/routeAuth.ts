/** Who is calling a dashboard API route (cookie session), or null. */
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

export async function routeUser(req: Request): Promise<{ payload: Payload; user: Record<string, any> | null }> {
  const payload = await getPayload({ config })
  try {
    const { user } = await payload.auth({ headers: req.headers })
    return { payload, user: user as Record<string, any> | null }
  } catch {
    return { payload, user: null }
  }
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
