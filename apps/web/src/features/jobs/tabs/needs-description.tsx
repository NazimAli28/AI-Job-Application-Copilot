import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FileWarning, Sparkles } from 'lucide-react'
import { MIN_DESCRIPTION_CHARS, type Job } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { EmptyState, Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useAnalyzeDescription } from '../tracking/api'

/** Prominent card on Overview when a job was saved without its description. */
export function AddDescriptionCard({ job }: { job: Job }) {
  const analyze = useAnalyzeDescription(job.id)
  const [text, setText] = useState(job.description)
  const short = text.trim().length < MIN_DESCRIPTION_CHARS

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileWarning className="size-4 text-primary" /> Add the job description
        </CardTitle>
        <CardDescription>
          Match, tailoring, cover letters and interview prep all need the posting text. Paste it
          below and we will pull out the responsibilities and requirements for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        <Field
          label="Job description"
          htmlFor="jd-text"
          hint={`At least ${MIN_DESCRIPTION_CHARS} characters.`}
        >
          <Textarea
            id="jd-text"
            rows={8}
            maxLength={20000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div>
          <Button
            disabled={short || analyze.isPending}
            onClick={() =>
              analyze.mutate(text.trim(), {
                onSuccess: () => toast.success('Description saved and analyzed'),
              })
            }
          >
            {analyze.isPending ? <Spinner /> : <Sparkles />} Save &amp; analyze
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** Shown in tabs that cannot work without a description. */
export function NeedsDescriptionEmpty({ job }: { job: Job }) {
  return (
    <EmptyState
      icon={FileWarning}
      title="Add the job description first"
      description="This tab analyzes the posting text, and this job was saved without it."
      action={
        <Button asChild>
          <Link to={`/app/jobs/${job.id}?tab=overview`}>Go to Overview</Link>
        </Button>
      }
    />
  )
}
