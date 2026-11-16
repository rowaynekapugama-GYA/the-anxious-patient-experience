/**
 * Lorna's Pre-appointment Questionnaire (v1.9.0), word for word from her PDF of 15 November 2026, laid out for a
 * screen. The wording lives here in code (not in the dashboard) so it can only change on purpose, with a new FORM_ID,
 * and every saved questionnaire keeps the id of the version it was answered on.
 *
 * Changes made for the screen, listed for Lorna in the v1.9.0 report:
 *   - numbered 01 to 11 in page order: PDF 10 is 09 here, PDF 11 is 10, and PDF 09 ("anything else") is last as 11
 *   - "Circle the number" reads "Choose the number"
 *   - "Other ___" is a tick box that opens a text box
 *   - each "If Yes" / "If yes" box appears once Yes is chosen
 *   - nothing is required, and question 07 is marked Optional
 *
 * Answers are a flat object keyed by the ids below. Nothing in this file touches the database or email.
 */

export const FORM_ID = 'ape-2026-11'

export type Field = {
  id: string
  /** what the patient sees beside the control (for one-field questions it is read out with the question) */
  label: string
  type: 'scale' | 'multi' | 'yesno' | 'choice' | 'text'
  options?: string[]
  /** tick boxes shown in named groups (question 03) */
  groups?: { heading: string; options: string[] }[]
  /** a tick box that opens a text box when ticked */
  other?: { option: string; id: string; label: string }
  /** a text box shown once Yes is chosen */
  follow?: { id: string; label: string }
  low?: string
  high?: string
  rows?: number
  /** the label is a question of its own, shown above the control (otherwise the card's title labels it) */
  ask?: boolean
}
export type Block = { kind: 'field'; field: Field } | { kind: 'note' | 'shaded' | 'sub'; text: string }
export type Question = { num: string; id: string; title: string; helper?: string; optional?: boolean; blocks: Block[] }

export const FORM = {
  brand: 'The Anxious Patient Experience™',
  strap: 'An Anxiety Support Pathway for Dental Patients',
  title: 'Pre-appointment Questionnaire',
  introHeading: 'Getting to Know You',
  intro: [
    'If you’re feeling nervous about your appointment, you’re not alone. Many patients experience anxiety around dental visits, and it can show up in different ways - worry, tension, overwhelm, or even feeling emotional when you arrive.',
    'Some people also feel embarrassed about their teeth or about avoiding the dentist, but this is something you never need to feel here. Everything you’re experiencing is valid, and you will always be met with understanding and without judgement.',
    'This short form helps me get to know you and tailor your appointment so you can feel calm, supported, and in control.',
  ],
  confidential: 'Your answers are confidential and help us create a calmer experience for you.',
  thanksHeading: 'Thank you',
  thanks: [
    'For taking the time to share this information with me. I’ll use it to tailor your appointment so you can feel as calm and in control as possible.',
    'Remember - there’s no pressure to answer everything. We can talk through anything together at your appointment.',
  ],
}

const f = (field: Field): Block => ({ kind: 'field', field })
const YES_NO = ['Yes', 'No']

