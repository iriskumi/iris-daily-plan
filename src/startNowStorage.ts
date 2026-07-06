import { getLocalDateKey } from './focus'
import { addIris365ProofItem, loadIris365Store } from './iris365Storage'
import type { Iris365ProofCategory } from './iris365Types'
import type {
  StartNowActionType,
  StartNowMetric,
  StartNowRecord,
  StartNowSummary,
} from './startNowTypes'

const STORAGE_KEY = 'iris-start-now-records'

export const START_NOW_DURATIONS = [5, 10, 25, 45] as const

export const START_NOW_ACTIONS: StartNowActionType[] = [
  'Study',
  'English',
  'Move Body',
  'Project',
  'Work / Resume',
  'Life Admin',
  'Reset',
  'Before I Spiral',
]

export interface QuickCounterOption {
  label: string
  actionType: StartNowActionType
  metric: StartNowMetric
  points?: number
  reps?: number
  minutes?: number
  contribution: string
}

export const START_NOW_COUNTERS: QuickCounterOption[] = [
  { label: '+10 reps', actionType: 'Move Body', metric: 'bodyReps', reps: 10, contribution: 'Body / routine' },
  { label: '+1 set', actionType: 'Move Body', metric: 'bodyReps', reps: 1, contribution: 'Body / routine' },
  { label: '+5 min walk', actionType: 'Move Body', metric: 'bodyMinutes', minutes: 5, contribution: 'Movement minutes' },
  { label: '+10 min walk', actionType: 'Move Body', metric: 'bodyMinutes', minutes: 10, contribution: 'Movement minutes' },
  { label: '+1 stretch session', actionType: 'Move Body', metric: 'bodyMinutes', minutes: 5, contribution: 'Gentle movement' },
  { label: '+1 gentle dance session', actionType: 'Move Body', metric: 'bodyMinutes', minutes: 5, contribution: 'Gentle movement' },
  { label: '+1 sentence', actionType: 'English', metric: 'englishPoints', points: 1, contribution: 'English output' },
  { label: '+5 min oral summary', actionType: 'English', metric: 'englishPoints', points: 2, contribution: 'English output' },
  { label: '+1 shadowing rep', actionType: 'English', metric: 'englishPoints', points: 1, contribution: 'Shadowing' },
  { label: '+1 work phrase', actionType: 'English', metric: 'englishPoints', points: 1, contribution: 'Work English' },
  { label: '+10 min listening', actionType: 'English', metric: 'englishPoints', points: 1, contribution: 'English input' },
  { label: '+1 useful expression', actionType: 'English', metric: 'englishPoints', points: 1, contribution: 'Useful expression' },
  { label: 'opened file', actionType: 'Study', metric: 'realThings', points: 1, contribution: 'Study progress' },
  { label: 'finished one question', actionType: 'Study', metric: 'realThings', points: 1, contribution: 'Study progress' },
  { label: 'wrote one paragraph', actionType: 'Study', metric: 'realThings', points: 1, contribution: 'Study progress' },
  { label: 'took one screenshot', actionType: 'Project', metric: 'realThings', points: 1, contribution: 'Project progress' },
  { label: 'watched one lesson', actionType: 'Study', metric: 'realThings', points: 1, contribution: 'Study progress' },
  { label: 'submitted one thing', actionType: 'Work / Resume', metric: 'realThings', points: 1, contribution: 'Career progress' },
  { label: '+1 urge delayed', actionType: 'Before I Spiral', metric: 'spiralsDelayed', points: 1, contribution: 'Emotional regulation' },
  { label: '+1 softer option', actionType: 'Before I Spiral', metric: 'spiralsDelayed', points: 1, contribution: 'Softer comfort chosen' },
  { label: '+1 bedtime shutdown', actionType: 'Reset', metric: 'resetSessions', points: 1, contribution: 'Protect tomorrow' },
]

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeRecord(value: unknown): StartNowRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<StartNowRecord>
  if (!record.actionType || !record.title || !record.completedAt) return null
  const now = new Date().toISOString()
  return {
    id: String(record.id ?? makeId('start-now')),
    date: String(record.date ?? getLocalDateKey(new Date(record.completedAt))),
    kind: record.kind === 'counter' ? 'counter' : 'session',
    actionType: record.actionType,
    title: String(record.title),
    durationMinutes: Number(record.durationMinutes) || undefined,
    completedMinutes: Number(record.completedMinutes) || undefined,
    metric: record.metric,
    points: Number(record.points) || undefined,
    reps: Number(record.reps) || undefined,
    tinyWin: String(record.tinyWin ?? ''),
    contribution: String(record.contribution ?? 'Today counted'),
    createdAt: String(record.createdAt ?? now),
    completedAt: String(record.completedAt ?? now),
  }
}

export function loadStartNowRecords(): StartNowRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeRecord).filter((record): record is StartNowRecord => Boolean(record))
  } catch (error) {
    console.warn('[StartNow] Failed to load records', error)
    return []
  }
}

