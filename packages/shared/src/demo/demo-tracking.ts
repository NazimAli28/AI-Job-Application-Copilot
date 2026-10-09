import type { ApplicationStatus, Job, JobInput } from '../index'
import { ago, ahead } from './helpers'

type Step = [status: ApplicationStatus, daysAgo: number, note?: string]
type Source = NonNullable<JobInput['source']>

type Tracking = {
  steps: Step[]
  source?: Source
  referral?: string
  reference?: string
  tags?: string[]
  notes?: string
  contacts?: [name: string, role: string, email: string][]
  interviews?: string[]
  /** 1 = "Frontend version", 2 = "Full-stack version" (only for jobs that were applied to). */
  resume?: 1 | 2
  links?: [label: string, url: string][]
  coverLetterId?: string
  screening?: [question: string, answer: string][]
  applyByDays?: number
  next?: [text: string, daysFromNow: number]
  archived?: boolean
}

const day = (d: number) => ahead(d).slice(0, 10)

/** Tracking per demo job id: ascending histories spread over ~10 weeks. */
const TRACKING: Record<string, Tracking> = {
  job_demo_1: {
    steps: [
      ['saved', 24],
      ['applied', 21, 'Applied via careers page with tailored resume.'],
      ['screening', 15, 'Recruiter call: 30 minutes, culture and salary expectations.'],
      ['interview', 10, 'Interview with the engineering manager.'],
      ['technical_interview', 3, 'Pairing session invite received.'],
    ],
    source: 'company_site',
    reference: 'LH-FE-204',
    tags: ['top choice', 'hybrid'],
    notes: 'Strong fit on React/TypeScript. Prepare an example of the checkout performance work and a Docker answer (still learning).',
    contacts: [['Mara Lindqvist', 'Recruiter', 'mara.lindqvist@lumos-health.example.com']],
    interviews: [ahead(4, 14)],
    resume: 1,
    coverLetterId: 'cl_demo_1',
    links: [['Portfolio', 'https://alexmorgan.example.com'], ['GitHub', 'https://github.com/alexmorgan-demo']],
    screening: [
      ['Why do you want to work at Lumos Health?', 'I enjoy building accessible tools that make everyday tasks easier, and healthcare booking is a good example of that.'],
      ['What is your notice period?', 'Four weeks.'],
    ],
  },
  job_demo_2: {
    steps: [
      ['saved', 18],
      ['applied', 16],
      ['screening', 11, 'Short intro call with the hiring manager.'],
      ['interview', 5, 'Take-home discussion scheduled.'],
    ],
    source: 'referral',
    referral: 'Daniel Okafor (former colleague)',
    tags: ['remote', 'full-stack'],
    notes: 'Review PostgreSQL indexing basics before the call.',
    contacts: [['Jonas Beck', 'Hiring manager', 'jonas.beck@fjordpay.example.com']],
    interviews: [ahead(2, 10, 30)],
    resume: 2,
    screening: [['Describe a backend service you built.', 'A small Node.js and PostgreSQL API for a client booking tool, with tests and CI.']],
    next: ['Prepare take-home discussion', 1],
  },
  job_demo_3: {
    steps: [['saved', 9], ['applied', 7]],
    source: 'job_board',
    tags: ['hybrid', 'graphql gap'],
    notes: 'GraphQL is a gap. Skim the Apollo docs while waiting.',
    resume: 1,
  },
  job_demo_4: {
    steps: [['saved', 2]],
    source: 'linkedin',
    tags: ['stretch'],
    notes: 'Asks for 6+ years. Probably a stretch, saved to revisit.',
    applyByDays: 2,
  },
  job_demo_5: {
    steps: [['saved', 40], ['applied', 38], ['rejected', 30, 'They want deep JVM experience.']],
    source: 'indeed',
    tags: ['on-site', 'backend'],
    notes: 'Applied out of curiosity; role is far from my frontend focus.',
    resume: 2,
  },
  job_demo_6: {
    steps: [['applied', 55], ['screening', 50], ['withdrawn', 45, 'Preferred a permanent role.']],
    source: 'recruiter',
    tags: ['contract'],
    resume: 1,
    archived: true,
  },
  job_demo_7: {
    steps: [
      ['saved', 62],
      ['applied', 60],
      ['screening', 54],
      ['interview', 47],
      ['technical_interview', 40, 'Live coding: build a filterable table.'],
      ['final_interview', 33, 'Meeting the team and CTO.'],
      ['offer', 26, 'Offer received, deadline in two weeks.'],
    ],
    source: 'company_site',
    reference: 'KR-2291',
    tags: ['offer', 'on-site'],
    notes: 'Offer is below target range and fully on-site. Keep as a fallback while other processes continue.',
    contacts: [['Tobias Reinhardt', 'Recruiter', 'tobias.reinhardt@kestrel-robotics.example.com']],
    resume: 1,
  },
  job_demo_8: {
    steps: [['applied', 50], ['screening', 44], ['rejected', 41, 'Looking for 4+ years of senior experience.']],
    source: 'linkedin',
    tags: ['remote', 'stretch'],
    resume: 2,
  },
  job_demo_9: {
    steps: [['applied', 12]],
    source: 'job_board',
    tags: ['no reply yet'],
    notes: 'No response yet. Plan a polite follow-up around week three.',
    resume: 1,
    next: ['Follow up with recruiter', -1],
  },
  job_demo_10: {
    steps: [
      ['applied', 30],
      ['screening', 24],
      ['interview', 18],
      ['technical_interview', 12],
      ['final_interview', 4, 'Final round with product and engineering leads.'],
    ],
    source: 'recruiter',
    tags: ['final round', 'hybrid'],
    notes: 'Final round went well; waiting to hear back.',
    contacts: [['Sofia Brandt', 'Recruiter', 'sofia.brandt@meridian-digital.example.com']],
    interviews: [ago(4, 15)],
    resume: 2,
  },
  job_demo_11: {
    steps: [['applied', 35], ['rejected', 33, 'Automated rejection email.']],
    source: 'other',
    tags: ['contract'],
    resume: 1,
  },
  job_demo_12: {
    steps: [['applied', 8], ['screening', 4, 'Intro call booked via recruiter.']],
    source: 'linkedin',
    tags: ['remote', 'climate tech'],
    contacts: [['Priya Nair', 'Recruiter', 'priya.nair@greenloop.example.com']],
    resume: 1,
    next: ['Prepare for intro call', 3],
  },
  job_demo_13: {
    steps: [
      ['applied', 66],
      ['screening', 60],
      ['interview', 54],
      ['rejected', 49, 'Went with a candidate with more infrastructure experience.'],
    ],
    source: 'email',
    tags: ['remote', 'infra heavy'],
    notes: 'Feedback: strong frontend, light on cloud infrastructure. Reason enough to keep learning Docker.',
    resume: 2,
  },
  job_demo_14: {
    steps: [['saved', 5]],
    source: 'job_board',
    tags: ['part-time'],
    notes: 'Part-time option; compare against full-time offers.',
    applyByDays: 9,
  },
  job_demo_15: { steps: [['saved', 3]], source: 'linkedin', tags: ['remote'], applyByDays: 12 },
  job_demo_16: { steps: [['saved', 1]], source: 'other' },
}

