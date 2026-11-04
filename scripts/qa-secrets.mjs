#!/usr/bin/env node
/**
 * Looks for anything that should never be committed: keys, tokens, passwords
 * and database addresses. Fails the build if it finds one.
 */
import { readFileSync, existsSync } from 'node:fs'
import { globSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SKIP = ['node_modules', '.next', '.git', 'public/images', 'public/fonts', 'media', 'migrations', 'scripts/qa-secrets.mjs']
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.css', '.html', '.yml', '.yaml', '.env']

const RULES = [
  { id: 'postgres-url', re: /postgres(?:ql)?:\/\/[^\s"'<>]{8,}/gi },
  { id: 'smtp2go-key', re: /api-[A-F0-9]{28,}/g },
  { id: 'vercel-blob-token', re: /vercel_blob_rw_[A-Za-z0-9_]{20,}/g },
  { id: 'aws-key', re: /AKIA[0-9A-Z]{16}/g },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: 'bearer-token', re: /(?:bearer|authorization)\s*[:=]\s*["']?[A-Za-z0-9._-]{24,}/gi },
  { id: 'deploy-hook', re: /api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_\/]+/g },
  { id: 'generic-secret', re: /(?:secret|password|passwd|api[_-]?key)\s*[:=]\s*["'][^"'\n]{12,}["']/gi },
]

function walk(dir, out = []) {
  for (const entry of globSync(['*', '.*'], { cwd: dir, withFileTypes: true })) {
    if (entry.name === '.' || entry.name === '..') continue
    const full = path.join(dir, entry.name)
    const rel = path.relative(ROOT, full)
    if (SKIP.some((s) => rel === s || rel.startsWith(s + path.sep))) continue
    // .env files hold real values on purpose and are kept out of git; what
    // matters is that .gitignore covers them
    if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
      envFiles.push(rel)
      continue
    }
    if (entry.isDirectory()) walk(full, out)
    else if (EXTS.includes(path.extname(entry.name))) out.push(full)
  }
  return out
}

const envFiles = []
let found = 0
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8')
  for (const rule of RULES) {
    rule.re.lastIndex = 0
    let m
    while ((m = rule.re.exec(text))) {
      const line = text.slice(0, m.index).split('\n').length
      found++
      console.log(`FOUND ${path.relative(ROOT, file)}:${line}  [${rule.id}]  ${m[0].slice(0, 60)}`)
    }
  }
}

const ignore = existsSync(path.join(ROOT, '.gitignore'))
  ? readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim())
  : []
for (const file of envFiles) {
  const covered = ignore.includes(file) || ignore.includes('.env') || ignore.includes('.env*')
  if (!covered) {
    found++
    console.log(`FOUND ${file}  [env file is not in .gitignore]`)
  } else {
    console.log(`note  ${file} holds real values and is kept out of git`)
  }
}

console.log(found === 0 ? '\nno secrets found' : `\n${found} possible secrets found`)
process.exit(found > 0 ? 1 : 0)
