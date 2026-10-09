/** GET /ai/usage — the caller's AI Pro quota. Monthly totals are only sent to admins. */
export type AiUsageInfo = {
  /** Engine answering ✨ requests: Claude, a generic OpenAI-compatible model, or simulated ($0). */
  provider: 'anthropic' | 'openai' | 'simulated'
  /** Free endpoint used when Claude fails or reaches the monthly budget. */
  backup?: 'openai'
  usedToday: number
  dailyLimit: number
  resetsAt: string
  monthlyTokens?: number
  monthlyTokenCap?: number
}
