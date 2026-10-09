import { useState } from 'react'
import { Upload } from 'lucide-react'
import type { Resume } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { UploadZone } from '@/features/resume/components/upload-zone'
import { useResumes } from '@/features/resume/api'

const name = (r: Resume) => r.label?.trim() || r.fileName

export const defaultResumeId = (rs: Resume[] | undefined) =>
  (rs?.find((r) => r.isActive && r.status === 'ready') ?? rs?.find((r) => r.status === 'ready'))?.id

/** Step 1: choose an existing resume (default = active) or upload a new one inline. */
export function ResumePicker({
  value,
  onChange,
  error,
}: {
  value: string | undefined
  onChange: (id: string) => void
  error?: string
}) {
  const { data, isPending } = useResumes()
  const [uploading, setUploading] = useState(false)
  if (isPending) return <Skeleton className="h-9 w-full" />
  const ready = (data ?? []).filter((r) => r.status === 'ready')
  const selected = ready.find((r) => r.id === value)

  if (ready.length === 0 || uploading)
    return (
      <div className="space-y-2">
        <UploadZone
          compact
          onUploaded={(r) => {
            onChange(r.id)
            setUploading(false)
          }}
        />
        {ready.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setUploading(false)}>
            Use an existing resume instead
          </Button>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    )

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="fit-resume" aria-label="Resume" className="w-full" aria-invalid={!!error}>
          <SelectValue placeholder="Choose a resume" />
        </SelectTrigger>
        <SelectContent>
          {ready.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {name(r)}
              {r.analysis ? ` · ${Math.round(r.analysis.overallScore)}` : ''}
              {r.isActive ? ' · Active' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setUploading(true)}>
          <Upload /> Upload new
        </Button>
        {selected?.isActive && <Badge variant="secondary">Active resume</Badge>}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
