import { useState } from 'react'
import {
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  TriangleAlert,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { MatchResult, SkillMatch, SkillMatchStatus } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSkillCorrection } from './api'

const GROUPS: { status: SkillMatchStatus; label: string; icon: LucideIcon; tone: string }[] = [
  { status: 'strong', label: 'Strong', icon: CheckCircle2, tone: 'text-success' },
  { status: 'partial', label: 'Partial', icon: TriangleAlert, tone: 'text-warning' },
  { status: 'missing', label: 'Missing', icon: XCircle, tone: 'text-destructive' },
  { status: 'unknown', label: 'Unknown', icon: CircleHelp, tone: 'text-muted-foreground' },
]

function ConfirmDialog({
  skill,
  onClose,
  jobId,
}: {
  skill: string | null
  onClose: () => void
  jobId: string
}) {
  const [evidence, setEvidence] = useState('')
  const mut = useSkillCorrection(jobId)
  return (
    <Dialog open={!!skill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm you have {skill}</DialogTitle>
          <DialogDescription>
            Skills only count with evidence. Say where you used it (optional) and it will be added
            to your profile.
          </DialogDescription>
        </DialogHeader>
        <Field
          label="Evidence"
          htmlFor="skill-evidence"
          optional
          hint="e.g. Built the checkout UI at my last job"
        >
          <Textarea
            id="skill-evidence"
            rows={3}
            maxLength={500}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mut.isPending}
            onClick={() =>
              skill &&
              mut.mutate(
                { skill, action: 'confirm', evidence: evidence.trim() || undefined },
                {
                  onSuccess: () => {
                    setEvidence('')
                    onClose()
                  },
                },
              )
            }
          >
            {mut.isPending && <Spinner />} Confirm skill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SkillRow({
  s,
  busy,
  onConfirm,
  onAct,
}: {
  s: SkillMatch
  busy: boolean
  onConfirm: () => void
  onAct: (a: 'reject' | 'learning') => void
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {s.skill}
          <Badge variant={s.requirementKind === 'required' ? 'default' : 'outline'}>
            {s.requirementKind}
          </Badge>
          {s.corrected && <Badge variant="secondary">corrected by you</Badge>}
        </p>
        {s.evidence.length > 0 ? (
          <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
            {s.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            No evidence found in your profile or resume.
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <Button size="sm" variant="outline" disabled={busy} onClick={onConfirm}>
          <Check /> I have it
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAct('learning')}>
          <BookOpen /> Learning
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAct('reject')}>
          <X /> Reject
        </Button>
      </div>
    </li>
  )
}

/** Skill groups with confirm / learning / reject actions (rendered inside the Match & gaps tab). */
export function GapsSection({ jobId, match: m }: { jobId: string; match: MatchResult }) {
  const mut = useSkillCorrection(jobId)
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">Skill gaps</h2>
        <Alert className="mt-2">
          <AlertDescription>
            Skills only count when your profile or resume shows evidence for them. If you have a
            skill we could not see, confirm it and add evidence. Marking a skill as learning keeps
            it out of your matched skills.
          </AlertDescription>
        </Alert>
      </div>
      {m.skills.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This job lists no skill requirements to compare.
        </p>
      )}
      {GROUPS.map(({ status, label, icon: Icon, tone }) => {
        const items = m.skills.filter((s) => s.status === status)
        if (!items.length) return null
        return (
          <section key={status} aria-label={`${label} skills`}>
            <h3 className={cn('mb-2 flex items-center gap-2 text-sm font-semibold', tone)}>
              <Icon className="size-4" /> {label} ({items.length})
            </h3>
            <ul className="grid grid-cols-1 gap-2">
              {items.map((s) => (
                <SkillRow
                  key={s.skill}
                  s={s}
                  busy={mut.isPending}
                  onConfirm={() => setConfirming(s.skill)}
                  onAct={(action) => mut.mutate({ skill: s.skill, action })}
                />
              ))}
            </ul>
          </section>
        )
      })}
      <ConfirmDialog skill={confirming} onClose={() => setConfirming(null)} jobId={jobId} />
    </div>
  )
}
