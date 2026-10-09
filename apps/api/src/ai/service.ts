import type { z } from 'zod'
import { ERROR_CODES } from '@copilot/shared'
import type { AppContext } from '../context'
import { AppError } from '../lib/errors'
import type { AiEngine } from '../config'
import { aiErrorStatus, type AiProvider, type AiReply, type AiUsage } from './provider'

/**
 * One AI Pro feature. The model only fills `schema`; `toResult` maps it onto the rules result
 * and enforces guardrails (throw `AiRejected` → one retry). `simulate` is the $0 engine used
 * while no real AI key is configured.
 */
export type AiTask<I, O, R> = {
  name: string
  tier: 'extract' | 'generate'
  maxTokens: number
  schema: z.ZodType<O>
  system: string
  prompt(input: I): string
  toResult(out: O, input: I): R
  simulate(input: I): R
}

/** Output parsed but broke a guardrail (invented numbers, unknown references…). */
export class AiRejected extends Error {}

const DAY_MS = 86_400_000
const startOfUtcDay = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const startOfUtcMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()))

const unavailable = (message: string, status = 502) =>
  new AppError(status, ERROR_CODES.AI_UNAVAILABLE, message)

type LogRow = { task: string; model: string; status: string; latencyMs: number } & Partial<
  AiUsage & { errorCode: string }
>

type Engine = { provider: AiProvider; models: AiEngine; paid: boolean }

/** Why one engine could not answer; the next engine (if any) is tried. */
class EngineFailed extends Error {
  constructor(readonly error: AppError) {
    super(error.message)
  }
}

export function createAiService(ctx: AppContext) {
  const { db, config, log } = ctx
  const engines: Engine[] = []
  if (ctx.aiProvider)
    engines.push({
      provider: ctx.aiProvider,
      models: config.ai,
      paid: config.ai.provider === 'anthropic',
    })
  if (ctx.aiProvider && ctx.aiBackup && config.ai.backup)
    engines.push({ provider: ctx.aiBackup, models: config.ai.backup, paid: false })
  // The monthly cap guards spend: with Claude only Claude tokens count; free-only counts all.
  const capped = config.ai.provider === 'anthropic' ? { startsWith: 'claude' } : undefined

  const record = (userId: string, row: LogRow) =>
    db.aiRequest.create({ data: { userId, ...row } }).catch((err: unknown) => {
      log.error({ err, task: row.task }, 'ai request log failed')
    })

  async function usage(userId: string) {
    const [usedToday, month] = await Promise.all([
      db.aiRequest.count({ where: { userId, createdAt: { gte: startOfUtcDay() } } }),
      db.aiRequest.aggregate({
        where: { createdAt: { gte: startOfUtcMonth() }, model: capped },
        _sum: { inputTokens: true, outputTokens: true },
      }),
    ])
    return {
      provider: engines.length ? config.ai.provider : ('simulated' as const),
      ...(engines.length > 1 ? { backup: 'openai' as const } : {}),
      usedToday,
      dailyLimit: config.AI_DAILY_LIMIT,
      resetsAt: new Date(startOfUtcDay().getTime() + DAY_MS).toISOString(),
      monthlyTokens: (month._sum.inputTokens ?? 0) + (month._sum.outputTokens ?? 0),
      monthlyTokenCap: config.AI_MONTHLY_TOKEN_CAP,
    }
  }

  /** One engine: up to 2 attempts (retry on unusable output). Throws EngineFailed. */
  async function ask<I, O, R>(userId: string, e: Engine, task: AiTask<I, O, R>, input: I) {
    const model = task.tier === 'extract' ? e.models.extractModel : e.models.generateModel
    const call = {
      model,
      system: task.system,
      prompt: task.prompt(input),
      schema: task.schema,
      maxTokens: task.maxTokens,
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now()
      let reply: AiReply<O>
      try {
        reply = await e.provider.complete(call)
      } catch (err) {
        const status = aiErrorStatus(err)
        if (status === null) throw err // programming error, not a provider failure
        await record(userId, {
          task: task.name,
          model,
          status: 'error',
          errorCode: `HTTP_${status}`,
          latencyMs: Date.now() - t0,
        })
        log.warn({ err: (err as Error).message, task: task.name, model }, 'ai call failed')
        throw new EngineFailed(
          unavailable('AI Pro is temporarily unavailable. Try again in a minute.'),
        )
      }
      const base = {
        task: task.name,
        model: reply.model,
        latencyMs: Date.now() - t0,
        ...reply.usage,
      }
      if (reply.stopReason === 'refusal') {
        // A refusal is a safety decision: never routed around via another model.
        await record(userId, { ...base, status: 'refused' })
        throw unavailable(
          'The AI declined this request. The rule-based result is still available.',
          422,
        )
      }
      if (reply.output !== null) {
        try {
          const result = task.toResult(reply.output, input)
          await record(userId, { ...base, status: 'ok' })
          return result
        } catch (err) {
          if (!(err instanceof AiRejected)) throw err
          await record(userId, { ...base, status: 'invalid', errorCode: 'GUARDRAIL' })
          log.info({ task: task.name, reason: err.message }, 'ai output rejected by guardrail')
          continue
        }
      }
      await record(userId, {
        ...base,
        status: 'invalid',
        errorCode: reply.stopReason === 'max_tokens' ? 'TRUNCATED' : 'SCHEMA',
      })
    }
    throw new EngineFailed(unavailable('AI Pro returned an unusable answer. Please try again.'))
  }

  /**
   * Daily per-user quota (every attempt counts), then Claude → free backup: the backup answers
   * when Claude errors, gives unusable output twice, or the monthly budget is spent.
   */
  async function run<I, O, R>(userId: string, task: AiTask<I, O, R>, input: I): Promise<R> {
    const u = await usage(userId)
    if (u.usedToday >= u.dailyLimit)
      throw new AppError(
        429,
        ERROR_CODES.AI_QUOTA_EXCEEDED,
        `Daily AI Pro limit reached (${u.dailyLimit} requests). It resets at midnight UTC.`,
        { resetsAt: u.resetsAt },
      )
    if (!engines.length) {
      const result = task.simulate(input)
      await record(userId, { task: task.name, model: 'simulated', status: 'ok', latencyMs: 0 })
      return result
    }
    let last = unavailable(
      'AI Pro has reached its monthly budget. Rule-based results still work.',
      503,
    )
    for (const [i, e] of engines.entries()) {
      if (u.monthlyTokens >= u.monthlyTokenCap && (e.paid || !capped)) continue
      try {
        return await ask(userId, e, task, input)
      } catch (err) {
        if (!(err instanceof EngineFailed)) throw err
        last = err.error
        if (i < engines.length - 1) log.warn({ task: task.name }, 'ai falling back to backup')
      }
    }
    throw last
  }

  return { run, usage }
}

export type AiService = ReturnType<typeof createAiService>
