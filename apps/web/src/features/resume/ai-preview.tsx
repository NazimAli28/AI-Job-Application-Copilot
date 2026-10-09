import { Sparkles } from 'lucide-react'
import { SourceBadge } from '@/components/common/ai'

/**
 * Static example of the AI Pro resume review, shown blurred to users without AI access.
 * The candidate and text are fictional and generic. Suggestions only rephrase and use
 * placeholders, never invented figures.
 */
export function ResumeAiPreview() {
  return (
    <div className="space-y-3 bg-card p-5 text-sm">
      <div className="flex items-center gap-2">
        <SourceBadge source="ai" />
        <span className="text-muted-foreground">
          Sample review for a fictional candidate, Alex Example
        </span>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase">Original</p>
        <p>Responsible for building the dashboard used by the support team.</p>
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-primary uppercase">
          <Sparkles className="size-3" /> Suggested rewrite
        </p>
        <p>
          Built the support team dashboard — [add metric: users, tickets handled or time saved].
        </p>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase">Summary feedback</p>
        <p>
          Your summary lists tools but not the kind of problems you solve. Add one sentence on the
          work you want to do next, using only what is true for you.
        </p>
      </div>
      <ul className="list-disc space-y-1 pl-5">
        <li>Lead each bullet with a strong verb, then the outcome.</li>
        <li>Move your strongest project above older, unrelated roles.</li>
      </ul>
    </div>
  )
}
