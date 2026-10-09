import { z } from 'zod'
import {
  generateCoverLetter,
  type CandidateBundle,
  type CoverLetterInput,
  type Job,
} from '@copilot/shared'
import { GUARDRAILS, candidateFacts, inventedNumbers, jobPosting, tag } from '../guard'
import { AiRejected, type AiTask } from '../service'

type Input = { bundle: CandidateBundle; job: Job; input: CoverLetterInput }

const schema = z.object({ content: z.string().describe('the full letter, plain text') })

const WORDS = { short: '150-200', medium: '250-320', long: '380-450' } as const
const NAME = '[Your name]'

function highlights(c: CandidateBundle, ids: string[]) {
  const set = new Set(ids)
  return [
    ...c.experience.filter((e) => set.has(e.id)).map((e) => `${e.title} at ${e.company}`),
    ...c.projects.filter((p) => set.has(p.id)).map((p) => `project ${p.name}`),
  ]
}

/** ✨ Cover letter. The candidate's name is filled in locally (never sent to the model). */
export const coverLetterTask: AiTask<Input, z.infer<typeof schema>, string> = {
  name: 'cover-letter',
  tier: 'generate',
  maxTokens: 2500,
  schema,
  system: `${GUARDRAILS}

Task: write a cover letter for this candidate and job. Greeting "Dear Hiring Manager," unless a contact is named in the posting. Connect 2-3 real experiences to the role's needs, show genuine interest in the company using only the posting/company info, close with a call to action. Sign off with "${NAME}" as the last line. Plain text, paragraphs separated by blank lines.`,
  prompt: ({ bundle, job, input }) => {
    const h = highlights(bundle, input.highlightIds)
    return [
      `Tone: ${input.tone}. Length: ${WORDS[input.length]} words.`,
      h.length ? `Emphasise: ${h.join('; ')}` : '',
      '',
      `<candidate>\n${candidateFacts(bundle)}\n</candidate>`,
      '',
      jobPosting(job),
      input.companyInfo ? `\n${tag('company_info', input.companyInfo)}` : '',
    ]
      .filter((l) => l !== '')
      .join('\n')
  },
  toResult(out, { bundle, job, input }) {
    const text = out.content.trim()
    if (text.length < 200) throw new AiRejected('letter too short')
    const bad = inventedNumbers(
      text,
      candidateFacts(bundle),
      job.description,
      input.companyInfo ?? '',
    )
    if (bad.length) throw new AiRejected(`invented numbers: ${bad.join(', ')}`)
    const name = bundle.profile?.fullName?.trim()
    return name ? text.split(NAME).join(name) : text
  },
  simulate: ({ bundle, job, input }) => generateCoverLetter(bundle, job, input),
}
