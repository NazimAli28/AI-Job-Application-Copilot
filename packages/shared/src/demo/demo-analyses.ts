import type { Analysis, CandidateBundle, Job, Resume } from '../index'
import { buildAnalysis } from '../index'
import { ago } from './helpers'

const STRONG_JD = `Frontend Engineer
Orbit Studio is looking for a Frontend Engineer to build our design-heavy marketing and product surfaces.
Location: Remote (EU)
Employment type: Full-time

Responsibilities
- Build responsive, accessible interfaces with React and TypeScript
- Write unit tests with Jest and React Testing Library
- Collaborate with designers in Figma and review pull requests
- Keep performance and Core Web Vitals healthy

Requirements
- 2+ years of experience building production web applications
- Strong experience with React and TypeScript
- Experience with Tailwind CSS and REST APIs
- Familiarity with Git and GitHub Actions

Nice to have
- Experience with Next.js
- Knowledge of Docker
`

const WEAK_JD = `Senior Data Engineer
Quanta Analytics is hiring a Senior Data Engineer to own our batch and streaming data platform.
Location: London, UK (onsite)
Employment type: Full-time

Responsibilities
- Design and operate data pipelines with Apache Spark and Airflow
- Manage Kubernetes workloads and Terraform infrastructure on AWS
- Model data in Snowflake and optimise warehouse costs

Requirements
- 6+ years of experience in data engineering
- Strong experience with Python, Spark and Airflow
- Experience with Kubernetes and Terraform
- Master's degree in Computer Science or related field

Nice to have
- Experience with Kafka
- Knowledge of dbt
`

/** 3 sample "Check my fit" results built with the same pipeline as POST /analyses. */
export function buildAnalyses(bundle: CandidateBundle, resume: Resume, jobs: Job[]): Analysis[] {
  const saved = jobs.find((j) => j.id === 'job_demo_1') ?? jobs[0]!
  const make = (id: string, days: number, hour: number, description: string, extra: Partial<Analysis> = {}) => {
    const { analysis } = buildAnalysis({ id, createdAt: ago(days, hour), resume, bundle, description })
    return { ...analysis, ...extra }
  }
  const a1 = make('ana_demo_1', 1, 14, STRONG_JD)
  const a2 = make('ana_demo_2', 3, 10, WEAK_JD)
  const a3 = make('ana_demo_3', 12, 11, saved.description, { savedJobId: saved.id })
  return [a1, a2, a3].map((a) =>
    a.id === 'ana_demo_3'
      ? { ...a, job: { ...a.job, title: saved.title, company: saved.company, url: saved.url } }
      : a,
  )
}
