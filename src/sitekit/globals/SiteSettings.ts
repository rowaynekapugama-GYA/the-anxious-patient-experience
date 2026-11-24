import type { GlobalConfig } from 'payload'
import { adminFieldOnly, adminOrEditor } from '../access'
import { touchSiteGlobal } from '../hooks/touchSite'
import { gtmFieldOk } from '../../lib/gtm'

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
      // v1.8.3: the practice can change this itself (new booking, deposit received and questionnaire received emails)
      name: 'bookingRecipients',
      type: 'array',
      label: 'Who receives booking emails',
      fields: [{ name: 'address', type: 'email', label: 'Email address', required: true }],
    },
    {
      // v1.8.3: a short notice to GYA for each booking saying which emails went out (no patient details)
      name: 'gyaDeliveryNotice',
      type: 'checkbox',
      label: 'Send GYA a delivery check for each booking (no patient details)',
      defaultValue: true,
      access: { create: adminFieldOnly, update: adminFieldOnly, read: adminFieldOnly },
    },
    {
      name: 'gyaNoticeTo',
      type: 'email',
      label: 'GYA delivery check and alerts go to',
      access: { create: adminFieldOnly, update: adminFieldOnly, read: adminFieldOnly },
      admin: { description: 'Blank uses rowayne@gyaclients.com.' },
    },
    {
      name: 'googleReviewLink',
      type: 'text',
      label: 'Google review link',
      admin: { description: 'The "Ask for reviews" link from the Google Business Profile (https://g.page/r/.../review). The /review/ page says "coming soon" until this is filled in.' },
    },
    {
      name: 'questionnaire',
      type: 'group',
      label: 'Welcome pack and questionnaire',
      fields: [
        {
          name: 'sendWhen',
          type: 'select',
          label: 'Send the welcome pack when',
          defaultValue: 'confirmed',
          options: [
            { label: 'a booking is confirmed (recommended)', value: 'confirmed' },
            { label: 'a booking request is received', value: 'requested' },
          ],
        },
        {
          name: 'notifyEmails',
          type: 'array',
          label: 'Questionnaire notifications go to',
          admin: { description: 'Who is told when a patient completes the online questionnaire. Empty uses Who receives booking emails. The email never contains answers.' },
          fields: [{ name: 'address', type: 'email', label: 'Email address', required: true }],
        },
        // v1.9.0: Lorna's two PDFs (blank uses the originals in public/downloads) and the switches, all edited on
        // the dashboard's Site Settings > Welcome pack screen. The switches are for GYA administrators only.
        { name: 'guidePdf', type: 'upload', relationTo: 'media', label: 'Patient Guide (PDF)' },
        { name: 'questionnairePdf', type: 'upload', relationTo: 'media', label: 'Pre-appointment Questionnaire (PDF)' },
        { name: 'welcomeEmailOn', type: 'checkbox', defaultValue: false, label: 'Send the welcome email', access: { create: adminFieldOnly, update: adminFieldOnly } },
        { name: 'onlineOn', type: 'checkbox', defaultValue: false, label: 'Online questionnaire', access: { create: adminFieldOnly, update: adminFieldOnly } },
        { name: 'noticeApproved', type: 'checkbox', defaultValue: false, label: 'Collection notice approved by Lorna', access: { create: adminFieldOnly, update: adminFieldOnly } },
        { name: 'noticeApprovedBy', type: 'text', access: { create: adminFieldOnly, update: adminFieldOnly } },
        { name: 'noticeApprovedAt', type: 'date', access: { create: adminFieldOnly, update: adminFieldOnly } },
      ],
    },
    {
      // v1.10.0: the booking terms and cancellation policy shown on Book Now (Site Settings > Booking terms in the
      // dashboard, src/booking/terms.ts). Blank uses the drafted default. Each saved change gets the next version.
      name: 'bookingTerms',
      type: 'group',
      label: 'Booking terms and cancellation policy',
      fields: [
        { name: 'text', type: 'textarea', label: 'Terms and cancellation policy', admin: { description: 'A line starting "## " is a heading and a line starting "- " is a bullet. {phone} and {deposit} are filled in.' } },
        { name: 'consentLabel', type: 'text', label: 'Tick box on the terms step' },
        { name: 'readLabel', type: 'text', label: 'Tick box before paying the deposit' },
        { name: 'version', type: 'number', label: 'Version', admin: { readOnly: true } },
        { name: 'changedAt', type: 'date', label: 'Last changed', admin: { readOnly: true } },
        { name: 'changedBy', type: 'text', admin: { readOnly: true } },
        { name: 'approvedBy', type: 'text', label: 'Approved by' },
        { name: 'approvedAt', type: 'date', label: 'Approved' },
      ],
    },
    {
      name: 'tracking',
      type: 'group',
      label: 'Tracking',
      access: { create: adminFieldOnly, update: adminFieldOnly, read: adminFieldOnly },
      fields: [
        { name: 'ga4', type: 'text', label: 'Google Analytics 4 measurement ID' },
        { name: 'metaPixel', type: 'text', label: 'Meta Pixel ID' },
        {
          // v1.15.0: empty uses the default container in src/site.config.ts; "off" switches Tag Manager off
          name: 'gtm',
          type: 'text',
          label: 'Google Tag Manager ID',
          validate: (v: unknown) => gtmFieldOk(v) || 'A Tag Manager ID looks like GTM-ABC1234 (or type off to switch it off).',
        },
      ],
    },
  ],
}
