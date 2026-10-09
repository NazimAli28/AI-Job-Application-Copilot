import { EVALUATION_CRITERIA, type InterviewSession } from '@copilot/shared'

export const CRITERIA_LABELS: Record<(typeof EVALUATION_CRITERIA)[number], string> = {
  relevance: 'Relevance',
  clarity: 'Clarity',
  technicalAccuracy: 'Technical accuracy',
  structure: 'Structure',
  examples: 'Examples',
  conciseness: 'Conciseness',
}

export const TYPE_LABELS = { technical: 'Technical', behavioral: 'Behavioral', candidate: 'Candidate-specific' } as const

export function sessionStats(s: InterviewSession) {
  const evals = s.answers.flatMap((a) => (a.evaluation ? [{ a, e: a.evaluation }] : []))
  const avg = evals.length ? Math.round(evals.reduce((n, x) => n + x.e.score, 0) / evals.length) : null
  const criteria = EVALUATION_CRITERIA.map((c) => ({
    key: c,
    label: CRITERIA_LABELS[c],
    value: evals.length ? evals.reduce((n, x) => n + (x.e.criteria[c] ?? 1), 0) / evals.length : 0,
  }))
  const sorted = [...evals].sort((x, y) => y.e.score - x.e.score)
  const best = sorted[0]
  const worst = sorted.length > 1 ? sorted[sorted.length - 1] : undefined
  const question = (id: string) => s.questions.find((q) => q.id === id)
  return {
    answered: s.answers.length,
    total: s.questions.length,
    avg,
    criteria,
    best: best && { question: question(best.a.questionId), score: best.e.score },
    worst: worst && { question: question(worst.a.questionId), score: worst.e.score },
  }
}
