import { Lightbulb, Sparkles } from 'lucide-react'

/** Static example shown to users without AI Pro (illustrative numbers, clearly a sample). */
const SAMPLE = [
  { kind: 'fact', text: '12 applications tracked: 4 reached an interview stage (33%), 1 offer (8%), 3 rejections (25%).' },
  { kind: 'fact', text: 'On average, it took 9 days from applying to an interview.' },
  { kind: 'suggestion', text: 'Suggestion: roles with a match score of 75+ led to interviews more often in your data. Consider prioritising them. Small sample, not a guarantee.' },
  { kind: 'suggestion', text: 'Suggestion: follow up on applications with no status change for about two weeks.' },
] as const

export function AiInsightsPreview() {
  return (
    <div className="space-y-3 p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" /> AI insights (sample)
      </p>
      <ul className="space-y-2">
        {SAMPLE.map((s) => (
          <li key={s.text} className="flex gap-2 rounded-lg border p-3 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <strong>{s.kind === 'fact' ? 'Fact: ' : 'Suggestion: '}</strong>
              {s.text.replace(/^Suggestion: /, '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
