/**
 * v1.19.0: the wording a treatment plan, a plan template or a library paragraph must not use, checked before a plan is
 * finalised and before a template or paragraph is saved. This file names the words, so the build's wording check
 * (scripts/qa-banned.mjs) skips it, as it skips its own list.
 */
/** Words a plan must not use (AHPRA). The same list as the build's wording check (scripts/qa-banned.mjs). */
const BLOCKED: { re: RegExp; why: string }[] = [
  { re: /\bpain[\s-]?free\b/i, why: 'AHPRA: no pain-free claims' },
  { re: /\bpainless(ly)?\b/i, why: 'AHPRA: no painless claims' },
  { re: /\bguarantee[ds]?\b/i, why: 'AHPRA: no guarantees of an outcome' },
  { re: /\bbest\b/i, why: 'AHPRA: a comparative claim' },
  { re: /\bexperts?\b/i, why: 'AHPRA: implies specialist registration' },
]
const SEDATION = /\b(sedation|sedated|sedate|happy gas|nitrous|laughing gas|twilight)\b/i
const RISKS = /\brisks?\b/i
export type PhraseProblem = { where: string; found: string; why: string }

/**
 * The wording problems that stop a plan, template or paragraph being finalised or saved. `context` is the rest of the
 * plan (fixed wording, chosen options and everything typed), so a treatment row that just says "inhalation sedation" is
 * fine when the plan already has the line about talking through how it works and its risks.
 */
export function phraseProblems(texts: { where: string; text: string }[], context = ''): PhraseProblem[] {
  // the risks line can be anywhere on the plan (in the same paragraph, a chosen comfort option or the form's wording)
  const risksOnPlan = RISKS.test(context)
  const out: PhraseProblem[] = []
  for (const t of texts) {
    for (const b of BLOCKED) { const m = b.re.exec(t.text); if (m) out.push({ where: t.where, found: m[0], why: b.why }) }
    if (/\u2014/.test(t.text)) out.push({ where: t.where, found: 'a long dash', why: 'house style: use a comma or a full stop' })
    const sed = SEDATION.exec(t.text)
    if (sed && !RISKS.test(t.text) && !risksOnPlan) out.push({ where: t.where, found: sed[0], why: 'wording about sedation needs the line that we will talk through how it works and its risks beforehand' })
  }
  return out
}
export const phraseMessage = (p: PhraseProblem[]) =>
  `Please change the wording first: ${p.slice(0, 6).map((x) => `"${x.found}" in ${x.where} (${x.why})`).join('; ')}${p.length > 6 ? `, and ${p.length - 6} more` : ''}.`
