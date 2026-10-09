import type { Spec } from './demo-jobs'

/** Jobs that began as tracked applications (short descriptions) plus link-only quick saves. */
export const EXTRA_SPECS: Spec[] = [
  {
    id: 'job_demo_7',
    title: 'Frontend Developer',
    company: 'Kestrel Robotics',
    location: 'Munich, Germany (on-site)',
    employmentType: 'full-time',
    workType: 'onsite',
    salary: '€58,000 per year',
    url: 'https://kestrel-robotics.example.com/careers/frontend-developer',
    createdDays: 62,
    description: `Frontend Developer
Kestrel Robotics is hiring a Frontend Developer for our fleet-monitoring dashboards.
Location: Munich, Germany (on-site)

Responsibilities
- Build data-heavy dashboards in React and TypeScript
- Collaborate with robotics engineers on API design

Requirements
- 2+ years of experience with React and JavaScript
- Experience with REST APIs and Git
`,
  },
  {
    id: 'job_demo_8',
    title: 'Senior Frontend Engineer',
    company: 'Northwind Labs',
    location: 'Remote (US)',
    employmentType: 'full-time',
    workType: 'remote',
    url: 'https://northwind-labs.example.com/jobs/senior-frontend',
    createdDays: 52,
    description: `Senior Frontend Engineer
Northwind Labs is looking for a senior engineer to lead our web app architecture.
Location: Remote (US)

Responsibilities
- Own frontend architecture and mentor engineers
- Drive performance and testing practices

Requirements
- 4+ years of experience building large React applications
- Strong TypeScript and GraphQL skills
`,
  },
  {
    id: 'job_demo_9',
    title: 'React Developer',
    company: 'Bluebird Travel',
    location: 'Cologne, Germany',
    employmentType: 'full-time',
    workType: 'hybrid',
    url: 'https://bluebird-travel.example.com/careers/react-developer',
    createdDays: 13,
    description: `React Developer
Bluebird Travel needs a React Developer to improve our booking flow.
Location: Cologne, Germany

Responsibilities
- Build and test booking-flow features
- Improve accessibility and page speed

Requirements
- 2+ years of experience with React and TypeScript
- Experience with Jest and Git
`,
  },
  {
    id: 'job_demo_10',
    title: 'Web Engineer',
    company: 'Meridian Bank Digital',
    location: 'Frankfurt, Germany (hybrid)',
    employmentType: 'full-time',
    workType: 'hybrid',
    salary: '€64,000 - €70,000 per year',
    url: 'https://meridian-digital.example.com/careers/web-engineer',
    createdDays: 31,
    description: `Web Engineer
Meridian Bank Digital builds the web banking experience used by retail customers.
Location: Frankfurt, Germany (hybrid)

Responsibilities
- Develop secure, accessible web features with React and TypeScript
- Write automated tests and review code

Requirements
- 3+ years of experience in web development
- Experience with React, TypeScript and CI/CD pipelines
`,
  },
  {
    id: 'job_demo_11',
    title: 'UI Engineer',
    company: 'Pixelhaus',
    location: 'Berlin, Germany',
    employmentType: 'contract',
    workType: 'onsite',
    url: 'https://pixelhaus.example.com/jobs/ui-engineer',
    createdDays: 36,
    description: `UI Engineer
Pixelhaus is a design studio seeking a UI Engineer for a short contract.
Location: Berlin, Germany

Responsibilities
- Turn Figma designs into pixel-perfect components
- Build animations with CSS and JavaScript

Requirements
- Strong HTML, CSS and JavaScript skills
- Experience with Figma handoff
`,
  },
  {
    id: 'job_demo_12',
    title: 'Frontend Developer',
    company: 'Greenloop',
    location: 'Remote (EU)',
    employmentType: 'full-time',
    workType: 'remote',
    salary: '€60,000 per year',
    url: 'https://greenloop.example.com/careers/frontend-developer',
    createdDays: 9,
    description: `Frontend Developer
Greenloop builds carbon-tracking tools for small businesses.
Location: Remote (EU)

Responsibilities
- Build charts and forms in React and TypeScript
- Work closely with the product team

Requirements
- 2+ years of experience with React
- Experience with Tailwind CSS and REST APIs
`,
  },
  {
    id: 'job_demo_13',
    title: 'Software Engineer',
    company: 'Atlas Cloud',
    location: 'Remote',
    employmentType: 'full-time',
    workType: 'remote',
    url: 'https://atlas-cloud.example.com/jobs/software-engineer',
    createdDays: 67,
    description: `Software Engineer
Atlas Cloud is hiring a Software Engineer for our cloud console.
Location: Remote

Responsibilities
- Build console features in React and Node.js
- Work with infrastructure teams on Docker and Kubernetes tooling

Requirements
- 3+ years of experience with TypeScript and Node.js
- Experience with Docker and AWS
`,
  },
  {
    id: 'job_demo_14',
    title: 'Web Developer',
    company: 'Nordlicht Media',
    location: 'Hamburg, Germany',
    employmentType: 'part-time',
    workType: 'hybrid',
    url: 'https://nordlicht-media.example.com/jobs/web-developer',
    createdDays: 5,
    description: `Web Developer (part-time)
Nordlicht Media needs a part-time Web Developer for client sites.
Location: Hamburg, Germany

Requirements
- Experience with HTML, CSS and JavaScript
- Familiarity with React
`,
  },
  // Link-only quick saves: no description yet (shows "Needs a description").
  {
    id: 'job_demo_15',
    title: 'Frontend Engineer',
    company: 'Helio Solar',
    location: '',
    employmentType: 'full-time',
    workType: 'remote',
    url: 'https://helio-solar.example.com/careers/frontend-engineer',
    createdDays: 3,
    description: '',
  },
  {
    id: 'job_demo_16',
    title: 'Full-Stack Engineer',
    company: 'Parcelo',
    location: '',
    employmentType: 'full-time',
    workType: 'hybrid',
    url: 'https://parcelo.example.com/jobs/full-stack-engineer',
    createdDays: 1,
    description: '',
  },
]
