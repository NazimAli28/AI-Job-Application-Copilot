import { describe, expect, it } from 'vitest'
import { analyzeResume } from '../resume-analyzer'
import { parseResumeText } from '../resume-parser'
import { SAMPLE_RESUME_TEXT } from './fixtures'

const nums = (s: string) => new Set(s.match(/\d+(?:\.\d+)?/g) ?? [])

describe('analyzeResume', () => {
  const parsed = parseResumeText(SAMPLE_RESUME_TEXT)
  const a = analyzeResume(parsed, SAMPLE_RESUME_TEXT, ['React', 'Kubernetes'])

  it('returns five scored categories and a weighted overall', () => {
    expect(a.categories.map((c) => c.key)).toEqual(['ats', 'skills', 'clarity', 'achievements', 'formatting'])
    for (const c of a.categories) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(100)
      expect(c.observations.length).toBeGreaterThan(0)
    }
    expect(a.overallScore).toBeGreaterThan(30)
    expect(a.source).toBe('rules')
  })

  it('flags weak openers with stable ids and replaces only the opener', () => {
    const weak = a.issues.filter((i) => i.id.startsWith('weak-verb-'))
    expect(weak.length).toBeGreaterThanOrEqual(3)
    expect(weak[0]!.id).toBe('weak-verb-1')
    expect(weak[0]!.suggestion).toContain('Built and maintained the customer dashboard using React, TypeScript and Redux')
  })

  it('prompts for metrics without inventing numbers', () => {
    const nm = a.issues.filter((i) => i.id.startsWith('no-metric-'))
    expect(nm.length).toBeGreaterThan(0)
    for (const i of nm) expect(nums(i.suggestion ?? '').size).toBe(0)
  })

  it('never introduces numbers that are not in the original text (guardrail)', () => {
    for (const i of a.issues.filter((x) => x.original)) {
      const orig = nums(i.original!)
      for (const n of nums(i.suggestion ?? '')) expect(orig.has(n), `${i.id}: ${n}`).toBe(true)
    }
  })

  it('reports missing target keywords and gives 3-6 recommendations', () => {
    expect(a.issues.some((i) => i.id.startsWith('missing-keyword') && i.message.includes('Kubernetes'))).toBe(true)
    expect(a.issues.some((i) => i.message.includes('"React"'))).toBe(false)
    expect(a.recommendations.length).toBeGreaterThanOrEqual(3)
    expect(a.recommendations.length).toBeLessThanOrEqual(6)
  })

  it('catches contact, section, length, buzzword, passive, pronoun and date problems', () => {
    const bad = 'I am a hard-working team player and detail-oriented go-getter.\n\nEXPERIENCE\nDeveloper | Acme | Jan 2020 - 03/2021\n- Responsible for the app which was written by me\n- I was given many tasks'
    const r = analyzeResume(parseResumeText(bad), bad)
    const ids = r.issues.map((i) => i.id)
    expect(ids).toContain('missing-contact-email')
    expect(ids).toContain('missing-section-education')
    expect(ids).toContain('length-short')
    expect(ids.some((i) => i.startsWith('buzzword-'))).toBe(true)
    expect(ids.some((i) => i.startsWith('passive-'))).toBe(true)
    expect(ids.some((i) => i.startsWith('first-person-'))).toBe(true)
    expect(ids).toContain('inconsistent-dates')
    expect(ids).toContain('few-skills')
    expect(r.issues.find((i) => i.message.includes('detail-oriented'))?.suggestion).toMatch(/evidence/)
  })

  it('flags overly long bullets and long resumes', () => {
    const long = `Sam Lee\nsam@x.io\n\nEXPERIENCE\nDev | Co | 2020 - 2022\n- ${'word '.repeat(40)}\n` + 'filler '.repeat(1100)
    const r = analyzeResume(parseResumeText(long), long)
    expect(r.issues.map((i) => i.id)).toEqual(expect.arrayContaining(['length-long', 'long-bullet-1']))
  })
})
