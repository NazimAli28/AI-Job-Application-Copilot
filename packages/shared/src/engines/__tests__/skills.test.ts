import { describe, expect, it } from 'vitest'
import { SKILLS, extractSkills, normalizeSkill, relatedSkills, skillCategory } from '../skills'

describe('skills dictionary', () => {
  it('has a large dictionary with valid related references', () => {
    expect(Object.keys(SKILLS).length).toBeGreaterThanOrEqual(400)
    for (const [name, def] of Object.entries(SKILLS)) {
      for (const r of def.related ?? []) expect(SKILLS[r], `${name} -> ${r}`).toBeDefined()
    }
  })

  it('normalizes aliases, case and punctuation', () => {
    for (const v of ['Node', 'nodejs', 'Node.js', 'node js', 'NODE.JS']) expect(normalizeSkill(v)).toBe('Node.js')
    expect(normalizeSkill('ReactJS')).toBe('React')
    expect(normalizeSkill('postgres')).toBe('PostgreSQL')
    expect(normalizeSkill('k8s')).toBe('Kubernetes')
    expect(normalizeSkill('C++')).toBe('C++')
    expect(normalizeSkill('golang')).toBe('Go')
    expect(normalizeSkill('totally-unknown-thing')).toBeNull()
  })

  it('extracts tokens like C++, C#, .NET, Node.js, CI/CD', () => {
    const found = extractSkills('Built services in C++ and C#, on .NET, plus Node.js APIs with CI/CD pipelines.')
    expect(found).toEqual(expect.arrayContaining(['C++', 'C#', '.NET', 'Node.js', 'CI/CD']))
  })

  it('avoids false positives for ambiguous words', () => {
    expect(extractSkills('We go to market quickly. Go-getter attitude. Rest assured.')).toEqual([])
    expect(extractSkills('Option R is cheaper. Swift delivery of results. Unity of purpose.')).toEqual([])
    expect(extractSkills('Languages: Go, Rust, R')).toEqual(expect.arrayContaining(['Go', 'Rust', 'R']))
    expect(extractSkills('Wrote services in Go and deployed them.')).toContain('Go')
    expect(extractSkills('We use JavaScript daily')).not.toContain('Java')
    expect(extractSkills('PostgreSQL and NoSQL')).not.toContain('SQL')
  })

  it('returns related skills in both directions and categories', () => {
    expect(relatedSkills('React')).toEqual(expect.arrayContaining(['Next.js', 'Vue']))
    expect(relatedSkills('Next.js')).toContain('React')
    expect(relatedSkills('PostgreSQL')).toEqual(expect.arrayContaining(['MySQL', 'SQL']))
    expect(skillCategory('react')).toBe('frontend')
    expect(skillCategory('nope')).toBeNull()
  })
})
