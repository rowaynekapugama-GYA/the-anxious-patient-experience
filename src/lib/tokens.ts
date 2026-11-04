const TOKEN = /\{\{site:([a-zA-Z0-9]+)\}\}/g

/** Replace the {{site:...}} placeholders the content model stores. */
export function applyTokens(text: string, tokens: Record<string, string>): string {
  if (!text || text.indexOf('{{site:') < 0) return text
  return text.replace(TOKEN, (whole, key: string) => tokens[key] ?? whole)
}
