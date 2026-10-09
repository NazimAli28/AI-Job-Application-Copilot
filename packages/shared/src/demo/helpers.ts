/** Date helpers for the demo seed: everything is relative to "now" so the demo always looks fresh. */
const DAY = 86_400_000

/** ISO timestamp `days` days in the past (negative = future) at the given local hour. */
export function ago(days: number, hour = 10, minute = 0): string {
  const d = new Date(Date.now() - days * DAY)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** ISO timestamp `days` days in the future. */
export const ahead = (days: number, hour = 10, minute = 0) => ago(-days, hour, minute)
