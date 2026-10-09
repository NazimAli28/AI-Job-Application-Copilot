import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import type { ParsedResume } from '@copilot/shared'
import { Spinner } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useImportFromResume, useProfile } from '@/features/profile/api'
import { formatMonth } from '@/lib/format'

function ImportDialog({
  parsed,
  open,
  onOpenChange,
}: {
  parsed: ParsedResume
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data: profile } = useProfile()
  const importer = useImportFromResume()
  const existing = new Set(profile?.skills.map((s) => s.name.toLowerCase()))
  const fresh = parsed.skills.filter((s) => !existing.has(s.toLowerCase()))
  const [skills, setSkills] = useState<string[] | null>(null)
  const [sections, setSections] = useState({ experience: true, education: true, projects: true })
  const chosen = skills ?? fresh

  const toggleSkill = (s: string, on: boolean) =>
    setSkills(on ? [...chosen, s] : chosen.filter((x) => x !== s))
  const groups = [
    {
      key: 'experience',
      label: `Experience (${parsed.experience.length})`,
      n: parsed.experience.length,
    },
    {
      key: 'education',
      label: `Education (${parsed.education.length})`,
      n: parsed.education.length,
    },
    { key: 'projects', label: `Projects (${parsed.projects.length})`, n: parsed.projects.length },
  ] as const

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import into your profile</DialogTitle>
          <DialogDescription>
            Review what we found. Only ticked items are added, and anything already in your profile
            is skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Skills ({fresh.length} new)</legend>
            {fresh.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All detected skills are already in your profile.
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {fresh.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox
                    id={`imp-${s}`}
                    checked={chosen.includes(s)}
                    onCheckedChange={(c) => toggleSkill(s, c === true)}
                  />
                  <Label htmlFor={`imp-${s}`} className="font-normal">
                    {s}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Sections</legend>
            {groups.map((g) => (
              <div key={g.key} className="flex items-center gap-2">
                <Checkbox
                  id={`imp-${g.key}`}
                  disabled={g.n === 0}
                  checked={g.n > 0 && sections[g.key]}
                  onCheckedChange={(c) => setSections({ ...sections, [g.key]: c === true })}
                />
                <Label htmlFor={`imp-${g.key}`} className="font-normal">
                  {g.label}
                </Label>
              </div>
            ))}
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={importer.isPending}
            onClick={() =>
              importer.mutate(
                { skills: chosen, ...sections },
                {
                  onSuccess: (r) => {
                    toast.success(
                      `Imported ${r.skills} skills, ${r.experience} roles, ${r.education} education, ${r.projects} projects`,
                    )
                    onOpenChange(false)
                  },
                },
              )
            }
          >
            {importer.isPending && <Spinner />} Import selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-1 sm:grid-cols-[8rem_1fr]">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-sm break-words">{children}</dd>
  </div>
)

/** What the parser extracted, plus the import-into-profile action. */
export function ParsedPanel({ parsed, isActive }: { parsed: ParsedResume; isActive: boolean }) {
  const [open, setOpen] = useState(false)
  const c = parsed.contact
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parsed data</CardTitle>
        <CardDescription>
          What we detected in your PDF. Parsing is automatic and can be wrong, so review before
          importing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2">
          <Row label="Sections found">
            {parsed.sections.length ? (
              <span className="flex flex-wrap gap-1">
                {parsed.sections.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </span>
            ) : (
              'None detected'
            )}
          </Row>
          <Row label="Contact">
            {[c.name, c.email, c.phone, c.location].filter(Boolean).join(' · ') ||
              'Nothing detected'}
          </Row>
          <Row label="Skills">
            {parsed.skills.length ? (
              <span className="flex flex-wrap gap-1">
                {parsed.skills.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </span>
            ) : (
              'None detected'
            )}
          </Row>
          <Row label="Experience">
            {parsed.experience.length ? (
              <ul className="space-y-1">
                {parsed.experience.map((e, i) => (
                  <li key={i}>
                    {e.title} at {e.company}{' '}
                    <span className="text-muted-foreground">
                      ({formatMonth(e.startDate)} – {formatMonth(e.endDate)})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              'None detected'
            )}
          </Row>
          <Row label="Education">
            {parsed.education.length
              ? parsed.education.map((e) => `${e.degree}, ${e.institution}`).join(' · ')
              : 'None detected'}
          </Row>
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setOpen(true)} disabled={!isActive}>
            <Download /> Import into profile
          </Button>
          {!isActive && (
            <span className="text-sm text-muted-foreground">
              Set this resume as active to import from it.
            </span>
          )}
        </div>
        <ImportDialog key={String(open)} parsed={parsed} open={open} onOpenChange={setOpen} />
      </CardContent>
    </Card>
  )
}
