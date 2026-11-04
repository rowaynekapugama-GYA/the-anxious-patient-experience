import type { Access, FieldAccess } from 'payload'

type Role = 'admin' | 'editor'

const roleOf = (user: unknown): Role | undefined =>
  (user as { role?: Role } | null | undefined)?.role

/** Anyone signed in may read. */
export const authenticated: Access = ({ req }) => Boolean(req.user)

/** GYA only. */
export const adminOnly: Access = ({ req }) => roleOf(req.user) === 'admin'

/** GYA and the practice. */
export const adminOrEditor: Access = ({ req }) => {
  const role = roleOf(req.user)
  return role === 'admin' || role === 'editor'
}

/** Published content is public, drafts are staff only. */
export const publishedOrStaff: Access = ({ req }) => {
  if (roleOf(req.user)) return true
  return { _status: { equals: 'published' } }
}

/** Field level: only GYA may change a role or a tracking ID. */
export const adminFieldOnly: FieldAccess = ({ req }) => roleOf(req.user) === 'admin'

export const anyone: Access = () => true
