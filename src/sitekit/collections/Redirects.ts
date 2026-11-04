import type { CollectionConfig } from 'payload'
import { adminOnly } from '../access'

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: {
    group: 'Settings',
    useAsTitle: 'from',
    defaultColumns: ['from', 'to', 'type'],
    description: 'Point an old address at a new one. Used when a page moves or is renamed.',
    hidden: ({ user }) => (user as { role?: string } | null)?.role !== 'admin',
  },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'The old path, starting with a slash. Example: /about.htm' },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: { description: 'Where it should go. Example: /about' },
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'permanent',
      options: [
        { label: 'Permanent (308)', value: 'permanent' },
        { label: 'Temporary (307)', value: 'temporary' },
      ],
    },
    { name: 'note', type: 'text', admin: { description: 'Optional reminder of why this exists.' } },
  ],
}
