import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  ExternalLink,
  FileText,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { attachmentLinkInput, type Attachment, type Job } from '@copilot/shared'
import { ConfirmAction } from '@/components/common/confirm'
import { Field } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/format'
import {
  downloadAttachment,
  useAddFileAttachment,
  useAddLinkAttachment,
  useDeleteAttachment,
} from './api'

const MAX_BYTES = 4 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.txt,.rtf,.odt,.png,.jpg,.jpeg,.gif,.webp,.zip'

function Row({ jobId, a, onDelete }: { jobId: string; a: Attachment; onDelete: () => void }) {
  const Icon = a.kind === 'link' ? Link2 : FileText
  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {a.kind === 'link'
            ? a.url
            : `${a.fileName ?? ''}${a.fileSize ? ` · ${formatBytes(a.fileSize)}` : ''}`}{' '}
          · added {formatDate(a.addedAt)}
        </p>
      </div>
      {a.kind === 'link' && a.url ? (
        <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${a.label}`}>
          <a href={a.url} target="_blank" rel="noreferrer noopener">
            <ExternalLink />
          </a>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Download ${a.label}`}
          onClick={() => downloadAttachment(jobId, a).catch((e) => toast.error(errorMessage(e)))}
        >
          <Download />
        </Button>
      )}
      <ConfirmAction
        title="Remove this attachment?"
        description={`"${a.label}" will be removed from this job.`}
        confirmLabel="Remove"
        onConfirm={onDelete}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.label}`}>
            <Trash2 />
          </Button>
        }
      />
    </li>
  )
}

function AddLink({ jobId }: { jobId: string }) {
  const add = useAddLinkAttachment(jobId)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string>()
  const submit = () => {
    const r = attachmentLinkInput.safeParse({ label, url })
    if (!r.success) return setError(r.error.issues[0]?.message)
    setError(undefined)
    add.mutate(r.data, {
      onSuccess: () => {
        setLabel('')
        setUrl('')
        toast.success('Link added')
      },
    })
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="Link label" htmlFor="att-label">
        <Input
          id="att-label"
          value={label}
          placeholder="Portfolio"
          maxLength={120}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <Field label="URL" htmlFor="att-url" error={error}>
        <Input
          id="att-url"
          value={url}
          placeholder="https://"
          inputMode="url"
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>
      <Button variant="outline" size="sm" className="h-8" disabled={add.isPending} onClick={submit}>
        {add.isPending ? <Spinner /> : <Plus />} Add link
      </Button>
    </div>
  )
}

export function AttachmentsList({ job }: { job: Job }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const addFile = useAddFileAttachment(job.id)
  const del = useDeleteAttachment(job.id)
  const list = job.materials.attachments

  const onFile = (file?: File) => {
    if (!file) return
    if (file.size > MAX_BYTES) return toast.error('That file is larger than 4 MB.')
    if (file.size === 0) return toast.error('That file is empty.')
    addFile.mutate({ file, label: file.name }, { onSuccess: () => toast.success('File added') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4" /> Other files &amp; links sent
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing attached yet. Add a portfolio link or a file you sent.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {list.map((a) => (
              <Row key={a.id} jobId={job.id} a={a} onDelete={() => del.mutate(a.id)} />
            ))}
          </ul>
        )}
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={addFile.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {addFile.isPending ? <Spinner /> : <Upload />} Upload a file
          </Button>
          <span className="ml-2 text-xs text-muted-foreground">
            Documents or images, up to 4 MB.
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Upload attachment"
            onChange={(e) => {
              onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        <AddLink jobId={job.id} />
      </CardContent>
    </Card>
  )
}
