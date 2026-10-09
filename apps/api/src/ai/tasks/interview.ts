import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  EVALUATION_CRITERIA,
  evaluateAnswer,
  type AnswerEvaluation,
  type CandidateBundle,
  type InterviewQuestion,
  type Job,
} from '@copilot/shared'
import { aiQuestions } from '../../modules/assistant/ai-preview'
import { aiEvaluate } from '../../modules/interviews/ai-preview'
import { GUARDRAILS, candidateFacts, jobPosting, tag } from '../guard'
import { AiRejected, type AiTask } from '../service'

// ---- candidate-specific questions

type QInput = { bundle: CandidateBundle; profile: CandidateBundle; job: Job }

const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        why: z.string().describe('why an interviewer asks it'),
        answerStructure: z.string().describe('how to structure the answer, e.g. STAR'),
        hints: z
          .array(z.string())
          .max(4)
          .describe("prep hints drawn from the candidate's own data"),
        skill: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
      }),
    )
    .min(1)
    .max(6),
})

/** ✨ Questions an interviewer would ask THIS candidate for THIS job. */
export const questionsTask: AiTask<QInput, z.infer<typeof questionsSchema>, InterviewQuestion[]> = {
  name: 'interview-questions',
  tier: 'generate',
  maxTokens: 3000,
  schema: questionsSchema,
  system: `${GUARDRAILS}

Task: write 5 interview questions an interviewer for this job would ask this specific candidate: probe their actual experience and projects, the job's key requirements, and likely gaps. Hints must reference the candidate's real experience, never invented achievements.`,
  prompt: ({ bundle, job }) =>
    `<candidate>\n${candidateFacts(bundle)}\n</candidate>\n\n${jobPosting(job)}`,
  toResult: (out) =>
    out.questions.map((q) => ({
      id: `iq_ai_${randomUUID().slice(0, 8)}`,
      type: 'candidate' as const,
      question: q.question.trim(),
      why: q.why.trim(),
      answerStructure: q.answerStructure.trim(),
      hints: q.hints.map((h) => h.trim()).filter(Boolean),
      ...(q.skill?.trim() ? { skill: q.skill.trim() } : {}),
      difficulty: q.difficulty,
    })),
  simulate: ({ profile, job }) => aiQuestions(profile, job),
}

// ---- answer evaluation

type EInput = { question: InterviewQuestion; answer: string }

const score15 = z.number().int().describe('1 (poor) to 5 (excellent)')
const evalSchema = z.object({
  score: z.number().int().describe('overall 0-100'),
  criteria: z.object(
    Object.fromEntries(EVALUATION_CRITERIA.map((k) => [k, score15])) as Record<
      (typeof EVALUATION_CRITERIA)[number],
      typeof score15
    >,
  ),
  strengths: z.array(z.string()).max(4),
  weaknesses: z.array(z.string()).max(4),
  suggestions: z.array(z.string()).max(4).describe('concrete edits to improve this answer'),
})

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

/** ✨ Interview answer evaluation (rubric scored by the model, clamped to the contract). */
export const answerEvalTask: AiTask<EInput, z.infer<typeof evalSchema>, AnswerEvaluation> = {
  name: 'answer-eval',
  tier: 'generate',
  maxTokens: 2000,
  schema: evalSchema,
  system: `${GUARDRAILS}

Task: evaluate a candidate's practice interview answer like a fair, experienced interviewer. Score each criterion 1-5 (relevance, clarity, technicalAccuracy, structure, examples, conciseness) and give an overall 0-100 score consistent with them. Strengths and weaknesses must quote or point to the answer; suggestions must be concrete. Do not invent experiences the candidate should claim.`,
  prompt: ({ question, answer }) =>
    [
      `Question: ${question.question}`,
      `Why it is asked: ${question.why}`,
      `Expected structure: ${question.answerStructure}`,
      question.hints.length ? `Prep hints: ${question.hints.join('; ')}` : '',
      '',
      tag('answer', answer),
    ]
      .filter((l) => l !== '')
      .join('\n'),
  toResult(out, { question, answer }) {
    if (!out.strengths.length && !out.weaknesses.length && !out.suggestions.length)
      throw new AiRejected('empty feedback')
    const criteria = Object.fromEntries(
      EVALUATION_CRITERIA.map((k) => [k, clamp(out.criteria[k], 1, 5)]),
    ) as AnswerEvaluation['criteria']
    // Very short answers keep the rules ceiling — the model must not inflate them.
    const rules = evaluateAnswer(question, answer)
    const words = answer.trim().split(/\s+/).length
    const score = clamp(out.score, 0, 100)
    return {
      score: words < 25 ? Math.min(score, rules.score) : score,
      criteria,
      strengths: out.strengths,
      weaknesses: out.weaknesses,
      suggestions: out.suggestions,
      source: 'ai',
    }
  },
  simulate: ({ question, answer }) => aiEvaluate(question, answer),
}
