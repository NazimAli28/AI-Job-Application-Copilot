import type { Job, Source, TailoringResult } from '@copilot/shared'
import { SourceBadge } from '@/components/common/ai'
import { CopyButton } from './copy-button'
import { useReviewSuggestion } from './api'
import { SuggestionList } from './suggestion-list'
import { KeywordSection, Section, SkillOrder, SummaryEditor } from './tailor-sections'

export function TailorResult({ job, result, source }: { job: Job; result: TailoringResult; source: Source }) {
  const review = useReviewSuggestion(job.id, source)
  const pending = result.bulletSuggestions.filter((b) => b.status === 'pending').length
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <SourceBadge source={result.source} /> Generated {new Date(result.createdAt).toLocaleString()}
      </div>
      {source === 'rules' && (
        <>
          <Section title="Keyword coverage" hint="Facts: what your profile already shows vs. what the job asks for.">
            <KeywordSection keywords={result.keywords} />
          </Section>
          <Section
            title="Recommended skill order"
            hint="Same skills, reordered so the most relevant come first."
            action={<CopyButton text={result.skillOrder.join(', ')} />}
          >
            <SkillOrder skills={result.skillOrder} />
          </Section>
          <Section title="Suggested section changes" hint="Suggestions, not facts.">
            {result.sectionChanges.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.sectionChanges.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No section changes suggested.</p>
            )}
          </Section>
        </>
      )}
      <Section
        title="Bullet suggestions"
        hint={`Rewrites of your existing bullets. ${pending} pending. Nothing changes until you accept.`}
      >
        <SuggestionList items={result.bulletSuggestions} busy={review.isPending} onReview={(v) => review.mutate(v)} />
      </Section>
      {result.summary && (
        <Section title="Tailored summary" hint="Built from your profile facts only.">
          <SummaryEditor summary={result.summary} />
        </Section>
      )}
    </div>
  )
}