export const QUESTIONS: Question[] = [
  {
    num: '01', id: 'q01',
    title: 'On a scale of 1-10, how anxious do you feel about visiting the dentist?',
    helper: 'Choose the number that best describes how you feel right now',
    blocks: [f({ id: 'q01', label: 'How anxious you feel, 1 to 10', type: 'scale', low: 'Not Anxious', high: 'Extremely Anxious' })],
  },
  {
    num: '02', id: 'q02',
    title: 'What makes you feel most anxious about visiting the dentist?',
    helper: 'Tick all that apply - there are no wrong answers',
    blocks: [
      f({
        id: 'q02', label: 'What makes you feel most anxious', type: 'multi',
        options: ['Feeling out of control', 'Previous bad experience', 'Fear of being in pain', 'Not knowing what\'s happening', 'Feeling embarrassed about my teeth', 'Other'],
        other: { option: 'Other', id: 'q02_other', label: 'Other (tell us in your own words)' },
      }),
      { kind: 'note', text: 'If you\'re unsure, that\'s completely fine - we can explore this together' },
    ],
  },
  {
    num: '03', id: 'q03',
    title: 'How would you like your appointment to feel?',
    helper: 'Tick the options that appeal to you - you can change these at any time. If none of these apply to you, feel free to leave them blank',
    blocks: [
      f({
        id: 'q03', label: 'How you would like your appointment to feel', type: 'multi',
        groups: [
          { heading: 'Information style', options: ['Tell me everything - I want to know each step', 'Simple overview, then guided quietly'] },
          { heading: 'In-room experience', options: ['I\'d like music or headphones during treatment', 'I\'d prefer quiet with minimal conversation'] },
          { heading: 'Control', options: ['I\'d like regular check-ins during treatment', 'I\'d like a stop signal I can use at any time', 'I\'d like breaks built in to longer appointments'] },
        ],
      }),
      { kind: 'note', text: 'You can change any of these preferences at any time - just let us know' },
      { kind: 'shaded', text: 'Remember: these are just starting points. We\'ll check in with you regularly and adjust as we go. Your comfort always comes first.' },
    ],
  },
  {
    num: '04', id: 'q04',
    title: 'What helps you to feel calm, safe or at ease?',
    helper: 'This can be anything - we\'ll use this to personalise your experience',
    blocks: [
      f({ id: 'q04', label: 'I feel most calm when:', type: 'text', rows: 4 }),
      { kind: 'shaded', text: 'Sometimes things that make people feel calm or safe include: a relaxing environment, clear communication, gentle physical reassurance (e.g. hand on shoulder). If you are unsure that\'s ok, we will figure that out together.' },
      { kind: 'sub', text: 'Let\'s personalise your experience further' },
      f({ id: 'q04_music', label: 'Tell us some music you enjoy - songs/artists/genres', type: 'text', rows: 2 }),
      f({ id: 'q04_tv', label: 'Do you have any favourite TV shows/podcasts?', type: 'text', rows: 2 }),
    ],
  },
  {
    num: '05', id: 'q05',
    title: 'Tell us about your dental treatment history',
    blocks: [
      f({ id: 'q05', label: 'Have you had any dental treatment carried out in the past successfully?', type: 'yesno', ask: true, options: YES_NO, follow: { id: 'q05_more', label: 'If Yes - have you ever needed sedation or general anaesthetic to facilitate treatment?' } }),
      { kind: 'shaded', text: 'Don\'t worry if you can\'t remember details - any information helps us understand your experience better.' },
    ],
  },
  {
    num: '06', id: 'q06',
    title: 'Have you ever tried any of the following?',
    helper: 'Tick any that you\'ve used before - even outside of dental settings',
    blocks: [f({ id: 'q06', label: 'What you have tried before', type: 'multi', options: ['Breathwork', 'Meditation', 'Relaxation techniques', 'Hypnotherapy', 'CBT or talking therapy'] })],
  },
  {
    num: '07', id: 'q07', optional: true,
    title: 'Outside of dental anxiety, do you ever experience anxiety in other aspects of life?',
    helper: 'Please only answer this question if you feel comfortable to',
    blocks: [f({ id: 'q07', label: 'Anxiety in other aspects of life', type: 'yesno', options: YES_NO, follow: { id: 'q07_more', label: 'If yes, what helps you manage it?' } })],
  },
  {
    num: '08', id: 'q08',
    title: 'Have you ever had a positive dental experience?',
    helper: 'Even a small one counts - it helps us understand what works for you',
    blocks: [f({ id: 'q08', label: 'A positive dental experience', type: 'yesno', options: YES_NO, follow: { id: 'q08_more', label: 'If yes, what made it feel better?' } })],
  },
  {
    num: '09', id: 'q09',
    title: 'Approximately how long has it been since your last dental visit?',
    blocks: [f({ id: 'q09', label: 'Time since your last dental visit', type: 'choice', options: ['Less than 1 year', '1–2 years', '3–5 years', 'More than 5 years'] })],
  },
  {
    num: '10', id: 'q10',
    title: 'Has dental anxiety ever caused you to delay, cancel or avoid dental care?',
    blocks: [f({ id: 'q10', label: 'Delayed, cancelled or avoided care', type: 'choice', options: ['Yes', 'No', 'Unsure'] })],
  },
  {
    num: '11', id: 'q11',
    title: 'Is there anything else you\'d like me to know to help you feel more comfortable?',
    blocks: [f({ id: 'q11', label: 'Anything else you would like us to know', type: 'text', rows: 5 })],
  },
]

/** Where each online question was in Lorna's PDF (for the report and the printed view). */
export const PDF_NUMBER: Record<string, string> = { q01: '01', q02: '02', q03: '03', q04: '04', q05: '05', q06: '06', q07: '07', q08: '08', q09: '10', q10: '11', q11: '09' }

export type Answers = Record<string, string | string[]>

export const fields = (): Field[] => QUESTIONS.flatMap((q) => q.blocks.flatMap((b) => (b.kind === 'field' ? [b.field] : [])))
export const optionsOf = (fl: Field): string[] => fl.options ?? (fl.groups ?? []).flatMap((g) => g.options)

const MAX_TEXT = 4000
const clean = (v: unknown, max = MAX_TEXT) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)

