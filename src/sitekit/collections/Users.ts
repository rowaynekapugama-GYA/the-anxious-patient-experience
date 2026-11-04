import type { CollectionConfig } from 'payload'
import { adminOnly, adminFieldOnly } from '../access'
import { firstUserGate } from '../hooks/firstUserGate'

type U = { id?: string | number; role?: string } | null | undefined

/**
 * Two roles. admin = GYA, editor = practice staff. Nobody can register: the
 * first login is created once while ALLOW_FIRST_USER=true, and every other
 * account is added by an administrator from the dashboard's Users screen.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 12,
    maxLoginAttempts: 8,
    lockTime: 15 * 60 * 1000,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
  hooks: {
    beforeOperation: [firstUserGate],
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        // an administrator setting a password for someone else makes it temporary
        if (
          operation === 'update' && data?.password && req.user && originalDoc
          && String((req.user as { id?: unknown }).id) !== String(originalDoc.id)
        ) {
          data.mustChangePassword = true
        }
        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Settings',
    description: 'Who can sign in to the dashboard.',
  },
  access: {
    // Payload's own screens at /cms are for GYA only. The practice uses /admin.
    admin: ({ req }) => (req.user as U)?.role === 'admin',
    read: ({ req }) => {
      const u = req.user as U
      if (!u) return false
      if (u.role === 'admin') return true
      return { id: { equals: u.id } }
    },
    create: adminOnly,
    update: ({ req }) => {
      const u = req.user as U
      if (!u) return false
      if (u.role === 'admin') return true
      return { id: { equals: u.id } }
    },
    delete: adminOnly,
    unlock: adminOnly,
  },
  fields: [
    { name: 'name', type: 'text', label: 'Full name' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      saveToJWT: true,
      options: [
        { label: 'Administrator (GYA)', value: 'admin' },
        { label: 'Editor (practice)', value: 'editor' },
      ],
      admin: {
        description:
          'Editors can change wording, photos, posts and SEO. Administrators also manage users, redirects and tracking IDs.',
      },
      access: { create: adminFieldOnly, update: adminFieldOnly },
    },
    {
      name: 'mustChangePassword',
      type: 'checkbox',
      defaultValue: false,
      saveToJWT: true,
      label: 'Must choose a new password at next sign in',
      access: { update: adminFieldOnly },
    },
  ],
}
