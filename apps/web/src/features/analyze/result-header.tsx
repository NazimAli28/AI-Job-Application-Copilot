import { Link, useNavigate } from 'react-router'
import { ArrowRight, BookmarkPlus, Check, ClipboardCopy, FileText, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Analysis } from '@copilot/shared'
import { SourceBadge } from '@/components/common/ai'
import { ScoreRing } from '@/components/common/score'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SaveJobDialog } from './save-dialog'

const sourceName = { greenhouse: 'Greenhouse', lever: 'Lever', jsonld: 'the job page', html: 'the job page' }

export function summaryText(a: Analysis): string {
  const strong = a.match.skills.filter((s) => s.status === 'strong').map((s) => s.skill)
  const missing = a.match.skills.filter((s) => s.status === 'missing').map((s) => s.skill)
  return [
    `${a.job.title} @ ${a.job.company} — estimated fit ${Math.round(a.match.score)}/100 (rule-based)`,
    a.match.explanation,
    strong.length ? `Strong: ${strong.join(', ')}` : '',
    missing.length ? `Gaps: ${missing.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function ResultHeader({ a }: { a: Analysis }) {
  const navigate = useNavigate()
  const saved = !!a.savedJobId
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(a))
      toast.success('Summary copied')
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }
  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ScoreRing score={a.match.score} size={120} label="Estimated fit" />
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-xl font-semibold tracking-tight break-words">
                {a.job.title} <span className="text-muted-foreground">@ {a.job.company}</span>
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <SourceBadge source="rules" />
                <span>Resume used: {a.resumeLabel}</span>
                {a.importedFrom && <span>· Imported from {sourceName[a.importedFrom]}</span>}
              </p>
              <p className="mt-2 text-sm">{a.match.explanation}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {saved ? (
              <Button size="lg" asChild>
                <Link to={`/app/jobs/${a.savedJobId}`}>
                  <Check /> Open saved job <ArrowRight />
                </Link>
              </Button>
            ) : (
              <SaveJobDialog
                a={a}
                trigger={
                  <Button size="lg">
                    <BookmarkPlus /> Save as job
                  </Button>
                }
              />
            )}
            <Button variant="outline" asChild>
              <Link to="/app/analyze">
                <Search /> Check another job
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate('/app/analyze', { state: { description: a.job.description, url: a.job.url ?? '' } })
              }
            >
              <RefreshCw /> Try another resume
            </Button>
            <Button variant="ghost" onClick={copy}>
              <ClipboardCopy /> Copy summary
            </Button>
          </div>
        </CardContent>
      </Card>
      {!saved && (
        <Card className="bg-primary/5">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm">
                <span className="font-medium">Want to track this job?</span> Save it to keep the match,
                tailoring and your interview prep — and follow it from Applied to Offer.
              </p>
            </div>
            <SaveJobDialog a={a} trigger={<Button className="shrink-0">Save as job</Button>} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
