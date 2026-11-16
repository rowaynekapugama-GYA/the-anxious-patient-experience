/**
 * Rebuilds the welcome pack PDFs (v1.9.2) from design/welcome-pack/*.html into public/downloads, and stops if any
 * page's content would run past its footer. Needs Playwright with Chromium on the computer running it:
 *   npx -y playwright@1 install chromium   (once)
 *   npm run pack:pdf
 * Not part of the website build: the PDFs are committed, so Vercel never runs this.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let chromium
try { ({ chromium } = await import('playwright')) } catch {
  // a global install (NODE_PATH=$(npm root -g)) works too
  try { ({ chromium } = (await import('node:module')).createRequire(import.meta.url)('playwright')) } catch { /* below */ }
}
if (!chromium) {
  console.error('Playwright is not installed here. Run: npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}
const jobs = [
  ['design/welcome-pack/patient-guide.html', 'public/downloads/ape-patient-guide.pdf'],
  ['design/welcome-pack/questionnaire.html', 'public/downloads/ape-pre-appointment-questionnaire.pdf'],
]
const browser = await chromium.launch()
let bad = 0
for (const [src, out] of jobs) {
  const page = await browser.newPage()
  await page.goto('file://' + path.join(root, src))
  await page.evaluate(() => document.fonts.ready)
  const over = await page.$$eval('.page', (pages) => pages.map((p, i) => {
    const inner = p.querySelector('.inner'); const foot = p.querySelector('.foot')
    const last = inner ? [...inner.querySelectorAll('*')].reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0) : 0
    return last > foot.getBoundingClientRect().top - 2 ? `page ${i + 1}` : ''
  }).filter(Boolean))
  if (over.length) { console.error(`${src}: content runs into the footer on ${over.join(', ')}`); bad++ }
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: path.join(root, out), format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true })
  console.log(`wrote ${out}`)
  await page.close()
}
await browser.close()
process.exit(bad ? 1 : 0)
