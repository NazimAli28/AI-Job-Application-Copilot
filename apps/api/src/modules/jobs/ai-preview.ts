import { parseJobDescription, type ParsedJob } from '@copilot/shared'

/**
 * Simulated AI Pro job parse (same as the prototype mock) until Phase 8 wires Claude:
 * rules parse + tidier title/company guesses and cleaned bullets. Never adds requirements.
 */
const clean = (s: string) =>
  s
    .replace(/^[\s\-–•*·\d.)]+/, '')
    .replace(/\s+/g, ' ')
    .trim()

export function improveParse(text: string): ParsedJob {
  const p = parseJobDescription(text)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const first = lines[0] ?? ''
  const at = first.match(/^(.{3,80}?)\s+(?:at|@|-|–|\|)\s+(.{2,60})$/i)
  const company = text.match(/^\s*(?:company|employer)\s*[:-]\s*(.+)$/im)?.[1]
  const seen = new Set<string>()
  const responsibilities = p.responsibilities
    .map(clean)
    .filter((r) => r.length > 8 && !seen.has(r.toLowerCase()) && !!seen.add(r.toLowerCase()))
  return {
    ...p,
    title: p.title || (at ? clean(at[1]!) : first.length < 80 ? clean(first) : undefined),
    company: p.company || company?.trim() || (at ? clean(at[2]!) : undefined),
    responsibilities,
    requirements: p.requirements.map((r) => ({ ...r, text: clean(r.text) })),
  }
}
