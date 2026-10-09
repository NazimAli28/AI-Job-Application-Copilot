import { randomBytes } from 'node:crypto'
import { expect, type Page } from '@playwright/test'

export interface TestUser {
  name: string
  email: string
  password: string
}

/** A fresh, unique user per call so runs are idempotent against a shared DB. */
export function newUser(): TestUser {
  const id = `${Date.now()}${randomBytes(2).toString('hex')}`
  return {
    name: 'E2E Tester',
    email: `e2e+${id}@example.com`,
    password: `Pw-${randomBytes(6).toString('hex')}-9x`,
  }
}

export async function register(page: Page, user: TestUser) {
  await page.goto('/register')
  await page.getByLabel('Full name').fill(user.name)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/app\/onboarding/)
}

export async function login(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL(/\/app\//)
}

export async function logout(page: Page, user: TestUser) {
  await page.getByRole('button', { name: user.email }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login/)
}
