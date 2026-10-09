import { z } from 'zod'
import type { Job, MatchResult } from '@copilot/shared'
import { aiMatch } from '../../modules/assistant/ai-preview'
import { GUARDRAILS, inventedNumbers, jobPosting } from '../guard'
import { AiRejected, type AiTask } from '../service'

type Input = { base: MatchResult; job: Job }

const schema = z.object({
  explanation: z.string().describe('4-6 sentences'),
  recommendations: z.array(z.string()).max(5).describe('prioritised, most important first'),
})

const matchFacts = (m: MatchResult) =>
  [
    `Estimated fit (computed): ${Math.round(m.score)}/100`,
    `Breakdown: required ${m.breakdown.requiredSkills}, preferred ${m.breakdown.preferredSkills}, experience ${m.breakdown.experience}, education ${m.breakdown.education}`,
    `Experience: ${m.experienceAlignment.status} — ${m.experienceAlignment.detail}`,
    `Education: ${m.educationAlignment.status} — ${m.educationAlignment.detail}`,
    'Skills:',
    ...m.skills.map(
      (s) =>
        `- ${s.skill} (${s.requirementKind}): ${s.status}${s.evidence.length ? ` — evidence: ${s.evidence.join('; ')}` : ''}`,
    ),
    ...(m.conflicts.length ? ['Conflicts:', ...m.conflicts.map((c) => `- ${c}`)] : []),
  ].join('\n')

/** ✨ Match: the deterministic score/skills stay; the model explains them and plans next steps. */
export const matchTask: AiTask<Input, z.infer<typeof schema>, MatchResult> = {
  name: 'match-explain',
  tier: 'generate',
  maxTokens: 2000,
  schema,
  system: `${GUARDRAILS}

Task: explain a computed job-match result to the candidate in natural language, then give a prioritised plan to close the most important gaps (required before preferred). Refer to the score only as "estimated fit". Base every statement on the match data; do not assess skills that are not listed.`,
  prompt: ({ base, job }) => `${matchFacts(base)}\n\n${jobPosting(job)}`,
  toResult(out, { base, job }) {
    const text = [out.explanation, ...out.recommendations].join('\n')
    const bad = inventedNumbers(text, matchFacts(base), job.description, job.title)
    if (bad.length) throw new AiRejected(`invented numbers: ${bad.join(', ')}`)
    return {
      ...base,
      source: 'ai',
      explanation: out.explanation.trim(),
      recommendations: out.recommendations.length ? out.recommendations : base.recommendations,
      computedAt: new Date().toISOString(),
    }
  },
  simulate: ({ base, job }) => aiMatch(base, job),
}
