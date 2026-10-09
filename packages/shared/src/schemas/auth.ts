import { z } from 'zod'
import { id, isoDate } from './common'

export const userSchema = z.object({
  id,
  email: z.email(),
  name: z.string(),
  role: z.enum(['user', 'admin']),
  aiAccess: z.boolean(), // invite-only AI Pro tier
  isDemo: z.boolean(), // public read-only demo account
  createdAt: isoDate,
})
export type User = z.infer<typeof userSchema>

const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/[0-9]/, 'Include a number')

export const registerInput = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.email('Enter a valid email'),
  password,
})
export type RegisterInput = z.infer<typeof registerInput>

export const loginInput = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})
export type LoginInput = z.infer<typeof loginInput>

export const forgotPasswordInput = z.object({ email: z.email('Enter a valid email') })
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>

export const resetPasswordInput = z.object({ token: z.string().min(1), password })
export type ResetPasswordInput = z.infer<typeof resetPasswordInput>

export const accessRequestSchema = z.object({
  id,
  userId: id,
  email: z.email(),
  name: z.string(),
  reason: z.string(),
  status: z.enum(['pending', 'approved', 'denied']),
  createdAt: isoDate,
})
export type AccessRequest = z.infer<typeof accessRequestSchema>

export const accessRequestInput = z.object({
  reason: z.string().trim().min(10, 'Tell us a bit more (10+ characters)').max(500),
})
export type AccessRequestInput = z.infer<typeof accessRequestInput>
