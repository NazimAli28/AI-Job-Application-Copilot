import { useState } from 'react'
import { toast } from 'sonner'
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
  type Job,
} from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, relativeTime } from '@/lib/format'
import { useSetStatus } from './api'

export function StatusSection({ job }: { job: Job }) {
  const set = useSetStatus(job.id)
  const [status, setStatus] = useState<ApplicationStatus>(job.status)
  const [note, setNote] = useState('')
  const items = [...job.history].reverse()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status &amp; timeline</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
          <Field label="Move to" htmlFor="trk-status">
            <Select value={status} onValueChange={(v) => setStatus(v as ApplicationStatus)}>
              <SelectTrigger id="trk-status" className="w-full">
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
          </Field>
          <Field label="Note" htmlFor="trk-status-note" optional>
            <Input
              id="trk-status-note"
              value={note}
              maxLength={500}
              placeholder="e.g. Recruiter called"
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Button
            size="sm"
            disabled={set.isPending || (status === job.status && !note.trim())}
            onClick={() =>
              set.mutate(
                { status, note: note.trim() || undefined },
                {
                  onSuccess: () => {
                    setNote('')
                    toast.success(`Status: ${STATUS_LABELS[status]}`)
                  },
                },
              )
            }
          >
            {set.isPending && <Spinner />} Update status
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {items.map((h, i) => (
              <li key={`${h.at}-${i}`} className="relative">
                <span
                  className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                  aria-hidden
                />
                <p className="text-sm font-medium">{STATUS_LABELS[h.status]}</p>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={h.at} title={new Date(h.at).toLocaleString()}>
                    {relativeTime(h.at)} · {formatDate(h.at)}
                  </time>
                </p>
                {h.note && <p className="mt-0.5 text-xs text-muted-foreground">{h.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
