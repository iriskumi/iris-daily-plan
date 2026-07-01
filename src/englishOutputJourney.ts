import { getLocalDateKey } from './focus'
import { STUDY_TASK_LIBRARY } from './studyTaskLibrary'
import type { StudySessionRecord } from './studyTypes'

export const ENGLISH_OUTPUT_JOURNEY_KEY = 'iris-english-output-journey'
export const ENGLISH_OUTPUT_MILESTONES = [
  100,
  200,
  300,
  500,
  800,
  1000,
  1500,
  2000,
  3000,
  5000,
  7000,
  10000,
]
export const ENGLISH_OUTPUT_LONG_TERM_TARGET = 10000

export interface EnglishOutputRepHistoryItem {
  id: string
  date: string
  source: 'study-session' | 'manual'
  sessionId?: string
  title?: string
  note?: string
  createdAt: string
}

export interface EnglishOutputJourney {
  totalReps: number
  milestones: number[]
  history: EnglishOutputRepHistoryItem[]
}

interface VersionedValue<T> {
  schemaVersion: number
  value: T
}

const SCHEMA_VERSION = 1

function isVersionedValue<T>(value: unknown): value is VersionedValue<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    'value' in value
  )
}

function emptyJourney(): EnglishOutputJourney {
  return {
    totalReps: 0,
    milestones: ENGLISH_OUTPUT_MILESTONES,
    history: [],
  }
}

function normalizeJourney(value: Partial<EnglishOutputJourney> | null): EnglishOutputJourney {
  const history = value?.history ?? []
  return {
    totalReps: history.length,
    milestones: ENGLISH_OUTPUT_MILESTONES,
    history,
  }
}

export function loadEnglishOutputJourney(): EnglishOutputJourney {
  try {
    const raw = localStorage.getItem(ENGLISH_OUTPUT_JOURNEY_KEY)
    if (!raw) return emptyJourney()
    const parsed = JSON.parse(raw) as unknown
    const value = isVersionedValue<Partial<EnglishOutputJourney>>(parsed)
      ? parsed.value
      : parsed as Partial<EnglishOutputJourney>
    return normalizeJourney(value)
  } catch {
    return emptyJourney()
  }
}

export function saveEnglishOutputJourney(journey: EnglishOutputJourney): void {
  const normalized = normalizeJourney(journey)
  const payload: VersionedValue<EnglishOutputJourney> = {
    schemaVersion: SCHEMA_VERSION,
    value: normalized,
  }
  localStorage.setItem(ENGLISH_OUTPUT_JOURNEY_KEY, JSON.stringify(payload))
}

export function isEnglishOutputRepSession(record: StudySessionRecord): boolean {
  if (record.status !== 'completed') return false
  if (record.actualMinutes < 5) return false
  if (record.category === 'English Output') return true
  const template = record.taskTemplateId
    ? STUDY_TASK_LIBRARY.find(item => item.id === record.taskTemplateId)
    : null
  return Boolean(
    template &&
    template.type === 'output' &&
    template.category.toLowerCase().includes('english'),
  )
}

export function addStudySessionEnglishOutputRep(
  record: StudySessionRecord,
  current = loadEnglishOutputJourney(),
): EnglishOutputJourney {
  if (!isEnglishOutputRepSession(record)) return current
  if (current.history.some(item => item.sessionId === record.id)) return current
  const next: EnglishOutputJourney = {
    ...current,
    history: [
      {
        id: `english-output-rep:${record.id}`,
        date: record.completedAt.slice(0, 10),
        source: 'study-session',
        sessionId: record.id,
        title: record.title,
        createdAt: new Date().toISOString(),
      },
      ...current.history,
    ],
  }
  saveEnglishOutputJourney(next)
  return loadEnglishOutputJourney()
}

export function addManualEnglishOutputRep(note: string, current = loadEnglishOutputJourney()): EnglishOutputJourney {
  const now = new Date().toISOString()
  const next: EnglishOutputJourney = {
    ...current,
    history: [
      {
        id: `manual-output-rep:${crypto.randomUUID()}`,
        date: getLocalDateKey(),
        source: 'manual',
        note: note.trim() || undefined,
        createdAt: now,
      },
      ...current.history,
    ],
  }
  saveEnglishOutputJourney(next)
  return loadEnglishOutputJourney()
}

export function undoLastEnglishOutputRep(current = loadEnglishOutputJourney()): EnglishOutputJourney {
  const next: EnglishOutputJourney = {
    ...current,
    history: current.history.slice(1),
  }
  saveEnglishOutputJourney(next)
  return loadEnglishOutputJourney()
}

export function englishOutputRepsForDate(journey: EnglishOutputJourney, date = getLocalDateKey()): number {
  return journey.history.filter(item => item.date === date).length
}

export function englishOutputRepsForLastSevenDays(journey: EnglishOutputJourney, now = new Date()): number {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 6)
  return journey.history.filter(item => {
    const date = new Date(`${item.date}T00:00:00`)
    return date >= start && date <= now
  }).length
}

export function currentEnglishOutputMilestone(totalReps: number): {
  previous: number
  next: number
  progress: number
  span: number
} {
  const next = ENGLISH_OUTPUT_MILESTONES.find(milestone => totalReps < milestone) ?? ENGLISH_OUTPUT_LONG_TERM_TARGET
  const previousMilestones = ENGLISH_OUTPUT_MILESTONES.filter(milestone => milestone < next)
  const previous = previousMilestones[previousMilestones.length - 1] ?? 0
  return {
    previous,
    next,
    progress: Math.max(0, totalReps - previous),
    span: Math.max(1, next - previous),
  }
}
