import type { AiCall, AiProvider, AiReply } from '../ai/provider'

type Queued = { output: unknown; stopReason?: string; usage?: Partial<AiReply<unknown>['usage']> }

/** Looks like a real Claude key so config resolves to `anthropic` (no client is built in tests). */
export const AI_TEST_ENV = { ANTHROPIC_API_KEY: 'sk-ant-test-000000000000000000000000' }

/**
 * Recorded-fixture provider: replies are queued per test, every call is captured, and each
 * fixture is checked against the task's own Zod contract (so fixtures can't drift from it).
 */
export function fakeAi() {
  const calls: AiCall<unknown>[] = []
  const queue: (Queued | Error)[] = []
  const provider: AiProvider = {
    async complete<T>(call: AiCall<T>): Promise<AiReply<T>> {
      calls.push(call as AiCall<unknown>)
      const next = queue.shift()
      if (!next) throw new Error(`fakeAi: no reply queued (call ${calls.length})`)
      if (next instanceof Error) throw next
      const output = next.output === null ? null : call.schema.parse(next.output)
      return {
        output,
        stopReason: next.stopReason ?? 'end_turn',
        model: call.model,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          ...next.usage,
        },
      }
    },
  }
  return {
    provider,
    calls,
    reply: (output: unknown, extra: Omit<Queued, 'output'> = {}) =>
      queue.push({ output, ...extra }),
    fail: (err: Error) => queue.push(err),
    pending: () => queue.length,
  }
}
