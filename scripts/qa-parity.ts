/**
 * Proves the content model gives back the approved pages: renders content/ with the v1.4.0 settings and
 * compares every page with the v1.4.0 build (tools/v140/), byte for byte. The only difference allowed is
 * the <!-- config:... --> markers the old build wrote around the settings it filled in.
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
let bad = 0
for (const f of ['index.html', 'book-now/index.html', 'privacy-policy/index.html', '404.html']) {
  const want = strip(fs.readFileSync(path.join(ref, f), 'utf8'))
  const got = fs.readFileSync(path.join(tmp, f), 'utf8')
  if (want === got) { console.log(`same: ${f}`); continue }
  bad++
  let i = 0
  while (i < want.length && want[i] === got[i]) i++
  console.log(`DIFFERENT: ${f} at ${i}\n  want: ${JSON.stringify(want.slice(Math.max(0, i - 80), i + 160))}\n  got:  ${JSON.stringify(got.slice(Math.max(0, i - 80), i + 160))}`)
}
fs.rmSync(tmp, { recursive: true, force: true })
if (bad) { console.error(`\nqa:parity: ${bad} page(s) differ from v1.4.0`); process.exit(1) }
console.log('\nqa:parity: every page matches v1.4.0')
