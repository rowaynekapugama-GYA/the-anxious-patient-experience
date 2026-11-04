/**
 * Production build (npm run build, which Vercel runs).
 *
 *   1. with a database: run migrations and pull whatever the dashboard holds into content/
 *   2. write the public pages from content/ into public/ (scripts/render-site.ts)
 *   3. check every page: links, anchors, files, structured data, FAQ counter, em dashes (scripts/qa-site.mjs)
 *   4. next build: the dashboard at /admin, Payload at /cms, the booking and dashboard API routes
 *
 * The public pages are plain files and never talk to the database. Without DATABASE_URL, or before the content
 * has been imported, step 1 is skipped and the site is built from the files in the repository.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

// Vercel sets these for real. Locally they live in .env, which this script
// has to read itself because it runs before Next starts.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    const value = match[2].replace(/^["']|["']$/g, '')
    if (!process.env[match[1]]) process.env[match[1]] = value
  }
}

const run = (command, args) => {
  const res = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

const quiet = (command, args) => spawnSync(command, args, { stdio: 'inherit', shell: false }).status

const UNSET_MARKER = 'set-PAYLOAD_SECRET-before-deploying'

if (process.env.DATABASE_URL) {
  // Dashboard sessions are signed with PAYLOAD_SECRET. With a database attached
  // and the placeholder secret from the public repository, anyone could forge
  // an administrator session, so refuse to build rather than go live like that.
  const secret = process.env.PAYLOAD_SECRET || ''
  if (!secret || secret === UNSET_MARKER || secret.length < 32) {
    console.error(
      '\n> stopped: DATABASE_URL is set but PAYLOAD_SECRET is missing or too short.\n'
        + '  Add PAYLOAD_SECRET in Vercel, Settings, Environment Variables: any random\n'
        + '  string of 32 characters or more. Then redeploy.\n',
    )
    process.exit(1)
  }

  console.log('> applying database migrations')
  run('npx', ['payload', 'migrate', '--force-accept-warning'])

  // the first build with a database loads the website into the dashboard by itself (same as the Import button;
  // it only adds what is missing, so it never overwrites anything saved in the dashboard)
  console.log('> loading the website into the dashboard if it is empty')
  if (quiet('npx', ['tsx', 'scripts/seed.ts', '--if-empty']) !== 0) {
    console.log('> could not load the website into the dashboard; GYA can press Import on the Dashboard')
  }

  console.log('> pulling content from the dashboard')
  const status = quiet('npx', ['tsx', 'scripts/pull-content.ts'])
  if (status !== 0) {
    console.log('> could not pull content, building from the files already in the repo')
  }
} else {
  console.log('> no DATABASE_URL, building from the content files in the repo')
}

console.log('> writing the public pages from the content files')
run('npx', ['tsx', 'scripts/render-site.ts'])

console.log('> checking the pages')
run('node', ['scripts/qa-site.mjs'])

console.log('> building the dashboard')
run('npx', ['next', 'build'])
