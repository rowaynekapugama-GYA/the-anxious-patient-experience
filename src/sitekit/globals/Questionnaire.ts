import type { GlobalConfig } from 'payload'
import { adminOrEditor } from '../access'

/**
 * The words around the questionnaire (v1.7.0, reworked in v1.9.0): the collection notice, the consent tick and the
 * welcome email, edited on the dashboard's Site Settings > Welcome pack screen. Blank uses the drafts in
 * src/lib/questionnaire.ts. Lorna's questions themselves are in src/lib/ape-questionnaire.ts (word for word from
 * her PDF), so `sections` and `welcomePack` here are no longer used; they stay so no data or table is removed.
 */
export const QUESTION_TYPES = [
  { label: 'Short answer', value: 'text' },
  { label: 'Longer answer', value: 'textarea' },
  { label: 'Yes or No', value: 'yesno' },
  { label: 'Choose one', value: 'choice' },
  { label: 'Tick all that apply', value: 'multi' },
  { label: 'Scale 1 to 10', value: 'scale' },
  { label: 'Date', value: 'date' },
  { label: 'Date of birth', value: 'dob' },
  { label: 'Signature (typed name)', value: 'signature' },
  { label: 'Heading only (no answer)', value: 'note' },
] as const

export const Questionnaire: GlobalConfig = {
  slug: 'questionnaire',
  label: 'Questionnaire and welcome pack',
  access: { read: adminOrEditor, update: adminOrEditor },
  admin: { group: 'Settings', description: 'The new patient questionnaire, its collection notice, the welcome email and the welcome pack file.' },
  fields: [
    { name: 'title', type: 'text', label: 'Questionnaire title', defaultValue: 'New Patient Questionnaire' },
    { name: 'intro', type: 'textarea', label: 'Introduction (shown at the top)' },
    { name: 'collectionNotice', type: 'textarea', label: 'Collection notice (shown above the consent tick)' },
    { name: 'consentLabel', type: 'text', label: 'Consent tick wording' },
    {
      name: 'sections',
      type: 'array',
      label: 'Sections (not used since v1.9.0)',
      admin: { hidden: true },
      fields: [
        { name: 'heading', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
        {
          name: 'questions',
          type: 'array',
          fields: [
            { name: 'label', type: 'text', required: true, label: 'Question' },
            { name: 'type', type: 'select', required: true, defaultValue: 'text', options: QUESTION_TYPES.map((t) => ({ ...t })) },
            { name: 'options', type: 'textarea', label: 'Choices, one per line (for Choose one and Tick all that apply)' },
            { name: 'help', type: 'text', label: 'Small print under the question' },
            { name: 'required', type: 'checkbox', defaultValue: false },
          ],
        },
      ],
    },
    { name: 'thankYou', type: 'textarea', label: 'Thank-you message after submitting' },
    { name: 'welcomePack', type: 'upload', relationTo: 'media', label: 'Welcome pack (not used since v1.9.0)', admin: { hidden: true } },
    { name: 'welcomeSubject', type: 'text', label: 'Welcome email subject' },
    { name: 'welcomeBody', type: 'textarea', label: 'Welcome email wording', admin: { description: 'Write {first} for the patient\'s first name, {when} for the appointment, {questionnaire} for the questionnaire paragraph, {where} for the address and directions and {phone} for the phone number. No health details in the email.' } },
  ],
}
