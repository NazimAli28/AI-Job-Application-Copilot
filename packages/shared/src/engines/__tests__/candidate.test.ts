import { describe, expect, it } from 'vitest'
import { withResumeEvidence } from '../candidate'
import { computeMatch } from '../match'
import { parseResumeText } from '../resume-parser'
import { makeCandidate, makeJob, SAMPLE_RESUME_TEXT } from './fixtures'

const empty = { profile: null, skills: [], experience: [], education: [], projects: [], certifications: [] }
const parsed = parseResumeText(SAMPLE_RESUME_TEXT)

describe('withResumeEvidence', () => {
  it('is pure and deterministic', () => {
    const a = withResumeEvidence(empty, parsed, SAMPLE_RESUME_TEXT)
    const b = withResumeEvidence(empty, parsed, SAMPLE_RESUME_TEXT)
    expect(a).toEqual(b)
    expect(empty.skills).toEqual([])
  })

  it('gives a new user (empty profile) strong matches for resume-evidenced skills', () => {
    const c = withResumeEvidence(empty, parsed, SAMPLE_RESUME_TEXT)
    expect(c.skills.length).toBeGreaterThan(0)
    expect(c.skills.every((s) => s.status === 'confirmed' && s.source === 'resume' && s.id.startsWith('res-skill-'))).toBe(true)
    expect(c.skills[0]!.evidence).toBe('Listed on resume')
    expect(c.experience.length).toBeGreaterThan(0)
    const m = computeMatch(c, makeJob())
    expect(m.skills.find((s) => s.skill === 'React')!.status).toBe('strong')
    expect(m.score).toBeGreaterThan(30)
  })

  it('keeps rejected/learning profile skills as the profile says', () => {
    const base = makeCandidate({
      skills: [
        { id: 'x', name: 'React', status: 'rejected', source: 'manual' },
        { id: 'y', name: 'TypeScript', status: 'learning', source: 'manual' },
      ],
      experience: [],
      projects: [],
      certifications: [],
    })
    const c = withResumeEvidence(base, { ...parsed, experience: [] }, 'Skills: React, TypeScript, Jest')
    expect(c.skills.filter((s) => s.name === 'React')).toHaveLength(1)
    expect(c.skills.find((s) => s.name === 'React')!.status).toBe('rejected')
    expect(c.skills.find((s) => s.name === 'TypeScript')!.status).toBe('learning')
    const m = computeMatch(c, makeJob())
    expect(m.skills.find((s) => s.skill === 'React')!.status).toBe('missing')
  })

  it('does not duplicate entries already in the profile', () => {
    const base = makeCandidate()
    const resume = {
      ...parsed,
      skills: ['react', 'Jest'],
      experience: [{ title: 'frontend developer', company: 'BRIGHTWAVE SOFTWARE', startDate: '2021-01', bullets: ['Built UI with React'] }, { title: 'Intern', company: 'Acme', startDate: '2018-06', endDate: 'Present', bullets: ['Wrote Jest tests'] }],
    }
    const c = withResumeEvidence(base, resume, 'x')
    expect(c.experience).toHaveLength(base.experience.length + 1)
    const added = c.experience.at(-1)!
    expect(added).toMatchObject({ id: 'res-exp-2', current: true, technologies: expect.arrayContaining(['Jest']) })
    expect(c.skills.filter((s) => s.name.toLowerCase() === 'react')).toHaveLength(1)
    expect(c.skills.find((s) => s.name === 'Jest')).toMatchObject({ id: 'res-skill-jest', source: 'resume' })
    expect(new Set(c.skills.map((s) => s.id)).size).toBe(c.skills.length)
  })
})
