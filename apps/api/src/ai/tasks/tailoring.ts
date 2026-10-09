import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  computeMatch,
  tailorResume,
  type BulletSuggestion,
  type CandidateBundle,
  type Job,
  type TailoringResult,
} from '@copilot/shared'
import { aiTailoring } from '../../modules/assistant/ai-preview'
import { GUARDRAILS, bulletIndex, candidateFacts, inventedNumbers, jobPosting } from '../guard'
import { AiRejected, type AiTask } from '../service'

/** `bundle` = profile + resume evidence (scores); `profile` = profile only (simulated engine). */
type Input = { bundle: CandidateBundle; profile: CandidateBundle; job: Job }

const schema = z.object({
  summary: z.string().describe('2-3 sentence professional summary tailored to this job'),
  bullets: z
    .array(
      z.object({
        ref: z.string().describe('bullet reference such as e0b1, copied exactly'),
        suggested: z.string(),
        reason: z.string().describe('one sentence: why this helps for this job'),
      }),
    )
    .max(6),
})

/** ✨ Tailoring: rules keywords/skill order stay; the model writes the summary + bullet rewrites. */
export const tailoringTask: AiTask<Input, z.infer<typeof schema>, TailoringResult> = {
  name: 'tailoring',
  tier: 'generate',
  maxTokens: 3000,
  schema,
  system: `${GUARDRAILS}

Task: tailor a resume to one job. Write a short summary from the candidate's real background aimed at this role, then rewrite up to 6 of the most relevant existing bullets (reference each by its [ref]). Keep every fact and number of the original bullet, use the posting's vocabulary where it truthfully applies, and add "[add metric]" instead of inventing results. Skip bullets that are already strong.`,
  prompt: ({ bundle, job }) => {
    const m = computeMatch(bundle, job)
    const by = (st: string) => m.skills.filter((s) => s.status === st).map((s) => s.skill)
    return [
      `Strong matches: ${by('strong').join(', ') || 'none'}`,
      `Gaps (do not claim these): ${[...by('missing'), ...by('partial')].join(', ') || 'none'}`,
      '',
      `<candidate>\n${candidateFacts(bundle)}\n</candidate>`,
      '',
      jobPosting(job),
    ].join('\n')
  },
  toResult(out, { bundle, job }) {
    const facts = candidateFacts(bundle)
    const badSummary = inventedNumbers(out.summary, facts, job.description)
    if (badSummary.length) throw new AiRejected(`summary invents ${badSummary.join(', ')}`)
    const index = bulletIndex(bundle)
    const used = new Set<string>()
    const bulletSuggestions: BulletSuggestion[] = []
    for (const b of out.bullets) {
      const orig = index.get(b.ref.trim())
      const suggested = b.suggested.trim()
      if (!orig || used.has(b.ref) || !suggested || suggested === orig.text) continue
      if (inventedNumbers(suggested, orig.text).length) continue // invented metric → drop
      used.add(b.ref)
      bulletSuggestions.push({
        id: `sug_${randomUUID().slice(0, 8)}`,
        section: orig.section,
        original: orig.text,
        suggested,
        reason: b.reason.trim(),
        status: 'pending',
      })
    }
    const base = tailorResume(bundle, job, computeMatch(bundle, job))
    return {
      ...base,
      summary: out.summary.trim(),
      bulletSuggestions,
      source: 'ai',
      createdAt: new Date().toISOString(),
    }
  },
  simulate: ({ bundle, profile, job }) => aiTailoring(bundle, profile, job),
}
