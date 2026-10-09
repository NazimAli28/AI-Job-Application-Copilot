import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { Job } from '@copilot/shared'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/common/states'
import { useCreateSession, useSavedJobs } from './api'

export function NewSessionDialog({ trigger }: { trigger: ReactNode }) {
  const navigate = useNavigate()
  const jobs = useSavedJobs()
  const create = useCreateSession()
  const [open, setOpen] = useState(false)
  const [jobId, setJobId] = useState('')
  const [mode, setMode] = useState<'practice' | 'mock'>('mock')
  const list: Job[] = (jobs.data ?? []).filter((j) => j.status === 'saved')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New interview session</DialogTitle>
          <DialogDescription>Pick a saved job and how you want to practice.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="session-job">Job</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger id="session-job" className="w-full">
                <SelectValue placeholder={jobs.isPending ? 'Loading jobs…' : 'Choose a saved job'} />
              </SelectTrigger>
              <SelectContent>
                {list.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} · {j.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!jobs.isPending && list.length === 0 && (
              <p className="text-xs text-muted-foreground">Save a job first to practice for it.</p>
            )}
          </div>
          <fieldset className="grid grid-cols-1 gap-2">
            <legend className="mb-1 text-sm font-medium">Mode</legend>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'practice' | 'mock')}>
              <Label htmlFor="mode-mock" className="flex items-start gap-3 rounded-lg border p-3 font-normal">
                <RadioGroupItem id="mode-mock" value="mock" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Mock interview</span>
                  <span className="text-xs text-muted-foreground">About 6 mixed questions, one at a time.</span>
                </span>
              </Label>
              <Label htmlFor="mode-practice" className="flex items-start gap-3 rounded-lg border p-3 font-normal">
                <RadioGroupItem id="mode-practice" value="practice" className="mt-0.5" />
                <span>
                  <span className="block font-medium">Practice</span>
                  <span className="text-xs text-muted-foreground">Every question for the job, at your own pace.</span>
                </span>
              </Label>
            </RadioGroup>
          </fieldset>
        </div>
        <DialogFooter>
          <Button
            disabled={!jobId || create.isPending}
            onClick={() =>
              create.mutate(
                { jobId, mode },
                {
                  onSuccess: (s) => {
                    setOpen(false)
                    navigate(`/app/interviews/${s.id}`)
                  },
                },
              )
            }
          >
            {create.isPending && <Spinner />} Start session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
