import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

/** Initial pipeline stage for a new job: Saved (default) or already applied. */
export function StartStatus({
  applied,
  onChange,
  id = 'already-applied',
}: {
  applied: boolean
  onChange: (applied: boolean) => void
  id?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <Checkbox id={id} checked={applied} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className="font-normal">
        I already applied <span className="text-muted-foreground">(otherwise it starts as Saved)</span>
      </Label>
    </div>
  )
}
