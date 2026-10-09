import type { AiUsageInfo } from '@copilot/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiUsage } from './api'

const ENGINE: Record<AiUsageInfo['provider'], string> = {
  anthropic: 'Claude',
  openai: 'a hosted open model',
  simulated: 'the built-in simulated engine (no AI key configured)',
}

const fmt = (n: number) => new Intl.NumberFormat().format(n)

/** Daily AI Pro quota; admins also see the global monthly token budget. */
export function AiUsageLine() {
  const { data, isPending, isError } = useAiUsage()
  if (isPending) return <Skeleton className="h-10 w-full" />
  if (isError || !data) return null
  const left = Math.max(0, data.dailyLimit - data.usedToday)
  const resets = new Date(data.resetsAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="space-y-1 rounded-md border p-3 text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">
          {left} of {data.dailyLimit}
        </span>{' '}
        AI requests left today (resets {resets}). Answered by {ENGINE[data.provider]}
        {data.backup ? ', with a free hosted model as backup' : ''}.
      </p>
      {data.monthlyTokenCap !== undefined && (
        <p>
          Admin: {fmt(data.monthlyTokens ?? 0)} of {fmt(data.monthlyTokenCap)} tokens used this
          month (all users).
        </p>
      )}
    </div>
  )
}