/**
 * Keep only real answers to real questions: unknown keys dropped, choices that are not on the form dropped,
 * a follow-up box kept only when Yes is chosen, the Other box only when Other is ticked. Nothing is required.
 */
export function cleanAnswers(raw: unknown): Answers {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Answers = {}
  for (const fl of fields()) {
    const v = a[fl.id]
    if (fl.type === 'multi') {
      const opts = optionsOf(fl)
      const list = (Array.isArray(v) ? v : []).map((x) => clean(x, 200)).filter((x) => opts.includes(x))
      const unique = opts.filter((o) => list.includes(o))
      if (unique.length) out[fl.id] = unique
      if (fl.other) {
        const t = clean(a[fl.other.id], 500)
        if (t && unique.includes(fl.other.option)) out[fl.other.id] = t
      }
      continue
    }
    if (fl.type === 'scale') {
      const n = Number(v)
      if (Number.isInteger(n) && n >= 1 && n <= 10) out[fl.id] = String(n)
      continue
    }
    if (fl.type === 'yesno' || fl.type === 'choice') {
      const s = clean(v, 100)
      if (optionsOf(fl).includes(s)) out[fl.id] = s
      if (fl.follow && s === 'Yes') {
        const t = clean(a[fl.follow.id])
        if (t) out[fl.follow.id] = t
      }
      continue
    }
    const t = clean(v)
    if (t) out[fl.id] = t
  }
  return out
}

/** Problems with what was sent (anything that cleanAnswers would have to throw away), empty when fine. */
export function problems(raw: unknown): Record<string, string> {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const fl of fields()) {
    const v = a[fl.id]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    if (fl.type === 'multi') { if (!Array.isArray(v) || v.some((x) => !optionsOf(fl).includes(String(x)))) out[fl.id] = 'Please choose from the options.' }
    else if (fl.type === 'scale') { const n = Number(v); if (!(Number.isInteger(n) && n >= 1 && n <= 10)) out[fl.id] = 'Please choose a number from 1 to 10.' }
    else if (fl.type === 'yesno' || fl.type === 'choice') { if (!optionsOf(fl).includes(String(v))) out[fl.id] = 'Please choose one of the options.' }
    else if (String(v).length > MAX_TEXT) out[fl.id] = 'That answer is a little long. Please shorten it, or tell us the rest at your appointment.'
  }
  return out
}

export const answeredCount = (a: Answers) => QUESTIONS.filter((q) => q.blocks.some((b) => b.kind === 'field' && a[b.field.id] !== undefined)).length

/** The "At a glance" strip in the dashboard: the score, what makes them anxious, and question 03 by group. */
export function glance(a: Answers): { score: number | null; anxious: string[]; prefs: { heading: string; picked: string[] }[] } {
  const anxious = ((a.q02 as string[] | undefined) ?? []).map((x) => (x === 'Other' && a.q02_other ? `Other: ${a.q02_other}` : x))
  const q03 = fields().find((x) => x.id === 'q03')!
  const picked = (a.q03 as string[] | undefined) ?? []
  return {
    score: a.q01 ? Number(a.q01) : null,
    anxious,
    prefs: (q03.groups ?? []).map((g) => ({ heading: g.heading, picked: g.options.filter((o) => picked.includes(o)) })),
  }
}

/** Every question with the patient's answers, in form order, for the dashboard and the printed copy. */
export function answerRows(a: Answers): { num: string; title: string; optional: boolean; items: { label: string; value: string | string[] | null; group?: string }[] }[] {
  return QUESTIONS.map((q) => {
    const items: { label: string; value: string | string[] | null; group?: string }[] = []
    const fieldsHere = q.blocks.flatMap((b) => (b.kind === 'field' ? [b.field] : []))
    for (const fl of fieldsHere) {
      const own = fieldsHere.length > 1 || fl.ask ? fl.label : ''
      if (fl.groups) {
        const picked = (a[fl.id] as string[] | undefined) ?? []
        for (const g of fl.groups) items.push({ label: g.heading, group: g.heading, value: g.options.filter((o) => picked.includes(o)) })
      } else {
        let v = a[fl.id] ?? null
        if (fl.type === 'scale' && v) v = `${v} out of 10`
        if (fl.other && Array.isArray(v)) v = v.map((x) => (x === fl.other!.option && a[fl.other!.id] ? `${x}: ${a[fl.other!.id]}` : x))
        items.push({ label: own, value: v })
      }
      if (fl.follow && a[fl.id] === 'Yes') items.push({ label: fl.follow.label, value: a[fl.follow.id] ?? null })
    }
    return { num: q.num, title: q.title, optional: !!q.optional, items }
  })
}
