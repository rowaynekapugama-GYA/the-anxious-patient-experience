/** v1.16.0: link checks shared by Site Settings (in the browser) and the build. No imports. */

/** v1.16.0: a Google Business Profile or Maps link, or '' (anything else is left out of the structured data). */
export function profileLink(v: unknown): string {
  const s = String(v || '').trim()
  return /^https:\/\/(maps\.app\.goo\.gl|g\.page|share\.google|goo\.gl|maps\.google\.com|www\.google\.com\/maps|www\.google\.com\.au\/maps|business\.google\.com|g\.co\/kgs)\//i.test(s) && !/[<>"'\s]/.test(s) ? s : ''
}

