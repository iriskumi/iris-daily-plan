import type { DurationMinutes } from './types'

export const DURATION_OPTIONS: DurationMinutes[] = [
  5,
  10,
  15,
  20,
  25,
  30,
  40,
  45,
  60,
  75,
  90,
  120,
  150,
  180,
]

export const DURATION_GROUPS = [
  { label: 'Short', values: [5, 10, 15, 20, 25, 30] as DurationMinutes[] },
  { label: 'Medium', values: [40, 45, 60] as DurationMinutes[] },
  { label: 'Long', values: [75, 90, 120] as DurationMinutes[] },
  { label: 'Deep', values: [150, 180] as DurationMinutes[] },
]

export function isStandardDuration(minutes: number): minutes is DurationMinutes {
  return DURATION_OPTIONS.includes(minutes as DurationMinutes)
}

export function durationValuesWithLegacy(minutes?: number): number[] {
  if (!minutes || isStandardDuration(minutes)) return DURATION_OPTIONS
  return [...DURATION_OPTIONS, minutes].sort((a, b) => a - b)
}

export function longBlockHint(minutes: number): string | null {
  if (minutes >= 150) {
    return 'This is a long block. A 5–10 min reset in the middle is recommended.'
  }
  if (minutes >= 90) {
    return 'Long block — consider taking a short reset halfway.'
  }
  return null
}
