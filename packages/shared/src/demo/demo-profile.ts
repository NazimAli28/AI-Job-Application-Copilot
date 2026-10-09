import type { Certification, Education, Experience, Profile, ProfileSkill, Project } from '../index'

export const profile: Profile = {
  fullName: 'Alex Morgan',
  email: 'demo@demo.dev',
  phone: '+49 30 5550 0142',
  location: 'Berlin, Germany',
  linkedinUrl: 'https://linkedin.com/in/alexmorgan-demo',
  githubUrl: 'https://github.com/alexmorgan-demo',
  portfolioUrl: 'https://alexmorgan.example.dev',
  summary:
    'Frontend-leaning full-stack developer with about 3 years of experience building React and TypeScript web applications. I care about accessibility, performance and tests, and enjoy working closely with designers and product managers.',
  targetTitles: ['Frontend Engineer', 'Full-Stack Developer', 'Product Engineer'],
  yearsExperience: 3,
  workTypes: ['remote', 'hybrid'],
  preferredLocations: ['Berlin', 'Remote (EU)', 'Hamburg'],
  salaryMin: 58000,
  salaryMax: 72000,
  salaryCurrency: 'EUR',
}

const sk = (
  n: number,
  name: string,
  level: ProfileSkill['level'],
  years: number,
  evidence: string,
  status: ProfileSkill['status'] = 'confirmed',
  source: ProfileSkill['source'] = 'manual',
): ProfileSkill => ({ id: `skl_demo_${n}`, name, level, years, evidence, status, source })

export const skills: ProfileSkill[] = [
  sk(1, 'React', 'advanced', 3, 'Main framework at Lumen Commerce; checkout and account pages.'),
  sk(2, 'TypeScript', 'advanced', 3, 'Strict-mode TypeScript across the Lumen Commerce frontend.'),
  sk(3, 'JavaScript', 'advanced', 4, 'Daily use since my bachelor thesis and first agency job.'),
  sk(4, 'HTML', 'advanced', 4, 'Semantic, accessible markup in all projects.', 'confirmed', 'resume'),
  sk(5, 'CSS', 'advanced', 4, 'Responsive layouts for client sites and product UI.', 'confirmed', 'resume'),
  sk(6, 'Tailwind CSS', 'advanced', 2, 'Used for the checkout redesign and the Pixel Pantry project.'),
  sk(7, 'Next.js', 'intermediate', 1, 'Built the Pixel Pantry project with the App Router.'),
  sk(8, 'Node.js', 'intermediate', 2, 'REST APIs at Kiezwerk Digital and the TrailLog project.'),
  sk(9, 'PostgreSQL', 'intermediate', 2, 'Schema design and queries for TrailLog.'),
  sk(10, 'Jest', 'intermediate', 2, 'Unit tests for shared components at Lumen Commerce.'),
  sk(11, 'React Testing Library', 'intermediate', 2, 'Integration tests for checkout flows.'),
  sk(12, 'Git', 'advanced', 4, 'Daily use; pull-request based workflow.', 'confirmed', 'resume'),
  sk(13, 'GitHub Actions', 'intermediate', 1, 'Maintained CI workflows for lint, test and deploy.'),
  sk(14, 'Docker', 'beginner', 0.5, 'Containerising the TrailLog API; still building confidence.', 'learning'),
]

export const EXP_LUMEN_BULLETS = [
  'Responsible for building and maintaining the checkout and account pages using React, TypeScript and Tailwind CSS',
  'Reduced Largest Contentful Paint by 38% by introducing route-level code splitting and image optimization',
  'Worked on migrating legacy class components and Redux boilerplate to hooks and React Query',
  'Wrote unit and integration tests with Jest and React Testing Library, raising coverage on shared components from 41% to 78%',
  'Helped to improve the CI pipeline in GitHub Actions',
  'Collaborated with designers in Figma to ship an accessible form library used by 3 product teams',
]

