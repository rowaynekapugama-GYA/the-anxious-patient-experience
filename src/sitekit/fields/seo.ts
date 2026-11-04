import type { Field } from 'payload'

/**
 * The search engine settings that sit on every page and every blog post.
 * Counters and the Google style preview come from the custom components.
 */
export function seoFields(): Field[] {
  return [
    {
      type: 'collapsible',
      label: 'How this page looks in Google',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'seoPreview',
          type: 'ui',
          admin: { components: { Field: '@/sitekit/admin/SeoPreview#SeoPreview' } },
        },
      ],
    },
    {
      name: 'meta',
      type: 'group',
      label: 'Search engine settings',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Page title',
          admin: {
            description: 'Shown as the headline in Google. Aim for 50 to 60 characters.',
            components: { Field: '@/sitekit/admin/CountedText#CountedText' },
          },
          custom: { counter: { ideal: 60, warn: 65 } },
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'Description',
          admin: {
            description: 'The grey text under the headline in Google. Aim for 150 to 160 characters.',
            components: { Field: '@/sitekit/admin/CountedTextarea#CountedTextarea' },
          },
          custom: { counter: { ideal: 160, warn: 170 } },
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
          label: 'Sharing picture',
          admin: { description: 'Shown when the page is shared on Facebook or in a message.' },
        },
        {
          name: 'canonical',
          type: 'text',
          label: 'Preferred address',
          admin: {
            description: 'Leave empty unless this page duplicates another one.',
          },
        },
        {
          name: 'noindex',
          type: 'checkbox',
          label: 'Hide this page from Google',
          defaultValue: false,
        },
        { name: 'ogTitle', type: 'text', admin: { hidden: true } },
        { name: 'ogDescription', type: 'textarea', admin: { hidden: true } },
        { name: 'ogImagePath', type: 'text', admin: { hidden: true } },
        { name: 'ogType', type: 'text', admin: { hidden: true } },
        { name: 'robots', type: 'text', admin: { hidden: true } },
      ],
    },
  ]
}
