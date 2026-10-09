import type { CandidateBundle, Experience, Project } from '../schemas/profile'
import type { CoverLetterInput, Job } from '../schemas/job'
import { computeMatch } from './match'
import { extractSkills, normalizeSkill } from './skills'
import { rewriteWeakOpener, weakOpenerOf } from './data/strong-verbs'

type Item = { text: string; prio: number }
const BUDGET = { short: [120, 170], medium: [200, 280], long: [300, 400] } as const
const MAX_PRIO = { short: 1, medium: 3, long: 9 } as const

const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const lowerFirst = (s: string) => {
  const w = s.split(/\s+/)[0] ?? ''
  return /^[A-Z][a-z]+$/.test(w) && normalizeSkill(w) === null ? s.charAt(0).toLowerCase() + s.slice(1) : s
}
const stripEnd = (s: string) => s.trim().replace(/[.!?;:,\s]+$/, '')
const firstSentence = (s: string) => stripEnd(s.trim().split(/(?<=[.!?])\s+/)[0] ?? '')
const joinList = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
const IRREGULAR = new Set(['Led', 'Built', 'Wrote', 'Ran', 'Drove', 'Grew', 'Won', 'Taught', 'Made', 'Set', 'Cut', 'Put', 'Oversaw', 'Spearheaded', 'Shipped'])
const isPastVerb = (w: string) => /^[A-Z][a-z]+ed$/.test(w) || IRREGULAR.has(w)

const TONES = {
  professional: {
    greeting: 'Dear Hiring Manager,',
    intro: (t: string, c: string) => `I am writing to express my interest in the ${t} position at ${c}.`,
    skills: (l: string) => `My background includes hands-on work with ${l}, which aligns with the requirements listed for this role.`,
    fit: (r: string) => `I am particularly interested in the opportunity to ${r}.`,
    closing: 'Thank you for your time and consideration. I would welcome the opportunity to discuss how my experience could contribute to your team.',
    signoff: 'Sincerely,',
  },
  friendly: {
    greeting: 'Hello Hiring Team,',
    intro: (t: string, c: string) => `I was excited to see the ${t} opening at ${c}, and I would love to be considered.`,
    skills: (l: string) => `I have enjoyed working with ${l}, which lines up nicely with what you are looking for.`,
    fit: (r: string) => `The chance to ${r} really appeals to me.`,
    closing: 'Thanks so much for taking the time to read this. I would love to chat about how I could help your team, and I am happy to share more whenever it suits you.',
    signoff: 'Warm regards,',
  },
  confident: {
    greeting: 'Dear Hiring Manager,',
    intro: (t: string, c: string) => `I am applying for the ${t} role at ${c}, and I am confident I can make a meaningful contribution.`,
    skills: (l: string) => `I have put ${l} to work in real projects, and those skills map directly onto the requirements of this role.`,
    fit: (r: string) => `I am ready to ${r}.`,
    closing: 'I would welcome a conversation about how I can help your team deliver, and I look forward to speaking with you.',
    signoff: 'Sincerely,',
  },
} as const

function recentFirst(exps: Experience[]): Experience[] {
  return [...exps].sort((a, b) => Number(b.current) - Number(a.current) || b.startDate.localeCompare(a.startDate))
}

function bulletSentence(b: string, lead: string, also = false): string {
  const text = stripEnd(weakOpenerOf(b) ? (rewriteWeakOpener(b) ?? b) : b)
  const first = text.split(/\s+/)[0] ?? ''
  if (isPastVerb(first)) return `${lead}I ${also ? 'also ' : ''}${lowerFirst(text)}.`
  return `${lead}${also ? 'another example is' : 'my work included'}: ${lowerFirst(text)}.`
}

