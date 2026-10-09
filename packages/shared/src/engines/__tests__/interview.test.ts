import { describe, expect, it } from 'vitest'
import { buildQuestionSet, evaluateAnswer } from '../interview'
import { TECHNICAL, BEHAVIORAL } from '../data/question-bank'
import { SKILLS } from '../skills'
import { interviewQuestionSchema, answerEvaluationSchema } from '../../schemas/interview'
import { makeCandidate, makeJob } from './fixtures'

describe('question bank', () => {
  it('has ~25 behavioral questions and 40+ technical skill templates', () => {
    expect(BEHAVIORAL.length).toBeGreaterThanOrEqual(25)
    expect(Object.keys(TECHNICAL).length).toBeGreaterThanOrEqual(40)
    for (const k of Object.keys(TECHNICAL)) expect(SKILLS[k], k).toBeDefined()
  })
})

describe('buildQuestionSet', () => {
  const job = makeJob()
  const qs = buildQuestionSet(makeCandidate(), job)

  it('returns 12-15 schema-valid questions with unique deterministic ids', () => {
    expect(qs.length).toBeGreaterThanOrEqual(12)
    expect(qs.length).toBeLessThanOrEqual(15)
    for (const q of qs) interviewQuestionSchema.parse(q)
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length)
    expect(buildQuestionSet(makeCandidate(), job).map((q) => q.id)).toEqual(qs.map((q) => q.id))
  })

  it('mixes technical, behavioral and candidate questions', () => {
    const types = new Set(qs.map((q) => q.type))
    expect(types).toEqual(new Set(['technical', 'behavioral', 'candidate']))
    expect(qs[0]!.question).toBe('Tell me about yourself.')
    expect(qs.some((q) => q.question.includes('Northwind Labs'))).toBe(true)
  })

  it('prioritizes required skills and sets difficulty from seniority', () => {
    const tech = qs.filter((q) => q.type === 'technical')
    expect(tech[0]!.skill).toBe('React')
    expect(tech.every((q) => q.difficulty === 'hard')).toBe(true)
    const junior = buildQuestionSet(makeCandidate(), makeJob({ title: 'Junior Frontend Developer', experienceYearsMin: 0 }))
    expect(junior.filter((q) => q.type === 'technical').every((q) => q.difficulty === 'easy')).toBe(true)
  })

  it('references the candidate real data in candidate questions and hints', () => {
    const cq = qs.filter((q) => q.type === 'candidate')
    expect(cq.some((q) => q.question.includes('Frontend Developer at Brightwave Software'))).toBe(true)
    expect(cq.some((q) => q.question.includes('Task Tracker'))).toBe(true)
    const react = qs.find((q) => q.skill === 'React')!
    expect(react.hints.join(' ')).toMatch(/Skills: React/)
    const tech = qs.filter((q) => q.type === 'technical')
    expect(tech.some((q) => /not in your profile|partial evidence/.test(q.hints.join(' ')))).toBe(true)
    expect(qs.find((q) => q.type === 'behavioral' && q.id !== 'q-beh-1')!.answerStructure).toMatch(/STAR|Situation|company|role/i)
  })

  it('works with no candidate data and with unknown skills', () => {
    const j = makeJob({}, 'Quantum Engineer\nRequirements\n- Experience with Python and Figma')
    const r = buildQuestionSet({ profile: null, skills: [], experience: [], education: [], projects: [], certifications: [] }, j)
    expect(r.length).toBeGreaterThanOrEqual(10)
    expect(r.some((q) => q.type === 'technical')).toBe(true)
  })
})

describe('evaluateAnswer', () => {
  const qs = buildQuestionSet(makeCandidate(), makeJob())
  const behavioral = qs.find((q) => q.id === 'q-beh-4')!
  const technical = qs.find((q) => q.skill === 'React')!

  const good =
    'In my last role at Brightwave, our dashboard was slow and customers complained, so my task was to cut load time. First I profiled the bundle and found large unused libraries. Then I introduced code splitting and optimized images, and I wrote tests to avoid regressions. As a result, page load time dropped by 35%, which improved retention for example on the reports page. I learned to measure before optimizing, and I now add performance budgets to every project I build with React and TypeScript. The team adopted the checks in CI and we shipped more confidently afterwards.'

  it('scores a strong STAR answer higher than a weak one', () => {
    const hi = evaluateAnswer(behavioral, good)
    const lo = evaluateAnswer(behavioral, 'I just fixed stuff and, like, it was fine I guess.')
    answerEvaluationSchema.parse(hi)
    expect(hi.score).toBeGreaterThan(lo.score + 20)
    expect(hi.criteria.structure).toBeGreaterThanOrEqual(4)
    expect(hi.criteria.examples).toBeGreaterThanOrEqual(4)
    expect(hi.strengths.length).toBeGreaterThan(0)
    expect(hi.source).toBe('rules')
  })

  it('handles empty and very short answers gracefully', () => {
    const e = evaluateAnswer(behavioral, '')
    expect(e.score).toBeGreaterThanOrEqual(20)
    expect(e.weaknesses[0]).toMatch(/No answer/)
    const s = evaluateAnswer(technical, 'It re-renders.')
    expect(s.score).toBeLessThan(50)
    expect(s.suggestions.some((x) => /80.300/.test(x))).toBe(true)
    for (const v of Object.values(s.criteria)) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(5)
    }
  })

  it('rewards technical vocabulary for technical questions and is neutral otherwise', () => {
    const tech = evaluateAnswer(technical, 'In React, re-renders happen when state or props change. I profile components, memoize expensive computations, and keep state local to avoid unnecessary renders, for example splitting a large component. The trade-off is added complexity, and caching must be correct for performance gains.')
    expect(tech.criteria.technicalAccuracy).toBeGreaterThanOrEqual(4)
    expect(evaluateAnswer(behavioral, good).criteria.technicalAccuracy).toBe(3)
  })

  it('penalizes overly long answers', () => {
    const long = evaluateAnswer(behavioral, 'I solved the problem by working hard. '.repeat(70))
    expect(long.criteria.conciseness).toBeLessThanOrEqual(3)
  })
})
