import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Editable list of bullet strings. */
export function BulletsEditor({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="space-y-2">
      {value.map((b, i) => (
        <div key={i} className="flex gap-2">
          <Input
            id={`${idPrefix}-${i}`}
            aria-label={`Bullet ${i + 1}`}
            value={b}
            maxLength={400}
            placeholder="What did you do, and what changed because of it?"
            onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove bullet ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ''])}>
        <Plus /> Add bullet
      </Button>
    </div>
  )
}
