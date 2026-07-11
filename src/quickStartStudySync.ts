import { addStudySessionEnglishOutputRep } from './englishOutputJourney'
import { addStudySessionRecord, loadStudySessionRecords } from './studyStorage'
import type { StudyCategory, StudySessionRecord } from './studyTypes'
import { writeStudySessionToTaskStore } from './taskStore'
import type { StartNowActionType, StartNowRecord } from './startNowTypes'

const QUICK_START_STUDY_SYNCS_KEY = 'iris-quick-start-study-syncs'

type QuickStartStudySyncMap = Record<string, string>

export type QuickStartStudySyncChoice = 'trace-only' | 'study-log' | 'english-output' | 'english-input'

export const QUICK_START_STUDY_ELIGIBLE_ACTIONS: StartNowActionType[] = [
  'Study',
  'English',
  'Project',
  'Work / Resume',
]

function loadSyncMap(): QuickStartStudySyncMap {
  try {
    const raw = localStorage.getItem(QUICK_START_STUDY_SYNCS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null ? parsed as QuickStartStudySyncMap : {}
  } catch {
    return {}
  }
}

function saveSyncMap(map: QuickStartStudySyncMap): void {
  localStorage.setItem(QUICK_START_STUDY_SYNCS_KEY, JSON.stringify(map))
}

export function isQuickStartStudyEligible(record: StartNowRecord): boolean {
  return record.kind === 'session' && QUICK_START_STUDY_ELIGIBLE_ACTIONS.includes(record.actionType)
}

export function getQuickStartStudySyncId(quickStartRecordId: string): string | null {
  const map = loadSyncMap()
  return map[quickStartRecordId] ?? null
}

function categoryForQuickStart(record: StartNowRecord, choice: QuickStartStudySyncChoice): StudyCategory {
  if (record.actionType === 'English') {
    return choice === 'english-input' ? 'English Input' : 'English Output'
  }
  if (record.actionType === 'Project') return 'AI Coding'
  if (record.actionType === 'Work / Resume') return 'Job / Career'
  return 'Admin / Life'
}

function titleForQuickStart(record: StartNowRecord, category: StudyCategory): string {
  if (record.actionType === 'Study') return 'Quick Start Study'
  if (record.actionType === 'English') return category === 'English Output' ? 'Quick Start English Output' : 'Quick Start English Input'
  if (record.actionType === 'Project') return 'Quick Start Project'
  if (record.actionType === 'Work / Resume') return 'Quick Start Career'
  return `Quick Start ${record.actionType}`
}

function startedAtForRecord(record: StartNowRecord, actualMinutes: number): string {
  const completedAt = new Date(record.completedAt)
  if (Number.isNaN(completedAt.getTime())) return record.createdAt
  return new Date(completedAt.getTime() - actualMinutes * 60_000).toISOString()
}

export function syncQuickStartToStudyLog(
  record: StartNowRecord,
  choice: Exclude<QuickStartStudySyncChoice, 'trace-only'>,
): {
  status: 'synced' | 'already-synced' | 'not-eligible'
  message: string
  studySessionId?: string
} {
  if (!isQuickStartStudyEligible(record)) {
    return { status: 'not-eligible', message: 'This Quick Start action does not sync to Study Log.' }
  }

  const existingId = getQuickStartStudySyncId(record.id)
  if (existingId || loadStudySessionRecords().some(session => session.source === 'today-quick-start' && session.sourceImportId === record.id)) {
    return {
      status: 'already-synced',
      message: 'Already saved to Study Log.',
      studySessionId: existingId ?? `quick-start-study:${record.id}`,
    }
  }

  const plannedMinutes = Math.max(1, Math.round(record.durationMinutes ?? record.completedMinutes ?? 1))
  const actualMinutes = Math.max(1, Math.min(
    plannedMinutes,
    Math.round(record.completedMinutes ?? record.durationMinutes ?? plannedMinutes),
  ))
  const category = categoryForQuickStart(record, choice)
  const studySessionId = `quick-start-study:${record.id}`
  const completedAt = record.completedAt || new Date().toISOString()
  const studyRecord: StudySessionRecord = {
    id: studySessionId,
    customTaskId: `quick-start:${record.id}`,
    source: 'today-quick-start',
    sourceImportId: record.id,
    title: titleForQuickStart(record, category),
    category,
    startedAt: startedAtForRecord(record, actualMinutes),
    completedAt,
    plannedMinutes,
    actualMinutes,
    status: 'completed',
    noteDestination: 'Obsidian/Study/Quick Start.md',
    notes: [
      record.tinyWin,
      `Synced from Today Quick Start: ${record.title}.`,
      choice === 'english-output' ? 'User confirmed this was active English output.' : '',
    ].filter(Boolean).join('\n'),
    resourceUsed: 'Today Quick Start',
  }

  addStudySessionRecord(studyRecord)
  writeStudySessionToTaskStore(studyRecord)
  if (choice === 'english-output') {
    addStudySessionEnglishOutputRep(studyRecord)
  }

  saveSyncMap({
    ...loadSyncMap(),
    [record.id]: studySessionId,
  })

  return {
    status: 'synced',
    message: 'Saved to Study Log.',
    studySessionId,
  }
}
