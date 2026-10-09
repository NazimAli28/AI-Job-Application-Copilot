import { evaluateAnswer, type AnswerEvaluation, type InterviewQuestion } from '@copilot/shared'

/**
 * Simulated AI Pro answer evaluation (same as the prototype mock) until Phase 8 wires Claude:
 * slightly more specific feedback layered on the rules baseline.
 */
export function aiEvaluate(q: InterviewQuestion, answer: string): AnswerEvaluation {
  const base = evaluateAnswer(q, answer)
  const words = answer.trim().split(/\s+/).length
  const bump = (n: number) => Math.min(5, Math.max(1, n))
  const lower = answer.toLowerCase()
  const mentionsHint = q.hints.some(
    (h) => h.length > 4 && lower.includes(h.toLowerCase().slice(0, 12)),
  )
  const clip = q.question.length > 70 ? `${q.question.slice(0, 70)}…` : q.question
  return {
    ...base,
    source: 'ai',
    score: Math.min(100, Math.max(0, base.score + (mentionsHint ? 4 : 0))),
    criteria: {
      ...base.criteria,
      relevance: bump(base.criteria.relevance + (mentionsHint ? 1 : 0)),
    },
    strengths: [
      ...base.strengths,
      ...(words > 60
        ? ['You gave enough detail for an interviewer to follow your reasoning.']
        : []),
    ],
    suggestions: [
      ...base.suggestions,
      `Tie your closing sentence back to the question: "${clip}"`,
      ...(q.hints[0] ? [`Consider weaving in this prep point: ${q.hints[0]}`] : []),
    ],
  }
}
