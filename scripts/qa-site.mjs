#!/usr/bin/env node
/**
 * Checks the public pages the build has just written into public/ (the v1.4.0 build's checks, kept):
 * every internal link and #anchor points at something real, every image and file exists, the structured data
 * is valid JSON, the FAQ counter and FAQ structured data match the number of questions, the footer contact
 * details are there, and nothing published contains an em dash. Exits with a list of problems if anything is wrong.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const PUB = join(ROOT, 'public')
const problems = []
const problem = (file, msg) => problems.push(`${file}: ${msg}`)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}
const rel = (f) => relative(PUB, f).split(sep).join('/')
const files = walk(PUB)
const pages = new Map()
for (const file of files.filter((f) => f.endsWith('.html'))) {
  const r = rel(file)
  const path = r === 'index.html' ? '/' : r.endsWith('/index.html') ? `/${r.slice(0, -'index.html'.length)}` : `/${r}`
  const html = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  pages.set(path, { file: r, html, ids: new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])) })
}
const pageFor = (p) => pages.get(p) || pages.get(p.endsWith('/') ? p : `${p}/`) || pages.get(p.replace(/\/$/, '.html'))

for (const [, { file, html, ids }] of pages) {
  const isRedirect = /http-equiv="refresh"/.test(html)
  for (const m of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    const url = m[2].replace(/&amp;/g, '&')
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(url)) continue
    if (url.startsWith('#')) {
      const id = url.slice(1)
      if (id && id !== 'top' && !ids.has(id)) problem(file, `link to #${id} but there is no element with that id`)
      continue
    }
    const [pathPart, hash] = url.split('#')
    const clean = pathPart.split('?')[0]
    if (!clean.startsWith('/')) { problem(file, `relative link "${url}" (use a link starting with /)`); continue }
    if (/^\/(api|admin)\//.test(clean)) continue
    const target = pageFor(clean)
    if (target) {
      if (hash && hash !== 'top' && !target.ids.has(hash)) problem(file, `link to ${clean}#${hash} but that section does not exist`)
    } else if (!existsSync(join(PUB, clean)) && !/^\/api\/media\//.test(clean) && !/^https?:/.test(clean)) {
      problem(file, `"${url}" points at a file or page that does not exist`)
    }
  }
  if (isRedirect) continue
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0]
      if (url.startsWith('/') && !url.startsWith('/api/media/') && !existsSync(join(PUB, url.split('?')[0]))) problem(file, `srcset file "${url}" does not exist`)
    }
  }
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]) } catch { problem(file, 'structured data (ld+json) is not valid JSON') }
  }
  const cards = (html.match(/class="faq-card"/g) || []).length
  if (cards) {
    const total = (html.match(/<\/span> \/ (\d+)<\/span>/) || [])[1]
    if (total && Number(total) !== cards) problem(file, `FAQ counter says ${total} but there are ${cards} questions`)
    const schema = (html.match(/"@type":"Question"/g) || []).length
    if (schema !== cards) problem(file, `FAQ structured data has ${schema} questions but the page has ${cards}`)
  }
  if (!html.includes('<ul class="contact">')) problem(file, 'footer contact details missing')
  if (/\{\{(site|seo|gen|f\d+)/.test(html)) problem(file, 'a {{...}} placeholder was not filled in')
}
for (const file of files.filter((f) => /\.(html|css|js|xml|txt)$/.test(f))) {
  if (readFileSync(file, 'utf8').includes('\u2014')) problem(rel(file), 'contains an em dash')
}
if (problems.length) {
  console.error(`\nqa:site: ${problems.length} problem(s) to fix:\n`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`qa:site: ${pages.size} pages checked, no problems found`)
