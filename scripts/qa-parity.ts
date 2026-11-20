/**
 * Proves the content model gives back the approved pages: renders content/ with the v1.4.0 settings and
 * compares every page with the v1.4.0 build (tools/v140/), byte for byte. The only differences allowed are
 * the <!-- config:... --> markers the old build wrote around the settings it filled in, and the changes
 * approved since (APPROVED below): Lauren's photo (v1.6.0), and the privacy policy (v1.6.0, a new page, so it is
 * checked by qa:site and qa:editor instead).
 *
 *   npm run qa:parity
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const ref = path.join(root, 'tools', 'v140')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ape-parity-'))
const env = { ...process.env, NEXT_PUBLIC_SERVER_URL: 'https://example.com', APE_ASSET_VERSION: '1.4.0', CONTENT_POSTS: '' }
execFileSync('npx', ['tsx', 'scripts/render-site.ts', tmp], { env, stdio: 'inherit' })

const strip = (s: string) => s.replace(/<!-- \/?config:\w+ -->/g, '')

/** Changes approved since v1.4.0: [file, the v1.4.0 markup, what replaced it]. */
const APPROVED: [string, RegExp, string][] = [
  ['index.html',
    /<!-- LAUREN'S PHOTO:.*?--><img src="\/images\/team-lauren-bright\.jpg" width="1200" height="1500" (alt="[^"]*") loading="lazy" decoding="async" style="object-position:50% 25%"\/>/,
    '<picture><source type="image/webp" srcset="/images/team-lauren-bright-2026-11-09-800.webp 800w, /images/team-lauren-bright-2026-11-09.webp 1086w" sizes="(max-width: 900px) 92vw, 30vw"/><img src="/images/team-lauren-bright-2026-11-09.jpg" width="1086" height="1448" $1 loading="lazy" decoding="async" style="object-position:45% 22%"/></picture>'],
  // v1.13.0: the hands photo (Lorna: it shows six fingers) is replaced by her napkin photo from Book Now
  ['index.html', /ape-hands-comfort/g, 'ape-textured-napkin'],
  ['index.html', /One hand resting gently on another over a soft white blanket/g, 'A textured cream napkin with a small tooth outline, resting on soft draped fabric'],
]
const SKIP = new Set(['privacy-policy/index.html'])
let bad = 0
for (const f of ['index.html', 'book-now/index.html', 'privacy-policy/index.html', '404.html']) {
  if (SKIP.has(f)) { console.log(`skipped: ${f} (rewritten since v1.4.0)`); continue }
  let want = strip(fs.readFileSync(path.join(ref, f), 'utf8'))
  for (const [file, from, to] of APPROVED) {
    if (file !== f) continue
    if (!from.test(want)) { console.log(`DIFFERENT: ${f}: the approved change no longer matches v1.4.0`); bad++ }
    want = want.replace(from, to)
  }
  const got = fs.readFileSync(path.join(tmp, f), 'utf8')
  if (want === got) { console.log(`same: ${f}`); continue }
  bad++
  let i = 0
  while (i < want.length && want[i] === got[i]) i++
  console.log(`DIFFERENT: ${f} at ${i}\n  want: ${JSON.stringify(want.slice(Math.max(0, i - 80), i + 160))}\n  got:  ${JSON.stringify(got.slice(Math.max(0, i - 80), i + 160))}`)
}
fs.rmSync(tmp, { recursive: true, force: true })
if (bad) { console.error(`\nqa:parity: ${bad} page(s) differ from v1.4.0`); process.exit(1) }
console.log('\nqa:parity: every page matches v1.4.0 plus the approved changes')
