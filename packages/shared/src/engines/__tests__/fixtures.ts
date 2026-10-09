import type { Application, ApplicationStatus } from '../../schemas/application'
import type { Job } from '../../schemas/job'
import type { CandidateBundle } from '../../schemas/profile'
import { defaultTracking } from '../../schemas/tracking'
import { parseJobDescription } from '../job-parser'
import { SAMPLE_JOB_DESCRIPTION, SAMPLE_RESUME_TEXT } from '../data/samples'

export { SAMPLE_JOB_DESCRIPTION, SAMPLE_RESUME_TEXT }

export const NOW = '2026-10-07T12:00:00.000Z'

export function makeJob(overrides: Partial<Job> = {}, description = SAMPLE_JOB_DESCRIPTION): Job {
  const p = parseJobDescription(description)
  return {
    id: 'job-1',
    title: p.title ?? 'Role',
    company: p.company ?? 'Company',
    description,
    responsibilities: p.responsibilities,
    requirements: p.requirements,
    ...defaultTracking(),
    createdAt: NOW,
    updatedAt: NOW,
    ...(p.location ? { location: p.location } : {}),
    ...(p.workType ? { workType: p.workType } : {}),
    ...(p.employmentType ? { employmentType: p.employmentType } : {}),
    ...(p.experienceYearsMin !== undefined ? { experienceYearsMin: p.experienceYearsMin } : {}),
    ...(p.educationRequirement ? { educationRequirement: p.educationRequirement } : {}),
    ...overrides,
  }
}

export function makeCandidate(overrides: Partial<CandidateBundle> = {}): CandidateBundle {
  return {
    profile: {
      fullName: 'Jordan Rivera',
      email: 'jordan.rivera@example.com',
      targetTitles: ['Frontend Engineer'],
      yearsExperience: 4,
      workTypes: ['remote', 'hybrid'],
      preferredLocations: ['Austin, TX'],
      salaryCurrency: 'USD',
    },
    skills: [
      { id: 's1', name: 'React', level: 'advanced', years: 3, status: 'confirmed', source: 'manual' },
      { id: 's2', name: 'TypeScript', level: 'advanced', years: 3, status: 'confirmed', source: 'manual' },
      { id: 's3', name: 'JavaScript', level: 'expert', years: 5, status: 'confirmed', source: 'resume' },
      { id: 's4', name: 'Git', status: 'confirmed', source: 'resume' },
      { id: 's5', name: 'Vue', status: 'learning', source: 'manual' },
      { id: 's6', name: 'Docker', status: 'rejected', source: 'manual' },
    ],
    experience: [
      {
        id: 'e1',
        title: 'Frontend Developer',
        company: 'Brightwave Software',
        startDate: '2021-01',
        current: true,
        bullets: [
          'Responsible for building and maintaining the customer dashboard using React, TypeScript and Redux',
          'Reduced page load time by 35% by introducing code splitting and image optimization',
          'Worked on migrating the legacy jQuery codebase to React components',
          'Helped to improve the CI/CD pipeline in GitHub Actions',
        ],
        technologies: ['React', 'TypeScript', 'Redux', 'Jest'],
      },
      {
        id: 'e2',
        title: 'Junior Web Developer',
        company: 'Pixel & Co',
        startDate: '2019-06',
        endDate: '2020-12',
        current: false,
        bullets: ['Developed responsive marketing websites with HTML, CSS and JavaScript', 'Assisted with fixing bugs reported by the QA team'],
        technologies: ['HTML', 'CSS', 'JavaScript'],
      },
    ],
    education: [{ id: 'ed1', institution: 'University of Texas at Austin', degree: 'B.S.', field: 'Computer Science', endDate: '2019' }],
    projects: [
      { id: 'p1', name: 'Task Tracker', description: 'Full-stack task manager with JWT authentication', technologies: ['React', 'Node.js', 'PostgreSQL'], bullets: [] },
      { id: 'p2', name: 'Portfolio Site', description: 'Personal site deployed on Vercel', technologies: ['Next.js', 'Tailwind CSS'], bullets: [] },
    ],
    certifications: [{ id: 'c1', name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon' }],
    resumeText: SAMPLE_RESUME_TEXT,
    ...overrides,
  }
}

let seq = 0
export function makeApp(status: ApplicationStatus, extra: Partial<Application> = {}): Application {
  seq++
  return {
    id: `a${seq}`,
    jobId: null,
    company: `Company ${seq}`,
    jobTitle: 'Engineer',
    status,
    interviewDates: [],
    tags: [],
    history: [{ status: 'applied', at: '2026-09-01T00:00:00.000Z' }],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...extra,
  }
}
