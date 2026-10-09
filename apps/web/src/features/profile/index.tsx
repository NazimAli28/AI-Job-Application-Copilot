import { Link } from 'react-router'
import { CheckCircle2, Circle } from 'lucide-react'
import { ErrorState, PageHeader, PageSkeleton } from '@/components/common/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentUser } from '@/features/auth/api'
import { completeness, useProfile } from './api'
import { emptyProfile, PersonalTab } from './components/personal-tab'
import {
  CertificationsSection,
  EducationSection,
  ExperienceSection,
  ProjectsSection,
  SkillsSection,
} from './components/sections'

export function ProfilePage() {
  const user = useCurrentUser()
  const { data, isPending, error, refetch } = useProfile()
  if (isPending) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  const { pct, missing } = completeness(data)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Profile"
        description="Your source of truth. Matches, tailoring and cover letters only use what is here."
      />

      {!data.profile && (
        <Alert className="mb-4">
          <AlertTitle>Start with your basics</AlertTitle>
          <AlertDescription>
            Fill in the Personal tab and save, or{' '}
            <Link to="/app/resume" className="font-medium text-primary underline">
              upload a resume
            </Link>{' '}
            and import from it.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">Profile completeness</p>
            <span className="font-heading text-lg font-semibold tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} aria-label="Profile completeness" />
          {missing.length > 0 ? (
            <ul className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {missing.slice(0, 4).map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <Circle className="size-3.5 shrink-0" /> {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" /> Your profile is complete.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="skills">Skills ({data.skills.length})</TabsTrigger>
            <TabsTrigger value="experience">Experience ({data.experience.length})</TabsTrigger>
            <TabsTrigger value="education">Education ({data.education.length})</TabsTrigger>
            <TabsTrigger value="projects">Projects ({data.projects.length})</TabsTrigger>
            <TabsTrigger value="certifications">Certifications ({data.certifications.length})</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="personal" className="mt-4">
          <PersonalTab
            key={data.profile ? 'saved' : 'new'}
            profile={data.profile}
            defaults={emptyProfile(user.name, user.email)}
          />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillsSection items={data.skills} />
        </TabsContent>
        <TabsContent value="experience" className="mt-4">
          <ExperienceSection items={data.experience} />
        </TabsContent>
        <TabsContent value="education" className="mt-4">
          <EducationSection items={data.education} />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <ProjectsSection items={data.projects} />
        </TabsContent>
        <TabsContent value="certifications" className="mt-4">
          <CertificationsSection items={data.certifications} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