export function saveStartNowRecords(records: StartNowRecord[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function proofCategoryForRecord(record: StartNowRecord): Iris365ProofCategory {
  if (record.actionType === 'English') return record.title.toLowerCase().includes('shadowing') ? 'Shadowing' : 'English output'
  if (record.actionType === 'Move Body' || record.actionType === 'Reset') return 'Health / routine'
  if (record.actionType === 'Before I Spiral') return 'Emotional regulation'
  if (record.actionType === 'Work / Resume') return 'Career'
  if (record.actionType === 'Project') return 'Project / AI coding'
  return 'Personal insight'
}

function autoProofTitle(record: StartNowRecord) {
  if (record.kind === 'counter') return `${record.contribution}: ${record.title}`
  return `${record.actionType} progress`
}

function maybeCreateAutoProof(record: StartNowRecord) {
  try {
    addIris365ProofItem({
      date: record.date,
      category: proofCategoryForRecord(record),
      title: autoProofTitle(record),
      description: record.tinyWin || 'Done counts. One small action was saved.',
      linkOrFile: '',
      source: 'manual',
      sourceSessionId: record.id,
      relatedEntryDate: record.date,
    }, loadIris365Store())
  } catch (error) {
    console.warn('[StartNow] Could not create auto proof', error)
  }
}

export function addStartNowSession(input: {
  actionType: StartNowActionType
  durationMinutes: number
  completedMinutes?: number
  tinyWin?: string
}) {
  const now = new Date().toISOString()
  const record: StartNowRecord = {
    id: makeId('start-session'),
    date: getLocalDateKey(),
    kind: 'session',
    actionType: input.actionType,
    title: `${input.durationMinutes} min ${input.actionType}`,
    durationMinutes: input.durationMinutes,
    completedMinutes: input.completedMinutes ?? input.durationMinutes,
    tinyWin: input.tinyWin?.trim() ?? '',
    contribution: input.actionType === 'Before I Spiral' ? 'Emotional regulation' : `${input.actionType} session`,
    createdAt: now,
    completedAt: now,
  }
  const records = [record, ...loadStartNowRecords()]
  saveStartNowRecords(records)
  maybeCreateAutoProof(record)
  return record
}

export function addStartNowCounter(option: QuickCounterOption) {
  const now = new Date().toISOString()
  const record: StartNowRecord = {
    id: makeId('start-counter'),
    date: getLocalDateKey(),
    kind: 'counter',
    actionType: option.actionType,
    title: option.label,
    completedMinutes: option.minutes,
    metric: option.metric,
    points: option.points,
    reps: option.reps,
    contribution: option.contribution,
    createdAt: now,
    completedAt: now,
  }
  const records = [record, ...loadStartNowRecords()]
  saveStartNowRecords(records)
  maybeCreateAutoProof(record)
  return record
}

export function getStartNowRecordsForDate(date = getLocalDateKey()) {
  return loadStartNowRecords().filter(record => record.date === date)
}

export function getStartNowWeekRecords(date = getLocalDateKey()) {
  const current = new Date(`${date}T12:00:00`)
  const start = new Date(current)
  start.setDate(current.getDate() - ((current.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return loadStartNowRecords().filter(record => {
    const recordDate = new Date(`${record.date}T12:00:00`)
    return recordDate >= start && recordDate <= end
  })
}

export function summarizeStartNow(records: StartNowRecord[]): StartNowSummary {
  const summary = records.reduce<StartNowSummary>((acc, record) => {
    if (record.kind === 'session') {
      acc.completedSessions += 1
      if (record.actionType === 'Study') acc.studyMinutes += record.completedMinutes ?? record.durationMinutes ?? 0
      if (record.actionType === 'Project' || record.actionType === 'Work / Resume') acc.studyMinutes += record.completedMinutes ?? record.durationMinutes ?? 0
      if (record.actionType === 'English') acc.englishPoints += Math.max(1, Math.round((record.completedMinutes ?? record.durationMinutes ?? 0) / 5))
      if (record.actionType === 'Move Body') acc.bodyMinutes += record.completedMinutes ?? record.durationMinutes ?? 0
      if (record.actionType === 'Reset') acc.resetSessions += 1
      if (record.actionType === 'Before I Spiral') acc.spiralsDelayed += 1
    }
    if (record.kind === 'counter') {
      if (record.metric === 'studyMinutes') acc.studyMinutes += record.completedMinutes ?? record.points ?? 0
      if (record.metric === 'englishPoints') acc.englishPoints += record.points ?? 0
      if (record.metric === 'bodyReps') acc.bodyReps += record.reps ?? record.points ?? 0
      if (record.metric === 'bodyMinutes') acc.bodyMinutes += record.completedMinutes ?? record.points ?? 0
      if (record.metric === 'realThings') acc.realThings += record.points ?? 1
      if (record.metric === 'spiralsDelayed') acc.spiralsDelayed += record.points ?? 1
      if (record.metric === 'resetSessions') acc.resetSessions += record.points ?? 1
    }
    return acc
  }, {
    studyMinutes: 0,
    englishPoints: 0,
    bodyReps: 0,
    bodyMinutes: 0,
    realThings: 0,
    spiralsDelayed: 0,
    resetSessions: 0,
    completedSessions: 0,
    dayStatus: 'Reset Day',
    statusMessage: 'Protect tomorrow.',
  })

  const hasStudy = summary.studyMinutes > 0
  const hasEnglish = summary.englishPoints >= 5
  const hasBody = summary.bodyMinutes >= 10 || summary.bodyReps >= 10
  const hasRecovery = summary.resetSessions > 0 || summary.spiralsDelayed > 0
  const hasAny = summary.completedSessions > 0
    || summary.englishPoints > 0
    || summary.bodyMinutes > 0
    || summary.bodyReps > 0
    || summary.realThings > 0
    || hasRecovery

  if (hasStudy && hasEnglish) {
    summary.dayStatus = 'High Value Day'
    summary.statusMessage = 'Today counted. High-value progress landed.'
  } else if (hasBody && (hasStudy || summary.realThings > 0) && hasRecovery) {
    summary.dayStatus = 'Strong Day'
    summary.statusMessage = 'Strong day: body, action, and tomorrow were protected.'
  } else if (hasRecovery && !hasStudy) {
    summary.dayStatus = 'Recovery Day'
    summary.statusMessage = 'Soft progress is still progress.'
  } else if (hasAny) {
    summary.dayStatus = 'Counted Day'
    summary.statusMessage = 'Today counted.'
  }

  return summary
}
