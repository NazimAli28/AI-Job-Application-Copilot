// README screenshots from the demo account. Needs the app running (`pnpm dev:all`).
// Usage: pnpm screenshots   (BASE_URL=https://… to shoot a deployed site)
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const base = process.env.BASE_URL ?? 'http://localhost:5173'
const out = 'docs/screenshots'
const shots = [
  ['dashboard', '/app/dashboard'],
  ['check-my-fit', '/app/analyze/ana_demo_1'],
  ['job-match', '/app/jobs/job_demo_1?tab=match'],
  ['jobs-board', '/app/jobs'],
  ['resume', '/app/resume'],
  ['analytics', '/app/analytics'],
]

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
page.setDefaultTimeout(90_000)

await page.goto(base)
await page.screenshot({ path: `${out}/landing.png` })
await page.getByRole('button', { name: 'Try the live demo' }).first().click()
await page.waitForURL(/\/app\/dashboard/)

for (const [name, path] of shots) {
  await page.goto(base + path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800) // chart/enter animations
  await page.screenshot({ path: `${out}/${name}.png` })
  console.log(`saved ${out}/${name}.png`)
}
await browser.close()
