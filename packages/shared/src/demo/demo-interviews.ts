import {
  buildQuestionSet,
  evaluateAnswer,
  type AnswerEvaluation,
  type CandidateBundle,
  type InterviewQuestion,
  type InterviewSession,
  type Job,
} from '../index'
import { ago } from './helpers'

const TECH_ANSWERS: Record<string, string> = {
  React:
    'At Lumen Commerce I build the checkout and account pages in React. I keep state close to where it is used, lift it only when two components need it, and use React Query for server data. For a slow list I would first measure with the React profiler, then memoise only where it shows up, rather than wrapping everything in memo by default. One trade-off I ran into was a shared form component that grew too many props, so we split it into smaller composable pieces.',
  TypeScript:
    'I use strict mode and try to let types flow from the API. For example I model API responses with a shared type and narrow with discriminated unions for loading and error states, which removed a class of undefined errors in our checkout. I avoid any, and when I need to escape the type system I leave a comment explaining why.',
  'Tailwind CSS':
    'Tailwind works well for us because design tokens live in the config and components stay close to their styles. The risk is long class lists, so I extract repeated patterns into components rather than using apply everywhere. For the checkout redesign I mapped the Figma spacing and colour scale to the theme so designers and developers used the same names.',
  Jest:
    'I write unit tests for pure logic and use React Testing Library for behaviour, querying by role and label so tests also guard accessibility. On shared components I raised coverage from 41% to 78%, but I focused on the flows users depend on instead of chasing the number.',
}

const GENERIC_TECH =
  'I would start by clarifying the requirements, then describe the approach I would take and the trade-offs. In my own work I have used this in small and mid-sized projects, and I am honest about where my depth ends. When I hit something new I read the docs, build a small prototype and ask a teammate to review it before it reaches production.'

const BEHAVIORAL =
  'Situation: our checkout pages were slow on mobile and conversion complaints were coming in. Task: I owned the performance work. Action: I measured with Lighthouse, found large images and one oversized bundle, introduced route-level code splitting and image optimisation, and agreed with design on lighter hero images. Result: Largest Contentful Paint dropped by 38%, and we added a performance budget to CI so it would not regress.'

const CANDIDATE =
  'In TrailLog I built the whole stack myself: React frontend, a Node.js REST API and a PostgreSQL schema. The hardest decision was how to store route notes and photos. I chose to keep notes relational and photos in object storage with URLs in the database. If I started again I would add integration tests for the API earlier and containerise it from day one.'

function pick(questions: InterviewQuestion[]): InterviewQuestion[] {
  const of = (t: InterviewQuestion['type'], n: number) => questions.filter((q) => q.type === t).slice(0, n)
  const picked = [...of('technical', 3), ...of('behavioral', 2), ...of('candidate', 1)]
  for (const q of questions) if (picked.length < 6 && !picked.includes(q)) picked.push(q)
  return picked.slice(0, 6)
}

function answerFor(q: InterviewQuestion): string {
  if (q.type === 'behavioral') return BEHAVIORAL
  if (q.type === 'candidate') return CANDIDATE
  return (q.skill && TECH_ANSWERS[q.skill]) || GENERIC_TECH
}

/** AI-style evaluation: rules baseline with extra, specific coaching. */
function aiEvaluation(q: InterviewQuestion, answer: string): AnswerEvaluation {
  const base = evaluateAnswer(q, answer)
  return {
    ...base,
    source: 'ai',
    score: Math.min(100, base.score + 4),
    strengths: [...base.strengths, 'You grounded the answer in your own project work and named a real trade-off.'],
    suggestions: [
      ...base.suggestions,
      'Close with the outcome in one sentence so the interviewer remembers the result.',
      'If you have a real figure for this example, state it once and clearly.',
    ],
  }
}

export function buildInterviewSessions(bundle: CandidateBundle, job: Job): InterviewSession[] {
  const questions = pick(buildQuestionSet(bundle, job))
  const answers = questions.map((q, i) => {
    const answer = answerFor(q)
    // One answer carries an AI Pro evaluation (the first technical answer).
    const evaluation = i === 0 ? aiEvaluation(q, answer) : evaluateAnswer(q, answer)
    return { questionId: q.id, answer, evaluation }
  })

  const completed: InterviewSession = {
    id: 'int_demo_1',
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    mode: 'mock',
    questions,
    answers,
    status: 'completed',
    createdAt: ago(7, 18),
    completedAt: ago(7, 18, 41),
  }

  const practiceQs = buildQuestionSet(bundle, job).slice(0, 4)
  const first = practiceQs[0]
  const practice: InterviewSession = {
    id: 'int_demo_2',
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    mode: 'practice',
    questions: practiceQs,
    answers: first
      ? [{ questionId: first.id, answer: answerFor(first), evaluation: evaluateAnswer(first, answerFor(first)) }]
      : [],
    status: 'in_progress',
    createdAt: ago(1, 20),
  }
  return [completed, practice]
}
