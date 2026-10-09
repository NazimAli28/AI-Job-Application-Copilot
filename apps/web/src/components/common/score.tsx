import { cn } from '@/lib/utils'

export const scoreTone = (score: number) =>
  score >= 75 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive'

/** Circular 0–100 score. Purely visual; the number is always shown as text too. */
export function ScoreRing({
  score,
  size = 96,
  label,
  className,
}: {
  score: number
  size?: number
  label?: string
  className?: string
}) {
  const stroke = Math.max(6, size / 12)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className={cn('stroke-current transition-[stroke-dashoffset] duration-700', scoreTone(pct))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-semibold tabular-nums" style={{ fontSize: size / 4 }}>
          {Math.round(pct)}
        </span>
        {label && <span className="text-[10px] text-muted-foreground uppercase">{label}</span>}
      </div>
    </div>
  )
}
