import { Plus, Trash2 } from 'lucide-react'
import type { JobRequirement } from '@copilot/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uid } from '@/lib/format'

export const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function ResponsibilitiesEditor({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {value.length === 0 && <p className="text-sm text-muted-foreground">No responsibilities added.</p>}
      {value.map((r, i) => (
        <div key={i} className="flex gap-2">
          <Input
            aria-label={`Responsibility ${i + 1}`}
            value={r}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove responsibility ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...value, ''])}>
        <Plus /> Add responsibility
      </Button>
    </div>
  )
}

export function RequirementsEditor({
  value,
  onChange,
}: {
  value: JobRequirement[]
  onChange: (v: JobRequirement[]) => void
}) {
  const patch = (i: number, p: Partial<JobRequirement>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...p } : r)))
  return (
    <div className="grid grid-cols-1 gap-3">
      {value.length === 0 && <p className="text-sm text-muted-foreground">No requirements added.</p>}
      {value.map((r, i) => (
        <div key={r.id} className="grid grid-cols-1 gap-2 rounded-lg border p-2.5 sm:grid-cols-[1fr_auto]">
          <Input
            aria-label={`Requirement ${i + 1} text`}
            placeholder="e.g. 3+ years of React"
            value={r.text}
            onChange={(e) => patch(i, { text: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`Requirement ${i + 1} importance`}
              className={`${selectClass} w-28`}
              value={r.kind}
              onChange={(e) => patch(i, { kind: e.target.value as JobRequirement['kind'] })}
            >
              <option value="required">Required</option>
              <option value="preferred">Preferred</option>
            </select>
            <select
              aria-label={`Requirement ${i + 1} category`}
              className={`${selectClass} w-28`}
              value={r.category}
              onChange={(e) => patch(i, { category: e.target.value as JobRequirement['category'] })}
            >
              <option value="skill">Skill</option>
              <option value="experience">Experience</option>
              <option value="education">Education</option>
              <option value="other">Other</option>
            </select>
            {r.category === 'skill' && (
              <Input
                aria-label={`Requirement ${i + 1} skill name`}
                placeholder="Skill"
                className="w-32"
                value={r.skill ?? ''}
                onChange={(e) => patch(i, { skill: e.target.value })}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove requirement ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...value, { id: uid('req'), kind: 'required', category: 'skill', text: '' }])}
      >
        <Plus /> Add requirement
      </Button>
    </div>
  )
}
