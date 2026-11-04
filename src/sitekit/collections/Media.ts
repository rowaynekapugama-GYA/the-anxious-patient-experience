import type { CollectionConfig } from 'payload'
import { adminOrEditor, anyone } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Image', plural: 'Media Library' },
  admin: {
    group: 'Website',
    description:
      'Every photo used on the site. Replacing an image here updates it everywhere it is used.',
  },
  access: { read: anyone, create: adminOrEditor, update: adminOrEditor, delete: adminOrEditor },
  upload: {
    mimeTypes: ['image/*'],
    // One resized master. Uploads are converted to WebP at 2400px and served
    // with next/image unoptimized, so they never hit the optimisation cap.
    formatOptions: { format: 'webp', options: { quality: 80 } },
    resizeOptions: { width: 2400, height: undefined, withoutEnlargement: true, fit: 'inside' },
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Alt text',
      admin: {
        description:
          'Describe what is in the photo, for screen readers and search. Example: a soft cream armchair beside a lit candle.',
      },
    },
    {
      name: 'credit',
      type: 'text',
      label: 'Credit or source',
      admin: { description: 'Optional. Where the photo came from.' },
    },
  ],
}
