import { describe, expect, it } from 'vitest'
import { computeMatch } from '../match'
import { tailorResume } from '../tailoring'
import { makeCandidate, makeJob } from './fixtures'

const nums = (s: string) => new Set(s.match(/\d+(?:\.\d+)?/g) ?? [])

describe('computeMatch', () => {
  const job = makeJob()
  const m = computeMatch(makeCandidate(), job)
  const status = (n: string) => m.skills.find((s) => s.skill === n)

  it('classifies strong / partial / missing with evidence strings', () => {
    expect(status('React')).toMatchObject({ status: 'strong', requirementKind: 'required' })
    expect(status('React')!.evidence[0]).toBe('Skills: React (advanced, 3 yrs)')
    expect(status('React')!.evidence.some((e) => e.startsWith('Experience: Frontend Developer @ Brightwave Software'))).toBe(true)
    expect(status('GraphQL')!.status).not.toBe('strong')
    expect(status('Next.js')!.status).toBe('partial')
    expect(status('Next.js')!.evidence.some((e) => e.startsWith('Project: Portfolio Site') || e.startsWith('Related'))).toBe(true)
    expect(status('Cypress')!.status).toBe('missing')
    expect(status('Cypress')!.evidence).toEqual([])
  })

  it('rejected skills never count as strong or partial (guardrail)', () => {
    // Docker is rejected but mentioned in the resume text and a related skill list
    expect(status('Docker')!.status).toBe('missing')
    const c = makeCandidate({ skills: [{ id: 'x', name: 'React', status: 'rejected', source: 'manual' }] })
    const r = computeMatch(c, job)
    expect(r.skills.find((s) => s.skill === 'React')!.status).toBe('missing')
  })

  it('treats learning skills as partial', () => {
    const j = makeJob({}, 'Vue developer needed.\nRequirements\n- Experience with Vue')
    const r = computeMatch(makeCandidate(), j)
    expect(r.skills.find((s) => s.skill === 'Vue')!.status).toBe('partial')
  })

  it('marks everything unknown when the candidate has almost no data', () => {
    const empty = computeMatch({ profile: null, skills: [], experience: [], education: [], projects: [], certifications: [] }, job)
    expect(empty.skills.every((s) => s.status === 'unknown')).toBe(true)
    expect(empty.score).toBe(0)
    expect(empty.explanation).toMatch(/not enough data/i)
  })

  it('computes experience and education alignment', () => {
    expect(m.experienceAlignment.status).toBe('meets')
    expect(m.educationAlignment.status).toBe('meets')
    const junior = computeMatch(makeCandidate({ profile: { ...makeCandidate().profile!, yearsExperience: 1 } }), makeJob({ experienceYearsMin: 5 }))
    expect(junior.experienceAlignment.status).toBe('below')
    expect(junior.conflicts.some((c) => /Experience is well below/.test(c))).toBe(true)
    const fromDates = computeMatch(makeCandidate({ profile: null }), job)
    expect(fromDates.experienceAlignment.detail).toMatch(/about \d/)
  })

  it('produces a bounded integer score with a breakdown, explanation and recommendations', () => {
    expect(Number.isInteger(m.score)).toBe(true)
    expect(m.score).toBeGreaterThan(40)
    expect(m.score).toBeLessThanOrEqual(100)
    expect(m.breakdown.requiredSkills).toBeGreaterThan(0)
    expect(m.explanation).toMatch(/estimate/i)
    expect(m.explanation).toMatch(/not a hiring probability/i)
    expect(m.recommendations.length).toBeGreaterThan(0)
    expect(m.source).toBe('rules')
  })

  it('detects work-type conflicts', () => {
    const r = computeMatch(makeCandidate(), makeJob({ workType: 'onsite' }))
    expect(r.conflicts.some((c) => /on-site/.test(c))).toBe(true)
  })

  it('redistributes weights when there are no preferred skills', () => {
    const j = makeJob({}, 'Frontend dev\nRequirements\n- React and TypeScript')
    const r = computeMatch(makeCandidate(), j)
    expect(r.breakdown.preferredSkills).toBe(100)
    expect(r.score).toBe(100)
  })
})

describe('tailorResume', () => {
  const job = makeJob()
  const candidate = makeCandidate()
  const t = tailorResume(candidate, job, computeMatch(candidate, job))

  it('orders skills with required matches first and excludes rejected', () => {
    expect(t.skillOrder.slice(0, 3).sort()).toEqual(['JavaScript', 'React', 'TypeScript'])
    expect(t.skillOrder).not.toContain('Docker')
    expect(t.skillOrder.indexOf('Git')).toBeGreaterThan(t.skillOrder.indexOf('React'))
  })

  it('creates keyword suggestions with honest wording', () => {
    const k = (n: string) => t.keywords.find((x) => x.keyword === n)!
    expect(k('React').present).toBe(true)
    expect(k('React').suggestion).toMatch(/keep it visible/)
    expect(k('Git').suggestion).toMatch(/not in any bullet/)
    expect(k('Cypress').present).toBe(false)
    expect(k('Cypress').suggestion).toMatch(/only add if you genuinely have/)
    expect(k('Docker').present).toBe(false)
  })

  it('rephrases weak openers only, as pending suggestions, never adding numbers (guardrail)', () => {
    expect(t.bulletSuggestions.length).toBeGreaterThanOrEqual(3)
    for (const b of t.bulletSuggestions) {
      expect(b.status).toBe('pending')
      expect(b.suggested).not.toBe(b.original)
      for (const n of nums(b.suggested)) expect(nums(b.original).has(n)).toBe(true)
    }
    const first = t.bulletSuggestions[0]!
    expect(first.suggested.startsWith('Built and maintained')).toBe(true)
  })

  it('builds a summary only from profile facts and section tips', () => {
    expect(t.summary).toMatch(/Frontend Developer with 4 years of experience/)
    expect(t.summary).toMatch(/React/)
    expect(t.summary).not.toMatch(/Docker|Kubernetes/)
    expect(t.sectionChanges.length).toBeGreaterThan(0)
    expect(t.source).toBe('rules')
  })
})
