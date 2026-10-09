import { expect, test, type Page } from '@playwright/test'
import { makePdf, sampleResumeLines } from './helpers/pdf'
import { newUser, register, type TestUser } from './helpers/user'

const JOB_DESCRIPTION = `Senior Frontend Engineer at Northwind Labs

About the role
We are looking for a Senior Frontend Engineer to build our customer-facing web application.

Requirements
- 3+ years of experience with React and TypeScript
- Strong knowledge of HTML, CSS and modern JavaScript
- Experience with REST APIs and GraphQL
- Experience with testing (Jest, Playwright) and CI/CD
- Familiarity with Docker and AWS is a plus

Responsibilities
- Build and maintain reusable React components
- Collaborate with designers and backend engineers
- Improve performance and accessibility of our product
`

const resumeLines = [
  ...sampleResumeLines,
  '- Reduced page load time of the checkout flow by 30% using code splitting',
  '- Led migration of a legacy codebase to TypeScript',
]

test.describe.configure({ mode: 'serial' })

let page: Page
let user: TestUser
let jobPath = ''

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage()
  user = newUser()
})
test.afterAll(async () => {
  await page.context().close()
})

test('onboarding: profile basics and resume upload with analysis score', async () => {
  await register(page, user)

  await page.getByLabel('Location').fill('Berlin, Germany')
  await page.getByLabel('Target job titles').fill('Frontend Developer')
  await page.getByLabel('Target job titles').press('Enter')
  await page.getByLabel('Years of experience').fill('3')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByText('Step 2 of 4')).toBeVisible()
  await page.getByLabel('Upload resume PDF').setInputFiles({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
    buffer: makePdf(resumeLines),
  })
  await expect(page.getByText('Quick score')).toBeVisible()
  await expect(page.getByText('resume.pdf')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByText('Step 3 of 4')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByText('Step 4 of 4')).toBeVisible()
  await page.getByRole('button', { name: 'Check your fit for a job' }).click()
  await expect(page).toHaveURL(/\/app\/analyze/)
})

test('resume page lists the uploaded resume', async () => {
  await page.goto('/app/resume')
  await expect(page.getByRole('heading', { name: 'Resume', exact: true })).toBeVisible()
  await expect(page.getByText('resume.pdf').first()).toBeVisible()
})

test('check my fit: estimated fit, gaps, save as job', async () => {
  await page.goto('/app/analyze')
  await expect(page.getByText(/resume\.pdf.*Active/).first()).toBeVisible()
  await page.getByLabel('Job description').fill(JOB_DESCRIPTION)
  await page.getByRole('button', { name: 'Check my fit' }).click()

  await expect(page).toHaveURL(/\/app\/analyze\/[^/]+$/)
  await expect(page.getByText('Estimated fit').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Skill gaps' })).toBeVisible()

  await page.getByRole('button', { name: 'Save as job' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Save as job' })
  await dialog.getByLabel('Job title').fill('Senior Frontend Engineer')
  await dialog.getByLabel('Company').fill('Northwind Labs')
  await dialog.getByRole('button', { name: 'Save job' }).click()

  await expect(page).toHaveURL(/\/app\/jobs\/[^/?]+/)
  jobPath = new URL(page.url()).pathname
  await expect(page.getByText('Northwind Labs').first()).toBeVisible()
})

test('job page: match, tailor, cover letter, interview prep', async () => {
  await page.goto(jobPath)

  await page.getByRole('tab', { name: 'Match & gaps' }).click()
  await expect(page.getByText(/estimated fit/i).first()).toBeVisible()

  // "Save as job" already stored rule-based tailoring; generate only if it is missing.
  await page.getByRole('tab', { name: 'Tailor resume' }).click()
  const generate = page.getByRole('button', { name: 'Generate tailoring suggestions' })
  const regenerate = page.getByRole('button', { name: 'Regenerate' })
  await expect(generate.or(regenerate).first()).toBeVisible()
  if (await generate.isVisible()) await generate.click()
  await expect(page.getByText('Keyword coverage')).toBeVisible()

  await page.getByRole('tab', { name: 'Cover letter' }).click()
  await page.getByRole('button', { name: 'Generate', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Regenerate' }).first()).toBeVisible()

  await page.getByRole('tab', { name: 'Interview prep' }).click()
  await expect(page.getByRole('button', { name: 'Start mock interview' })).toBeVisible()
})

test('change job status on the tracking tab', async () => {
  await page.goto(`${jobPath}?tab=tracking`)
  await page.getByLabel('Move to').click()
  await page.getByRole('option', { name: 'Applied' }).click()
  await page.getByRole('button', { name: 'Update status' }).click()
  await expect(page.getByText('Status: Applied').first()).toBeVisible()
})

test('interview practice: start a session and answer a question', async () => {
  await page.goto(`${jobPath}?tab=interview`)
  await page.getByRole('button', { name: 'Start mock interview' }).click()
  await expect(page).toHaveURL(/\/app\/interviews\/[^/]+$/)

  await page
    .getByLabel('Your answer')
    .fill(
      'In my last role I led the migration of a legacy codebase to TypeScript. I broke it into small steps, added tests first, and reduced production bugs along the way.',
    )
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await expect(
    page.getByRole('button', { name: /Next question|Finish|Complete/i }).first(),
  ).toBeVisible()
})

test('dashboard and analytics reflect the job', async () => {
  await page.goto('/app/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Northwind Labs').first()).toBeVisible()

  await page.goto('/app/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
})
