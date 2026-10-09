import type { CandidateBundle } from '../schemas/profile'
import type { Job, MatchResult, SkillMatch, SkillMatchStatus } from '../schemas/job'
import { extractSkills, normalizeSkill, relatedSkills } from './skills'

const canon = (s: string) => normalizeSkill(s) ?? s

type Evidence = { strong: string[]; partial: string[]; rejected: boolean; learning: boolean; manual: boolean }

/** Collects evidence for one skill from candidate data only. Rejected skills count as absent everywhere. */
export function skillEvidence(candidate: CandidateBundle, skill: string, resumeSkills?: Set<string>): Evidence {
  const target = canon(skill)
  const ev: Evidence = { strong: [], partial: [], rejected: false, learning: false, manual: false }
  for (const s of candidate.skills) {
    if (canon(s.name) !== target) continue
    if (s.source === 'manual') ev.manual = true
    if (s.status === 'rejected') {
      ev.rejected = true
      return { strong: [], partial: [], rejected: true, learning: false, manual: true }
    }
    const bits = [s.level, s.years !== undefined ? `${s.years} yrs` : undefined].filter(Boolean).join(', ')
    const label = `Skills: ${s.name}${bits ? ` (${bits})` : ''}`
    if (s.status === 'learning') {
      ev.learning = true
      ev.partial.push(`Skills: ${s.name} (learning)`)
    } else ev.strong.push(label)
  }
  for (const e of candidate.experience) {
    const techHit = e.technologies.some((t) => canon(t) === target)
    const textHit = extractSkills(`${e.title}\n${e.bullets.join('\n')}`).includes(target)
    if (techHit || textHit) ev.strong.push(`Experience: ${e.title} @ ${e.company}`)
  }
  for (const p of candidate.projects) {
    const hit = p.technologies.some((t) => canon(t) === target) || extractSkills(`${p.name}\n${p.description}\n${p.bullets.join('\n')}`).includes(target)
    if (hit) ev.partial.push(`Project: ${p.name}`)
  }
  for (const c of candidate.certifications) {
    if (extractSkills(`${c.name} ${c.issuer ?? ''}`).includes(target)) ev.partial.push(`Certification: ${c.name}`)
  }
  if (resumeSkills?.has(target) && !ev.strong.length && !ev.partial.length) ev.partial.push('Resume text mentions it')
  return ev
}

function monthIndex(ym: string): number | null {
  const m = ym.match(/^(\d{4})(?:-(\d{1,2}))?/)
  return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : null
}

/** Years of experience from experience dates (overlaps merged). Returns 0 when nothing parseable. */
export function yearsFromExperience(candidate: CandidateBundle, now: Date = new Date()): number {
  const nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth()
  const ranges: [number, number][] = []
  for (const e of candidate.experience) {
    const s = monthIndex(e.startDate)
    const end = e.current || !e.endDate ? nowIdx : monthIndex(e.endDate)
    if (s !== null && end !== null && end >= s) ranges.push([s, end])
  }
  ranges.sort((a, b) => a[0] - b[0])
  let months = 0
  let cur: [number, number] | null = null
  for (const r of ranges) {
    if (!cur) cur = [...r]
    else if (r[0] <= cur[1]) cur[1] = Math.max(cur[1], r[1])
    else {
      months += cur[1] - cur[0]
      cur = [...r]
    }
  }
  if (cur) months += cur[1] - cur[0]
  return Math.round((months / 12) * 10) / 10
}

/** 0 none, 1 associate/diploma, 2 bachelor, 3 master, 4 doctorate. */
export function degreeLevel(text: string): number {
  const t = text.toLowerCase()
  if (/ph\.?d|doctor/.test(t)) return 4
  if (/master|\bm\.?s\.?c?\b|\bm\.?a\.?\b|\bmba\b|\bm\.?eng|m\.?tech/.test(t)) return 3
  if (/bachelor|\bb\.?s\.?c?\b|\bb\.?a\.?\b|\bb\.?eng|\bb\.?tech|\bb\.?e\.?\b|undergraduate|\bdegree\b/.test(t)) return 2
  if (/associate|diploma|certificate/.test(t)) return 1
  return 0
}
const LEVEL_NAME = ['no degree', "associate's/diploma", "bachelor's", "master's", 'doctorate']

const WEIGHTS = { requiredSkills: 55, preferredSkills: 15, experience: 20, education: 10 } as const

