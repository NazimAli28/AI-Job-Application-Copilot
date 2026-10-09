import { z } from 'zod'

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  )

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see apps/api/.env.example)'),
  /** HMAC key for session + reset token hashes. Rotating it logs everyone out. */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  /** Web origin(s) allowed for CORS + Origin check, comma-separated. */
  APP_URL: z.string().default('http://localhost:5173'),
  ADMIN_EMAILS: csv,
  /** Number of reverse proxies in front of the API (Vercel: 1, set in src/vercel.ts). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /** Uploaded files: `local` disk (dev), `memory` (tests) or `s3` (R2 / Supabase Storage). */
  STORAGE_DRIVER: z.enum(['local', 'memory', 's3']).default('local'),
  /** S3-compatible storage (required when STORAGE_DRIVER=s3). */
  S3_ENDPOINT: z.string().trim().optional(),
  S3_BUCKET: z.string().trim().optional(),
  S3_ACCESS_KEY_ID: z.string().trim().optional(),
  S3_SECRET_ACCESS_KEY: z.string().trim().optional(),
  S3_REGION: z.string().trim().default('auto'),
  /** Resend API key (`re_...`); unset/placeholder -> emails are logged to the console. */
  RESEND_API_KEY: z.string().trim().optional(),
  MAIL_FROM: z.string().trim().default('AI Job Copilot <onboarding@resend.dev>'),
  /**
   * Root folder for the `local` driver, relative to the API's working directory (apps/api).
   * Defaults to the repo root: on Windows `node --watch` (pnpm dev) restarts on ANY write inside
   * apps/api, which killed every upload request mid-response.
   */
  STORAGE_DIR: z.string().default('../../.storage'),
  /**
   * AI Pro engine: `auto` = Claude if ANTHROPIC_API_KEY is real, else the generic
   * OpenAI-compatible endpoint if AI_API_KEY is real (free tiers: Groq, Gemini, OpenRouter,
   * local Ollama), else the $0 simulated engine. With both keys, the free endpoint is Claude's
   * backup (AI_BACKUP).
   */
  AI_PROVIDER: z.enum(['auto', 'anthropic', 'openai', 'simulated']).default('auto'),
  /** Claude key (server-only). */
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  /** Generic OpenAI-compatible endpoint (`/chat/completions` is appended). */
  AI_BASE_URL: z.string().trim().default('https://api.groq.com/openai/v1'),
  AI_API_KEY: z.string().trim().optional(),
  /** Free/generic endpoint models: extraction (job parse) and generation (everything else). */
  AI_MODEL_EXTRACT: z.string().trim().optional(),
  AI_MODEL_GENERATE: z.string().trim().optional(),
  /** Claude models (defaults: Haiku 4.5 extract, Sonnet 5.5 generate). */
  CLAUDE_MODEL_EXTRACT: z.string().trim().optional(),
  CLAUDE_MODEL_GENERATE: z.string().trim().optional(),
  /** `on`: when Claude fails, is unusable or hits the monthly budget, retry on the free endpoint. */
  AI_BACKUP: z.enum(['on', 'off']).default('on'),
  /** AI Pro calls per user per UTC day. */
  AI_DAILY_LIMIT: z.coerce.number().int().min(0).default(40),
  /** Hard stop: total input+output tokens per UTC month across all users. */
  AI_MONTHLY_TOKEN_CAP: z.coerce.number().int().min(0).default(2_000_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export type Config = z.infer<typeof envSchema> & {
  appOrigins: string[]
  isProd: boolean
  /** Resolved AI Pro engine + models; `backup` = free endpoint used when Claude fails. */
  ai: AiEngine & { backup: (AiEngine & { provider: 'openai' }) | null }
}

export type AiEngine = {
  provider: 'anthropic' | 'openai' | 'simulated'
  extractModel: string
  generateModel: string
}

/** Claude keys look like `sk-ant-…`; anything else (unset, "your-key-here") is a placeholder. */
const isAnthropicKey = (k?: string) => !!k && /^sk-ant-[\w-]{20,}$/.test(k)
/** Generic keys: long enough and not an obvious placeholder. Ollama accepts any value ("ollama"). */
const isGenericKey = (k?: string) =>
  !!k && (k === 'ollama' || (k.length >= 20 && !/your|placeholder|change-?me|xxx/i.test(k)))

const DEFAULT_MODELS = {
  anthropic: { extract: 'claude-haiku-4-5', generate: 'claude-sonnet-5-5' },
  openai: { extract: 'llama-3.1-8b-instant', generate: 'llama-3.3-70b-versatile' }, // Groq free tier
} as const

function resolveAi(c: z.infer<typeof envSchema>): Config['ai'] {
  const auto = isAnthropicKey(c.ANTHROPIC_API_KEY)
    ? 'anthropic'
    : isGenericKey(c.AI_API_KEY)
      ? 'openai'
      : 'simulated'
  const want = c.AI_PROVIDER === 'auto' ? auto : c.AI_PROVIDER
  // An explicitly chosen provider without a usable key falls back to simulated, never crashes.
  const provider =
    (want === 'anthropic' && !isAnthropicKey(c.ANTHROPIC_API_KEY)) ||
    (want === 'openai' && !isGenericKey(c.AI_API_KEY))
      ? 'simulated'
      : want
  const openai = {
    provider: 'openai' as const,
    extractModel: c.AI_MODEL_EXTRACT ?? DEFAULT_MODELS.openai.extract,
    generateModel: c.AI_MODEL_GENERATE ?? DEFAULT_MODELS.openai.generate,
  }
  const engine: AiEngine =
    provider === 'anthropic'
      ? {
          provider,
          extractModel: c.CLAUDE_MODEL_EXTRACT ?? DEFAULT_MODELS.anthropic.extract,
          generateModel: c.CLAUDE_MODEL_GENERATE ?? DEFAULT_MODELS.anthropic.generate,
        }
      : provider === 'openai'
        ? openai
        : { provider, extractModel: 'simulated', generateModel: 'simulated' }
  const backup =
    provider === 'anthropic' && c.AI_BACKUP === 'on' && isGenericKey(c.AI_API_KEY) ? openai : null
  return { ...engine, backup }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment:\n${msg}`)
  }
  const c = parsed.data
  if (c.STORAGE_DRIVER === 's3') {
    const missing = (
      ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const
    ).filter((k) => !c[k])
    if (missing.length)
      throw new Error(`Invalid environment:\n  STORAGE_DRIVER=s3 requires ${missing.join(', ')}`)
  }
  return {
    ...c,
    appOrigins: c.APP_URL.split(',').map((s) => s.trim().replace(/\/$/, '')),
    isProd: c.NODE_ENV === 'production',
    ai: resolveAi(c),
  }
}
