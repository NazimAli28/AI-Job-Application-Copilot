import { describe, expect, it } from 'vitest'
import { parseJobDescription } from '../job-parser'
import { SAMPLE_JOB_DESCRIPTION } from './fixtures'

describe('parseJobDescription', () => {
  const j = parseJobDescription(SAMPLE_JOB_DESCRIPTION)

  it('extracts header facts', () => {
    expect(j.title).toBe('Senior Frontend Engineer')
    expect(j.company).toBe('Northwind Labs')
    expect(j.location).toContain('Remote')
    expect(j.workType).toBe('remote')
    expect(j.employmentType).toBe('full-time')
    expect(j.salary).toContain('$120,000')
    expect(j.experienceYearsMin).toBe(4)
    expect(j.educationRequirement).toMatch(/Bachelor/)
  })

  it('splits responsibilities', () => {
    expect(j.responsibilities).toHaveLength(4)
    expect(j.responsibilities[0]).toMatch(/^Build and maintain/)
  })

  it('creates deterministic, deduplicated skill requirements with kinds', () => {
    const skills = j.requirements.filter((r) => r.category === 'skill')
    expect(new Set(skills.map((s) => s.skill)).size).toBe(skills.length)
    const kind = (n: string) => skills.find((s) => s.skill === n)?.kind
    expect(kind('React')).toBe('required')
    expect(kind('GraphQL')).toBe('required')
    expect(kind('Next.js')).toBe('preferred')
    expect(kind('Playwright')).toBe('preferred')
    expect(j.requirements[0]!.id).toBe('req-1')
    expect(j.requirements.some((r) => r.category === 'experience')).toBe(true)
    expect(j.requirements.some((r) => r.category === 'education')).toBe(true)
    expect(parseJobDescription(SAMPLE_JOB_DESCRIPTION)).toEqual(j)
  })

  it('handles labels, hybrid, contract, k-salary and year ranges', () => {
    const t = "Job Title: Data Engineer\nCompany: Acme Analytics\nLocation: Berlin, Germany (Hybrid)\nContract position, EUR 60k - EUR 80k.\nMinimum of 2 years of experience with Python and SQL.\nMaster's degree in a related field preferred."
    const r = parseJobDescription(t)
    expect(r.title).toBe('Data Engineer')
    expect(r.company).toBe('Acme Analytics')
    expect(r.workType).toBe('hybrid')
    expect(r.employmentType).toBe('contract')
    expect(r.salary).toContain('60k')
    expect(r.experienceYearsMin).toBe(2)
    expect(parseJobDescription('We need 2-4 years of experience in Java.').experienceYearsMin).toBe(2)
  })

  it('treats whole text as required when there are no sections', () => {
    const r = parseJobDescription('Backend developer wanted. You know Python and Docker well and ideally Kubernetes experience is a plus.')
    const k = (n: string) => r.requirements.find((x) => x.skill === n)?.kind
    expect(k('Python')).toBe('required')
    expect(k('Kubernetes')).toBe('preferred')
  })
})
