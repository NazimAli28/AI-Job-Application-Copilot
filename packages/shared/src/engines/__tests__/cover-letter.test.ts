import { describe, expect, it } from 'vitest'
import { generateCoverLetter } from '../cover-letter'
import { makeCandidate, makeJob } from './fixtures'
import { COVER_LETTER_LENGTHS, COVER_LETTER_TONES } from '../../schemas/job'

const wc = (s: string) => s.split(/\s+/).filter(Boolean).length
const job = makeJob()
const candidate = makeCandidate()
const base = { highlightIds: [] as string[], companyInfo: undefined as string | undefined }

describe('generateCoverLetter', () => {
  it('respects length ranges', () => {
    const w = Object.fromEntries(COVER_LETTER_LENGTHS.map((length) => [length, wc(generateCoverLetter(candidate, job, { ...base, tone: 'professional', length }))]))
    expect(w.short).toBeGreaterThanOrEqual(110)
    expect(w.short).toBeLessThanOrEqual(175)
    expect(w.medium).toBeGreaterThanOrEqual(190)
    expect(w.medium).toBeLessThanOrEqual(290)
    expect(w.long).toBeGreaterThanOrEqual(280)
    expect(w.long).toBeLessThanOrEqual(410)
  })

  it('varies by tone and signs with the candidate name', () => {
    const texts = COVER_LETTER_TONES.map((tone) => generateCoverLetter(candidate, job, { ...base, tone, length: 'medium' }))
    expect(new Set(texts).size).toBe(3)
    for (const t of texts) {
      expect(t.trim().endsWith('Jordan Rivera')).toBe(true)
      expect(t).toContain('\n\n')
      expect(t).toContain('Senior Frontend Engineer')
    }
  })

  it('uses only real candidate facts: matched skills, real bullets, highlight selection', () => {
    const t = generateCoverLetter(candidate, job, { ...base, tone: 'professional', length: 'long' })
    expect(t).toMatch(/React/)
    expect(t).not.toMatch(/Kubernetes|Cypress|Docker/)
    expect(t).toMatch(/Brightwave Software/)
    const proj = generateCoverLetter(candidate, job, { ...base, tone: 'friendly', length: 'medium', highlightIds: ['p1'] })
    expect(proj).toContain('Task Tracker')
    expect(proj).not.toContain('In my role as Frontend Developer')
  })

  it('makes no company claims when companyInfo is absent (guardrail)', () => {
    for (const tone of COVER_LETTER_TONES) {
      const t = generateCoverLetter(candidate, job, { ...base, tone, length: 'long' })
      expect(t).not.toMatch(/analytics software|retailers|stood out to me|your mission|your product|I admire|your culture/i)
      expect(t).toMatch(/your team/)
    }
  })

  it('includes provided companyInfo only', () => {
    const t = generateCoverLetter(candidate, job, { ...base, tone: 'professional', length: 'medium', companyInfo: 'Northwind builds privacy-first analytics tools. Founded recently.' })
    expect(t).toContain('privacy-first analytics tools')
    expect(t).not.toContain('Founded recently')
  })

  it('works with an empty candidate', () => {
    const t = generateCoverLetter({ profile: null, skills: [], experience: [], education: [], projects: [], certifications: [] }, job, { ...base, tone: 'confident', length: 'short' })
    expect(t).toContain('[Your name]')
    expect(t).toContain('Northwind Labs')
  })
})
