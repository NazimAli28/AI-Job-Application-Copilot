import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InterviewQuestion, InterviewSession, Job, SubmitAnswerInput } from '@copilot/shared'
import { api } from '@/lib/api'

export const interviewKeys = {
  list: ['interviews'] as const,
  one: (id: string) => ['interviews', id] as const,
  questions: (jobId: string) => ['jobs', jobId, 'interview-questions'] as const,
}

export const useJobQuestions = (jobId: string) =>
  useQuery({
    queryKey: interviewKeys.questions(jobId),
    queryFn: () => api.get<InterviewQuestion[]>(`/jobs/${jobId}/interview-questions`),
  })

export const useGenerateAiQuestions = (jobId: string) =>
  useMutation({ mutationFn: () => api.post<InterviewQuestion[]>(`/jobs/${jobId}/interview-questions/ai`) })

export const useSessions = () =>
  useQuery({ queryKey: interviewKeys.list, queryFn: () => api.get<InterviewSession[]>('/interviews') })

export const useSession = (id: string) =>
  useQuery({ queryKey: interviewKeys.one(id), queryFn: () => api.get<InterviewSession>(`/interviews/${id}`) })

export const useSavedJobs = () =>
  useQuery({ queryKey: ['jobs'], queryFn: () => api.get<Job[]>('/jobs') })

export type CreateSessionInput = {
  jobId: string
  mode: 'practice' | 'mock'
  questionIds?: string[]
  extraQuestions?: InterviewQuestion[]
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSessionInput) => api.post<InterviewSession>('/interviews', input),
    onSuccess: (s) => {
      qc.setQueryData(interviewKeys.one(s.id), s)
      qc.invalidateQueries({ queryKey: interviewKeys.list })
    },
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/interviews/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: interviewKeys.list }),
  })
}

export function useSubmitAnswer(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ai, ...input }: SubmitAnswerInput & { ai?: boolean }) =>
      api.post<InterviewSession>(`/interviews/${sessionId}/answers${ai ? '?ai=1' : ''}`, input),
    onSuccess: (s) => qc.setQueryData(interviewKeys.one(sessionId), s),
  })
}

export function useCompleteSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<InterviewSession>(`/interviews/${sessionId}/complete`),
    onSuccess: (s) => {
      qc.setQueryData(interviewKeys.one(sessionId), s)
      qc.invalidateQueries({ queryKey: interviewKeys.list })
    },
  })
}
