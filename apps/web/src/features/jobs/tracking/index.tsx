import type { Job } from '@copilot/shared'
import { ContactsSection } from './contacts-section'
import { DatesSection } from './dates-section'
import { MaterialsSection } from './materials-section'
import { NotesSection } from './notes-section'
import { ScreeningSection } from './screening-section'
import { SourceSection } from './source-section'
import { StatusSection } from './status-section'

/** Job detail → "Tracking" tab: pipeline, dates, source, what was sent, answers, contacts, notes. */
export function TrackingTab({ job }: { job: Job }) {
  return (
    <div className="grid min-w-0 gap-4">
      <StatusSection job={job} />
      <DatesSection job={job} />
      <SourceSection job={job} />
      <MaterialsSection job={job} />
      <ScreeningSection job={job} />
      <ContactsSection job={job} />
      <NotesSection job={job} />
    </div>
  )
}
