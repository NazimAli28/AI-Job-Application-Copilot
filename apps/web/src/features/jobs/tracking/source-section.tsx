import { useState } from 'react'
import { JOB_SOURCES, SOURCE_LABELS, type Job } from '@copilot/shared'
import { Field } from '@/components/common/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePatchJob } from './api'
import { Section } from './section'
import { same, savedToast } from './utils'

const draftOf = (job: Job) => ({
  source: job.source ?? '',
  referral: job.referral ?? '',
  reference: job.reference ?? '',
})

export function SourceSection({ job }: { job: Job }) {
  const patch = usePatchJob(job.id)
  const [d, setD] = useState(() => draftOf(job))
  return (
    <Section
      title="Where you applied"
      dirty={!same(d, draftOf(job))}
      pending={patch.isPending}
      onSave={() =>
        patch.mutate(
          {
            source: d.source ? (d.source as (typeof JOB_SOURCES)[number]) : undefined,
            referral: d.referral.trim(),
            reference: d.reference.trim(),
          },
          { onSuccess: savedToast('Source') },
        )
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Source" htmlFor="trk-source">
          <Select value={d.source || undefined} onValueChange={(v) => setD({ ...d, source: v })}>
            <SelectTrigger id="trk-source" className="w-full">
              <SelectValue placeholder="Choose where" />
            </SelectTrigger>
            <SelectContent>
              {JOB_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Referred by" htmlFor="trk-referral" optional>
          <Input
            id="trk-referral"
            value={d.referral}
            maxLength={100}
            onChange={(e) => setD({ ...d, referral: e.target.value })}
          />
        </Field>
        <Field label="Reference / job ID" htmlFor="trk-reference" optional>
          <Input
            id="trk-reference"
            value={d.reference}
            maxLength={80}
            onChange={(e) => setD({ ...d, reference: e.target.value })}
          />
        </Field>
      </div>
    </Section>
  )
}
