import { getLocalDateKey } from './focus'
import type {
  DailyStudyTarget,
  StudyActiveSession,
  StudyDailyReview,
  StudySessionRecord,
} from './studyTypes'

const STUDY_STORAGE_SCHEMA_VERSION = 1

const STUDY_KEYS = {
  targetsByDate: 'iris-study-targets-by-date',
  sessions: 'iris-study-session-records',
  activeSession: 'iris-study-active-session',
  reviewsByDate: 'iris-study-reviews-by-date',
}

export const STUDY_ACTIVE_SESSION_CHANGED_EVENT = 'iris-study-active-session-changed'

interface VersionedValue<T> {
  schemaVersion: number
  value: T
}

const defaultStudyTargetMinutes = 8 * 60

function isVersionedValue<T>(value: unknown): value is VersionedValue<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    'value' in value
  )
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (isVersionedValue<T>(parsed)) return parsed.value
    return parsed as T
  } catch {
    return null
  }
}

function save(key: string, value: unknown): void {
  const payload: VersionedValue<unknown> = {
    schemaVersion: STUDY_STORAGE_SCHEMA_VERSION,
    value,
  }
  localStorage.setItem(key, JSON.stringify(payload))
}

function notifyActiveStudySessionChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STUDY_ACTIVE_SESSION_CHANGED_EVENT))
}

export function emptyDailyStudyTarget(date = getLocalDateKey()): DailyStudyTarget {
  return {
    date,
    targetMinutes: defaultStudyTargetMinutes,
    updatedAt: new Date().toISOString(),
  }
}

export function loadStudyTargetsByDate(): Record<string, DailyStudyTarget> {
  return load<Record<string, DailyStudyTarget>>(STUDY_KEYS.targetsByDate) ?? {}
}

export function loadDailyStudyTarget(date = getLocalDateKey()): DailyStudyTarget {
  return loadStudyTargetsByDate()[date] ?? emptyDailyStudyTarget(date)
}

export function saveDailyStudyTarget(target: DailyStudyTarget): void {
  save(STUDY_KEYS.targetsByDate, {
    ...loadStudyTargetsByDate(),
    [target.date]: {
      ...target,
      updatedAt: new Date().toISOString(),
    },
  })
}

export function loadStudySessionRecords(): StudySessionRecord[] {
  return load<StudySessionRecord[]>(STUDY_KEYS.sessions) ?? []
}

export function saveStudySessionRecords(records: StudySessionRecord[]): void {
  save(STUDY_KEYS.sessions, records)
}

export function loadStudySessionRecordsForDate(date = getLocalDateKey()): StudySessionRecord[] {
  return loadStudySessionRecords().filter(record => {
    const recordDate = record.completedAt?.slice(0, 10) || record.startedAt.slice(0, 10)
    return recordDate === date
  })
}

export function addStudySessionRecord(record: StudySessionRecord): StudySessionRecord[] {
  const existing = loadStudySessionRecords()
  const next = [
    record,
    ...existing.filter(item => item.id !== record.id),
  ]
  saveStudySessionRecords(next)
  return next
}

export function loadActiveStudySession(): StudyActiveSession | null {
  return load<StudyActiveSession>(STUDY_KEYS.activeSession)
}

export function saveActiveStudySession(session: StudyActiveSession): void {
  save(STUDY_KEYS.activeSession, session)
  notifyActiveStudySessionChanged()
}

export function clearActiveStudySession(): void {
  localStorage.removeItem(STUDY_KEYS.activeSession)
  notifyActiveStudySessionChanged()
}

export function emptyStudyDailyReview(date = getLocalDateKey()): StudyDailyReview {
  return {
    date,
    actualDone: '',
    carryOver: '',
    tomorrowNextStep: '',
    updatedAt: new Date().toISOString(),
  }
}

export function loadStudyReviewsByDate(): Record<string, StudyDailyReview> {
  return load<Record<string, StudyDailyReview>>(STUDY_KEYS.reviewsByDate) ?? {}
}

export function loadStudyDailyReview(date = getLocalDateKey()): StudyDailyReview {
  return {
    ...emptyStudyDailyReview(date),
    ...(loadStudyReviewsByDate()[date] ?? {}),
    date,
  }
}

export function saveStudyDailyReview(review: StudyDailyReview): void {
  save(STUDY_KEYS.reviewsByDate, {
    ...loadStudyReviewsByDate(),
    [review.date]: {
      ...review,
      updatedAt: new Date().toISOString(),
    },
  })
}
