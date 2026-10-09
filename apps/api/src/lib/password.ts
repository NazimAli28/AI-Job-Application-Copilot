import { hash, verify } from '@node-rs/argon2'

// Argon2id (library default) with OWASP-recommended parameters: 19 MiB, t=2, p=1.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

export const hashPassword = (password: string) => hash(password, OPTIONS)

// Verified against when the user doesn't exist, so login timing doesn't reveal accounts.
let dummyHash: Promise<string> | undefined

export async function verifyPassword(stored: string | null | undefined, password: string) {
  if (!stored) {
    dummyHash ??= hashPassword('dummy-password-for-timing')
    await verify(await dummyHash, password).catch(() => false)
    return false
  }
  return verify(stored, password).catch(() => false)
}
