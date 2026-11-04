import type { GlobalConfig } from 'payload'
import { adminFieldOnly, adminOrEditor } from '../access'
import { touchSiteGlobal } from '../hooks/touchSite'

/**
 * The details that appear in more than one place on the website. Changing a value here changes it
 * everywhere the page content writes it as a {{site:...}} token (footer, Book Now, structured data).
 * Only settings the website uses are here.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  access: { read: adminOrEditor, update: adminOrEditor },
  admin: {
    group: 'Settings',
    description: 'The contact details used across the whole website. Change them once here and press Publish website.',
  },
  hooks: { afterChange: [touchSiteGlobal] },
  fields: [
    { name: 'practiceName', type: 'text', label: 'Name' },
    { name: 'phone', type: 'text', label: 'Phone number' },
    { name: 'apeEmail', type: 'text', label: 'APE enquiries email' },
    { name: 'receptionEmail', type: 'text', label: 'General practice enquiries email' },
    {
      name: 'clinic',
      type: 'group',
      label: 'Where appointments are held',
      fields: [
        { name: 'name', type: 'text', label: 'Clinic name' },
        { name: 'street', type: 'text', label: 'Street' },
        { name: 'suburb', type: 'text', label: 'Suburb' },
        { name: 'state', type: 'text', label: 'State' },
        { name: 'postcode', type: 'text', label: 'Postcode' },
        { name: 'mapsUrl', type: 'text', label: 'Google Maps link' },
      ],
    },
    {
      name: 'bookingRecipients',
      type: 'array',
      label: 'Who receives booking requests',
      access: { create: adminFieldOnly, update: adminFieldOnly, read: adminFieldOnly },
      fields: [{ name: 'address', type: 'email', label: 'Email address', required: true }],
    },
    {
      name: 'tracking',
      type: 'group',
      label: 'Tracking',
      access: { create: adminFieldOnly, update: adminFieldOnly, read: adminFieldOnly },
      fields: [
        { name: 'ga4', type: 'text', label: 'Google Analytics 4 measurement ID' },
        { name: 'metaPixel', type: 'text', label: 'Meta Pixel ID' },
      ],
    },
  ],
}
