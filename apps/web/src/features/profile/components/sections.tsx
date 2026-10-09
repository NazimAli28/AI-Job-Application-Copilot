import { Award, Briefcase, FolderGit2, GraduationCap, Sparkles } from 'lucide-react'
import type { Certification, Education, Experience, Project, ProfileSkill } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { formatMonth } from '@/lib/format'
import { CrudSection } from './crud-section'
import { ExperienceForm } from './experience-form'
import { SkillForm, STATUS_LABEL, statusClass } from './skill-form'
import { CertificationForm, EducationForm, ProjectForm } from './simple-forms'

const Tags = ({ items }: { items: string[] }) =>
  items.length ? (
    <div className="mt-2 flex flex-wrap gap-1">
      {items.map((t) => (
        <Badge key={t} variant="secondary">
          {t}
        </Badge>
      ))}
    </div>
  ) : null

export function SkillsSection({ items }: { items: ProfileSkill[] }) {
  return (
    <CrudSection<ProfileSkill>
      name="skills"
      noun="skill"
      icon={Sparkles}
      emptyText="Add skills you have or are learning. Only confirmed skills count towards job matches."
      items={items}
      Form={SkillForm}
      renderItem={(s) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{s.name}</span>
            <Badge className={statusClass(s.status)}>{STATUS_LABEL[s.status]}</Badge>
            {s.level && <Badge variant="outline">{s.level}</Badge>}
            {s.years !== undefined && <span className="text-xs text-muted-foreground">{s.years} yrs</span>}
            {s.source === 'resume' && <span className="text-xs text-muted-foreground">from resume</span>}
          </div>
          {s.evidence && <p className="mt-1 text-sm text-muted-foreground">{s.evidence}</p>}
        </div>
      )}
    />
  )
}

export function ExperienceSection({ items }: { items: Experience[] }) {
  const sorted = [...items].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
  return (
    <CrudSection<Experience>
      name="experience"
      noun="experience"
      icon={Briefcase}
      emptyText="Add your roles so matching and tailoring can use real evidence."
      items={sorted}
      Form={ExperienceForm}
      renderItem={(e) => (
        <div>
          <p className="font-medium">{e.title}</p>
          <p className="text-sm text-muted-foreground">
            {e.company}
            {e.location ? ` · ${e.location}` : ''} · {formatMonth(e.startDate)} –{' '}
            {e.current ? 'Present' : formatMonth(e.endDate)}
          </p>
          {e.bullets.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {e.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          <Tags items={e.technologies} />
        </div>
      )}
    />
  )
}

export function EducationSection({ items }: { items: Education[] }) {
  return (
    <CrudSection<Education>
      name="education"
      noun="education"
      icon={GraduationCap}
      emptyText="Add degrees, diplomas or courses."
      items={items}
      Form={EducationForm}
      renderItem={(e) => (
        <div>
          <p className="font-medium">
            {e.degree}
            {e.field ? `, ${e.field}` : ''}
          </p>
          <p className="text-sm text-muted-foreground">
            {e.institution}
            {(e.startDate || e.endDate) &&
              ` · ${e.startDate ? formatMonth(e.startDate) : ''} – ${formatMonth(e.endDate)}`}
            {e.grade ? ` · ${e.grade}` : ''}
          </p>
        </div>
      )}
    />
  )
}

export function ProjectsSection({ items }: { items: Project[] }) {
  return (
    <CrudSection<Project>
      name="projects"
      noun="project"
      icon={FolderGit2}
      emptyText="Personal, open-source or client projects show practical skills."
      items={items}
      Form={ProjectForm}
      renderItem={(p) => (
        <div>
          <p className="font-medium">{p.name}</p>
          <p className="text-sm text-muted-foreground">{p.description}</p>
          {p.url && (
            <a href={p.url} target="_blank" rel="noreferrer" className="text-sm break-all text-primary hover:underline">
              {p.url}
            </a>
          )}
          <Tags items={p.technologies} />
        </div>
      )}
    />
  )
}

export function CertificationsSection({ items }: { items: Certification[] }) {
  return (
    <CrudSection<Certification>
      name="certifications"
      noun="certification"
      icon={Award}
      emptyText="Add certifications you hold."
      items={items}
      Form={CertificationForm}
      renderItem={(c) => (
        <div>
          <p className="font-medium">{c.name}</p>
          <p className="text-sm text-muted-foreground">
            {[c.issuer, c.date ? formatMonth(c.date) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}
    />
  )
}
