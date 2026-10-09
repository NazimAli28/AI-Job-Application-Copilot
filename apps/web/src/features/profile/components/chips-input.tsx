import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Tag input: Enter or comma adds a chip, Backspace on empty input removes the last one. */
export function ChipsInput({
  id,
  value,
  onChange,
  placeholder = 'Type and press Enter',
  max,
  label,
  className,
}: {
  id: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  max?: number
  /** Used for the accessible name of remove buttons context. */
  label?: string
  className?: string
}) {
  const [draft, setDraft] = useState('')
  const full = max !== undefined && value.length >= max

  const commit = () => {
    const parts = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    setDraft('')
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) {
      if (max !== undefined && next.length >= max) break
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p)
    }
    onChange(next)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        className,
      )}
    >
      {value.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1 pr-1">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="rounded-sm p-0.5 hover:bg-background/60"
            aria-label={`Remove ${v}${label ? ` from ${label}` : ''}`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        disabled={full}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={full ? `Maximum ${max} reached` : placeholder}
        className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  )
}
