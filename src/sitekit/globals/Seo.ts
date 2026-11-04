import type { GlobalConfig } from 'payload'
import { adminOrEditor } from '../access'
import { touchSiteGlobal } from '../hooks/touchSite'

/** The search engine defaults a page falls back to when it sets nothing itself. */
export const Seo: GlobalConfig = {
  slug: 'seo',
  label: 'SEO',
  access: { read: adminOrEditor, update: adminOrEditor },
  admin: {
    group: 'Settings',
    description:
      'Defaults for search engines. A page or a blog post that fills in its own '
      + 'title and description uses those instead.',
  },
  hooks: { afterChange: [touchSiteGlobal] },
  fields: [
    {
      name: 'defaultTitle',
      type: 'text',
      label: 'Default page title',
      admin: { description: 'Used when a page has no title of its own.' },
    },
    { name: 'defaultDescription', type: 'textarea', label: 'Default description' },
    {
      name: 'defaultOgImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Default sharing picture',
      admin: { description: 'Shown when a page is shared and has no picture of its own.' },
    },
    {
      name: 'noindexSite',
      type: 'checkbox',
      defaultValue: false,
      label: 'Hide the whole site from Google',
      admin: { description: 'Only tick this before the site goes live.' },
    },
  ],
}
