import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Info, Target } from 'lucide-react'
import { runAnalysisInput } from '@copilot/shared'
import { GeneratingState } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser } from '@/features/auth/api'
import { useResumes } from '@/features/resume/api'
import { ApiRequestError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useRunAnalysis } from './api'
import { defaultResumeId, ResumePicker } from './resume-picker'

const STEPS = [
  'Reading the job description',
  'Comparing with your resume',
  'Finding skill gaps',
  'Preparing interview questions',
]

function StepTitle({ n, children }: { n: number; children: string }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 font-medium">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      {children}
    </h3>
  )
}

function FieldError({ children }: { children?: string }) {
  return children ? (
    <p role="alert" className="mt-1.5 text-xs text-destructive">
      {children}
    </p>
  ) : null
}

type Errors = { resumeId?: string; description?: string; url?: string }

/** THE core flow: pick a resume + paste a job, get the full result (match, gaps, fixes, questions). */
export function CheckFitPanel({ compact = false }: { compact?: boolean }) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const prefill = (useLocation().state ?? {}) as { description?: string; url?: string }
  const { data: resumes } = useResumes()
  const run = useRunAnalysis()
  const [resumeId, setResumeId] = useState<string>()
  const [description, setDescription] = useState(prefill.description ?? '')
  const [url, setUrl] = useState(prefill.url ?? '')
  const [tab, setTab] = useState(prefill.url && !prefill.description ? 'link' : 'paste')
  const [errors, setErrors] = useState<Errors>({})
  const [demoNote, setDemoNote] = useState(false)

  const effectiveResume = resumeId ?? defaultResumeId(resumes)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // The paste tab sends only the text; the link tab sends the URL (plus any text as fallback).
    const check = runAnalysisInput.safeParse({
      resumeId: effectiveResume ?? '',
      description: description.trim() || undefined,
      url: tab === 'link' ? url.trim() : undefined,
    })
    if (!check.success) {
      const f = check.error.flatten().fieldErrors
      setErrors({ resumeId: f.resumeId?.[0], description: f.description?.[0], url: f.url?.[0] })
      return
    }
    setErrors({})
    if (user.isDemo) return setDemoNote(true)
    run.mutate(check.data, {
      onSuccess: (a) => navigate(`/app/analyze/${a.id}`),
      onError: (err) => {
        if (err instanceof ApiRequestError && err.code === 'IMPORT_FAILED') setTab('paste')
        setErrors({ description: err instanceof Error ? err.message : 'Something went wrong' })
      },
    })
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className={cn(compact ? 'space-y-4' : 'space-y-6')}>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Target className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className={cn('font-heading font-semibold tracking-tight', compact ? 'text-xl' : 'text-2xl')}>
              Check your fit for a job
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a resume, paste a job description — get your match score, skill gaps, resume fixes and
              interview questions in seconds. Free.
            </p>
          </div>
        </div>

        {run.isPending ? (
          <GeneratingState label="Checking your fit…" steps={STEPS} />
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <section aria-label="Your resume" className="min-w-0">
                <StepTitle n={1}>Your resume</StepTitle>
                <ResumePicker value={effectiveResume} onChange={setResumeId} error={errors.resumeId} />
              </section>
              <section aria-label="The job" className="min-w-0">
                <StepTitle n={2}>The job</StepTitle>
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList>
                    <TabsTrigger value="paste">Paste description</TabsTrigger>
                    <TabsTrigger value="link">Link</TabsTrigger>
                  </TabsList>
                  <TabsContent value="paste" className="mt-2">
                    <Textarea
                      id="fit-description"
                      aria-label="Job description"
                      rows={compact ? 6 : 9}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      aria-invalid={!!errors.description}
                      placeholder="Paste the job description from a website, an email or text copied from a PDF…"
                    />
                    <FieldError>{errors.description}</FieldError>
                  </TabsContent>
                  <TabsContent value="link" className="mt-2 space-y-1.5">
                    <Input
                      id="fit-url"
                      type="url"
                      aria-label="Job link"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      aria-invalid={!!errors.url}
                      placeholder="https://boards.greenhouse.io/…"
                    />
                    <p className="text-xs text-muted-foreground">
                      Greenhouse &amp; Lever links import automatically; for others paste the text too.
                    </p>
                    <FieldError>{errors.url ?? errors.description}</FieldError>
                  </TabsContent>
                </Tabs>
              </section>
            </div>
            {demoNote && (
              <Alert role="status">
                <Info />
                <AlertDescription>
                  The demo is read-only — open a sample result in{' '}
                  <Link to="/app/analyze#recent-checks" className="font-medium underline">
                    recent checks
                  </Link>{' '}
                  or create a free account.
                </AlertDescription>
              </Alert>
            )}
            {/* Disabled until the resume list loads, so the default resume is part of the check. */}
            <Button type="submit" size="lg" className="w-full sm:w-auto sm:min-w-56" disabled={!resumes}>
              <Target /> Check my fit
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
