import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import type { BulletSuggestion } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Review = (v: { sid: string; status: 'accepted' | 'rejected'; suggested?: string }) => void

function Item({ s, onReview, busy }: { s: BulletSuggestion; onReview: Review; busy: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(s.suggested)
  const hasPlaceholder = (editing ? draft : s.suggested).includes('[add metric]')
  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{s.section}</span>
        {s.status !== 'pending' && (
          <Badge variant={s.status === 'accepted' ? 'default' : 'secondary'} className="capitalize">
            {s.status}
          </Badge>
        )}
      </div>
      <p className="rounded-md bg-muted/50 px-2 py-1.5 text-sm text-muted-foreground line-through decoration-muted-foreground/50">
        {s.original}
      </p>
      {editing ? (
        <Textarea
          aria-label="Edit suggested bullet"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
        />
      ) : (
        <p className="rounded-md bg-success/10 px-2 py-1.5 text-sm">{s.suggested}</p>
      )}
      {hasPlaceholder && (
        <p className="text-xs text-warning">
          Replace &quot;[add metric]&quot; with a real number, or remove it. Never use a figure that isn&apos;t true.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Why: {s.reason}</p>
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={busy || !draft.trim()}
              onClick={() => {
                onReview({ sid: s.id, status: 'accepted', suggested: draft.trim() })
                setEditing(false)
              }}
            >
              <Check /> Save &amp; accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(s.suggested)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant={s.status === 'accepted' ? 'secondary' : 'default'}
              disabled={busy || s.status === 'accepted'}
              onClick={() => onReview({ sid: s.id, status: 'accepted' })}
            >
              <Check /> Accept
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || s.status === 'rejected'}
              onClick={() => onReview({ sid: s.id, status: 'rejected' })}
            >
              <X /> Reject
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

/** Diff-style list: original (struck) vs suggested (highlighted); user approves each change. */
export function SuggestionList({
  items,
  onReview,
  busy,
  className,
}: {
  items: BulletSuggestion[]
  onReview: Review
  busy: boolean
  className?: string
}) {
  if (!items.length)
    return (
      <p className="text-sm text-muted-foreground">
        No bullet rewrites to suggest. Add experience bullets in your profile to get rewrite ideas.
      </p>
    )
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((s) => (
        <Item key={`${s.id}-${s.suggested}`} s={s} onReview={onReview} busy={busy} />
      ))}
    </ul>
  )
}