export const EXP_KIEZ_BULLETS = [
  'Developed responsive client websites with HTML, CSS and JavaScript',
  'Integrated REST APIs built with Node.js and Express for 6 client projects',
  'Built a booking widget in React that replaced a legacy jQuery plugin',
  'Assisted with fixing bugs reported by the QA team',
]

export const experience: Experience[] = [
  {
    id: 'exp_demo_1',
    title: 'Frontend Developer',
    company: 'Lumen Commerce GmbH',
    location: 'Berlin, Germany',
    startDate: '2024-03',
    current: true,
    bullets: EXP_LUMEN_BULLETS,
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Jest', 'React Testing Library', 'GitHub Actions'],
  },
  {
    id: 'exp_demo_2',
    title: 'Junior Web Developer',
    company: 'Kiezwerk Digital',
    location: 'Berlin, Germany',
    startDate: '2023-05',
    endDate: '2024-02',
    current: false,
    bullets: EXP_KIEZ_BULLETS,
    technologies: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'Express'],
  },
]

export const education: Education[] = [
  {
    id: 'edu_demo_1',
    institution: 'Technische Universität Berlin',
    degree: 'B.Sc. Computer Science',
    field: 'Computer Science',
    startDate: '2019-10',
    endDate: '2023-04',
    grade: '2.1',
  },
]

export const projects: Project[] = [
  {
    id: 'prj_demo_1',
    name: 'TrailLog',
    description: 'Full-stack hiking log with route notes, photo uploads and shareable trip pages.',
    url: 'https://github.com/alexmorgan-demo/traillog',
    technologies: ['React', 'Node.js', 'PostgreSQL', 'Docker'],
    bullets: [
      'Designed the PostgreSQL schema and a REST API with JWT authentication',
      'Started containerising the API with Docker',
    ],
  },
  {
    id: 'prj_demo_2',
    name: 'Pixel Pantry',
    description: 'Recipe and pantry planner built with Next.js and Tailwind CSS, deployed on Vercel.',
    url: 'https://github.com/alexmorgan-demo/pixel-pantry',
    technologies: ['Next.js', 'TypeScript', 'Tailwind CSS'],
    bullets: ['Built accessible, keyboard-friendly components with Tailwind CSS'],
  },
]

export const certifications: Certification[] = [
  {
    id: 'crt_demo_1',
    name: 'Meta Front-End Developer Professional Certificate',
    issuer: 'Meta (Coursera)',
    date: '2023-02',
  },
]

export const RESUME_TEXT = `Alex Morgan
Berlin, Germany | demo@demo.dev | +49 30 5550 0142
linkedin.com/in/alexmorgan-demo | github.com/alexmorgan-demo | alexmorgan.example.dev

PROFESSIONAL SUMMARY
Frontend-leaning full-stack developer with about 3 years of experience building React and TypeScript web applications. I care about accessibility, performance and tests, and enjoy working closely with designers and product managers.

EXPERIENCE
Frontend Developer | Lumen Commerce GmbH | Mar 2024 – Present
${EXP_LUMEN_BULLETS.map((b) => `• ${b}`).join('\n')}

Junior Web Developer | Kiezwerk Digital | May 2023 – Feb 2024
${EXP_KIEZ_BULLETS.map((b) => `- ${b}`).join('\n')}

EDUCATION
B.Sc. in Computer Science, Technische Universität Berlin, 2023

SKILLS
JavaScript, TypeScript, React, Next.js, Node.js, Express, HTML, CSS, Tailwind CSS, Jest, React Testing Library, Git, GitHub Actions, PostgreSQL, Docker, Figma

PROJECTS
TrailLog – Full-stack hiking log built with React, Node.js and PostgreSQL with JWT authentication
Pixel Pantry – Recipe and pantry planner built with Next.js and Tailwind CSS, deployed on Vercel

CERTIFICATIONS
Meta Front-End Developer Professional Certificate
`
