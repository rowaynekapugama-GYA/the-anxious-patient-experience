import type { GlobalConfig } from 'payload'
import { adminOrEditor } from '../access'

/**
 * The New Patient Information Pack (v1.7.0): the questionnaire's sections and questions, the collection notice,
 * the welcome email and the welcome pack file. Content, not code: Lorna's originals are loaded here (dashboard >
 * Questionnaires > Questions and emails, or /cms for GYA). Switched on with QUESTIONNAIRE_ENABLED=true in Vercel.
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
      label: 'Sections',
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
    { name: 'welcomePack', type: 'upload', relationTo: 'media', label: 'Welcome pack (PDF)', admin: { description: "Lorna's original welcome pack. Attached to the welcome email and offered as a download." } },
    { name: 'welcomeSubject', type: 'text', label: 'Welcome email subject' },
    { name: 'welcomeBody', type: 'textarea', label: 'Welcome email wording', admin: { description: 'Write {first} for the patient\'s first name, {when} for the appointment, {link} for the questionnaire link and {pack} for the welcome pack link. No health details in the email.' } },
  ],
}
