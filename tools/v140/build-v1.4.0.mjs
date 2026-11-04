#!/usr/bin/env node
/* ==========================================================================
   Build and check for The Anxious Patient Experience™ website (plain HTML, no dependencies).

   1. Reads assets/site-config.js and writes the contact details, footer disclaimer, clinic details, phone number and
      Dentist structured data into every page (between the <!-- config:... --> markers), so a change in that one file
      reaches the whole site.
   2. Checks the site: every internal link and #anchor points at something real, every image and file exists,
      the structured data is valid, the FAQ counter matches the number of questions, and there are no em dashes.
   3. Copies the finished site into public/, which is the folder Vercel publishes. Build tools, notes and
      settings for developers (scripts/, api/, package.json, README.md and so on) are left out of it. The booking
      email function in api/ is deployed by Vercel separately, as a serverless function.

   Run with: npm run build   (exits with an error message if anything is wrong)
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.next', 'scripts', 'public']);
const OUT_DIR = 'public';
// api/ holds the booking email function: checked for em dashes, never copied into public/
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
const clinic = C.clinic;
// (02) 8599 9815 -> +61285999815
const telOf = (phone) => {
  const d = String(phone).replace(/[^\d+]/g, '');
  return d.startsWith('+') ? d : d.startsWith('0') ? `+61${d.slice(1)}` : d;
};
const phoneLink = contact.phone ? `<a href="tel:${esc(telOf(contact.phone))}">${esc(contact.phone)}</a>` : placeholder('Phone');
const mailLink = (addr, label) => (addr ? `<a href="mailto:${esc(addr)}">${esc(addr)}</a>` : placeholder(label));
const address = `${clinic.street}, ${clinic.suburb}`;
const addressLink = clinic.mapsUrl
  ? `<a href="${esc(clinic.mapsUrl)}" target="_blank" rel="noopener">${esc(address)}<span class="sr-only"> (opens Google Maps)</span></a>`
  : esc(address);
const addrParts = String(clinic.suburb).match(/^(.*?)\s+([A-Z]{2,3})\s+(\d{4})$/) || [null, clinic.suburb, '', ''];
const postal = { '@type': 'PostalAddress', streetAddress: clinic.street, addressLocality: addrParts[1], addressRegion: addrParts[2], postalCode: addrParts[3], addressCountry: 'AU' };
const intlPhone = contact.phone ? telOf(contact.phone).replace(/^\+61(\d)(\d{4})(\d{4})$/, '+61 $1 $2 $3') : undefined;
const schema = {
  '@context': 'https://schema.org',
  '@type': 'Dentist',
  name: clinic.name,
  address: postal,
  telephone: intlPhone,
  email: contact.receptionEmail || undefined,
  hasMap: clinic.mapsUrl || undefined,
  department: {
    '@type': 'Dentist',
    name: 'The Anxious Patient Experience™',
    description: 'A nervous-system-aware approach to dental care.',
    address: postal,
    telephone: intlPhone,
    email: contact.apeEmail || undefined,
  },
};
// GA4 and Meta Pixel, only when their IDs are filled in (assets/site-config.js > analytics)
function analyticsTags(a) {
  const ga = String(a.ga4Id || '').trim();
  const px = String(a.metaPixelId || '').trim();
  let out = '';
  if (ga) {
    if (!/^G-[A-Z0-9]+$/.test(ga)) problem('assets/site-config.js', `analytics.ga4Id "${ga}" does not look like a GA4 ID (G-XXXXXXX)`);
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(ga)}"></script>` +
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(ga)}');</script>`;
  }
  if (px) {
    if (!/^\d{6,20}$/.test(px)) problem('assets/site-config.js', `analytics.metaPixelId "${px}" should be digits only`);
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(px)}');fbq('track','PageView');</script>`;
  }
  return out;
}
const REGIONS = {
  contact: [
    `<li class="contact-name">${esc(clinic.name)}</li>`,
    `<li>${addressLink}</li>`,
    `<li>${phoneLink}</li>`,
    `<li class="contact-email"><span class="contact-label">APE enquiries</span>${mailLink(contact.apeEmail, 'APE email')}</li>`,
    `<li class="contact-email"><span class="contact-label">General practice enquiries</span>${mailLink(contact.receptionEmail, 'Reception email')}</li>`,
  ].join(''),
  phone: phoneLink,
  schema: `<script type="application/ld+json">${JSON.stringify(schema)}</script>`,
  analytics: analyticsTags(C.analytics || {}),
  disclaimer:
    `<p class="disclaimer">${esc(C.disclaimer.general)}</p>` +
    (C.SHOW_INVASIVE_RISK_DISCLAIMER ? `<p class="disclaimer disclaimer-risk">${esc(C.disclaimer.invasiveRisk)}</p>` : ''),
  clinic: `<span class="clinic-name">${esc(clinic.name)}</span> <span class="clinic-address">${addressLink}</span>`,
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
  const isDashboard = path.startsWith('/admin/');  // the APE dashboard has no public header, footer or schema
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
  // every file in a srcset exists
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url.startsWith('/') && !existsSync(join(ROOT, url.split('?')[0]))) problem(file, `srcset file "${url}" does not exist`);
    }
  }
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
  if (isDashboard) continue;
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
  if (NOT_PUBLISHED.has(r) || r.startsWith('api/') || r.startsWith('qr/') || r.startsWith('docs/') || name === '.DS_Store' || name.startsWith('.env')) continue;
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
