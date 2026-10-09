import { describe, expect, it } from 'vitest'
import { parseResumeText } from '../resume-parser'
import { SAMPLE_RESUME_TEXT } from './fixtures'

describe('parseResumeText', () => {
  const p = parseResumeText(SAMPLE_RESUME_TEXT)

  it('detects sections in order', () => {
    expect(p.sections).toEqual(['summary', 'experience', 'education', 'skills', 'projects', 'certifications'])
  })

  it('extracts contact info', () => {
    expect(p.contact.name).toBe('Jordan Rivera')
    expect(p.contact.email).toBe('jordan.rivera@example.com')
    expect(p.contact.phone).toContain('555-0147')
    expect(p.contact.location).toBe('Austin, TX')
    expect(p.contact.links.some((l) => l.includes('linkedin.com'))).toBe(true)
    expect(p.contact.links.some((l) => l.includes('github.com'))).toBe(true)
  })

  it('parses experience entries, dates and bullets', () => {
    expect(p.experience).toHaveLength(2)
    expect(p.experience[0]).toMatchObject({ title: 'Frontend Developer', company: 'Brightwave Software', startDate: '2021-01' })
    expect(p.experience[0]!.endDate).toBeUndefined()
    expect(p.experience[0]!.bullets.length).toBeGreaterThanOrEqual(5)
    expect(p.experience[1]).toMatchObject({ title: 'Junior Web Developer', company: 'Pixel & Co', startDate: '2019-06', endDate: '2020-12' })
  })

  it('parses education, projects, certifications, achievements and skills', () => {
    expect(p.education[0]).toMatchObject({ institution: 'University of Texas at Austin', endDate: '2019' })
    expect(p.education[0]!.degree).toContain('Computer Science')
    expect(p.projects.map((x) => x.name)).toEqual(['Portfolio Site', 'Task Tracker'])
    expect(p.certifications).toHaveLength(2)
    expect(p.achievements.some((a) => a.includes('35%'))).toBe(true)
    expect(p.skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Node.js', 'PostgreSQL']))
    expect(p.technologies.length).toBeGreaterThan(10)
  })

  it('handles alternative date formats and headings', () => {
    const t = 'Alex Doe\nalex@x.io\n\nWORK HISTORY:\nData Analyst - Acme Corp\n03/2020 - 06/2022\n* Built dashboards in Tableau\n\nTechnical Skills:\nSQL, Python'
    const r = parseResumeText(t)
    expect(r.sections).toEqual(['experience', 'skills'])
    expect(r.experience[0]).toMatchObject({ title: 'Data Analyst', company: 'Acme Corp', startDate: '2020-03', endDate: '2022-06' })
    expect(r.skills).toEqual(expect.arrayContaining(['SQL', 'Python', 'Tableau']))
    const y = parseResumeText('Experience\nEngineer at Foo Inc (2019-2021)\n- Did things')
    expect(y.experience[0]).toMatchObject({ startDate: '2019', endDate: '2021' })
  })

  it('does not crash on empty text', () => {
    expect(parseResumeText('').sections).toEqual([])
  })
})
