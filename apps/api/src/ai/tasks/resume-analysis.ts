import { z } from 'zod'
import type { ResumeAnalysis } from '@copilot/shared'
import { simulateAiAnalysis } from '../../modules/resumes/ai-preview'
import { GUARDRAILS, inventedNumbers, tag } from '../guard'
import { AiRejected, type AiTask } from '../service'

type Input = { analysis: ResumeAnalysis; text: string }

const schema = z.object({
  rewrites: z
    .array(
      z.object({
        issueId: z.string().describe('id of the issue being fixed, copied exactly'),
        suggestion: z.string().describe('rewritten bullet/sentence, facts preserved'),
      }),
    )
    .max(20),
  recommendations: z.array(z.string()).max(6).describe('deeper, resume-specific advice'),
})

/** ✨ Resume analysis: rules score stays; Claude rewrites flagged lines + deeper advice. */
export const resumeAnalysisTask: AiTask<Input, z.infer<typeof schema>, ResumeAnalysis> = {
  name: 'resume-analysis',
  tier: 'generate',
  maxTokens: 4000,
  schema,
  system: `${GUARDRAILS}

Task: improve a resume. You receive rule-based issues (each with an id and the original text) and the resume.
- For issues that quote original text, write a stronger version: lead with an action verb, keep every fact and number from the original, add "[add metric]" where a measurable result is missing.
- Give up to 6 specific recommendations about this resume (structure, focus, missing evidence). Do not repeat the rule-based messages verbatim.`,
  prompt: ({ analysis, text }) =>
    [
      'Rule-based issues:',
      ...analysis.issues
        .filter((i) => i.original)
        .map((i) => `- id=${i.id} [${i.category}] ${i.message}\n  original: ${i.original}`),
      '',
      tag('resume', text),
    ].join('\n'),
  toResult(out, { analysis }) {
    const byId = new Map(out.rewrites.map((r) => [r.issueId, r.suggestion.trim()]))
    let used = 0
    const issues = analysis.issues.map((i) => {
      const s = byId.get(i.id)
      // Rewrites that add numbers the original never had are invented metrics → keep the rules fix.
      if (!s || !i.original || inventedNumbers(s, i.original).length)
        return { ...i, id: `ai_${i.id}` }
      used++
      return { ...i, id: `ai_${i.id}`, suggestion: s }
    })
    const recommendations = out.recommendations.map((r) => r.trim()).filter(Boolean)
    if (!used && !recommendations.length) throw new AiRejected('no usable rewrites or advice')
    return {
      ...analysis,
      issues,
      recommendations: recommendations.length ? recommendations : analysis.recommendations,
      source: 'ai',
      analyzedAt: new Date().toISOString(),
    }
  },
  simulate: ({ analysis }) => simulateAiAnalysis(analysis),
}
