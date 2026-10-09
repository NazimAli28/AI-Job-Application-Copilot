import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { needsDescription, type Job, type JobRequirement } from '@copilot/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AddDescriptionCard } from './needs-description'

function ReqList({ title, items }: { title: string; items: JobRequirement[] }) {
  if (!items.length) return null
  return (
    <div>
      <h4 className="mb-1 text-sm font-medium">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((r) => (
          <li key={r.id}>{r.text}</li>
        ))}
      </ul>
    </div>
  )
}

const IMPORT_LABEL = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  jsonld: 'the page data',
  html: 'the page',
} as const

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 600
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Description</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-sm break-words whitespace-pre-wrap ${long && !open ? 'line-clamp-6' : ''}`}
        >
          {text}
        </p>
        {long && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 px-0"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Show less' : 'Show full description'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function OverviewTab({ job }: { job: Job }) {
  const missing = needsDescription(job)
  const facts = [
    ['Salary', job.salary],
    ['Location', job.location],
    ['Experience', job.experienceYearsMin != null ? `${job.experienceYearsMin}+ years` : undefined],
    ['Education', job.educationRequirement],
  ].filter((f): f is [string, string] => !!f[1])

  return (
    <div className="grid min-w-0 gap-4">
      {missing && <AddDescriptionCard job={job} />}
      {(job.url || facts.length > 0 || job.importedFrom) && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 text-sm">
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex w-fit max-w-full items-center gap-1 text-primary hover:underline"
              >
                <span className="truncate">{job.url}</span>{' '}
                <ExternalLink className="size-3.5 shrink-0" />
              </a>
            )}
            {facts.length > 0 && (
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {job.importedFrom && (
              <p className="text-xs text-muted-foreground">
                Imported from {IMPORT_LABEL[job.importedFrom]}. Check the details against the
                original posting.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {!missing && <Description text={job.description} />}
      {job.responsibilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Responsibilities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {job.responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {!missing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requirements</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            {job.requirements.length === 0 && (
              <p className="text-sm text-muted-foreground">None listed.</p>
            )}
            <ReqList
              title="Required"
              items={job.requirements.filter((r) => r.kind === 'required')}
            />
            <ReqList
              title="Preferred"
              items={job.requirements.filter((r) => r.kind === 'preferred')}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
