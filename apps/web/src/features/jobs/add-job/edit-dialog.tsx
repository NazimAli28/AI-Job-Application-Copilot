import type { Job } from '@copilot/shared'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useParseJob, useUpdateJob } from '../api'
import { JobForm, toDraft } from '../job-form'

/** Edit posting details only (tracking fields live on the job page tabs). */
export function EditJobDialog({
  job,
  open,
  onOpenChange,
}: {
  job: Job
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const update = useUpdateJob(job.id)
  const parse = useParseJob(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit job details</DialogTitle>
          <DialogDescription>Changing the description or requirements refreshes your estimated fit.</DialogDescription>
        </DialogHeader>
        <JobForm
          initial={toDraft(job)}
          submitLabel="Save changes"
          pending={update.isPending}
          reextract={{ pending: parse.isPending, run: (text) => parse.mutateAsync(text) }}
          onCancel={() => onOpenChange(false)}
          onSubmit={(v) =>
            update.mutate(v, {
              onSuccess: () => {
                toast.success('Job updated')
                onOpenChange(false)
              },
            })
          }
        />
      </DialogContent>
    </Dialog>
  )
}
