import { EVALUATION_CRITERIA, type AnswerEvaluation } from '@copilot/shared'
import { SourceBadge } from '@/components/common/ai'
import { ScoreRing } from '@/components/common/score'
import { CRITERIA_LABELS } from './stats'

export function CriterionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{value.toFixed(1)} / 5</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={Number(value.toFixed(1))}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  )
}

function Bullets({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null
  return (
    <div>
      <h4 className={`mb-1 text-sm font-medium ${tone}`}>{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  )
}

export function EvaluationCard({ evaluation: e }: { evaluation: AnswerEvaluation }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4" aria-live="polite">
      <div className="flex items-center gap-4">
        <ScoreRing score={e.score} size={72} />
        <div>
          <p className="font-medium">Answer feedback</p>
          <div className="mt-1">
            <SourceBadge source={e.source} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {EVALUATION_CRITERIA.map((c) => (
          <CriterionBar key={c} label={CRITERIA_LABELS[c]} value={e.criteria[c] ?? 1} />
        ))}
      </div>
      <Bullets title="Strengths" items={e.strengths} tone="text-success" />
      <Bullets title="Weaknesses" items={e.weaknesses} tone="text-warning" />
      <Bullets title="Suggestions" items={e.suggestions} tone="text-primary" />
    </div>
  )
}
