import { Forbidden, type CollectionBeforeOperationHook } from 'payload'

/**
 * Nobody can create a dashboard account from the open web.
 *
 * Payload registers the first user with overrideAccess, so the adminOnly rule
 * on Users does not apply to it: on a fresh database, whoever reaches /admin
 * first would become the administrator. This hook runs whatever the access
 * override says.
 *
 * A create is allowed when:
 *   - a signed in GYA administrator is adding someone, or
 *   - it comes from the server itself (seed and import scripts), or
 *   - ALLOW_FIRST_USER=true is set and there are no users yet. That account is
 *     always an administrator. Remove the variable and redeploy straight after.
 */
export const firstUserGate: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create') return args

  const role = (req.user as { role?: string } | null | undefined)?.role
  if (role === 'admin') return args
  if (req.payloadAPI === 'local') return args

  if (process.env.ALLOW_FIRST_USER === 'true') {
    const existing = await req.payload.count({ collection: 'users', req, overrideAccess: true })
    if (existing.totalDocs === 0) {
      const data = (args.data ?? {}) as Record<string, unknown>
      args.data = { ...data, role: 'admin' } as typeof args.data
      return args
    }
  }

  throw new Forbidden(req.t)
}
