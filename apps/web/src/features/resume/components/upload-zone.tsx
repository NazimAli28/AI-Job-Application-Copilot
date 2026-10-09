import { useRef, useState, type DragEvent } from 'react'
import { AlertCircle, FileUp } from 'lucide-react'
import { RESUME_MAX_BYTES, type Resume } from '@copilot/shared'
import { GeneratingState } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUploadResume, validateResumeFile } from '../api'

/** Drag-and-drop / click upload for PDF resumes with client-side validation. */
export function UploadZone({
  onUploaded,
  compact,
}: {
  onUploaded?: (r: Resume) => void
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const upload = useUploadResume()

  const handle = (file: File | undefined) => {
    if (!file) return
    const problem = validateResumeFile(file, RESUME_MAX_BYTES)
    setError(problem)
    if (problem) return
    upload.mutate(file, {
      onSuccess: (r) => onUploaded?.(r),
      onError: (e) => setError(errorMessage(e)),
    })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    handle(e.dataTransfer.files[0])
  }

  if (upload.isPending)
    return (
      <GeneratingState
        label="Reading your resume…"
        steps={['Extracting text', 'Detecting sections', 'Running the rule-based analysis']}
      />
    )

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          compact ? 'py-8' : 'py-12',
          drag ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileUp className="size-5" />
        </span>
        <span className="font-medium">Drop your resume here, or click to browse</span>
        <span className="mt-1 text-sm text-muted-foreground">
          PDF only, up to 4 MB. Text-based PDFs work best.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Upload resume PDF"
        onChange={(e) => {
          handle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
