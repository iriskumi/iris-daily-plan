import { getLocalDateKey } from './focus'
import type { Iris365Entry, Iris365Phase, Iris365Stats, Iris365Store, Iris365Streaks } from './iris365Types'

const STORAGE_KEY = 'iris-365'
const SCHEMA_VERSION = 1
const JOURNEY_DAYS = 365

export const IRIS_365_PHASES: Iris365Phase[] = [
  {
    id: 1,
    startDay: 1,
    endDay: 30,
    title: 'Stabilise the System',
    focus: 'Protect the base: sleep, movement, English output, and one real-world task.',
  },
  {
    id: 2,
    startDay: 31,
    endDay: 90,
    title: 'Build Output',
    focus: 'Turn small practice into repeatable visible output.',
  },
  {
    id: 3,
    startDay: 91,
    endDay: 180,
    title: 'Portfolio and Proof',
    focus: 'Collect evidence: projects, writing, interviews, and consistent study logs.',
  },
  {
    id: 4,
    startDay: 181,
    endDay: 365,
    title: 'Scale Up',
    focus: 'Use the proof you built to reach bigger rooms and better opportunities.',
  },
]

function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

function dayDiffInclusive(startDate: string, currentDate = getLocalDateKey()): number {
  const start = parseLocalDate(startDate)
  const current = parseLocalDate(currentDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) return 1
  return Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1
}

export function calculateCurrentDayNumber(startDate: string, currentDate = getLocalDateKey()): number {
  return Math.min(JOURNEY_DAYS, Math.max(1, dayDiffInclusive(startDate, currentDate)))
}

export function calculateDaysRemaining(startDate: string, currentDate = getLocalDateKey()): number {
  return Math.max(0, JOURNEY_DAYS - calculateCurrentDayNumber(startDate, currentDate))
}

export function determineCurrentPhase(dayNumber: number): Iris365Phase {
  return IRIS_365_PHASES.find(phase => dayNumber >= phase.startDay && dayNumber <= phase.endDay) ?? IRIS_365_PHASES[IRIS_365_PHASES.length - 1]
}

export function emptyIris365Entry(date = getLocalDateKey()): Iris365Entry {
  return {
    date,
    englishOutput: false,
    shadowing: false,
    realityTask: false,
    movement: false,
    highStimulusControlled: false,
    sleepProtected: false,
    mood: 3,
    energy: 3,
    tinyWin: '',
    notes: '',
    updatedAt: new Date().toISOString(),
  }
}

function fallbackStore(): Iris365Store {
  return {
    schemaVersion: SCHEMA_VERSION,
    startDate: getLocalDateKey(),
    entries: {},
  }
}

function normaliseEntry(value: Partial<Iris365Entry>, date: string): Iris365Entry {
  return {
    ...emptyIris365Entry(date),
    ...value,
    date,
    mood: clampRating(value.mood),
    energy: clampRating(value.energy),
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  }
}

function clampRating(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 3
  return Math.min(5, Math.max(1, Math.round(numeric)))
}

function normaliseStore(value: unknown): Iris365Store {
  if (!value || typeof value !== 'object') return fallbackStore()
  const parsed = value as Partial<Iris365Store>
  const startDate = typeof parsed.startDate === 'string' ? parsed.startDate : getLocalDateKey()
  const entries = Object.entries(parsed.entries ?? {}).reduce<Record<string, Iris365Entry>>((acc, [date, entry]) => {
    if (entry && typeof entry === 'object') acc[date] = normaliseEntry(entry as Partial<Iris365Entry>, date)
    return acc
  }, {})
  return {
    schemaVersion: SCHEMA_VERSION,
    startDate,
    entries,
  }
}

export function loadIris365Store(): Iris365Store {
  if (typeof localStorage === 'undefined') return fallbackStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const store = fallbackStore()
      saveIris365Store(store)
      return store
    }
    return normaliseStore(JSON.parse(raw))
  } catch {
    return fallbackStore()
  }
}

export function saveIris365Store(store: Iris365Store): Iris365Store {
  const next = normaliseStore(store)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

export function loadIris365Entry(date = getLocalDateKey(), store = loadIris365Store()): Iris365Entry {
  return store.entries[date] ?? emptyIris365Entry(date)
}

export function saveIris365Entry(entry: Iris365Entry, store = loadIris365Store()): Iris365Store {
  return saveIris365Store({
    ...store,
    entries: {
      ...store.entries,
      [entry.date]: {
        ...entry,
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

export function calculateIris365Streaks(entries: Record<string, Iris365Entry>, currentDate = getLocalDateKey()): Iris365Streaks {
  const entryDates = new Set(Object.values(entries).map(entry => entry.date))
  let currentStreak = 0
  const cursor = parseLocalDate(currentDate)
  while (entryDates.has(getLocalDateKey(cursor))) {
    currentStreak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  const sortedDates = [...entryDates].sort()
  let bestStreak = 0
  let running = 0
  let previous: Date | null = null
  sortedDates.forEach(date => {
    const current = parseLocalDate(date)
    if (previous && Math.round((current.getTime() - previous.getTime()) / 86_400_000) === 1) {
      running += 1
    } else {
      running = 1
    }
    bestStreak = Math.max(bestStreak, running)
    previous = current
  })

  return { currentStreak, bestStreak }
}

export function calculateIris365Stats(entries: Record<string, Iris365Entry>, currentDate = getLocalDateKey()): Iris365Stats {
  const list = Object.values(entries)
  const streaks = calculateIris365Streaks(entries, currentDate)
  return {
    totalCompletedDays: list.length,
    englishOutputDays: list.filter(entry => entry.englishOutput).length,
    shadowingDays: list.filter(entry => entry.shadowing).length,
    realityTaskDays: list.filter(entry => entry.realityTask).length,
    movementDays: list.filter(entry => entry.movement).length,
    highStimulusControlledDays: list.filter(entry => entry.highStimulusControlled).length,
    sleepProtectedDays: list.filter(entry => entry.sleepProtected).length,
    ...streaks,
  }
}

export function recentIris365Entries(entries: Record<string, Iris365Entry>, count = 7): Iris365Entry[] {
  return Object.values(entries)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, count)
}

export function iris365ProgressPercent(dayNumber: number): number {
  return Math.min(100, Math.max(0, Math.round((dayNumber / JOURNEY_DAYS) * 100)))
}
