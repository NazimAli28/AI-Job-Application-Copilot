export const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '')

export const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Whole days from today until a YYYY-MM-DD date (negative = overdue). */
export function daysUntil(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  const target = new Date(y!, (m ?? 1) - 1, d ?? 1).getTime()
  const t = new Date()
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  return Math.round((target - today) / 86400000)
}

export function countdownLabel(date: string): string {
  const n = daysUntil(date)
  if (n < 0) return `Deadline passed ${-n}d ago`
  if (n === 0) return 'Apply today'
  if (n === 1) return 'Apply by tomorrow'
  return `Apply in ${n} days`
}
