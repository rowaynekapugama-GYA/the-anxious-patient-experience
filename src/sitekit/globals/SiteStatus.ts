import type { GlobalConfig } from 'payload'
import { adminOrEditor } from '../access'

/** Bookkeeping behind the Publish website button. Never shown in the menu. */
export const SiteStatus: GlobalConfig = {
  slug: 'site-status',
  label: 'Site status',
  access: { read: adminOrEditor, update: adminOrEditor },
  admin: { hidden: true },
  fields: [
    { name: 'lastChangedAt', type: 'date' },
    { name: 'lastPublishedAt', type: 'date' },
    { name: 'lastPublishBy', type: 'text' },
    { name: 'imported', type: 'checkbox', defaultValue: false },
  ],
}
