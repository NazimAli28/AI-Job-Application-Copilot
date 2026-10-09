import { useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Download, FileText, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Job, Resume } from '@copilot/shared'
import { ConfirmAction } from '@/components/common/confirm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useJobs } from '@/features/jobs/api'
import { errorMessage } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { downloadResume, useActivateResume, useDeleteResume, usePatchResume } from '../api'

function LabelEditor({ r }: { r: Resume }) {
  const patch = usePatchResume()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(r.label ?? '')
  const save = () => {
    setEditing(false)
    if (value.trim() !== (r.label ?? '')) patch.mutate({ id: r.id, label: value.trim() })
  }
  if (editing)
    return (
      <Input
        autoFocus
        value={value}
        maxLength={80}
        aria-label="Resume label"
        placeholder="e.g. Frontend v2"
        className="h-7 max-w-64"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') {
            setValue(r.label ?? '')
            setEditing(false)
          }
        }}
      />
    )
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      aria-label={r.label ? `Edit label ${r.label}` : 'Add a label'}
    >
      <Pencil className="size-3" /> {r.label || 'Add label'}
    </button>
  )
}

function UsedFor({ r, jobs }: { r: Resume; jobs: Job[] }) {
  const used = jobs.filter((j) => j.materials?.resumeId === r.id || j.id === r.jobId)
  if (!used.length) return null
  return (
    <p className="text-xs text-muted-foreground">
      Used for:{' '}
      {used.map((j, i) => (
        <span key={j.id}>
          {i > 0 && ', '}
          <Link to={`/app/jobs/${j.id}?tab=resume`} className="text-primary hover:underline">
            {j.title} @ {j.company}
          </Link>
        </span>
      ))}
    </p>
  )
}

export function ResumeList({
  resumes,
  selectedId,
  onSelect,
}: {
  resumes: Resume[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const activate = useActivateResume()
  const remove = useDeleteResume()
  const jobs = useJobs().data ?? []

  return (
    <ul className="space-y-2">
      {resumes.map((r) => (
        <li
          key={r.id}
          className={cn(
            'flex flex-col gap-1.5 rounded-xl border p-3',
            r.id === selectedId && 'border-primary/50 bg-primary/5',
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              aria-pressed={r.id === selectedId}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.label || r.fileName}</span>
                {r.label && (
                  <span className="block truncate text-xs text-muted-foreground">{r.fileName}</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {formatBytes(r.fileSize)} · uploaded {formatDate(r.uploadedAt)}
                  {r.analysis && ` · score ${Math.round(r.analysis.overallScore)}`}
                </span>
              </span>
            </button>
            <div className="flex flex-wrap items-center gap-1.5">
              {r.isActive ? (
                <Badge className="bg-success/15 text-success">
                  <CheckCircle2 className="size-3" /> Active
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activate.isPending}
                  onClick={() => activate.mutate(r.id)}
                >
                  Set active
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Download ${r.fileName}`}
                onClick={() => downloadResume(r).catch((e) => toast.error(errorMessage(e)))}
              >
                <Download />
              </Button>
              <ConfirmAction
                title="Delete this resume?"
                description={`"${r.fileName}" and its analysis will be removed. Your profile data is not affected.`}
                onConfirm={() => remove.mutate(r.id)}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.fileName}`}>
                    <Trash2 />
                  </Button>
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:pl-8">
            <LabelEditor r={r} />
            <UsedFor r={r} jobs={jobs} />
          </div>
        </li>
      ))}
    </ul>
  )
}
