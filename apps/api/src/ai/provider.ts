import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'

export type AiUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export type AiCall<T> = {
  model: string
  system: string
  prompt: string
  /** Output contract: sent as the structured-output JSON schema, then re-validated here. */
  schema: z.ZodType<T>
  maxTokens: number
}

/** `output` is null when the reply was missing, truncated, refused or failed the schema. */
export type AiReply<T> = {
  output: T | null
  stopReason: string | null
  usage: AiUsage
  /** Model that actually answered (differs from the request after a refusal fallback). */
  model: string
}

/** One structured completion. Tests inject a fake; prod uses `anthropicProvider`. */
export type AiProvider = { complete<T>(call: AiCall<T>): Promise<AiReply<T>> }

// Server-side refusal fallback (`fallbacks: "default"`) exists on these models only.
const FALLBACK_MODELS = /^claude-(sonnet-5-5|opus-5|fable-5)/
// `output_config.effort` is rejected by these older models.
const NO_EFFORT = /^claude-(haiku-4|sonnet-4-5|opus-4-1)/

const zeroUsage: AiUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
}

/**
 * Claude via the official SDK: structured outputs (JSON schema from the task's Zod contract),
 * cached system prompt, moderate effort, SDK retries for 429/5xx. Parsing is done here (not
 * `messages.parse`) so token usage is still recorded when the output is invalid.
 */
export function anthropicProvider(
  apiKey: string,
  opts: { fetch?: typeof fetch; maxRetries?: number } = {},
): AiProvider {
  const client = new Anthropic({
    apiKey,
    timeout: 90_000,
    maxRetries: opts.maxRetries ?? 2,
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  })
  return {
    async complete<T>(call: AiCall<T>): Promise<AiReply<T>> {
      const { type, schema } = betaZodOutputFormat(call.schema)
      const fallback = FALLBACK_MODELS.test(call.model)
      const res = await client.beta.messages.create({
        model: call.model,
        max_tokens: call.maxTokens,
        system: [{ type: 'text', text: call.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: call.prompt }],
        output_config: {
          format: { type, schema },
          ...(NO_EFFORT.test(call.model) ? {} : { effort: 'medium' as const }),
        },
        ...(fallback
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      })
      const u = res.usage
      const usage: AiUsage = u
        ? {
            inputTokens: u.input_tokens ?? 0,
            outputTokens: u.output_tokens ?? 0,
            cacheReadTokens: u.cache_read_input_tokens ?? 0,
            cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
          }
        : zeroUsage
      const reply = { stopReason: res.stop_reason ?? null, usage, model: res.model ?? call.model }
      if (res.stop_reason !== 'end_turn') return { ...reply, output: null }
      const text = res.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
      try {
        const parsed = call.schema.safeParse(JSON.parse(text))
        return { ...reply, output: parsed.success ? parsed.data : null }
      } catch {
        return { ...reply, output: null }
      }
    },
  }
}

/** Provider HTTP/network failure (either provider) → its status for the usage log. */
export function aiErrorStatus(e: unknown): string | null {
  if (e instanceof Anthropic.APIError) return String(e.status ?? 'NETWORK')
  if (e instanceof AiHttpError) return String(e.status ?? 'NETWORK')
  return null
}

type ChatCompletion = {
  model?: string
  choices?: {
    finish_reason?: string | null
    message?: { content?: string | null; refusal?: string | null }
  }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
  }
}

/** Typed error for the generic provider (status kept for the usage log). */
export class AiHttpError extends Error {
  constructor(
    readonly status: number | undefined,
    message: string,
  ) {
    super(message)
  }
}

const FINISH: Record<string, string> = {
  stop: 'end_turn',
  length: 'max_tokens',
  content_filter: 'refusal',
}

/**
 * Any OpenAI-compatible `/chat/completions` endpoint — free tiers like Groq, Google Gemini
 * (`…/v1beta/openai`), OpenRouter `:free` models or a local Ollama (`http://localhost:11434/v1`).
 * Uses JSON mode (widest support) with the task's JSON schema in the system prompt; the reply
 * is validated against the Zod contract like Claude's. One retry on 429/5xx/network errors.
 */
export function openAiCompatibleProvider(
  baseUrl: string,
  apiKey: string,
  opts: { fetch?: typeof fetch; timeoutMs?: number } = {},
): AiProvider {
  const doFetch = opts.fetch ?? fetch
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  async function post(body: unknown, attempt = 0): Promise<ChatCompletion> {
    let res: Response
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
      })
    } catch (err) {
      if (attempt < 1) return post(body, attempt + 1)
      throw new AiHttpError(undefined, `AI endpoint unreachable: ${(err as Error).message}`)
    }
    if (res.ok) return (await res.json()) as ChatCompletion
    if ((res.status === 429 || res.status >= 500) && attempt < 1) {
      await new Promise((r) => setTimeout(r, 1500))
      return post(body, attempt + 1)
    }
    throw new AiHttpError(res.status, `AI endpoint returned HTTP ${res.status}`)
  }
  return {
    async complete<T>(call: AiCall<T>): Promise<AiReply<T>> {
      const { schema } = betaZodOutputFormat(call.schema)
      const system = `${call.system}\n\nRespond with ONLY a JSON object (no prose, no code fences) that matches this JSON schema:\n${JSON.stringify(schema)}`
      const res = await post({
        model: call.model,
        max_tokens: call.maxTokens,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: call.prompt },
        ],
      })
      const choice = res.choices?.[0]
      const stopReason = choice?.message?.refusal
        ? 'refusal'
        : (FINISH[choice?.finish_reason ?? ''] ?? choice?.finish_reason ?? null)
      const usage: AiUsage = {
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
        cacheReadTokens: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        cacheWriteTokens: 0,
      }
      const reply = { stopReason, usage, model: res.model ?? call.model }
      if (stopReason !== 'end_turn') return { ...reply, output: null }
      const text = (choice?.message?.content ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
      try {
        const parsed = call.schema.safeParse(JSON.parse(text))
        return { ...reply, output: parsed.success ? parsed.data : null }
      } catch {
        return { ...reply, output: null }
      }
    },
  }
}

/** The free endpoint as Claude's backup (null when not configured). */
export function createBackupProvider(config: {
  ai: { backup: unknown }
  AI_API_KEY?: string
  AI_BASE_URL: string
}): AiProvider | null {
  return config.ai.backup ? openAiCompatibleProvider(config.AI_BASE_URL, config.AI_API_KEY!) : null
}

/** Builds the configured provider; null = simulated engine. */
export function createAiProvider(config: {
  ai: { provider: 'anthropic' | 'openai' | 'simulated' }
  ANTHROPIC_API_KEY?: string
  AI_API_KEY?: string
  AI_BASE_URL: string
}): AiProvider | null {
  if (config.ai.provider === 'anthropic') return anthropicProvider(config.ANTHROPIC_API_KEY!)
  if (config.ai.provider === 'openai')
    return openAiCompatibleProvider(config.AI_BASE_URL, config.AI_API_KEY!)
  return null
}
