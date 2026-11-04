import type { CollectionConfig } from 'payload'
import { adminOnly, adminOrEditor, publishedOrStaff } from '../access'
import { seoFields } from '../fields/seo'
import { touchSite } from '../hooks/touchSite'
import { cleanPostBody } from '../sanitize'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Category', plural: 'Categories' },
  admin: { useAsTitle: 'title', group: 'Website', hidden: true },
  access: { read: () => true, create: adminOrEditor, update: adminOrEditor, delete: adminOnly },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Category name' },
    { name: 'slug', type: 'text', required: true, unique: true, label: 'Web address' },
  ],
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Blog Post', plural: 'Blog Posts' },
  versions: { drafts: { autosave: false, schedulePublish: true } },
  access: {
    read: publishedOrStaff,
    create: adminOrEditor,
    update: adminOrEditor,
    delete: adminOrEditor,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'publishedAt', 'category'],
    group: 'Website',
    description:
      'Write, schedule and publish news for the practice. The Blog link, the sitemap entry '
      + 'and the article markup all appear on the website once the first post is published.',
    components: { beforeList: ['@/sitekit/admin/AhpraNotice#AhpraNotice'] },
    livePreview: undefined,
  },
  hooks: { afterChange: [touchSite], afterDelete: [touchSite] },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Headline' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Web address',
      admin: {
        position: 'sidebar',
        description: 'Lower case, words joined by hyphens. For example: caring-for-braces.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Publish date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Set a date in the future and use Save as draft to schedule it.',
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Category',
      admin: { position: 'sidebar' },
    },
    {
      name: 'author',
      type: 'text',
      label: 'Written by',
      admin: { position: 'sidebar', description: 'A name from the practice. Do not invent one.' },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Main picture',
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Short summary',
      admin: { description: 'One or two sentences, shown on the blog listing.' },
    },
    {
      name: 'body',
      type: 'textarea',
      maxLength: 400000,
      label: 'Article',
      admin: {
        description:
          'Written in the dashboard\'s article editor. Stored as clean HTML: headings, paragraphs, '
          + 'lists, quotes, links and pictures only.',
      },
      hooks: { beforeChange: [({ value }) => (typeof value === 'string' ? cleanPostBody(value) : value)] },
    },
    {
      type: 'tabs',
      tabs: [{ label: 'Search engines', fields: seoFields() }],
    },
  ],
}
