import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  needsDescription,
  type ApplicationStatus,
  type Job,
} from '@copilot/shared'
import { scoreTone } from '@/components/common/score'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useDeleteJob, useMatch } from '../api'
import { EditJobDialog } from '../add-job'
import { countdownLabel, daysUntil } from '../tracking/dates'
import { usePatchJob, useSetStatus } from '../tracking/api'

function MatchPill({ jobId }: { jobId: string }) {
  const { data } = useMatch(jobId)
  if (!data) return null
  const s = Math.round(data.score)
  return (
    <span
      title="Estimated fit"
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums',
        scoreTone(s),
      )}
    >
      {s}% estimated fit
    </span>
  )
}

export function JobHeader({ job }: { job: Job }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const setStatus = useSetStatus(job.id)
  const patch = usePatchJob(job.id)
  const del = useDeleteJob()
  const showCountdown = job.applyBy && job.status === 'saved'

  return (
    <div className="mb-5">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/app/jobs">
          <ArrowLeft /> Jobs
        </Link>
      </Button>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
            {job.title}
          </h1>
          <p className="text-muted-foreground">{job.company}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {job.location && <Badge variant="secondary">{job.location}</Badge>}
            {job.workType && !job.location?.toLowerCase().includes(job.workType) && (
              <Badge variant="secondary" className="capitalize">
                {job.workType}
              </Badge>
            )}
            {job.employmentType && (
              <Badge variant="outline" className="capitalize">
                {job.employmentType}
              </Badge>
            )}
            {job.archived && <Badge variant="outline">Archived</Badge>}
            {showCountdown && (
              <Badge
                variant="outline"
                className={cn(daysUntil(job.applyBy!) <= 3 && 'border-warning/50 text-warning')}
              >
                <CalendarClock className="size-3" /> {countdownLabel(job.applyBy!)}
              </Badge>
            )}
            {!needsDescription(job) && <MatchPill jobId={job.id} />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={job.status}
            disabled={setStatus.isPending}
            onValueChange={(v) =>
              setStatus.mutate(
                { status: v as ApplicationStatus },
                {
                  onSuccess: () =>
                    toast.success(`Moved to ${STATUS_LABELS[v as ApplicationStatus]}`),
                },
              )
            }
          >
            <SelectTrigger aria-label="Application status" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPLICATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Job actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit details
              </DropdownMenuItem>
              {job.url && (
                <DropdownMenuItem asChild>
                  <a href={job.url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink /> Open posting
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                disabled={patch.isPending}
                onSelect={() =>
                  patch.mutate(
                    { archived: !job.archived },
                    {
                      onSuccess: () =>
                        toast.success(job.archived ? 'Job restored' : 'Job archived'),
                    },
                  )
                }
              >
                {job.archived ? <ArchiveRestore /> : <Archive />}{' '}
                {job.archived ? 'Unarchive' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the job with its tracking history, attachments, match results, tailoring,
              cover letters and interview sessions. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                del.mutate(job.id, {
                  onSuccess: () => {
                    toast.success('Job deleted')
                    navigate('/app/jobs')
                  },
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editing && <EditJobDialog job={job} open onOpenChange={setEditing} />}
    </div>
  )
}
