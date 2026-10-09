import { describe, expect, it } from 'vitest'
import { analyzeResume } from '../resume-analyzer'
import { parseResumeText } from '../resume-parser'
import { parseJobDescription } from '../job-parser'
import { computeMatch } from '../match'
import { makeCandidate, makeJob } from './fixtures'

const resume = (contact: string) =>
  `Test User\n${contact}\n\nExperience\nEngineer at Acme\n2019 - 2021\n- Built things\n\nSkills\nReact`

describe('phone detection regressions', () => {
  it.each([
    ['+1 555 0100', '+1 555 0100'],
    ['+49 30 1234567', '+49 30 1234567'],
    ['(555) 010-0100', '(555) 010-0100'],
    ['555.010.0100', '555.010.0100'],
  ])('detects %s on a pipe-separated contact line', (phone, expected) => {
    const text = resume(`test@example.com | ${phone} | Lisbon, Portugal | github.com/testuser`)
    const p = parseResumeText(text)
    expect(p.contact.phone).toBe(expected)
    const a = analyzeResume(p, text, [])
    expect(a.issues.some((i) => /phone/i.test(i.message))).toBe(false)
  })

  it('does not treat date ranges or years as phone numbers', () => {
    for (const c of ['test@example.com | 2019 - 2021', 'test@example.com | 2019-2021 | Lisbon, Portugal', 'Jan 2019 - Mar 2021 | test@example.com']) {
      const text = resume(c)
      expect(parseResumeText(text).contact.phone).toBeUndefined()
      expect(analyzeResume(parseResumeText(text), text, []).issues.some((i) => /phone/i.test(i.message))).toBe(true)
    }
  })
})

describe('job parser header regressions', () => {
  it.each([' - ', ' · ', ' | ', ' — '])('parses "Company%sLocation"', (sep) => {
    const p = parseJobDescription(`Frontend Engineer\nNimbus Labs${sep}Remote (EU)\nFull-time\n\nAbout the role\nBuild UI.\n\nRequirements\n- React`)
    expect(p.title).toBe('Frontend Engineer')
    expect(p.company).toBe('Nimbus Labs')
    expect(p.location).toBe('Remote (EU)')
  })

  it('captures education listed under nice to have as a preferred requirement', () => {
    const p = parseJobDescription(
      "Frontend Engineer\nNimbus Labs - Remote (EU)\n\nRequirements\n- 3+ years of experience with React\n\nNice to have\n- Bachelor's degree in Computer Science\n- Storybook",
    )
    expect(p.educationRequirement).toMatch(/Bachelor/)
    const edu = p.requirements.find((r) => r.category === 'education')
    expect(edu?.kind).toBe('preferred')
    expect(p.experienceYearsMin).toBe(3)
  })
})

describe('match breakdown regressions', () => {
  it('shows 100% and redistributes weight when job has no education or experience requirement', () => {
    const j = makeJob({}, 'Frontend dev\nRequirements\n- React and TypeScript')
    const r = computeMatch(makeCandidate(), j)
    expect(r.educationAlignment.status).toBe('unknown')
    expect(r.breakdown.education).toBe(100)
    expect(r.breakdown.experience).toBe(100)
    expect(r.score).toBe(100)
  })

  it('keeps all breakdown values within 0-100', () => {
    const r = computeMatch(makeCandidate(), makeJob())
    for (const v of Object.values(r.breakdown)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })
})
