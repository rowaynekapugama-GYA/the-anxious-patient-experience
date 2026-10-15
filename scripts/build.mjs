#!/usr/bin/env node
/* ==========================================================================
   Build and check for The Anxious Patient Experience™ website (plain HTML, no dependencies).

   1. Reads assets/site-config.js and writes the contact details, footer disclaimer and clinic details into every
      page (between the <!-- config:... --> markers), so a change in that one file reaches the whole site.
   2. Checks the site: every internal link and #anchor points at something real, every image and file exists,
      the structured data is valid, the FAQ counter matches the number of questions, and there are no em dashes.
   3. Copies the finished site into public/, which is the folder Vercel publishes. Build tools, notes and
      settings for developers (scripts/, package.json, README.md and so on) are left out of it.

   Run with: npm run build   (exits with an error message if anything is wrong)
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.next', 'scripts', 'public']);
const OUT_DIR = 'public';
// files at the top of the repo that are for developers, not for visitors
const NOT_PUBLISHED = new Set(['package.json', 'package-lock.json', 'vercel.json', 'README.md', 'CHANGELOG.md', '.gitignore']);
const problems = [];
const problem = (file, msg) => problems.push(`${file}: ${msg}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const rel = (f) => relative(ROOT, f).split(sep).join('/');

/* ---------- 1. Settings into every page ---------- */
const configFile = join(ROOT, 'assets', 'site-config.js');
const sandbox = { window: {} };
try {
  vm.runInNewContext(readFileSync(configFile, 'utf8'), sandbox, { filename: 'assets/site-config.js' });
} catch (err) {
  console.error(`\nBuild stopped: assets/site-config.js has a mistake in it.\n${err.message}\n`);
  process.exit(1);
}
const C = sandbox.window.APE_CONFIG;
if (!C || !C.contact || !C.disclaimer || !C.clinic || !C.booking) {
  console.error('\nBuild stopped: assets/site-config.js must set window.APE_CONFIG with contact, disclaimer, clinic and booking.\n');
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const placeholder = (label) => `<mark class="placeholder" title="Placeholder: waiting on the client">[${label}]</mark>`;

const contact = C.contact;
const REGIONS = {
  contact: [
    `<li>${contact.phone ? `<a href="tel:${esc(String(contact.phone).replace(/[^\d+]/g, ''))}">${esc(contact.phone)}</a>` : placeholder('Phone')}</li>`,
    `<li>${contact.email ? `<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : placeholder('Email')}</li>`,
    `<li>${contact.address ? esc(contact.address) : placeholder('Practice address')}</li>`,
  ].join(''),
  disclaimer:
    `<p class="disclaimer">${esc(C.disclaimer.general)}</p>` +
    (C.SHOW_INVASIVE_RISK_DISCLAIMER ? `<p class="disclaimer disclaimer-risk">${esc(C.disclaimer.invasiveRisk)}</p>` : ''),
  clinic: `<span class="clinic-name">${esc(C.clinic.name)}</span> <span class="clinic-address">${esc(C.clinic.street)}, ${esc(C.clinic.suburb)}</span>`,
};

const files = walk(ROOT);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
let changed = 0;
for (const file of htmlFiles) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/<!-- config:(\w+) -->[\s\S]*?<!-- \/config:\1 -->/g, (m, key) => {
    if (!(key in REGIONS)) { problem(rel(file), `unknown settings marker "config:${key}"`); return m; }
    return `<!-- config:${key} -->${REGIONS[key]}<!-- /config:${key} -->`;
  });
  if (after !== before) { writeFileSync(file, after); changed++; }
}

/* ---------- 2. Checks ---------- */
const pages = new Map(); // site path -> { file, html, ids }
for (const file of htmlFiles) {
  const r = rel(file);
  const path = r === 'index.html' ? '/' : r.endsWith('/index.html') ? `/${r.slice(0, -'index.html'.length)}` : `/${r}`;
  const html = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, ''); // comments are notes, not content
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  pages.set(path, { file: r, html, ids });
}
const pageFor = (p) => pages.get(p) || pages.get(p.endsWith('/') ? p : `${p}/`) || pages.get(p.replace(/\/$/, '.html'));

for (const [path, { file, html, ids }] of pages) {
  const isRedirect = /http-equiv="refresh"/.test(html);
  // links and files
  for (const m of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    const url = m[2];
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(url)) continue;
    if (url.startsWith('#')) {
      const id = url.slice(1);
      if (id && id !== 'top' && !ids.has(id)) problem(file, `link to #${id} but there is no element with that id`);
      continue;
    }
    const [pathPart, hash] = url.split('#');
    const clean = pathPart.split('?')[0];
    if (!clean.startsWith('/')) { problem(file, `relative link "${url}" (use a link starting with /)`); continue; }
    const target = pageFor(clean);
    if (target) {
      if (hash && hash !== 'top' && !target.ids.has(hash)) problem(file, `link to ${clean}#${hash} but that section does not exist`);
    } else if (!existsSync(join(ROOT, clean))) {
      problem(file, `"${url}" points at a file or page that does not exist`);
    }
  }
  if (isRedirect) continue;
  // structured data
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { problem(file, 'structured data (ld+json) is not valid JSON'); }
  }
  // FAQ counter and schema match the cards
  const cards = (html.match(/class="faq-card"/g) || []).length;
  if (cards) {
    const total = (html.match(/<\/span> \/ (\d+)<\/span>/) || [])[1];
    if (Number(total) !== cards) problem(file, `FAQ counter says ${total} but there are ${cards} questions`);
    const schema = (html.match(/"@type":"Question"/g) || []).length;
    if (schema !== cards) problem(file, `FAQ schema has ${schema} questions but the page has ${cards}`);
  }
  // settings markers present on every full page
  const raw = readFileSync(join(ROOT, file), 'utf8');
  if (!raw.includes('<!-- config:contact -->')) problem(file, 'footer contact settings marker missing');
  if (!raw.includes('<!-- config:disclaimer -->')) problem(file, 'footer disclaimer settings marker missing');
}

// no em dashes in anything we publish
for (const file of files.filter((f) => /\.(html|css|js|mjs|md|json|xml|txt)$/.test(f))) {
  if (readFileSync(file, 'utf8').includes('\u2014')) problem(rel(file), 'contains an em dash');
}

if (problems.length) {
  console.error(`\nBuild failed. ${problems.length} problem(s) to fix:\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}
/* ---------- 3. The finished site into public/ (what Vercel publishes) ---------- */
const out = join(ROOT, OUT_DIR);
rmSync(out, { recursive: true, force: true });
let copied = 0;
for (const file of walk(ROOT)) {
  const r = rel(file);
  const name = r.split('/').pop();
  if (NOT_PUBLISHED.has(r) || name === '.DS_Store' || name.startsWith('.env')) continue;
  const target = join(out, r);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
  copied++;
}
if (!existsSync(join(out, 'index.html'))) {
  console.error(`\nBuild failed: ${OUT_DIR}/index.html was not created.\n`);
  process.exit(1);
}
console.log(`Build complete: settings applied (${changed} page(s) updated), ${pages.size} pages checked, no problems found. ${copied} files ready in ${OUT_DIR}/.`);
