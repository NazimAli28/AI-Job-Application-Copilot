import type { CandidateBundle, Education, Experience, ProfileSkill, Project } from '../schemas/profile'
import type { ParsedResume } from '../schemas/resume'
import { extractSkills, normalizeSkill } from './skills'

const canon = (s: string) => (normalizeSkill(s) ?? s).trim().toLowerCase()
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const slug = (s: string) => canon(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Merges a parsed resume into the candidate bundle so the resume counts as EVIDENCE (D11):
 * resume skills → skills (status confirmed, source 'resume'), resume experience/projects/education
 * → entries, de-duplicated against the profile. Profile data wins; rejected profile skills stay rejected.
 * Pure and deterministic.
 */
export function withResumeEvidence(
  bundle: CandidateBundle,
  parsed: ParsedResume | null,
  resumeText?: string,
): CandidateBundle {
  const text = resumeText ?? bundle.resumeText
  if (!parsed) return { ...bundle, resumeText: text }

  // ---- skills
  const known = new Set(bundle.skills.map((s) => canon(s.name)))
  const added: ProfileSkill[] = []
  for (const raw of [...parsed.skills, ...parsed.technologies]) {
    const name = (normalizeSkill(raw) ?? raw).trim()
    const c = canon(name)
    if (!name || name.length > 60 || known.has(c)) continue
    known.add(c)
    added.push({
      id: `res-skill-${slug(name) || added.length}`,
      name,
      status: 'confirmed',
      source: 'resume',
      evidence: 'Listed on resume',
    })
  }

  // ---- experience
  const expKeys = new Set(bundle.experience.map((e) => `${key(e.title)}|${key(e.company)}`))
  const experience: Experience[] = []
  parsed.experience.forEach((e, i) => {
    const title = e.title.trim()
    const company = e.company.trim()
    const k = `${key(title)}|${key(company)}`
    if (!title || !company || expKeys.has(k)) return
    expKeys.add(k)
    const end = e.endDate?.trim()
    const current = !end || /^(present|current|now)$/i.test(end)
    experience.push({
      id: `res-exp-${i + 1}`,
      title,
      company,
      startDate: e.startDate?.trim() || 'Unknown',
      ...(current ? {} : { endDate: end }),
      current,
      bullets: e.bullets,
      technologies: extractSkills(e.bullets.join('\n')),
    })
  })

  // ---- projects
  const projKeys = new Set(bundle.projects.map((p) => key(p.name)))
  const projects: Project[] = []
  parsed.projects.forEach((p, i) => {
    const name = p.name.trim()
    if (!name || projKeys.has(key(name))) return
    projKeys.add(key(name))
    projects.push({
      id: `res-proj-${i + 1}`,
      name,
      description: p.description,
      technologies: extractSkills(`${name}\n${p.description}`),
      bullets: [],
    })
  })

  // ---- education
  const eduKeys = new Set(bundle.education.map((e) => `${key(e.institution)}|${key(e.degree)}`))
  const education: Education[] = []
  parsed.education.forEach((e, i) => {
    const institution = e.institution.trim()
    const degree = e.degree.trim()
    const k = `${key(institution)}|${key(degree)}`
    if (!institution || !degree || eduKeys.has(k)) return
    eduKeys.add(k)
    education.push({
      id: `res-edu-${i + 1}`,
      institution,
      degree,
      ...(e.endDate ? { endDate: e.endDate } : {}),
    })
  })

  return {
    ...bundle,
    skills: [...bundle.skills, ...added],
    experience: [...bundle.experience, ...experience],
    projects: [...bundle.projects, ...projects],
    education: [...bundle.education, ...education],
    resumeText: text,
  }
}
