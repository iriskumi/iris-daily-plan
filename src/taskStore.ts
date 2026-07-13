import type {
  TaskStore,
  TaskStoreMigrationMarker,
  TaskStoreSummary,
  UnifiedActiveTimer,
  UnifiedSubtask,
  UnifiedTask,
  UnifiedTaskSession,
  UnifiedTaskTemplate,
} from './taskStoreTypes'
import type { StudyActiveSession, StudySessionRecord, StudyTaskTemplate } from './studyTypes'
import type {
  BlockTaskArea,
  DayBlock,
  FocusBlock,
  FocusBlockStatus,
  FocusSession,
  Task,
  TaskStatus,
} from './types'
import { createInboxTask } from './focusBlocks'
import { loadTasks, saveTasks } from './storage'

export const TASK_STORE_SCHEMA_VERSION = 1
export const TASK_STORE_KEY = 'iris-task-store'
export const TASK_STORE_MIGRATION_KEY = 'iris-task-store-migration'

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

function loadJson<T>(key: string): T | null {
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

function saveJson(key: string, value: unknown): void {
  const payload: VersionedValue<unknown> = {
    schemaVersion: TASK_STORE_SCHEMA_VERSION,
    value,
  }
  localStorage.setItem(key, JSON.stringify(payload))
}

export function emptyTaskStore(now = new Date().toISOString()): TaskStore {
  return {
    schemaVersion: TASK_STORE_SCHEMA_VERSION,
    migratedAt: now,
    tasks: [],
    templates: [],
    sessions: [],
  }
}

export function loadTaskStore(): TaskStore | null {
  const store = loadJson<TaskStore>(TASK_STORE_KEY)
  if (!store) return null
  return {
    ...emptyTaskStore(store.migratedAt),
    ...store,
    schemaVersion: store.schemaVersion || TASK_STORE_SCHEMA_VERSION,
    tasks: store.tasks ?? [],
    templates: store.templates ?? [],
    sessions: store.sessions ?? [],
  }
}

export function saveTaskStore(store: TaskStore): void {
  saveJson(TASK_STORE_KEY, {
    ...store,
    schemaVersion: TASK_STORE_SCHEMA_VERSION,
  })
}

function mutableTaskStore(): TaskStore {
  return loadTaskStore() ?? emptyTaskStore()
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

function studyTemplateTaskId(templateId: string): string {
  return `study-template-instance:${templateId}`
}

function customStudyTaskId(customTaskId: string): string {
  return `manual-study:${customTaskId}`
}

function subtasksFromTitles(taskId: string, titles: string[]): UnifiedSubtask[] {
  return titles.map((title, index) => ({
    id: `${taskId}:subtask:${index}`,
    title,
    done: false,
  }))
}

function contextFromQuickAddArea(area?: BlockTaskArea): UnifiedTask['context'] {
  if (!area) return null
  if (area === 'work_admin') return 'work'
  if (area === 'life_admin' || area === 'health') return 'life'
  if (['cyber', 'ai_project', 'english', 'japanese', 'sql_data', 'reading'].includes(area)) {
    return 'study'
  }
  return null
}

function statusFromBlockStatus(status: DayBlock['status']): UnifiedTask['status'] {
  if (status === 'done') return 'done'
  if (status === 'in_progress') return 'in-progress'
  if (status === 'skipped') return 'abandoned'
  return 'todo'
}

function statusFromInboxStatus(status?: TaskStatus, done?: boolean): UnifiedTask['status'] {
  if (done || status === 'Done') return 'done'
  if (status === 'Doing') return 'in-progress'
  if (status === 'Skipped' || status === 'Archived') return 'abandoned'
  return 'todo'
}

function quickAddBlockTaskId(block: DayBlock): string {
  return block.unifiedTaskId ?? `quick-add-block:${block.id}`
}

function activeTimerFromStudySession(
  session: StudyActiveSession,
  taskId: string,
): UnifiedActiveTimer {
  return {
    id: session.id,
    taskId,
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
    oldSource: 'iris-study-active-session',
    oldSourceId: session.id,
  }
}

export function mirrorActiveStudySessionInTaskStore(session: StudyActiveSession | null): void {
  const store = mutableTaskStore()
  if (!session) {
    saveTaskStore({
      ...store,
      activeTimer: store.activeTimer?.engine === 'study' ? undefined : store.activeTimer,
    })
    return
  }
  const taskId = session.taskTemplateId
    ? studyTemplateTaskId(session.taskTemplateId)
    : session.customTaskId
      ? customStudyTaskId(session.customTaskId)
      : `active-study:${session.id}`
  saveTaskStore({
    ...store,
    activeTimer: activeTimerFromStudySession(session, taskId),
  })
}

export function ensureStudyTemplateTaskInTaskStore(
  template: StudyTaskTemplate,
  durationMinutes: number,
  activeSession?: StudyActiveSession,
  overrides?: {
    title?: string
    noteDestination?: string
    studyMethod?: string
  },
): string {
  const store = mutableTaskStore()
  const now = new Date().toISOString()
  const taskId = studyTemplateTaskId(template.id)
  const existing = store.tasks.find(task => task.id === taskId)
  const task: UnifiedTask = {
    id: taskId,
    templateId: template.id,
    title: overrides?.title?.trim() || template.title,
    context: 'study',
    category: template.category,
    status: 'in-progress',
    energy: template.energy,
    estimatedMinutes: durationMinutes,
    source: 'study-template-instance',
    noteDestination: overrides?.noteDestination?.trim() || template.noteDestination,
    resourceSuggestion: template.resourceSuggestion,
    studyMethod: overrides?.studyMethod?.trim() || template.studyMethod,
    subtasks: subtasksFromTitles(taskId, template.subtasks),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    oldSource: 'src/studyTaskLibrary.ts',
    oldSourceId: template.id,
  }
  saveTaskStore({
    ...store,
    tasks: upsertById(store.tasks, task),
    activeTimer: activeSession ? activeTimerFromStudySession(activeSession, taskId) : store.activeTimer,
  })
  return taskId
}

export function ensureCustomStudyTaskInTaskStore(input: {
  customTaskId: string
  title: string
  category: string
  durationMinutes: number
  noteDestination?: string
  notes?: string
  activeSession?: StudyActiveSession
}): string {
  const store = mutableTaskStore()
  const now = new Date().toISOString()
  const taskId = customStudyTaskId(input.customTaskId)
  const existing = store.tasks.find(task => task.id === taskId)
  const task: UnifiedTask = {
    id: taskId,
    title: input.title,
    context: 'study',
    category: input.category,
    status: 'in-progress',
    estimatedMinutes: input.durationMinutes,
    source: 'manual',
    noteDestination: input.noteDestination,
    studyMethod: input.notes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    oldSource: 'study-custom-task',
    oldSourceId: input.customTaskId,
  }
  saveTaskStore({
    ...store,
    tasks: upsertById(store.tasks, task),
    activeTimer: input.activeSession ? activeTimerFromStudySession(input.activeSession, taskId) : store.activeTimer,
  })
  return taskId
}

export function writeQuickAddBlockToTaskStore(block: DayBlock): string {
  const store = mutableTaskStore()
  const taskId = quickAddBlockTaskId(block)
  const existing = store.tasks.find(task => task.id === taskId)
  const now = new Date().toISOString()
  const task: UnifiedTask = {
    id: taskId,
    title: block.title,
    context: contextFromQuickAddArea(block.area),
    category: block.area,
    status: statusFromBlockStatus(block.status),
    priority: block.priority,
    energy: block.energyLevel,
    estimatedMinutes: block.estimatedMinutes,
    scheduledDate: block.date,
    scheduledBlockId: block.id,
    source: 'quick-add-block',
    notes: block.notes,
    subtasks: block.subtasks,
    createdAt: existing?.createdAt ?? block.createdAt ?? now,
    updatedAt: block.updatedAt ?? now,
    oldSource: 'iris-block-queues-by-date',
    oldSourceId: block.id,
  }
  saveTaskStore({
    ...store,
    tasks: upsertById(store.tasks, task),
  })
  return taskId
}

export function clearBlockQueueScheduleInTaskStore(block: DayBlock, status: 'todo' | 'abandoned' = 'todo'): void {
  const store = mutableTaskStore()
  const taskId = block.unifiedTaskId ?? (block.sourceTaskId ? block.sourceTaskId : quickAddBlockTaskId(block))
  const existing = store.tasks.find(task =>
    task.id === taskId ||
    task.scheduledBlockId === block.id ||
    task.oldSourceId === block.sourceTaskId ||
    task.oldSourceId === block.id,
  )
  if (!existing) return
  saveTaskStore({
    ...store,
    tasks: upsertById(store.tasks, {
      ...existing,
      status,
      scheduledDate: undefined,
      scheduledBlockId: undefined,
      updatedAt: new Date().toISOString(),
    }),
  })
}

export function writeInboxTaskToTaskStore(task: Task): string {
  const store = mutableTaskStore()
  const createdAt = task.createdAt || new Date().toISOString()
  const externalContext = task.tags?.includes('external-context:study')
    ? 'study'
    : task.tags?.includes('external-context:life')
      ? 'life'
      : 'work'
  const subtasks = task.subtasks?.length
    ? task.subtasks
    : task.checklist?.map((title, index) => ({
        id: `${task.id}:checklist:${index}`,
        title,
        done: false,
      }))
  const unifiedTask: UnifiedTask = {
    id: task.id,
    title: task.title,
    context: task.externalSource === 'iris-job-search' ? externalContext : null,
    category: task.area ?? task.category,
    status: statusFromInboxStatus(task.status, task.done),
    priority: task.priority,
    energy: task.energy,
    estimatedMinutes: task.estimatedMinutes,
    source: task.externalSource === 'iris-job-search' ? 'iris-job-search' : 'task-inbox',
    notes: task.notes,
    subtasks,
    createdAt,
    updatedAt: task.updatedAt ?? createdAt,
    oldSource: 'iris-tasks',
    oldSourceId: task.id,
    externalSource: task.externalSource,
    sourceImportId: task.sourceImportId,
    sourceUrl: task.sourceUrl,
    externalCategory: task.externalCategory,
    applicationId: task.applicationId,
    company: task.company,
    jobTitle: task.jobTitle,
  }
  saveTaskStore({
    ...store,
    tasks: upsertById(store.tasks, unifiedTask),
  })
  return unifiedTask.id
}

export interface ExternalInboxTaskInput {
  title: string
  estimatedMinutes: number
  context: UnifiedTask['context']
  notes?: string
  sourceUrl?: string
  externalCategory?: string
  applicationId?: string
  company?: string
  jobTitle?: string
  externalSource: string
  sourceImportId: string
}

export function findExternalInboxTask(externalSource: string, sourceImportId: string): Task | null {
  return loadTasks().find(task =>
    task.externalSource === externalSource &&
    task.sourceImportId === sourceImportId,
  ) ?? null
}

export function createExternalInboxTask(input: ExternalInboxTaskInput): { task: Task; created: boolean } {
  const existing = findExternalInboxTask(input.externalSource, input.sourceImportId)
  if (existing) return { task: existing, created: false }
  const task = createInboxTask({
    title: input.title,
    area: 'Job',
    energy: input.estimatedMinutes > 45 ? 'High' : input.estimatedMinutes <= 25 ? 'Low' : 'Medium',
    mode: input.estimatedMinutes <= 25 ? 'Admin' : 'Focus',
    estimatedMinutes: input.estimatedMinutes,
    nextTinyAction: 'Open the JD and highlight 3 requirements only.',
  })
  const notes = [
    input.notes,
    input.company ? `Company: ${input.company}` : '',
    input.jobTitle ? `Role: ${input.jobTitle}` : '',
    input.sourceUrl ? `Source: ${input.sourceUrl}` : '',
  ].filter(Boolean).join('\n')
  const externalTask: Task = {
    ...task,
    project: input.company || 'Iris Job Search',
    notes,
    tags: ['iris-job-search', 'job-search', `external-context:${input.context ?? 'work'}`, input.externalCategory].filter(Boolean) as string[],
    externalSource: input.externalSource,
    sourceImportId: input.sourceImportId,
    sourceUrl: input.sourceUrl,
    externalCategory: input.externalCategory,
    applicationId: input.applicationId,
    company: input.company,
    jobTitle: input.jobTitle,
  }
  saveTasks([externalTask, ...loadTasks()])
  writeInboxTaskToTaskStore(externalTask)
  return { task: externalTask, created: true }
}

function taskIdForStudyRecord(record: StudySessionRecord): string {
  if (record.taskTemplateId) return studyTemplateTaskId(record.taskTemplateId)
  if (record.customTaskId) return customStudyTaskId(record.customTaskId)
  return `study-history:${record.id}`
}

export function writeStudySessionToTaskStore(record: StudySessionRecord): void {
  const store = mutableTaskStore()
  const taskId = taskIdForStudyRecord(record)
  const now = new Date().toISOString()
  const existingTask = store.tasks.find(task => task.id === taskId)
  const existingCompletedSession = store.sessions.some(session =>
    session.taskId === taskId &&
    session.outcome === 'completed' &&
    session.id !== record.id,
  )
  const nextStatus = record.status === 'completed'
    ? 'done'
    : existingCompletedSession
      ? 'done'
      : 'abandoned'
  const fallbackTask: UnifiedTask = {
    id: taskId,
    templateId: record.taskTemplateId,
    title: record.title,
    context: 'study',
    category: record.category,
    status: nextStatus,
    estimatedMinutes: record.plannedMinutes,
    source: record.taskTemplateId ? 'study-template-instance' : record.customTaskId ? 'manual' : 'synthetic-history',
    noteDestination: record.noteDestination,
    resourceSuggestion: record.resourceUsed,
    studyMethod: record.notes,
    createdAt: existingTask?.createdAt ?? record.startedAt,
    updatedAt: now,
    oldSource: record.source ?? 'iris-study-session-records',
    oldSourceId: record.sourceImportId ?? record.id,
  }
  const nextTask: UnifiedTask = {
    ...fallbackTask,
    ...existingTask,
    status: nextStatus,
    updatedAt: now,
  }
  const session: UnifiedTaskSession = {
    id: record.id,
    taskId,
    sourceTemplateId: record.taskTemplateId,
    sourceCustomTaskId: record.customTaskId,
    title: record.title,
    category: record.category,
    engine: 'study',
    startedAt: record.startedAt,
    endedAt: record.completedAt,
    durationPlannedMin: record.plannedMinutes,
    actualMinutes: record.actualMinutes,
    outcome: record.status === 'completed' ? 'completed' : 'abandoned',
    noteDestination: record.noteDestination,
    notes: record.notes,
    resourceUsed: record.resourceUsed,
    oldSource: record.source ?? 'iris-study-session-records',
    oldSourceId: record.sourceImportId ?? record.id,
  }
  saveTaskStore({
    ...store,
    tasks: upsertById(store.tasks, nextTask),
    sessions: upsertById(store.sessions, session),
    activeTimer: store.activeTimer?.id === record.id ? undefined : store.activeTimer,
  })
}

export function removeTaskStoreSession(sessionId: string): void {
  const store = mutableTaskStore()
  saveTaskStore({
    ...store,
    sessions: store.sessions.filter(session => session.id !== sessionId),
    activeTimer: store.activeTimer?.id === sessionId ? undefined : store.activeTimer,
  })
}

export function writeFocusBlockSessionToTaskStore(input: {
  block: FocusBlock
  focusSession?: FocusSession
  status: FocusBlockStatus
  startedAt: string
  endedAt: string
  actualMinutes?: number
}): void {
  const store = mutableTaskStore()
  const existingTask = store.tasks.find(task => task.id === input.block.taskId)
  const now = new Date().toISOString()
  const taskStatus: UnifiedTask['status'] = input.status === 'Done'
    ? 'done'
    : input.status === 'Partial'
      ? 'todo'
      : input.status === 'Skipped' || input.status === 'Changed'
        ? 'abandoned'
        : 'in-progress'
  const task: UnifiedTask = {
    id: input.block.taskId,
    title: input.block.taskTitle,
    context: null,
    category: input.block.area,
    status: taskStatus,
    energy: input.block.energy,
    estimatedMinutes: input.block.minutes,
    scheduledDate: input.block.date,
    scheduledBlockId: input.block.id,
    source: 'task-inbox',
    notes: input.block.notes,
    createdAt: existingTask?.createdAt ?? input.block.createdAt,
    updatedAt: now,
    oldSource: 'iris-tasks',
    oldSourceId: input.block.taskId,
  }
  const session: UnifiedTaskSession = {
    id: input.focusSession?.id ?? `focus-block-session:${input.block.id}`,
    taskId: input.block.taskId,
    title: input.block.taskTitle,
    category: input.block.area,
    engine: 'focus-block',
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationPlannedMin: input.block.minutes,
    actualMinutes: input.actualMinutes,
    outcome: input.status === 'Done' ? 'completed' : 'abandoned',
    notes: input.block.notes,
    oldSource: 'focusBlocksByDate',
    oldSourceId: input.block.id,
  }
  saveTaskStore({
    ...store,
    tasks: upsertById(store.tasks, {
      ...task,
      ...existingTask,
      status: taskStatus,
      scheduledDate: input.block.date,
      scheduledBlockId: input.block.id,
      updatedAt: now,
    }),
    sessions: upsertById(store.sessions, session),
    activeTimer: store.activeTimer?.id === input.block.id ? undefined : store.activeTimer,
  })
}

export function writePomodoroSessionToTaskStore(session: FocusSession): void {
  if (!session.taskId) return
  const store = mutableTaskStore()
  const existingTask = store.tasks.find(task => task.id === session.taskId)
  const completedAt = session.completedAt
  const startedAt = new Date(new Date(completedAt).getTime() - session.focusMinutes * 60_000).toISOString()
  const task: UnifiedTask = {
    id: session.taskId,
    title: session.taskTitle,
    context: null,
    category: session.category,
    status: existingTask?.status ?? 'todo',
    estimatedMinutes: session.focusMinutes,
    source: 'task-inbox',
    createdAt: existingTask?.createdAt ?? startedAt,
    updatedAt: completedAt,
    oldSource: 'iris-tasks',
    oldSourceId: session.taskId,
  }
  const unifiedSession: UnifiedTaskSession = {
    id: session.id,
    taskId: session.taskId,
    title: session.taskTitle,
    category: session.category,
    engine: 'pomodoro',
    startedAt,
    endedAt: completedAt,
    durationPlannedMin: session.focusMinutes,
    actualMinutes: session.focusMinutes,
    outcome: 'completed',
    oldSource: 'iris-focus-sessions',
    oldSourceId: session.id,
  }
  saveTaskStore({
    ...store,
    tasks: upsertById(store.tasks, {
      ...task,
      ...existingTask,
      updatedAt: completedAt,
    }),
    sessions: upsertById(store.sessions, unifiedSession),
    activeTimer: store.activeTimer?.id === session.id ? undefined : store.activeTimer,
  })
}

export function getStudySessionSummaryFromTaskStore(store = loadTaskStore()): {
  completedMinutes: number
  completedSessions: number
  abandonedSessions: number
  sessionsByCategory: Record<string, number>
} {
  const studySessions = (store?.sessions ?? []).filter(session => session.engine === 'study')
  const completed = studySessions.filter(session => session.outcome === 'completed')
  return {
    completedMinutes: completed.reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0),
    completedSessions: completed.length,
    abandonedSessions: studySessions.filter(session => session.outcome === 'abandoned').length,
    sessionsByCategory: countBy(studySessions, session => session.category),
  }
}

export function loadTaskStoreMigrationMarker(): TaskStoreMigrationMarker | null {
  return loadJson<TaskStoreMigrationMarker>(TASK_STORE_MIGRATION_KEY)
}

export function saveTaskStoreMigrationMarker(marker: TaskStoreMigrationMarker): void {
  saveJson(TASK_STORE_MIGRATION_KEY, marker)
}

function countBy<T>(items: T[], key: (item: T) => string | undefined | null): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item) || 'none'
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

