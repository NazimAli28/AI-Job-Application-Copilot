import { http } from 'msw'
import {
  ERROR_CODES,
  buildQuestionSet,
  createInterviewInput,
  evaluateAnswer,
  submitAnswerInput,
  type AnswerEvaluation,
  type InterviewQuestion,
  type InterviewSession,
} from '@copilot/shared'
import { uid } from '@/lib/format'
import { db, type UserData } from '../db'
import { aiAllowed, aiLatency, auth, bundleOf, fail, latency, notFound, now, ok, parseBody, writable } from '../utils'

/** Mock mode: ~6 questions mixed across types. */
function mixed(pool: InterviewQuestion[], n = 6): InterviewQuestion[] {
  const buckets = (['technical', 'behavioral', 'candidate'] as const).map((t) => pool.filter((q) => q.type === t))
  const out: InterviewQuestion[] = []
  for (let i = 0; out.length < n && buckets.some((b) => i < b.length); i++)
    for (const b of buckets) if (i < b.length && out.length < n) out.push(b[i])
  return out
}

/** Candidate-specific questions built only from the user's real profile data. */
function aiQuestions(d: UserData, jobTitle: string, company: string): InterviewQuestion[] {
  const out: InterviewQuestion[] = []
  const exp = d.experience[0]
  const project = d.projects[0]
  const skill = d.skills.find((s) => s.status === 'confirmed')
  const mk = (q: Omit<InterviewQuestion, 'id' | 'type'>): InterviewQuestion => ({
    id: uid('iq_ai'),
    type: 'candidate',
    ...q,
  })
  if (exp)
    out.push(
      mk({
        question: `At ${exp.company} you worked as ${exp.title}. Which part of that role best prepares you for ${jobTitle} at ${company}?`,
        why: 'Interviewers test whether you can connect past work to the new role without being prompted.',
        answerStructure:
          'Pick one responsibility, describe the situation, your action, the measurable result, then link it to the new role.',
        hints: [
          `Draw on your time at ${exp.company}`,
          ...(exp.bullets[0] ? [`You listed: "${exp.bullets[0]}" — expand on it with numbers`] : []),
          ...(exp.technologies.length ? [`Mention hands-on use of ${exp.technologies.slice(0, 3).join(', ')}`] : []),
        ],
        difficulty: 'medium',
      }),
    )
  if (project)
    out.push(
      mk({
        question: `Walk me through "${project.name}". What was the hardest decision you made and what would you change now?`,
        why: 'Projects reveal ownership, trade-off thinking and honesty about mistakes.',
        answerStructure: 'Goal, your role, one key decision with alternatives considered, outcome, retrospective.',
        hints: ['Be clear about what you personally built', 'Name one honest trade-off or regret'],
        difficulty: 'medium',
      }),
    )
  if (skill)
    out.push(
      mk({
        question: `Your profile lists ${skill.name}. Describe a situation where you relied on it under real constraints.`,
        why: 'They want evidence behind a listed skill, not just the keyword.',
        answerStructure: 'Context, the constraint, what you did with the skill, the result.',
        hints: [
          skill.evidence
            ? `Use your own evidence: "${skill.evidence}"`
            : `Prepare one concrete example of using ${skill.name}`,
        ],
        skill: skill.name,
        difficulty: 'hard',
      }),
    )
  return out
}

/** Slightly more specific "AI-style" evaluation layered on the rules baseline. */
function aiEvaluate(q: InterviewQuestion, answer: string): AnswerEvaluation {
  const base = evaluateAnswer(q, answer)
  const words = answer.trim().split(/\s+/).length
  const bump = (n: number) => Math.min(5, Math.max(1, n))
  const lower = answer.toLowerCase()
  const mentionsHint = q.hints.some((h) => h.length > 4 && lower.includes(h.toLowerCase().slice(0, 12)))
  const clip = q.question.length > 70 ? `${q.question.slice(0, 70)}…` : q.question
  return {
    ...base,
    source: 'ai',
    score: Math.min(100, Math.max(0, base.score + (mentionsHint ? 4 : 0))),
    criteria: { ...base.criteria, relevance: bump(base.criteria.relevance + (mentionsHint ? 1 : 0)) },
    strengths: [
      ...base.strengths,
      ...(words > 60 ? ['You gave enough detail for an interviewer to follow your reasoning.'] : []),
    ],
    suggestions: [
      ...base.suggestions,
      `Tie your closing sentence back to the question: "${clip}"`,
      ...(q.hints[0] ? [`Consider weaving in this prep point: ${q.hints[0]}`] : []),
    ],
  }
}

