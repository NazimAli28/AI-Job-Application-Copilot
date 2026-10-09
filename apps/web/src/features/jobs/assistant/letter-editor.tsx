import { useLayoutEffect, useRef, useState } from 'react'
import { Download, Save, Trash2 } from 'lucide-react'
import type { CoverLetter } from '@copilot/shared'
import { SourceBadge } from '@/components/common/ai'
import { ConfirmAction } from '@/components/common/confirm'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CopyButton } from './copy-button'

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export function LetterEditor({
  letter,
  jobLabel,
  saving,
  onSave,
}: {
  letter: CoverLetter
  jobLabel: string
  saving: boolean
  onSave: (content: string) => void
}) {
  const [text, setText] = useState(letter.content)
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [text])
  const dirty = text !== letter.content

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `cover-letter-${jobLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <SourceBadge source={letter.source} />
        <span className="capitalize">
          {letter.length} / {letter.tone}
        </span>
        <span>{words(text)} words</span>
        {dirty && <span className="text-warning">Unsaved edits</span>}
      </div>
      <Textarea
        ref={ref}
        aria-label="Cover letter"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-64 resize-none overflow-hidden leading-relaxed"
      />
      <p className="text-xs text-muted-foreground">
        Review before sending: make sure every statement about you and the company is true.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!dirty || saving || !text.trim()} onClick={() => onSave(text)}>
          {saving ? <Spinner /> : <Save />} Save
        </Button>
        <CopyButton text={text} />
        <Button size="sm" variant="outline" onClick={download}>
          <Download /> Download .txt
        </Button>
      </div>
    </div>
  )
}

export function LetterVersions({
  letters,
  selectedId,
  onSelect,
  onDelete,
}: {
  letters: CoverLetter[]
  selectedId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Versions ({letters.length})</h3>
      <ul className="space-y-2">
        {letters.map((l) => (
          <li
            key={l.id}
            className={cn('flex items-center gap-2 rounded-lg border p-2', l.id === selectedId && 'border-primary bg-primary/5')}
          >
            <button
              type="button"
              aria-current={l.id === selectedId}
              onClick={() => onSelect(l.id)}
              className="min-w-0 flex-1 text-left text-sm"
            >
              <span className="block truncate font-medium capitalize">
                {l.length} / {l.tone} {l.source === 'ai' ? '(AI)' : ''}
              </span>
              <span className="block text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
            </button>
            <ConfirmAction
              trigger={
                <Button size="icon-sm" variant="ghost" aria-label="Delete this version">
                  <Trash2 />
                </Button>
              }
              title="Delete this cover letter?"
              description="This version and your edits to it will be removed."
              onConfirm={() => onDelete(l.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