export function getTaskStoreSummary(store = loadTaskStore()): TaskStoreSummary {
  const marker = loadTaskStoreMigrationMarker()
  const tasks: UnifiedTask[] = store?.tasks ?? []
  const templates: UnifiedTaskTemplate[] = store?.templates ?? []
  const sessions: UnifiedTaskSession[] = store?.sessions ?? []
  const studyTasks = tasks.filter(task =>
    task.source === 'study-template-instance' ||
    (task.source === 'manual' && task.context === 'study'),
  )
  const studySessions = sessions.filter(session => session.engine === 'study')
  return {
    taskCount: tasks.length,
    templateCount: templates.length,
    sessionCount: sessions.length,
    activeTimerPresent: Boolean(store?.activeTimer),
    studyTaskInstanceCount: studyTasks.length,
    studySessionCount: studySessions.length,
    countsBySource: countBy(tasks, task => task.source),
    countsByContext: countBy(tasks, task => task.context ?? 'none'),
    countsByEngine: countBy(sessions, session => session.engine),
    sessionsByOutcome: countBy(sessions, session => session.outcome),
    sessionsByCategory: countBy(sessions, session => session.category),
    migrationVersion: marker?.migrationVersion,
    migratedAt: marker?.migratedAt ?? store?.migratedAt,
  }
}

export function exportTaskStoreJson(pretty = true): string {
  const store = loadTaskStore() ?? emptyTaskStore()
  return JSON.stringify(store, null, pretty ? 2 : 0)
}
