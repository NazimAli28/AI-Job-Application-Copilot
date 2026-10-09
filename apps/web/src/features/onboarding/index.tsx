import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CheckCircle2 } from 'lucide-react'
import type { Resume } from '@copilot/shared'
import { ErrorState, PageSkeleton, Spinner } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Logo } from '@/app/shell'
import { useCurrentUser } from '@/features/auth/api'
import { useCompleteOnboarding, useProfile } from '@/features/profile/api'
import { emptyProfile } from '@/features/profile/components/personal-tab'
import { BasicsStep, ResumeStep, SkillsStep } from './steps'

const STEPS = [
  { title: 'About you', description: 'The basics that drive job matching.' },
  { title: 'Your resume', description: 'Optional. Upload a PDF for an instant rule-based score.' },
  { title: 'Your skills', description: 'Confirm what is really yours. You can edit everything later.' },
  { title: 'All set', description: 'Your profile is ready.' },
]

export function OnboardingPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { data, isPending, error, refetch } = useProfile()
  const complete = useCompleteOnboarding()
  const [step, setStep] = useState(0)
  const [uploaded, setUploaded] = useState<Resume | null>(null)

  if (isPending) return <div className="mx-auto max-w-xl p-6"><PageSkeleton rows={2} /></div>
  if (error) return <div className="mx-auto max-w-xl p-6"><ErrorState error={error} onRetry={() => void refetch()} /></div>

  const base = data.profile ?? emptyProfile(user.name, user.email)
  const back = () => setStep((s) => s - 1)
  const next = () => setStep((s) => s + 1)
  const finish = (to: string) => complete.mutate(undefined, { onSuccess: () => navigate(to) })

  return (
    <div className="flex min-h-svh flex-col items-center bg-muted/40 px-4 py-8">
      <Logo className="mb-6 text-lg" />
      <div className="w-full max-w-xl space-y-4">
        {user.isDemo && (
          <Alert>
            <AlertDescription>
              You are in the read-only demo, so nothing here is saved.{' '}
              <Link to="/app/dashboard" className="font-medium text-primary underline">
                Go to the dashboard
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <div>
          <div className="mb-2 flex justify-between text-sm text-muted-foreground">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <span>{STEPS[step]!.title}</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} aria-label={`Step ${step + 1} of ${STEPS.length}`} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{STEPS[step]!.title}</CardTitle>
            <CardDescription>{STEPS[step]!.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 && <BasicsStep base={base} skipSave={user.isDemo} onNext={next} />}
            {step === 1 && <ResumeStep uploaded={uploaded} onUploaded={setUploaded} onBack={back} onNext={next} />}
            {step === 2 && (
              <SkillsStep
                resume={uploaded}
                existing={data.skills}
                skipSave={user.isDemo}
                onBack={back}
                onNext={next}
              />
            )}
            {step === 3 && (
              <div className="space-y-5 text-center">
                <CheckCircle2 className="mx-auto size-12 text-success" />
                <p className="text-sm text-muted-foreground">
                  Check your fit for a job you are interested in to see your estimated fit, resume fixes and interview prep.
                </p>
                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  <Button disabled={complete.isPending} onClick={() => finish('/app/analyze')}>
                    {complete.isPending && <Spinner />} Check your fit for a job
                  </Button>
                  <Button variant="outline" disabled={complete.isPending} onClick={() => finish('/app/dashboard')}>
                    Go to dashboard
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
