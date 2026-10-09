import { DEMO_EMAIL, DEMO_NAME, buildDemoData, validateDemoData } from '@copilot/shared/demo'
import { db, emptyUserData, fakeHash, type StoredUser } from '../db'

export { DEMO_EMAIL }

/**
 * Offline prototype only: creates (once) the read-only demo account in the mock db. The seed
 * itself lives in packages/shared (`@copilot/shared/demo`) and is what the API seeds too.
 */
export function ensureDemoUser(): StoredUser {
  const existing = db.read().users.find((u) => u.email === DEMO_EMAIL)
  if (existing) return existing
  return db.write((s) => {
    const { createdAt, ...seed } = buildDemoData()
    if (import.meta.env.DEV)
      validateDemoData({ createdAt, ...seed }).forEach((p) => console.warn(`[demo seed] ${p}`))
    const u: StoredUser = {
      id: 'usr_demo',
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      role: 'user',
      aiAccess: true,
      isDemo: true,
      createdAt,
      passwordHash: fakeHash(crypto.randomUUID()),
    }
    s.users.push(u)
    s.data[u.id] = { ...emptyUserData(), ...seed, onboardingComplete: true }
    return u
  })
}
