import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { Analysis } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useSaveAnalysis } from './api'

/** Small dialog that turns a check into a tracked job. */
export function SaveJobDialog({ a, trigger }: { a: Analysis; trigger: ReactNode }) {
  const navigate = useNavigate()
  const save = useSaveAnalysis(a.id)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'saved' | 'applied'>('saved')
  const [title, setTitle] = useState(a.job.title)
  const [company, setCompany] = useState(a.job.company)

  const submit = () =>
    save.mutate(
      { status, title: title.trim() || undefined, company: company.trim() || undefined },
      {
        onSuccess: (job) => {
          toast.success('Saved to your jobs')
          navigate(`/app/jobs/${job.id}`)
        },
      },
    )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as job</DialogTitle>
          <DialogDescription>
            Keeps the match, tailoring and interview prep with the job so you can follow it from Applied to
            Offer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Job title" htmlFor="save-title">
            <Input id="save-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Company" htmlFor="save-company">
            <Input
              id="save-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={120}
            />
          </Field>
          <RadioGroup
            value={status}
            onValueChange={(v) => setStatus(v as 'saved' | 'applied')}
            aria-label="Status"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="saved" id="save-status-saved" />
              <Label htmlFor="save-status-saved">Saved (I might apply)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="applied" id="save-status-applied" />
              <Label htmlFor="save-status-applied">I&apos;ve already applied</Label>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={submit}>
            {save.isPending && <Spinner />} Save job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