/** Template-based cover letter from real profile data only. */
export function generateCoverLetter(candidate: CandidateBundle, job: Job, opts: CoverLetterInput): string {
  const tone = TONES[opts.tone]
  const p = candidate.profile
  const match = computeMatch(candidate, job)
  const matchedSkills = match.skills
    .filter((s) => s.status === 'strong')
    .sort((a, b) => Number(b.requirementKind === 'required') - Number(a.requirementKind === 'required'))
    .map((s) => s.skill)
  const confirmed = candidate.skills.filter((s) => s.status === 'confirmed').map((s) => s.name)
  const skillList = (matchedSkills.length ? matchedSkills : confirmed).slice(0, 4)

  const ordered = recentFirst(candidate.experience)
  const picked: { exp?: Experience; proj?: Project }[] = []
  for (const hid of opts.highlightIds) {
    const e = candidate.experience.find((x) => x.id === hid)
    const pr = candidate.projects.find((x) => x.id === hid)
    if (e) picked.push({ exp: e })
    else if (pr) picked.push({ proj: pr })
  }
  if (!picked.length && ordered[0]) picked.push({ exp: ordered[0] })
  if (opts.length !== 'short' && picked.length < 2 && !opts.highlightIds.length) {
    const other = ordered[1]
    if (other) picked.push({ exp: other })
  }

  const jobSkillSet = new Set(match.skills.map((s) => s.skill))
  const items: Item[][] = []

  // P1: intro
  const p1: Item[] = [{ text: tone.intro(job.title, job.company), prio: 0 }]
  const latest = ordered[0]
  const years = p && p.yearsExperience > 0 ? p.yearsExperience : 0
  if (years || latest) {
    const yText = years ? `${years} year${years === 1 ? '' : 's'} of professional experience` : 'professional experience'
    p1.push({ text: `I bring ${yText}${latest ? `, most recently as ${latest.title} at ${latest.company}` : ''}.`, prio: 1 })
  }
  if (opts.companyInfo?.trim()) {
    const info = firstSentence(opts.companyInfo)
    if (info) p1.push({ text: `What I read about ${job.company} stood out to me: ${info}.`, prio: 1 })
  }
  items.push(p1)

  // P2: skills
  if (skillList.length) {
    const group: Item[] = [{ text: tone.skills(joinList(skillList)), prio: 1 }]
    const more = confirmed.filter((c) => !skillList.includes(c)).slice(0, 4)
    if (more.length) group.push({ text: `I am also comfortable working with ${joinList(more)}.`, prio: 4 })
    items.push(group)
  }

  // P3..: highlights
  picked.slice(0, 2).forEach((h, i) => {
    const group: Item[] = []
    const basePrio = i === 0 ? 1 : 2
    if (h.exp) {
      const e = h.exp
      const bullets = [...e.bullets].sort((a, b) => {
        const score = (x: string) => extractSkills(x).filter((s) => jobSkillSet.has(s)).length * 2 + (/\d/.test(x) ? 1 : 0)
        return score(b) - (weakOpenerOf(b) ? 3 : 0) - (score(a) - (weakOpenerOf(a) ? 3 : 0))
      })
      const lead = `In my role as ${e.title} at ${e.company}, `
      if (bullets[0]) group.push({ text: bulletSentence(bullets[0], lead), prio: basePrio })
      else {
        const tech = e.technologies.slice(0, 4)
        group.push({ text: `At ${e.company}, I worked as ${e.title}${tech.length ? `, using ${joinList(tech)}` : ''}.`, prio: basePrio })
      }
      if (bullets[1]) group.push({ text: bulletSentence(bullets[1], '', true), prio: basePrio + 1 })
      if (bullets[2]) group.push({ text: bulletSentence(bullets[2], '', true), prio: basePrio + 4 })
    } else if (h.proj) {
      const d = firstSentence(h.proj.description)
      group.push({ text: `A project I worked on, ${h.proj.name}, shows how I apply these skills${d ? `: ${lowerFirst(d)}` : ''}.`, prio: basePrio })
      const b = h.proj.bullets[0]
      if (b) group.push({ text: bulletSentence(b, ''), prio: basePrio + 1 })
    }
    if (group.length) items.push(group)
  })

  // long letters: one extra project the candidate really has
  const extraProj = candidate.projects.find((pr) => !picked.some((h) => h.proj?.id === pr.id))
  if (extraProj) {
    const d = firstSentence(extraProj.description)
    items.push([{ text: `Outside of my day-to-day work, I also worked on ${extraProj.name}${d ? `: ${lowerFirst(d)}` : ''}${extraProj.technologies.length ? `, using ${joinList(extraProj.technologies.slice(0, 4))}` : ''}.`, prio: 5 }])
  }

  // fit paragraph from the job's own responsibilities
  const resp = job.responsibilities
    .filter((r) => !/^(you|the|our|we|your)/i.test(r.trim()))
    .slice(0, 3)
    .map((r) => lowerFirst(stripEnd(r)))
  const fit: Item[] = []
  if (resp[0]) fit.push({ text: tone.fit(resp[0]), prio: 1 })
  if (resp[1]) fit.push({ text: `I would also welcome the chance to ${resp[1]}.`, prio: 3 })
  fit.push({ text: 'I would be glad to bring this experience to your team.', prio: 1 })
  const topReq = match.skills.filter((x) => x.requirementKind === 'required').map((x) => x.skill).slice(0, 3)
  if (topReq.length) fit.push({ text: `From the posting, I understand the role centers on ${joinList(topReq)}, and I have tried to address each of these honestly in this letter.`, prio: 5 })
  fit.push({ text: 'I have read the requirements carefully and focused this letter on the points where my background overlaps with them.', prio: 5 })
  if (resp[2]) fit.push({ text: `I would also be glad to help ${resp[2]}.`, prio: 6 })
  fit.push({ text: 'My resume has further detail on each of these roles, and I would be glad to expand on any of the examples above.', prio: 5 })
  items.push(fit)

  // budget: add by priority until max words
  const [, max] = BUDGET[opts.length]
  const maxPrio = MAX_PRIO[opts.length]
  const fixed = [tone.greeting, tone.closing, tone.signoff, p?.fullName ?? '[Your name]']
  let total = fixed.reduce((a, s) => a + wc(s), 0)
  const flat = items.flatMap((g, gi) => g.map((it, ii) => ({ ...it, gi, ii })))
  const chosen = new Set<string>()
  for (const it of [...flat].sort((a, b) => a.prio - b.prio || a.gi - b.gi || a.ii - b.ii)) {
    if (it.prio > maxPrio) continue
    const w = wc(it.text)
    if (it.prio > 0 && total + w > max) continue
    chosen.add(`${it.gi}:${it.ii}`)
    total += w
  }
  const paragraphs = items
    .map((g, gi) => g.filter((_, ii) => chosen.has(`${gi}:${ii}`)).map((x) => x.text).join(' '))
    .filter(Boolean)

  const name = p?.fullName?.trim() || '[Your name]'
  return [tone.greeting, ...paragraphs, tone.closing, `${tone.signoff}\n${name}`].join('\n\n')
}
