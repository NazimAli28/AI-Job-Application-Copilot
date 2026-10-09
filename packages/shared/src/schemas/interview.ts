import { z } from 'zod'
import { id, isoDate, source } from './common'

export const interviewQuestionSchema = z.object({
  id,
  type: z.enum(['technical', 'behavioral', 'candidate']),
  question: z.string(),
  why: z.string(), // why the interviewer asks it
  answerStructure: z.string(), // e.g. STAR outline
  hints: z.array(z.string()), // candidate-specific prep hints
  skill: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
})
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>

export const EVALUATION_CRITERIA = [
  'relevance',
  'clarity',
  'technicalAccuracy',
  'structure',
  'examples',
  'conciseness',
] as const

export const answerEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  criteria: z.record(z.enum(EVALUATION_CRITERIA), z.number().min(1).max(5)),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
  source,
})
export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>

export const interviewSessionSchema = z.object({
  id,
  jobId: id,
  jobTitle: z.string(),
  company: z.string(),
  mode: z.enum(['practice', 'mock']),
  questions: z.array(interviewQuestionSchema),
  answers: z.array(
    z.object({ questionId: id, answer: z.string(), evaluation: answerEvaluationSchema.nullable() }),
  ),
  status: z.enum(['in_progress', 'completed']),
  createdAt: isoDate,
  completedAt: isoDate.optional(),
})
export type InterviewSession = z.infer<typeof interviewSessionSchema>

export const submitAnswerInput = z.object({
  questionId: id,
  answer: z.string().trim().min(1, 'Write an answer first').max(5000),
})
export type SubmitAnswerInput = z.infer<typeof submitAnswerInput>

export const createInterviewInput = z.object({
  jobId: id,
  mode: z.enum(['practice', 'mock']),
  questionIds: z.array(z.string()).max(50).optional(),
  /** AI questions the client already holds (generation is stateless). */
  extraQuestions: z.array(interviewQuestionSchema).max(20).optional(),
})
export type CreateInterviewInput = z.infer<typeof createInterviewInput>
