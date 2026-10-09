import { useState, type ReactNode } from 'react'
import { Check, Minus } from 'lucide-react'
import type { TailoringResult } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from './copy-button'

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function KeywordSection({ keywords }: { keywords: TailoringResult['keywords'] }) {
  if (!keywords.length)
    return <p className="text-sm text-muted-foreground">This job lists no specific skills to cover.</p>
  return (
    <ul className="space-y-2">
      {keywords.map((k) => (
        <li key={k.keyword} className="flex gap-2 text-sm">
          {k.present ? (
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Present" />
          ) : (
            <Minus className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Missing" />
          )}
          <div className="min-w-0">
            <span className="font-medium">{k.keyword}</span>
            {!k.present && (
              <Badge variant="outline" className="ml-2 text-warning">
                Only add if true
              </Badge>
            )}
            <p className="text-muted-foreground">{k.suggestion}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function SkillOrder({ skills }: { skills: string[] }) {
  if (!skills.length)
    return <p className="text-sm text-muted-foreground">Add skills to your profile to get an order.</p>
  return (
    <ol className="flex flex-wrap gap-2">
      {skills.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
          <span className="text-muted-foreground">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  )
}

export function SummaryEditor({ summary }: { summary: string }) {
  const [text, setText] = useState(summary)
  return (
    <div className="space-y-2">
      <Textarea aria-label="Tailored summary" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Edit freely. Check every claim is true before using it.</p>
        <CopyButton text={text} />
      </div>
    </div>
  )
}
