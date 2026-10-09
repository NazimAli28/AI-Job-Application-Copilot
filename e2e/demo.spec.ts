import { expect, test } from '@playwright/test'

test('demo: seeded data, pre-generated AI Pro result, read-only writes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the live demo' }).first().click()
  await expect(page).toHaveURL(/\/app\/dashboard/)
  await expect(page.getByText('Alex Morgan').first()).toBeVisible()
  await expect(page.getByText(/read-only demo/i).first()).toBeVisible()

  // Seeded job (job_demo_1 = Frontend Engineer at Lumos Health) with a rules match.
  await page.goto('/app/jobs/job_demo_1?tab=match')
  await expect(page.getByText('Lumos Health').first()).toBeVisible()
  await expect(page.getByText('Estimated fit').first()).toBeVisible()

  // The ✨ button returns the seeded AI result (the demo never calls an LLM).
  await page.getByRole('button', { name: 'Generate AI explanation' }).click()
  await expect(page.getByText(/Estimated fit for Frontend Engineer at Lumos Health/)).toBeVisible()

  // A write action is refused with the read-only message.
  await page.goto('/app/jobs/job_demo_1?tab=tracking')
  await page.getByLabel('Move to').click()
  await page.getByRole('option', { name: 'Offer' }).click()
  await page.getByRole('button', { name: 'Update status' }).click()
  await expect(page.getByText(/demo is read-only/i).first()).toBeVisible()
})
