import { expect, test } from '@playwright/test'
import { login, logout, newUser, register } from './helpers/user'

test('landing, register, logout, login, protected route', async ({ page }) => {
  const user = newUser()

  await page.goto('/')
  await page.getByRole('link', { name: 'Get started', exact: true }).first().click()
  await expect(page).toHaveURL(/\/register/)

  await register(page, user)
  await expect(page.getByText('Step 1 of 4')).toBeVisible()

  // Onboarding has no user menu; go to the app shell to log out.
  await page.goto('/app/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await logout(page, user)

  await page.goto('/app/dashboard')
  await expect(page).toHaveURL(/\/login/)

  await login(page, user)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('logged-out visit to a protected route redirects to login', async ({ page }) => {
  await page.goto('/app/jobs')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
})

test('wrong password stays on login', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('nobody+e2e@example.com')
  await page.getByLabel('Password').fill('Wrong-pass-123')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeEnabled()
  await expect(page).toHaveURL(/\/login/)
})