export const interviewsHandlers = [
  http.get('/api/jobs/:id/interview-questions', async ({ params }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const job = a.data.jobs.find((j) => j.id === params.id)
    if (!job) return notFound('Job')
    return ok(buildQuestionSet(bundleOf(a.data, job), job))
  }),

  http.post('/api/jobs/:id/interview-questions/ai', async ({ params }) => {
    const a = auth()
    if (a instanceof Response) return a
    const blocked = aiAllowed(a.user)
    if (blocked) return blocked
    const job = a.data.jobs.find((j) => j.id === params.id)
    if (!job) return notFound('Job')
    await aiLatency()
    return ok(aiQuestions(a.data, job.title, job.company))
  }),

  http.get('/api/interviews', async () => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    return ok([...a.data.interviewSessions].sort((x, y) => y.createdAt.localeCompare(x.createdAt)))
  }),

  http.post('/api/interviews', async ({ request }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const w = writable(a.user)
    if (w) return w
    const body = await parseBody(request, createInterviewInput)
    if (!body.ok) return body.response
    const { jobId, mode, questionIds, extraQuestions } = body.value
    const job = a.data.jobs.find((j) => j.id === jobId)
    if (!job) return notFound('Job')
    const pool = [...new Map([...buildQuestionSet(bundleOf(a.data, job), job), ...(extraQuestions ?? [])].map((q) => [q.id, q])).values()]
    let questions: InterviewQuestion[]
    if (questionIds?.length) questions = pool.filter((q) => questionIds.includes(q.id))
    else questions = mode === 'mock' ? mixed(pool) : pool
    if (!questions.length)
      return fail(400, ERROR_CODES.VALIDATION, 'No interview questions are available for this job yet')
    const session: InterviewSession = {
      id: uid('int'),
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      mode,
      questions,
      answers: [],
      status: 'in_progress',
      createdAt: now(),
    }
    db.update(a.user.id, (d) => void d.interviewSessions.push(session))
    return ok(session, 201)
  }),

  http.get('/api/interviews/:id', async ({ params }) => {
    await latency(150)
    const a = auth()
    if (a instanceof Response) return a
    const s = a.data.interviewSessions.find((x) => x.id === params.id)
    return s ? ok(s) : notFound('Interview session')
  }),

  http.delete('/api/interviews/:id', async ({ params }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const w = writable(a.user)
    if (w) return w
    db.update(a.user.id, (d) => void (d.interviewSessions = d.interviewSessions.filter((x) => x.id !== params.id)))
    return ok(null)
  }),

  http.post('/api/interviews/:id/answers', async ({ params, request }) => {
    const a = auth()
    if (a instanceof Response) return a
    const w = writable(a.user)
    if (w) return w
    const body = await parseBody(request, submitAnswerInput)
    if (!body.ok) return body.response
    const useAi = new URL(request.url).searchParams.get('ai') === '1'
    if (useAi) {
      const blocked = aiAllowed(a.user)
      if (blocked) return blocked
      await aiLatency()
    } else await latency(400)
    const session = a.data.interviewSessions.find((x) => x.id === params.id)
    if (!session) return notFound('Interview session')
    const q = session.questions.find((x) => x.id === body.value.questionId)
    if (!q) return fail(400, ERROR_CODES.VALIDATION, 'Question is not part of this session')
    const evaluation = useAi ? aiEvaluate(q, body.value.answer) : evaluateAnswer(q, body.value.answer)
    const updated = db.update(a.user.id, (d) => {
      const s = d.interviewSessions.find((x) => x.id === params.id)!
      s.answers = s.answers.filter((x) => x.questionId !== q.id)
      s.answers.push({ questionId: q.id, answer: body.value.answer, evaluation })
      return s
    })
    return ok(updated)
  }),

  http.post('/api/interviews/:id/complete', async ({ params }) => {
    await latency()
    const a = auth()
    if (a instanceof Response) return a
    const w = writable(a.user)
    if (w) return w
    const updated = db.update(a.user.id, (d) => {
      const s = d.interviewSessions.find((x) => x.id === params.id)
      if (s) {
        s.status = 'completed'
        s.completedAt = now()
      }
      return s
    })
    return updated ? ok(updated) : notFound('Interview session')
  }),
]
