#!/usr/bin/env node
/**
 * Banned wording check for GYA sites.
 * Fails the build on em dashes and on AHPRA sensitive superlatives.
 * Known approved phrases live in scripts/qa-allow.json.
 */
import { readFileSync, existsSync } from 'node:fs'
import { globSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.css', '.html']
const SKIP = [
  'node_modules', '.next', '.git', 'public/images', 'public/fonts', 'migrations', 'media',
  // these two files exist to name the banned wording, so they cannot be scanned
  'scripts/qa-banned.mjs', 'scripts/qa-allow.json', 'src/sitekit/admin/AhpraNotice.tsx',
]

const RULES = [
  { id: 'em-dash', re: /\u2014/g, why: 'Em dash. Use a comma, colon, full stop or spaced hyphen.' },
  { id: 'pain-free', re: /\bpain[\s-]?free\b/gi, why: 'AHPRA: no pain-free claims.' },
  { id: 'painless', re: /\bpainless\b/gi, why: 'AHPRA: no painless claims.' },
  { id: 'guarantee', re: /\bguarantee[ds]?\b/gi, why: 'AHPRA: no guarantees of outcome.' },
  { id: 'best', re: /\bbest\b/gi, why: 'AHPRA: comparative claim. Check context.' },
  { id: 'expert', re: /\bexperts?\b/gi, why: 'AHPRA: implies specialist registration.' },
  { id: 'specialist', re: /\bspecialis[t]\b/gi, why: 'Only if registered as a specialist.' },
  { id: 'premier', re: /\bpremier\b/gi, why: 'AHPRA: superlative.' },
  { id: 'leading', re: /\bleading\b/gi, why: 'AHPRA: superlative.' },
  { id: 'number-one', re: /\b(#1|number one)\b/gi, why: 'AHPRA: superlative.' },
]

const allowPath = path.join(ROOT, 'scripts', 'qa-allow.json')
const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : []
/**
 * An allowed entry is { rule, contains, note }. A hit is allowed when the
 * wording around it contains that phrase. Every entry has been read and
 * judged by a person, and the note says why it is acceptable.
 */
const isAllowed = (ruleId, context) =>
  allow.some(
    (a) => a.rule === ruleId && context.toLowerCase().includes(String(a.contains).toLowerCase()),
  )

function walk(dir, out = []) {
  for (const entry of globSync('*', { cwd: dir, withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(ROOT, full)
    if (SKIP.some((s) => rel === s || rel.startsWith(s + path.sep))) continue
    if (entry.isDirectory()) walk(full, out)
    else if (EXTS.includes(path.extname(entry.name))) out.push(full)
  }
  return out
}

let hard = 0
let soft = 0
let okayed = 0
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8')
  for (const rule of RULES) {
    rule.re.lastIndex = 0
    let m
    while ((m = rule.re.exec(text))) {
      const line = text.slice(0, m.index).split('\n').length
      const ctx = text.slice(Math.max(0, m.index - 45), m.index + 45).replace(/\s+/g, ' ')
      if (isAllowed(rule.id, ctx)) {
        okayed++
        continue
      }
      const rel = path.relative(ROOT, file)
      if (rule.id === 'em-dash') {
        hard++
        console.log(`FAIL  ${rel}:${line}  ${rule.why}`)
      } else {
        soft++
        console.log(`CHECK ${rel}:${line}  [${rule.id}] ...${ctx}...`)
      }
    }
  }
}

console.log(`\nem dashes: ${hard}   phrases to review: ${soft}   already reviewed and allowed: ${okayed}`)
process.exit(hard > 0 ? 1 : 0)