/** Fills a posting-only Job with its demo tracking (history, dates, contacts, materials, ...). */
export function applyTracking(job: Job): Job {
  const t = TRACKING[job.id]
  if (!t) return job
  const history = t.steps.map(([status, days, note]) => ({
    status,
    at: ago(days, 9 + (days % 7)),
    ...(note ? { note } : {}),
  }))
  const applied = history.find((h) => h.status !== 'saved')
  const last = history[history.length - 1]!
  const attachments = (t.links ?? []).map(([label, url], i) => ({
    id: `att_${job.id}_${i + 1}`,
    kind: 'link' as const,
    label,
    url,
    addedAt: applied?.at ?? last.at,
  }))
  return {
    ...job,
    status: last.status,
    archived: t.archived ?? false,
    history,
    appliedAt: applied?.at.slice(0, 10),
    applyBy: t.applyByDays != null ? day(t.applyByDays) : undefined,
    nextAction: t.next?.[0],
    nextActionAt: t.next ? day(t.next[1]) : undefined,
    source: t.source,
    referral: t.referral,
    reference: t.reference,
    notes: t.notes,
    tags: t.tags ?? [],
    contacts: (t.contacts ?? []).map(([name, role, email], i) => ({ id: `ct_${job.id}_${i + 1}`, name, role, email })),
    interviewDates: t.interviews ?? [],
    materials: {
      ...(t.resume ? { resumeId: `res_demo_${t.resume}` } : {}),
      ...(t.coverLetterId ? { coverLetterId: t.coverLetterId } : {}),
      attachments,
    },
    screeningAnswers: (t.screening ?? []).map(([question, answer], i) => ({ id: `sa_${job.id}_${i + 1}`, question, answer })),
    createdAt: history[0]!.at,
    updatedAt: last.at,
  }
}
