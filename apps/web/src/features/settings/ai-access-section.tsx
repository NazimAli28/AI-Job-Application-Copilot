import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles } from 'lucide-react'
import { accessRequestInput, type AccessRequestInput } from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser, useMyAccessRequest, useRequestAiAccess } from '@/features/auth/api'
import { AiUsageLine } from './ai-usage'

export function AiAccessSection() {
  const user = useCurrentUser()
  const { hash } = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  const req = useMyAccessRequest()
  const request = useRequestAiAccess()
  const form = useForm<AccessRequestInput>({ resolver: zodResolver(accessRequestInput), defaultValues: { reason: '' } })
  const { errors } = form.formState

  useEffect(() => {
    if (hash === '#ai-access') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const status = req.data?.status
  return (
    <Card id="ai-access" ref={ref} className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Plan &amp; AI access
          {user.aiAccess ? (
            <Badge className="bg-primary/10 text-primary">
              <Sparkles className="size-3" /> AI Pro
            </Badge>
          ) : (
            <Badge variant="secondary">Free</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Free is rule-based, unlimited and $0. AI Pro adds AI-written explanations, rewrites, letters and feedback, and is invite-only during the beta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {user.aiAccess ? (
          <>
            <p>You have AI Pro access. AI features are marked with an AI Pro badge and are always optional.</p>
            {!user.isDemo && <AiUsageLine />}
          </>
        ) : user.isDemo ? (
          <p className="text-muted-foreground">
            You&apos;re in the read-only demo. Create a free account to request AI Pro access.
          </p>
        ) : req.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : status === 'pending' ? (
          <p>
            <Badge variant="outline">Pending</Badge> Your request is being reviewed. You&apos;ll see AI features here
            once it&apos;s approved.
          </p>
        ) : (
          <>
            {status === 'denied' && (
              <p className="text-muted-foreground">
                <Badge variant="destructive">Denied</Badge> Your last request wasn&apos;t approved. You can send a new one
                below.
              </p>
            )}
            <form
              noValidate
              className="space-y-3"
              onSubmit={form.handleSubmit((v) => request.mutate(v.reason))}
            >
              <Field label="Why would you like AI Pro?" htmlFor="reason" error={errors.reason?.message}>
                <Textarea
                  id="reason"
                  rows={3}
                  placeholder="e.g. I'm applying to several roles and want help tailoring my resume"
                  {...invalidProps('reason', errors.reason?.message)}
                  {...form.register('reason')}
                />
              </Field>
              <Button type="submit" disabled={request.isPending}>
                {request.isPending ? <Spinner /> : <Sparkles />} Request AI access
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  )
}
