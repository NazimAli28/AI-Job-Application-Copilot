import { useNavigate } from 'react-router'
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal, MoveRight, Trash2 } from 'lucide-react'
import { APPLICATION_STATUSES, STATUS_LABELS } from '@copilot/shared'
import { ConfirmAction } from '@/components/common/confirm'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useArchiveJob, useChangeJobStatus, useDeleteJob, type JobListItem } from '../api'

export function JobActions({ job }: { job: JobListItem }) {
  const navigate = useNavigate()
  const archive = useArchiveJob()
  const del = useDeleteJob()
  const change = useChangeJobStatus()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${job.title}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => navigate(`/app/jobs/${job.id}`)}>
          <ExternalLink /> Open
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MoveRight /> Change status
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {APPLICATION_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                disabled={s === job.status}
                onSelect={() => change.mutate({ id: job.id, status: s })}
              >
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => archive.mutate(job.id)}>
          {job.archived ? <ArchiveRestore /> : <Archive />} {job.archived ? 'Unarchive' : 'Archive'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ConfirmAction
          trigger={
            <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          }
          title="Delete this job?"
          description="This permanently removes the job, its notes, attachments, match results, tailoring, cover letters and interview practice."
          onConfirm={() => del.mutate(job.id)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
