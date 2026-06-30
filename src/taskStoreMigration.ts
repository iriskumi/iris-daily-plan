import { STUDY_TASK_LIBRARY } from './studyTaskLibrary'
import {
  emptyTaskStore,
  loadTaskStore,
  saveTaskStore,
  saveTaskStoreMigrationMarker,
  TASK_STORE_SCHEMA_VERSION,
} from './taskStore'
import type {
  BlockTaskArea,
  DayBlock,
  DayBlockQueue,
  FocusBlock,
  FocusSession,
  Task,
  TaskStatus,
} from './types'
import type { StudyActiveSession, StudySessionRecord } from './studyTypes'
import type {
  TaskStore,
  TaskStoreMigrationMarker,
  TaskStoreSummary,
  UnifiedActiveTimer,
  UnifiedSubtask,
  UnifiedTask,
  UnifiedTaskContext,
  UnifiedTaskSession,
  UnifiedTaskStatus,
  UnifiedTaskTemplate,
} from './taskStoreTypes'
import { getTaskStoreSummary } from './taskStore'

export const TASK_STORE_MIGRATION_VERSION = 'step-1a'

const OLD_KEYS = {
  tasks: 'iris-tasks',
  blockQueuesByDate: 'iris-block-queues-by-date',
  studySessions: 'iris-study-session-records',
  studyActiveSession: 'iris-study-active-session',
  focusSessions: 'iris-focus-sessions',
  legacyFocusBlocks: 'iris_focus_blocks',
  focusBlocksByDate: 'focusBlocksByDate',
}

interface VersionedValue<T> {
  schemaVersion: number
  value: T
}

function isVersionedValue<T>(value: unknown): value is VersionedValue<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    'value' in value
  )
}

