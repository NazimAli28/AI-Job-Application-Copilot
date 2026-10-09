import {
  generateCoverLetter,
  type CandidateBundle,
  type CoverLetter,
  type Job,
  type MatchResult,
  type ResumeAnalysis,
  type TailoringResult,
  computeMatch,
  tailorResume,
} from '../index'
import { EXP_KIEZ_BULLETS, EXP_LUMEN_BULLETS } from './demo-profile'
import { ago } from './helpers'

const [LUMEN_RESP, , LUMEN_MIGRATE, , LUMEN_CI] = EXP_LUMEN_BULLETS as [string, string, string, string, string, string]

/** Hand-written "AI Pro" resume analysis. Suggestions only rephrase existing bullets; numbers are never invented. */
export function buildAiAnalysis(): ResumeAnalysis {
  return {
    overallScore: 78,
    categories: [
      {
        key: 'ats',
        label: 'ATS compatibility',
        score: 88,
        observations: ['Standard section headings and plain text layout parse cleanly.', 'Dates and job titles are easy to extract.'],
      },
      {
        key: 'skills',
        label: 'Skills & keywords',
        score: 82,
        observations: [
          'Core frontend stack (React, TypeScript, Tailwind CSS) is prominent and backed by experience bullets.',
          'Docker appears in the skills list but has little supporting evidence yet.',
        ],
      },
      {
        key: 'clarity',
        label: 'Clarity',
        score: 70,
        observations: ['Three bullets open with passive phrases ("Responsible for", "Worked on", "Helped to").'],
      },
      {
        key: 'achievements',
        label: 'Achievements',
        score: 68,
        observations: [
          'Two Lumen Commerce bullets show measurable impact, which stands out.',
          'Most other bullets describe tasks without an outcome.',
        ],
      },
      {
        key: 'formatting',
        label: 'Formatting',
        score: 84,
        observations: ['Consistent bullets and date formats; length suits a 3-year profile.'],
      },
    ],
    issues: [
      {
        id: 'ai_demo_1',
        severity: 'medium',
        category: 'clarity',
        section: 'Experience: Frontend Developer @ Lumen Commerce GmbH',
        message: 'Weak opener: leading with "Responsible for" hides what you actually did.',
        original: LUMEN_RESP,
        suggestion:
          'Built and maintained the checkout and account pages using React, TypeScript and Tailwind CSS [add metric: users, traffic or conversion]',
      },
      {
        id: 'ai_demo_2',
        severity: 'medium',
        category: 'achievements',
        section: 'Experience: Frontend Developer @ Lumen Commerce GmbH',
        message: 'Migration bullet has no outcome. Hiring managers look for the result of the work.',
        original: LUMEN_MIGRATE,
        suggestion:
          'Migrated legacy class components and Redux boilerplate to hooks and React Query [add metric: components migrated, bundle size or bugs reduced]',
      },
      {
        id: 'ai_demo_3',
        severity: 'medium',
        category: 'achievements',
        section: 'Experience: Frontend Developer @ Lumen Commerce GmbH',
        message: 'CI bullet is vague. Say what improved.',
        original: LUMEN_CI,
        suggestion: 'Improved the GitHub Actions CI pipeline [add metric: build time saved or flaky tests fixed]',
      },
      {
        id: 'ai_demo_4',
        severity: 'low',
        category: 'clarity',
        section: 'Experience: Junior Web Developer @ Kiezwerk Digital',
        message: '"Assisted with" undersells your contribution.',
        original: EXP_KIEZ_BULLETS[3],
        suggestion: 'Fixed bugs reported by the QA team [add metric: number of tickets or severity]',
      },
      {
        id: 'ai_demo_5',
        severity: 'low',
        category: 'skills',
        section: 'Skills',
        message: 'Docker is listed but not demonstrated in any experience bullet.',
        suggestion:
          'If you have used Docker in a real project (for example TrailLog), add one bullet describing how. Otherwise label it as "learning".',
      },
    ],
    recommendations: [
      'Lead each bullet with a strong verb, then the outcome, then how you did it.',
      'Replace each [add metric] placeholder with a real figure you can back up in an interview, or delete the placeholder.',
      'Keep your two measurable bullets (LCP and test coverage) near the top of the Lumen Commerce section.',
      'Add one bullet that connects Docker or CI/CD to a shipped project, since several target roles list it.',
    ],
    source: 'ai',
    analyzedAt: ago(2, 11),
  }
}

const gapNames = (m: MatchResult) =>
  m.skills.filter((s) => s.status === 'missing' || s.status === 'partial').map((s) => s.skill)

