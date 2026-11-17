import type { CollectionConfig } from 'payload'
import { adminOnly } from '../access'

/**
 * Patient questionnaires (v1.7.0). One row per welcome email sent: it holds the private link's token (hashed) and,
 * once the patient submits, their answers, encrypted in the app with QUESTIONNAIRE_ENCRYPTION_KEY before they are
 * saved (on top of the database's own encryption). Nothing here is reachable through Payload's REST or GraphQL
 * API or its /cms screens: only the server code in src/lib/questionnaire.ts reads and writes it, and the dashboard
 * shows answers only to people with "Can view patient questionnaires", logging every view in questionnaire-log.
 */
const nobody = () => false

export const Questionnaires: CollectionConfig = {
  slug: 'questionnaires',
  admin: { hidden: true, useAsTitle: 'bookingRef' },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody, admin: () => false },
  fields: [
    { name: 'bookingRef', type: 'text', required: true, index: true },
    { name: 'patientName', type: 'text' },
    { name: 'appointmentAt', type: 'date' },
    /** sha256 of the token in the private link (the token itself is only ever in the email) */
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'status', type: 'select', required: true, defaultValue: 'sent', options: ['sent', 'submitted', 'expired'] },
    { name: 'sentAt', type: 'date' },
    { name: 'sentCount', type: 'number', defaultValue: 1 },
    { name: 'submittedAt', type: 'date' },
    /** AES-256-GCM: JSON {v, iv, tag, data} of the answers plus a copy of the questions as asked */
    { name: 'sealed', type: 'textarea' },
    { name: 'reviewed', type: 'checkbox', defaultValue: false },
    { name: 'reviewedBy', type: 'text' },
    { name: 'reviewedAt', type: 'date' },
    /** 7 years after the appointment, or the patient's 25th birthday if they were under 18, whichever is later */
    { name: 'retainUntil', type: 'date' },
    // v1.9.0: which version of the form was answered, answers saved to finish later (encrypted the same way), and
    // test rows from Email check (deleted after 24 hours, never shown with real responses)
    { name: 'form', type: 'text' },
    { name: 'draft', type: 'textarea' },
    { name: 'draftSavedAt', type: 'date' },
    { name: 'test', type: 'checkbox', defaultValue: false, index: true },
    { name: 'testEmail', type: 'text' },
    // v1.10.0: the name or date of birth the patient entered is not the one on the booking (worked out on submit)
    { name: 'identityDiffers', type: 'checkbox', defaultValue: false },
  ],
}

/** Who opened, printed, reviewed or deleted a questionnaire, and when. Administrators can read it. */
export const QuestionnaireLog: CollectionConfig = {
  slug: 'questionnaire-log',
  admin: { hidden: true },
  access: { read: adminOnly, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'at', type: 'date', required: true, index: true },
    { name: 'userId', type: 'text' },
    { name: 'userEmail', type: 'text', required: true },
    { name: 'action', type: 'select', required: true, options: ['viewed', 'printed', 'reviewed', 'unreviewed', 'deleted', 'denied', 'resent'] },
    { name: 'bookingRef', type: 'text', index: true },
    { name: 'questionnaire', type: 'text' },
    { name: 'note', type: 'text' },
  ],
}
