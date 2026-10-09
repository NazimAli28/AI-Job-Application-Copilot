import { parseJobDescription, defaultTracking, type Job, type JobInput } from '../index'
import { EXTRA_SPECS } from './demo-jobs-extra'
import { applyTracking } from './demo-tracking'
import { ago } from './helpers'

export type Spec = {
  id: string
  title: string
  company: string
  location: string
  employmentType: NonNullable<JobInput['employmentType']>
  workType: NonNullable<JobInput['workType']>
  salary?: string
  url: string
  createdDays: number
  description: string
}

const SPECS: Spec[] = [
  {
    id: 'job_demo_1',
    title: 'Frontend Engineer',
    company: 'Lumos Health',
    location: 'Berlin, Germany (hybrid)',
    employmentType: 'full-time',
    workType: 'hybrid',
    salary: '€62,000 - €74,000 per year',
    url: 'https://lumos-health.example.com/careers/frontend-engineer',
    createdDays: 24,
    description: `Frontend Engineer
Lumos Health is hiring a Frontend Engineer to build patient-facing web apps.
Location: Berlin, Germany (hybrid)
Employment type: Full-time
Salary: €62,000 - €74,000 per year

About Lumos Health
We build digital tools that make it easier for people to book care and follow treatment plans.

Responsibilities
- Build accessible, responsive features with React and TypeScript
- Work with designers in Figma to turn flows into production-ready components
- Write unit and integration tests with Jest and React Testing Library
- Improve web performance and Core Web Vitals across the product
- Take part in code reviews and keep our CI pipeline healthy

Requirements
- 2+ years of experience building production web applications
- Strong experience with React, TypeScript and Tailwind CSS
- Experience writing automated tests with Jest
- Experience consuming REST APIs
- Familiarity with Git and GitHub Actions
- Good communication skills in English

Nice to have
- Experience with Next.js
- Knowledge of Docker
- Interest in accessibility (WCAG)
`,
  },
  {
    id: 'job_demo_2',
    title: 'Full-Stack Developer',
    company: 'Fjordpay',
    location: 'Remote (EU)',
    employmentType: 'full-time',
    workType: 'remote',
    salary: '€65,000 - €80,000 per year',
    url: 'https://fjordpay.example.com/jobs/full-stack-developer',
    createdDays: 19,
    description: `Full-Stack Developer
Fjordpay is looking for a Full-Stack Developer to work on our merchant dashboard and payments API.
Location: Remote (EU)
Employment type: Full-time
Salary: €65,000 - €80,000 per year

About Fjordpay
Fjordpay offers payment tooling for small online shops across Europe.

Responsibilities
- Build features across our React frontend and Node.js backend
- Design and query PostgreSQL schemas
- Write tests and review pull requests
- Help the team ship small changes safely and often

Requirements
- 3+ years of experience as a web developer
- Strong experience with React, TypeScript and Node.js
- Experience with PostgreSQL
- Experience designing REST APIs
- Familiarity with Git and CI/CD

Nice to have
- Experience with Docker
- Knowledge of AWS
- Experience with GraphQL
`,
  },
  {
    id: 'job_demo_3',
    title: 'Product Engineer',
    company: 'Tidewell',
    location: 'Hamburg, Germany (hybrid)',
    employmentType: 'full-time',
    workType: 'hybrid',
    salary: '€60,000 - €72,000 per year',
    url: 'https://tidewell.example.com/careers/product-engineer',
    createdDays: 10,
    description: `Product Engineer
Tidewell is hiring a Product Engineer to own features from idea to release.
Location: Hamburg, Germany (hybrid)
Employment type: Full-time
Salary: €60,000 - €72,000 per year

About Tidewell
We make logistics planning software for mid-sized shipping companies.

Responsibilities
- Own product features end to end with React, Next.js and TypeScript
- Work closely with product managers and customers
- Build and maintain GraphQL queries and REST integrations
- Monitor and improve application performance

Requirements
- 3+ years of experience building web products
- Strong experience with React and TypeScript
- Experience with Next.js
- Experience with GraphQL
- Experience with Git workflows

Nice to have
- Knowledge of AWS
- Experience with Cypress or Playwright
- Experience with Docker
`,
  },
  {
    id: 'job_demo_4',
    title: 'Senior Frontend Engineer',
    company: 'Orbit Analytics',
    location: 'Remote (Europe)',
    employmentType: 'full-time',
    workType: 'remote',
    salary: '€85,000 - €100,000 per year',
    url: 'https://orbit-analytics.example.com/jobs/senior-frontend',
    createdDays: 6,
    description: `Senior Frontend Engineer
Orbit Analytics is hiring a Senior Frontend Engineer to lead our data visualisation frontend.
Location: Remote (Europe)
Employment type: Full-time
Salary: €85,000 - €100,000 per year

About Orbit Analytics
Orbit Analytics builds dashboards that help product teams explore their data.

Responsibilities
- Lead the architecture of our React and TypeScript frontend
- Mentor engineers and set frontend standards
- Improve rendering performance of large data views
- Partner with design and data teams on new features

Requirements
- 6+ years of experience building production web applications
- Expert knowledge of React and TypeScript
- Experience with D3 or other data visualisation libraries
- Experience with GraphQL
- Experience leading technical projects or mentoring engineers
- Bachelor's degree in Computer Science or equivalent practical experience

Nice to have
- Experience with micro-frontends
- Knowledge of AWS
- Experience with Playwright
`,
  },
  {
    id: 'job_demo_5',
    title: 'Backend Engineer (Java)',
    company: 'Stackline Systems',
    location: 'Munich, Germany (on-site)',
    employmentType: 'full-time',
    workType: 'onsite',
    salary: '€70,000 - €85,000 per year',
    url: 'https://stackline.example.com/careers/backend-java',
    createdDays: 41,
    description: `Backend Engineer (Java)
Stackline Systems is hiring a Backend Engineer to build services for our insurance platform.
Location: Munich, Germany (on-site)
Employment type: Full-time
Salary: €70,000 - €85,000 per year

About Stackline Systems
We provide core platform software for regional insurers.

Responsibilities
- Build and operate backend services in Java and Spring Boot
- Design relational schemas and optimise PostgreSQL queries
- Deploy services with Docker and Kubernetes
- Write automated tests and take part in on-call rotations

Requirements
- 4+ years of experience in backend development
- Strong experience with Java and Spring Boot
- Experience with PostgreSQL
- Experience with Docker and Kubernetes
- Experience with REST APIs

Nice to have
- Experience with Kafka
- Knowledge of AWS
`,
  },
  {
    id: 'job_demo_6',
    title: 'Frontend Developer (Contract)',
    company: 'Cobalt Studio',
    location: 'Remote',
    employmentType: 'contract',
    workType: 'remote',
    salary: '€55 - €65 per hour',
    url: 'https://cobalt-studio.example.com/work/frontend-contract',
    createdDays: 58,
    description: `Frontend Developer (Contract)
Cobalt Studio needs a Frontend Developer for a 6-month contract on a retail redesign.
Location: Remote
Employment type: Contract
Salary: €55 - €65 per hour

About Cobalt Studio
We are a small digital agency building brand sites and web shops.

Responsibilities
- Implement designs in React and Tailwind CSS
- Build reusable components and keep styling consistent
- Fix cross-browser and responsive layout issues

Requirements
- 2+ years of experience with React and JavaScript
- Strong HTML and CSS skills
- Experience with Tailwind CSS
- Familiarity with Git

Nice to have
- Experience with Next.js
- Experience with Figma handoff
`,
  },
]

const ALL_SPECS = [...SPECS, ...EXTRA_SPECS]

/** All demo jobs = posting + tracking (D9). Link-only quick saves have an empty description. */
export function buildJobs(): Job[] {
  return ALL_SPECS.map((s) => {
    const parsed = parseJobDescription(s.description)
    const base: Job = {
      id: s.id,
      title: s.title,
      company: s.company,
      location: s.location,
      employmentType: s.employmentType,
      workType: s.workType,
      url: s.url,
      salary: s.salary,
      description: s.description,
      experienceYearsMin: parsed.experienceYearsMin,
      educationRequirement: parsed.educationRequirement,
      responsibilities: s.description ? parsed.responsibilities : [],
      requirements: s.description ? parsed.requirements : [],
      ...defaultTracking(),
      createdAt: ago(s.createdDays, 9),
      updatedAt: ago(s.createdDays, 9),
    }
    return applyTracking(base)
  })
}
