import type { ResumeAnalysis, ResumeIssue } from '@copilot/shared'

/**
 * Simulated AI Pro analysis (same as the prototype mock) until Phase 8 wires Claude.
 * Rephrase-only: never adds facts, uses placeholders where a metric is missing.
 */
function rewrite(original: string): string {
  const base = original
    .replace(
      /^(responsible for|worked on|helped with|helped|assisted with|duties included)\s+/i,
      '',
    )
    .trim()
  const cleaned = base.charAt(0).toUpperCase() + base.slice(1)
  const hasNumber = /\d/.test(cleaned)
  return `${cleaned.replace(/[.;]$/, '')}${hasNumber ? '' : ' — [add metric: scale, % improvement or time saved]'}`
}

export function simulateAiAnalysis(rules: ResumeAnalysis): ResumeAnalysis {
  const issues: ResumeIssue[] = rules.issues.map((i) => ({
    ...i,
    id: `ai_${i.id}`,
    suggestion:
      i.original && (i.category === 'achievements' || i.category === 'clarity')
        ? rewrite(i.original)
        : i.suggestion,
  }))
  return {
    ...rules,
    issues,
    recommendations: [
      ...rules.recommendations,
      'Lead each bullet with a strong verb, then the outcome, then how you did it.',
      'Only add numbers you can back up in an interview — replace each [add metric] placeholder with a real figure.',
    ],
    source: 'ai',
    analyzedAt: new Date().toISOString(),
  }
}