/** AI-style match: rules scoring and skills, plus a richer explanation and learning plan. */
export function buildAiMatches(bundle: CandidateBundle, jobs: Job[]): Record<string, MatchResult> {
  const out: Record<string, MatchResult> = {}
  const top = jobs.find((j) => j.id === 'job_demo_1')!
  const fs = jobs.find((j) => j.id === 'job_demo_2')!

  const m1 = computeMatch(bundle, top)
  out[top.id] = {
    ...m1,
    explanation: `Estimated fit for ${top.title} at ${top.company} is ${Math.round(m1.score)}/100, based only on what is documented in your profile and resume. Your React, TypeScript and Tailwind CSS experience at Lumen Commerce maps directly onto the core of this role, and your testing work with Jest and React Testing Library covers the quality expectations. The accessible form library you built with designers is a strong talking point for a patient-facing product. The one visible gap is Docker, which the posting lists as a nice-to-have and which you are still learning.`,
    recommendations: [
      'Lead your cover letter with the checkout performance improvement and the form library, since both are evidenced in your resume.',
      'Learning plan for Docker (about 2 weeks): containerise the TrailLog API, write a docker-compose file with PostgreSQL, then add an image build step to a GitHub Actions workflow.',
      'Prepare a short accessibility story: which WCAG issues you found and how you fixed them.',
      'Replace the [add metric] placeholders on your resume before applying.',
    ],
    source: 'ai',
    computedAt: ago(6, 14),
  }

  const m2 = computeMatch(bundle, fs)
  const gaps2 = gapNames(m2)
  out[fs.id] = {
    ...m2,
    explanation: `Estimated fit for ${fs.title} at ${fs.company} is ${Math.round(m2.score)}/100. Your React and TypeScript experience is solid, and your Node.js and PostgreSQL work comes from an agency role and a personal project rather than a large production backend, so the estimate is more moderate on the full-stack side.${gaps2.length ? ` Skills worth addressing: ${gaps2.slice(0, 4).join(', ')}.` : ''} The role is remote within the EU, which matches your stated preferences.`,
    recommendations: [
      'Be upfront that your backend depth is at intermediate level and point to TrailLog (REST API, JWT authentication, PostgreSQL schema) as concrete proof.',
      'Learning plan (about 3 weeks): practise indexing and query plans in PostgreSQL, add integration tests to the TrailLog API, then containerise it with Docker.',
      'If GraphQL comes up, say you have not used it professionally and describe how you would ramp up from your REST experience.',
    ],
    source: 'ai',
    computedAt: ago(5, 16),
  }
  return out
}

/** AI tailoring: rewrites of real resume bullets only, with [add metric] placeholders where numbers are missing. */
export function buildAiTailoring(bundle: CandidateBundle, job: Job): TailoringResult {
  const base = tailorResume(bundle, job, computeMatch(bundle, job))
  const section = 'Frontend Developer @ Lumen Commerce GmbH'
  return {
    ...base,
    summary: `Frontend Developer at Lumen Commerce GmbH with 3 years of experience building accessible React and TypeScript interfaces, tested with Jest and React Testing Library, applying for the ${job.title} role at ${job.company}.`,
    bulletSuggestions: [
      {
        id: 'sug_demo_1',
        section,
        original: LUMEN_RESP,
        suggested:
          'Built and maintained the checkout and account pages using React, TypeScript and Tailwind CSS [add metric: users or traffic]',
        reason: 'Leads with the action and mirrors the keywords in the posting. Replace the placeholder with a real figure or delete it.',
        status: 'pending',
      },
      {
        id: 'sug_demo_2',
        section,
        original: EXP_LUMEN_BULLETS[5]!,
        suggested:
          'Collaborated with designers in Figma to ship an accessible form library used by 3 product teams, supporting WCAG-aligned patterns',
        reason: 'The posting stresses accessibility and design collaboration. Your original figures are kept; only the framing changes.',
        status: 'pending',
      },
      {
        id: 'sug_demo_3',
        section,
        original: LUMEN_CI,
        suggested: 'Improved the GitHub Actions CI pipeline [add metric: build time or reliability gain]',
        reason: 'The posting mentions keeping CI healthy. Add a real number if you have one.',
        status: 'pending',
      },
    ],
    sectionChanges: [
      'Move the performance and test-coverage bullets above the CI bullet to match the posting priorities.',
      'List Tailwind CSS and Jest near the front of your skills section.',
      ...base.sectionChanges.slice(0, 2),
    ],
    source: 'ai',
    createdAt: ago(6, 15),
  }
}

export function buildCoverLetters(bundle: CandidateBundle, job: Job): CoverLetter[] {
  const rules = generateCoverLetter(bundle, job, {
    length: 'medium',
    tone: 'professional',
    highlightIds: ['exp_demo_1'],
  })
  const ai = `Dear Lumos Health team,

Healthcare tools are only useful if everyone can use them, and that is the part of frontend work I enjoy most. At Lumen Commerce I build and maintain the checkout and account pages in React, TypeScript and Tailwind CSS, and I worked with our designers on an accessible form library that three product teams now use.

I care about the details that make a product dependable. I reduced Largest Contentful Paint by 38% through code splitting and image optimisation, and I raised test coverage on our shared components from 41% to 78% with Jest and React Testing Library. Your posting asks for exactly this mix of performance, accessibility and testing.

One honest note: I am still learning Docker. I have started containerising a personal project, and I would be glad to deepen that on the job.

I would love to talk about how I can help Lumos Health make care easier to book and follow. Thank you for your time.

Best regards,
Alex Morgan`
  return [
    {
      id: 'cl_demo_1',
      jobId: job.id,
      length: 'medium',
      tone: 'professional',
      content: rules,
      source: 'rules',
      createdAt: ago(8, 10),
      updatedAt: ago(8, 10),
    },
    {
      id: 'cl_demo_2',
      jobId: job.id,
      length: 'medium',
      tone: 'confident',
      content: ai,
      source: 'ai',
      createdAt: ago(6, 16),
      updatedAt: ago(6, 16),
    },
  ]
}