export function computeMatch(candidate: CandidateBundle, job: Job): MatchResult {
  const resumeSkills = new Set(candidate.resumeText ? extractSkills(candidate.resumeText) : [])
  const hasData =
    candidate.skills.some((s) => s.status !== 'rejected') ||
    candidate.experience.length > 0 ||
    candidate.projects.length > 0 ||
    candidate.certifications.length > 0 ||
    (candidate.resumeText ?? '').trim().length >= 50

  const skillReqs = job.requirements.filter((r) => r.category === 'skill')
  const skills: SkillMatch[] = skillReqs.map((r) => {
    const name = r.skill ?? r.text
    const ev = skillEvidence(candidate, name, resumeSkills)
    let status: SkillMatchStatus
    let evidence: string[] = []
    if (!hasData) status = 'unknown'
    else if (ev.rejected) status = 'missing'
    else if (ev.strong.length && !ev.learning) {
      status = 'strong'
      evidence = [...ev.strong, ...ev.partial].slice(0, 4)
    } else if (ev.strong.length || ev.partial.length) {
      status = 'partial'
      evidence = [...ev.strong, ...ev.partial].slice(0, 4)
    } else {
      const rel: string[] = []
      for (const rs of relatedSkills(name)) {
        const rev = skillEvidence(candidate, rs, resumeSkills)
        if (!rev.rejected && (rev.strong.length || rev.partial.length)) rel.push(`Related skill: ${rs} (adjacent to ${name})`)
        if (rel.length >= 2) break
      }
      status = rel.length ? 'partial' : 'missing'
      evidence = rel
    }
    return { skill: name, requirementKind: r.kind, status, evidence, ...(ev.manual ? { corrected: true } : {}) }
  })

  const value = (s: SkillMatch) => (s.status === 'strong' ? 1 : s.status === 'partial' ? 0.5 : 0)
  const part = (kind: 'required' | 'preferred') => {
    const list = skills.filter((s) => s.requirementKind === kind)
    return list.length ? (list.reduce((a, s) => a + value(s), 0) / list.length) * 100 : null
  }
  const reqScore = part('required')
  const prefScore = part('preferred')

  // ---- experience
  const profileYears = candidate.profile?.yearsExperience
  const computedYears = yearsFromExperience(candidate)
  const years = profileYears !== undefined && profileYears > 0 ? profileYears : computedYears > 0 ? computedYears : undefined
  const minYears = job.experienceYearsMin
  let experienceAlignment: MatchResult['experienceAlignment'] = { status: 'unknown', detail: 'The job does not state a minimum experience requirement.' }
  let expScore: number | null = null
  if (minYears !== undefined) {
    if (years === undefined) {
      experienceAlignment = { status: 'unknown', detail: `The job asks for ${minYears}+ years; add your experience dates or years of experience to compare.` }
    } else if (years >= minYears) {
      const above = minYears > 0 && years >= minYears * 2 && years - minYears >= 3
      experienceAlignment = { status: above ? 'above' : 'meets', detail: `You have about ${years} years of experience; the job asks for ${minYears}+.` }
      expScore = 100
    } else {
      experienceAlignment = { status: 'below', detail: `You have about ${years} years of experience; the job asks for ${minYears}+.` }
      expScore = minYears > 0 ? (years / minYears) * 100 : 100
    }
  }

  // ---- education
  let educationAlignment: MatchResult['educationAlignment'] = { status: 'unknown', detail: 'The job does not state an education requirement.' }
  let eduScore: number | null = null
  if (job.educationRequirement) {
    const need = degreeLevel(job.educationRequirement)
    const have = Math.max(0, ...candidate.education.map((e) => degreeLevel(`${e.degree} ${e.field ?? ''}`)))
    const flexible = /equivalent|or related experience|or experience/i.test(job.educationRequirement)
    if (need === 0) educationAlignment = { status: 'unknown', detail: 'Could not determine the degree level requested.' }
    else if (!candidate.education.length) educationAlignment = { status: 'unknown', detail: `The job asks for a ${LEVEL_NAME[need]} degree; add your education to compare.` }
    else if (have >= need) {
      educationAlignment = { status: have > need ? 'above' : 'meets', detail: `Your highest listed education (${LEVEL_NAME[have]}) ${have > need ? 'exceeds' : 'meets'} the ${LEVEL_NAME[need]} requirement.` }
      eduScore = 100
    } else {
      educationAlignment = { status: 'below', detail: `The job asks for a ${LEVEL_NAME[need]} degree${flexible ? ' (or equivalent experience)' : ''}; your highest listed education is ${LEVEL_NAME[have]}.` }
      eduScore = flexible ? 60 : 25
    }
  }

  // ---- weighted score (weights of absent components are redistributed)
  const comps: [keyof typeof WEIGHTS, number | null][] = [
    ['requiredSkills', reqScore], ['preferredSkills', prefScore], ['experience', expScore], ['education', eduScore],
  ]
  const present = comps.filter(([, v]) => v !== null) as [keyof typeof WEIGHTS, number][]
  const totalW = present.reduce((a, [k]) => a + WEIGHTS[k], 0)
  const raw = totalW ? present.reduce((a, [k, v]) => a + (v * WEIGHTS[k]) / totalW, 0) : 0
  const score = Math.max(0, Math.min(100, Math.round(raw)))
  // components with nothing to compare (no requirement stated) are excluded from the score and shown as 100%
  const noReq = { preferred: prefScore === null, experience: minYears === undefined, education: !job.educationRequirement }
  const r = (v: number | null, none = false) => (v === null ? (none ? 100 : 0) : Math.max(0, Math.min(100, Math.round(v))))

  // ---- conflicts
  const conflicts: string[] = []
  const prefs = candidate.profile?.workTypes ?? []
  if (job.workType === 'onsite' && prefs.length && !prefs.includes('onsite')) conflicts.push(`The role is on-site, but your profile lists only ${prefs.join('/')} work.`)
  if (job.workType === 'hybrid' && prefs.length && prefs.every((p) => p === 'remote')) conflicts.push('The role is hybrid, but your profile lists only remote work.')
  if (experienceAlignment.status === 'below' && minYears !== undefined && years !== undefined && (minYears - years >= 2 || years < minYears * 0.6)) {
    conflicts.push(`Experience is well below the stated minimum (${years} vs ${minYears}+ years).`)
  }
  const reqList = skills.filter((s) => s.requirementKind === 'required')
  const reqMissing = reqList.filter((s) => s.status === 'missing')
  if (reqList.length >= 3 && hasData && reqMissing.length / reqList.length > 0.5) conflicts.push('More than half of the required skills have no evidence in your profile.')

  // ---- explanation
  const strongReq = reqList.filter((s) => s.status === 'strong').length
  const partialReq = reqList.filter((s) => s.status === 'partial').length
  const label = score >= 80 ? 'a strong fit' : score >= 60 ? 'a good fit' : score >= 40 ? 'a moderate fit' : 'a limited fit'
  const sentences: string[] = []
  if (!hasData) {
    sentences.push('There is not enough data in your resume or profile yet to estimate your fit for this role.')
    sentences.push('Add skills, experience or upload a resume to get a meaningful comparison.')
  } else {
    sentences.push(`Based on your resume and profile, this looks like ${label} (estimated score ${score}/100).`)
    if (reqList.length) sentences.push(`You have strong evidence for ${strongReq} of ${reqList.length} required skills${partialReq ? ` and partial evidence for ${partialReq} more` : ''}.`)
    sentences.push(experienceAlignment.status === 'unknown' ? 'Experience could not be compared.' : experienceAlignment.detail)
  }
  sentences.push('This is an estimate of how well your profile matches the posting, not a hiring probability.')
  const explanation = sentences.join(' ')

  // ---- recommendations
  const recommendations: string[] = []
  if (!hasData) recommendations.push('Add your skills and experience (or upload a resume) so the match can be calculated.')
  const missNames = reqMissing.map((s) => s.skill)
  if (missNames.length) recommendations.push(`Missing required skills: ${missNames.slice(0, 5).join(', ')}. If you genuinely have them, add them to your profile with evidence; otherwise consider a small project or course.`)
  const partialNames = skills.filter((s) => s.status === 'partial' && s.requirementKind === 'required').map((s) => s.skill)
  if (partialNames.length) recommendations.push(`Strengthen evidence for ${partialNames.slice(0, 5).join(', ')}: mention where you used them in your experience bullets.`)
  const prefMissing = skills.filter((s) => s.requirementKind === 'preferred' && s.status === 'missing').map((s) => s.skill)
  if (prefMissing.length) recommendations.push(`Nice-to-have skills you do not list: ${prefMissing.slice(0, 4).join(', ')}. Only add them if you have real experience.`)
  if (experienceAlignment.status === 'below') recommendations.push('Highlight projects or responsibilities that show depth beyond your years of experience.')
  if (conflicts.length) recommendations.push('Review the conflicts above before applying; some may be deal-breakers for you or the employer.')
  if (!recommendations.length) recommendations.push('Your profile covers the stated requirements well; tailor your resume summary and top bullets to this posting.')

  return {
    jobId: job.id,
    score: hasData ? score : 0,
    breakdown: { requiredSkills: r(reqScore), preferredSkills: r(prefScore, noReq.preferred), experience: r(expScore, noReq.experience), education: r(eduScore, noReq.education) },
    skills,
    experienceAlignment,
    educationAlignment,
    conflicts,
    explanation,
    recommendations,
    source: 'rules',
    computedAt: new Date().toISOString(),
  }
}
