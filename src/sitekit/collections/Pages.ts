import type { CollectionConfig } from 'payload'
import { adminOnly, adminOrEditor } from '../access'
import { seoFields } from '../fields/seo'
import { touchSite } from '../hooks/touchSite'

/**
 * One document per page of the website. A page is a list of sections, and a
 * section is a list of plainly labelled fields. Nobody has to look at markup.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  access: {
    read: adminOrEditor,
    create: adminOnly,
    update: adminOrEditor,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'path', 'updatedAt'],
    description:
      'Every page on the website. Open a page, then open the section you want to change. '
      + 'Remember to press Publish website on the Dashboard when you are finished.',
    components: {
      beforeList: ['@/sitekit/admin/AhpraNotice#AhpraNotice'],
      edit: { beforeDocumentControls: ['@/sitekit/admin/PreviewLink#PreviewLink'] },
    },
    group: 'Website',
  },
  hooks: { afterChange: [touchSite], afterDelete: [touchSite] },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Page name',
      admin: { description: 'How this page is listed here. It is not shown on the website.' },
    },
    {
      name: 'pageSlug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Page file name',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'path',
      type: 'text',
      required: true,
      label: 'Web address',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar', description: 'Only affects the order shown here.' },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Sections',
          description:
            'Drag a section by its handle to move it up or down the page. '
            + 'Tick Hide to take a section off the page without deleting it.',
          fields: [
            {
              name: 'sections',
              type: 'array',
              label: 'Page sections',
              labels: { singular: 'Section', plural: 'Sections' },
              admin: {
                initCollapsed: true,
                components: { RowLabel: '@/sitekit/admin/SectionRowLabel#SectionRowLabel' },
              },
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  label: 'Section name',
                  admin: { description: 'Shown here only, to help you find the right section.' },
                },
                {
                  name: 'hidden',
                  type: 'checkbox',
                  label: 'Hide this section',
                  defaultValue: false,
                },
                {
                  name: 'content',
                  type: 'array',
                  label: 'Wording and pictures',
                  labels: { singular: 'Item', plural: 'Items' },
                  admin: {
                    initCollapsed: true,
                    components: { RowLabel: '@/sitekit/admin/FieldRowLabel#FieldRowLabel' },
                    description:
                      'Anything written as {{site:phone}} or {{site:email}} is filled in '
                      + 'automatically from Site Settings. Leave those as they are.',
                  },
                  fields: [
                    { name: 'fieldId', type: 'text', admin: { hidden: true } },
                    { name: 'kind', type: 'text', admin: { hidden: true } },
                    {
                      name: 'label',
                      type: 'text',
                      label: 'What this is',
                      admin: { readOnly: true },
                    },
                    {
                      name: 'text',
                      type: 'textarea',
                      maxLength: 200000,
                      label: 'Wording',
                      admin: {
                        condition: (_, sibling) =>
                          ['richtext', 'text', 'alt', 'srcset'].includes(String(sibling?.kind)),
                      },
                    },
                    {
                      name: 'link',
                      type: 'text',
                      label: 'Link address',
                      admin: {
                        condition: (_, sibling) => String(sibling?.kind) === 'href',
                        description: 'A page on this site starts with a slash, for example /contact.',
                      },
                    },
                    {
                      name: 'image',
                      type: 'upload',
                      relationTo: 'media',
                      label: 'Picture',
                      admin: {
                        condition: (_, sibling) => String(sibling?.kind) === 'image',
                        description: 'Choose from the Media Library or upload a new one.',
                      },
                    },
                    { name: 'of', type: 'text', admin: { hidden: true } },
                    { name: 'w', type: 'text', admin: { hidden: true } },
                    { name: 'h', type: 'text', admin: { hidden: true } },
                    {
                      name: 'builtIn',
                      type: 'text',
                      label: 'Current picture',
                      admin: {
                        readOnly: true,
                        condition: (_, sibling) => String(sibling?.kind) === 'image',
                        description:
                          'Used when no picture is chosen above. Replace it with one of the '
                          + 'same shape so the layout stays as approved.',
                      },
                    },
                  ],
                },
                // structure the editor never needs to see
                { name: 'key', type: 'text', admin: { hidden: true } },
                { name: 'kind', type: 'text', admin: { hidden: true } },
                { name: 'tag', type: 'text', admin: { hidden: true } },
                { name: 'attrs', type: 'textarea', maxLength: 2000000, admin: { hidden: true } },
                { name: 'template', type: 'textarea', maxLength: 2000000, admin: { hidden: true } },
              ],
            },
          ],
        },
        {
          label: 'Search engines',
          fields: seoFields(),
        },
      ],
    },
    // carried through untouched so a page can be rebuilt exactly
    // stored as text so the exact byte order of the original markup survives
    { name: 'group', type: 'text', admin: { hidden: true } },
    { name: 'order', type: 'textarea', maxLength: 2000000, admin: { hidden: true } },
    { name: 'headHtml', type: 'textarea', maxLength: 2000000, admin: { hidden: true } },
    { name: 'tailHtml', type: 'textarea', maxLength: 2000000, admin: { hidden: true } },
    { name: 'isChrome', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
  ],
}
