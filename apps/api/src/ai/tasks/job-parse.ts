import { z } from 'zod'
import {
  EMPLOYMENT_TYPES,
  WORK_TYPES,
  normalizeSkill,
  parseJobDescription,
  type JobRequirement,
  type ParsedJob,
} from '@copilot/shared'
import { improveParse } from '../../modules/jobs/ai-preview'
import { GUARDRAILS, numbersIn, tag } from '../guard'
import type { AiTask } from '../service'

const schema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  workType: z.enum(WORK_TYPES).optional(),
  salary: z.string().optional().describe('as written in the posting'),
  experienceYearsMin: z.number().optional(),
  educationRequirement: z.string().optional(),
  responsibilities: z.array(z.string()).max(20),
  requirements: z
    .array(
      z.object({
        kind: z.enum(['required', 'preferred']),
        category: z.enum(['skill', 'experience', 'education', 'other']),
        text: z.string(),
        skill: z.string().optional().describe('short skill/technology name when category=skill'),
      }),
    )
    .max(40),
})

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.toLowerCase())
const clip = (s: string | undefined, max: number) =>
  s ? s.trim().slice(0, max) || undefined : undefined

/**
 * ✨ Job parse (extraction model). The rules parse is the base; the model fills fields it missed.
 * Every skill/number must literally occur in the posting; rules skill requirements are never lost.
 */
export const jobParseTask: AiTask<string, z.infer<typeof schema>, ParsedJob> = {
  name: 'job-parse',
  tier: 'extract',
  maxTokens: 4000,
  schema,
  system: `${GUARDRAILS}

Task: extract structured data from a job posting or recruiter email. Copy wording from the text; omit any field the text does not state. Split requirements into required vs preferred as the posting does, one requirement per item.`,
  prompt: (text) => tag('job_posting', text),
  toResult(out, text) {
    const rules = parseJobDescription(text)
    const nums = numbersIn(text)
    let n = 0
    const nextId = () => `req_ai_${++n}`
    const seen = new Set<string>()
    const requirements: JobRequirement[] = []
    for (const r of out.requirements) {
      const t = r.text.trim()
      if (!t || seen.has(t.toLowerCase())) continue
      if (r.category === 'skill') {
        const raw = (r.skill ?? t).trim()
        if (!has(text, raw)) continue // not in the posting → hallucinated
        const skill = normalizeSkill(raw) ?? raw
        if (seen.has(`skill:${skill.toLowerCase()}`)) continue
        seen.add(`skill:${skill.toLowerCase()}`)
        requirements.push({ id: nextId(), kind: r.kind, category: 'skill', text: t, skill })
      } else requirements.push({ id: nextId(), kind: r.kind, category: r.category, text: t })
      seen.add(t.toLowerCase())
    }
    for (const r of rules.requirements)
      if (r.category === 'skill' && r.skill && !seen.has(`skill:${r.skill.toLowerCase()}`))
        requirements.push({ ...r, id: nextId() })
    const years = out.experienceYearsMin
    return {
      ...rules,
      title: rules.title || clip(out.title, 120),
      company: rules.company || clip(out.company, 120),
      location: clip(out.location, 120) ?? rules.location,
      employmentType: out.employmentType ?? rules.employmentType,
      workType: out.workType ?? rules.workType,
      salary: out.salary && has(text, out.salary) ? clip(out.salary, 80) : rules.salary,
      experienceYearsMin:
        years !== undefined && years >= 0 && years <= 30 && nums.has(String(years))
          ? years
          : rules.experienceYearsMin,
      educationRequirement: clip(out.educationRequirement, 200) ?? rules.educationRequirement,
      responsibilities: out.responsibilities.length
        ? out.responsibilities.map((s) => s.trim()).filter(Boolean)
        : rules.responsibilities,
      requirements,
    }
  },
  simulate: improveParse,
}