function readOldLocalStorage<T>(key: string): T | null {
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

function nowIso(): string {
  return new Date().toISOString()
}

function contextFromText(value?: string): UnifiedTaskContext {
  const text = (value ?? '').toLowerCase()
  if (/(english|japanese|cyber|study|ai|sql|excel|review|notebooklm)/.test(text)) return 'study'
  if (/(job|work|career|interview|application|cv|linkedin)/.test(text)) return 'work'
  if (/(admin|life|reset|health|bill|finance|recovery)/.test(text)) return 'life'
  return null
}

function contextFromBlockArea(area?: BlockTaskArea): UnifiedTaskContext {
  if (!area) return null
  if (area === 'work_admin') return 'work'
  if (area === 'life_admin' || area === 'health') return 'life'
  return 'study'
}

function statusFromTask(status?: TaskStatus, done?: boolean): UnifiedTaskStatus {
  if (done || status === 'Done') return 'done'
  if (status === 'Doing') return 'in-progress'
  if (status === 'Skipped' || status === 'Archived') return 'abandoned'
  return 'todo'
}

function statusFromBlock(status: DayBlock['status']): UnifiedTaskStatus {
  if (status === 'done') return 'done'
  if (status === 'in_progress') return 'in-progress'
  if (status === 'skipped') return 'abandoned'
  return 'todo'
}

function subtasksFromTask(task: Task): UnifiedSubtask[] | undefined {
  if (task.subtasks?.length) return task.subtasks
  if (task.checklist?.length) {
    return task.checklist.map((title, index) => ({
      id: `${task.id}-checklist-${index}`,
      title,
      done: false,
    }))
  }
  return undefined
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex(existing => existing.id === item.id)
  if (index < 0) return [...items, item]
  const next = [...items]
  next[index] = {
    ...next[index],
    ...item,
  }
  return next
}

function syntheticStudyTaskId(session: StudySessionRecord): string {
  return `study-history:${session.taskTemplateId ?? session.customTaskId ?? session.id}`
}

function legacyFocusBlocks(): FocusBlock[] {
  const legacy = readOldLocalStorage<FocusBlock[]>(OLD_KEYS.legacyFocusBlocks) ?? []
  const byDate = readOldLocalStorage<Record<string, FocusBlock[]>>(OLD_KEYS.focusBlocksByDate) ?? {}
  const byId = new Map<string, FocusBlock>()
  ;[...legacy, ...Object.values(byDate).flat()].forEach(block => byId.set(block.id, block))
  return [...byId.values()]
}

function taskFromInbox(task: Task): UnifiedTask {
  const createdAt = task.createdAt || nowIso()
  return {
    id: task.id,
    title: task.title,
    context: contextFromText(`${task.area ?? ''} ${task.category}`),
    category: task.area ?? task.category,
    status: statusFromTask(task.status, task.done),
    priority: task.priority,
    energy: task.energy,
    estimatedMinutes: task.estimatedMinutes,
    source: 'task-inbox',
    subtasks: subtasksFromTask(task),
    createdAt,
    updatedAt: task.updatedAt ?? createdAt,
    oldSource: OLD_KEYS.tasks,
    oldSourceId: task.id,
  }
}

function taskFromBlock(block: DayBlock): UnifiedTask {
  return {
    id: `quick-add-block:${block.id}`,
    title: block.title,
    context: contextFromBlockArea(block.area),
    category: block.area,
    status: statusFromBlock(block.status),
    priority: block.priority,
    energy: block.energyLevel,
    estimatedMinutes: block.estimatedMinutes,
    scheduledDate: block.date,
    scheduledBlockId: block.id,
    source: 'quick-add-block',
    subtasks: block.subtasks,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    oldSource: OLD_KEYS.blockQueuesByDate,
    oldSourceId: block.id,
  }
}

function templateFromStudyLibrary(template: typeof STUDY_TASK_LIBRARY[number]): UnifiedTaskTemplate {
  return {
    id: template.id,
    title: template.title,
    context: 'study',
    category: template.category,
    defaultDuration: template.defaultDuration,
    alternativeDurations: template.alternativeDurations,
    energy: template.energy,
    type: template.type,
    resourceSuggestion: template.resourceSuggestion,
    studyMethod: template.studyMethod,
    noteDestination: template.noteDestination,
    subtasks: template.subtasks,
    eveningFriendly: template.eveningFriendly,
    rescueFriendly: template.rescueFriendly,
    oldSource: 'src/studyTaskLibrary.ts',
  }
}

function taskFromStudySession(session: StudySessionRecord): UnifiedTask {
  const createdAt = session.startedAt || session.completedAt || nowIso()
  return {
    id: syntheticStudyTaskId(session),
    templateId: session.taskTemplateId,
    title: session.title,
    context: 'study',
    category: session.category,
    status: session.status === 'completed' ? 'done' : 'abandoned',
    estimatedMinutes: session.plannedMinutes,
    source: 'synthetic-history',
    noteDestination: session.noteDestination,
    resourceSuggestion: session.resourceUsed,
    studyMethod: session.notes,
    createdAt,
    updatedAt: session.completedAt || createdAt,
    oldSource: OLD_KEYS.studySessions,
    oldSourceId: session.id,
  }
}

function sessionFromStudyRecord(session: StudySessionRecord): UnifiedTaskSession {
  const taskId = syntheticStudyTaskId(session)
  return {
    id: session.id,
    taskId,
    sourceTemplateId: session.taskTemplateId,
    sourceCustomTaskId: session.customTaskId,
    title: session.title,
    category: session.category,
    engine: 'study',
    startedAt: session.startedAt,
    endedAt: session.completedAt,
    durationPlannedMin: session.plannedMinutes,
    actualMinutes: session.actualMinutes,
    outcome: session.status === 'completed' ? 'completed' : 'abandoned',
    noteDestination: session.noteDestination,
    notes: session.notes,
    resourceUsed: session.resourceUsed,
    oldSource: OLD_KEYS.studySessions,
    oldSourceId: session.id,
  }
}

function activeTimerFromStudy(session: StudyActiveSession): UnifiedActiveTimer {
  return {
    id: session.id,
    taskId: session.taskTemplateId || session.customTaskId
      ? `active-study:${session.taskTemplateId ?? session.customTaskId}`
      : undefined,
    sourceTemplateId: session.taskTemplateId,
    sourceCustomTaskId: session.customTaskId,
    title: session.title,
    category: session.category,
    engine: 'study',
    status: session.status,
    sessionStartTime: session.sessionStartTime,
    durationMinutes: session.durationMinutes,
    expectedEndTime: session.expectedEndTime,
    pausedAccumulatedMs: session.pausedAccumulatedMs,
    pauseStartedAt: session.pauseStartedAt,
    noteDestination: session.noteDestination,
    notes: session.notes,
    resourceUsed: session.resourceUsed,
    oldSource: OLD_KEYS.studyActiveSession,
    oldSourceId: session.id,
  }
}

function sessionFromFocusSession(session: FocusSession, blockIds: Set<string>): UnifiedTaskSession {
  const engine = session.taskId && blockIds.has(session.taskId) ? 'focus-block' : 'pomodoro'
  return {
    id: `focus-session:${session.id}`,
    taskId: session.taskId,
    title: session.taskTitle,
    category: session.category,
    engine,
    startedAt: session.completedAt,
    endedAt: session.completedAt,
    durationPlannedMin: session.focusMinutes,
    actualMinutes: session.focusMinutes,
    outcome: 'completed',
    oldSource: OLD_KEYS.focusSessions,
    oldSourceId: session.id,
  }
}

function sessionFromFocusBlock(block: FocusBlock): UnifiedTaskSession {
  return {
    id: `focus-block:${block.id}`,
    taskId: block.taskId,
    title: block.taskTitle,
    category: block.area,
    engine: 'focus-block',
    startedAt: block.startTime,
    endedAt: block.actualEndTime,
    durationPlannedMin: block.minutes,
    actualMinutes: block.status === 'Done' ? block.minutes : undefined,
    outcome: block.status === 'Doing'
      ? 'in-progress'
      : block.status === 'Done'
        ? 'completed'
        : 'abandoned',
    notes: block.notes,
    oldSource: OLD_KEYS.focusBlocksByDate,
    oldSourceId: block.id,
  }
}

function migrationMarker(store: TaskStore, migratedAt: string): TaskStoreMigrationMarker {
  return {
    schemaVersion: TASK_STORE_SCHEMA_VERSION,
    migrationVersion: TASK_STORE_MIGRATION_VERSION,
    migratedAt,
    sourceIds: {
      tasks: store.tasks.filter(task => task.oldSource === OLD_KEYS.tasks).map(task => task.oldSourceId ?? task.id),
      queueBlocks: store.tasks.filter(task => task.oldSource === OLD_KEYS.blockQueuesByDate).map(task => task.oldSourceId ?? task.id),
      studyTemplates: store.templates.map(template => template.id),
      studySessions: store.sessions.filter(session => session.oldSource === OLD_KEYS.studySessions).map(session => session.oldSourceId ?? session.id),
      focusSessions: store.sessions.filter(session => session.oldSource === OLD_KEYS.focusSessions).map(session => session.oldSourceId ?? session.id),
      focusBlocks: store.sessions.filter(session => session.oldSource === OLD_KEYS.focusBlocksByDate).map(session => session.oldSourceId ?? session.id),
      activeTimers: store.activeTimer ? [store.activeTimer.oldSourceId ?? store.activeTimer.id] : [],
    },
  }
}

export function previewTaskStoreMigration(): TaskStore {
  const migratedAt = nowIso()
  let store = loadTaskStore() ?? emptyTaskStore(migratedAt)
  store = {
    ...store,
    schemaVersion: TASK_STORE_SCHEMA_VERSION,
    migratedAt,
    tasks: [...store.tasks],
    templates: [...store.templates],
    sessions: [...store.sessions],
  }

  const oldTasks = readOldLocalStorage<Task[]>(OLD_KEYS.tasks) ?? []
  oldTasks.forEach(task => {
    store.tasks = upsertById(store.tasks, taskFromInbox(task))
  })

  const queueByDate = readOldLocalStorage<Record<string, DayBlockQueue>>(OLD_KEYS.blockQueuesByDate) ?? {}
  Object.values(queueByDate).forEach(queue => {
    queue.blocks.forEach(block => {
      if (block.sourceTaskId) {
        const existing = store.tasks.find(task => task.id === block.sourceTaskId)
        if (existing) {
          store.tasks = upsertById(store.tasks, {
            ...existing,
            scheduledDate: block.date,
            scheduledBlockId: block.id,
            status: statusFromBlock(block.status),
            updatedAt: block.updatedAt,
          })
          return
        }
      }
      store.tasks = upsertById(store.tasks, taskFromBlock(block))
    })
  })

  STUDY_TASK_LIBRARY.forEach(template => {
    store.templates = upsertById(store.templates, templateFromStudyLibrary(template))
  })

  const studySessions = readOldLocalStorage<StudySessionRecord[]>(OLD_KEYS.studySessions) ?? []
  studySessions.forEach(session => {
    store.tasks = upsertById(store.tasks, taskFromStudySession(session))
    store.sessions = upsertById(store.sessions, sessionFromStudyRecord(session))
  })

  const activeStudySession = readOldLocalStorage<StudyActiveSession>(OLD_KEYS.studyActiveSession)
  if (activeStudySession) {
    store.activeTimer = activeTimerFromStudy(activeStudySession)
  }

  const focusBlocks = legacyFocusBlocks()
  const focusBlockIds = new Set(focusBlocks.map(block => block.id))
  focusBlocks.forEach(block => {
    store.sessions = upsertById(store.sessions, sessionFromFocusBlock(block))
    const existingTask = store.tasks.find(task => task.id === block.taskId)
    if (existingTask) {
      store.tasks = upsertById(store.tasks, {
        ...existingTask,
        scheduledDate: block.date,
        scheduledBlockId: block.id,
        updatedAt: block.updatedAt,
      })
    }
  })

  const focusSessions = readOldLocalStorage<FocusSession[]>(OLD_KEYS.focusSessions) ?? []
  focusSessions.forEach(session => {
    store.sessions = upsertById(store.sessions, sessionFromFocusSession(session, focusBlockIds))
  })

  return store
}

export function migrateTaskStoreStep1A(): TaskStoreSummary {
  const store = previewTaskStoreMigration()
  const marker = migrationMarker(store, store.migratedAt)
  saveTaskStore(store)
  saveTaskStoreMigrationMarker(marker)
  return getTaskStoreSummary(store)
}

export function previewTaskStoreMigrationSummary(): TaskStoreSummary {
  return getTaskStoreSummary(previewTaskStoreMigration())
}
