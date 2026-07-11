export type UnifiedTaskContext = 'work' | 'life' | 'study' | null
export type UnifiedTaskStatus = 'todo' | 'in-progress' | 'done' | 'abandoned'
export type UnifiedTaskSource =
  | 'task-inbox'
  | 'quick-add-block'
  | 'study-template-instance'
  | 'plan-generated'
  | 'manual'
  | 'synthetic-history'
  | 'iris-job-search'
export type UnifiedSessionEngine = 'study' | 'pomodoro' | 'focus-block' | 'unknown'
export type UnifiedSessionOutcome = 'completed' | 'abandoned' | 'in-progress'

export interface UnifiedSubtask {
  id: string
  title: string
  done: boolean
}

export interface UnifiedTask {
  id: string
  templateId?: string
  title: string
  context: UnifiedTaskContext
  category?: string
  status: UnifiedTaskStatus
  priority?: string
  energy?: string
  estimatedMinutes?: number
  scheduledDate?: string
  scheduledBlockId?: string
  source: UnifiedTaskSource
  noteDestination?: string
  resourceSuggestion?: string
  studyMethod?: string
  notes?: string
  subtasks?: UnifiedSubtask[]
  createdAt: string
  updatedAt: string
  oldSource?: string
  oldSourceId?: string
  externalSource?: string
  sourceImportId?: string
  sourceUrl?: string
  externalCategory?: string
  applicationId?: string
  company?: string
  jobTitle?: string
}

export interface UnifiedTaskTemplate {
  id: string
  title: string
  context: UnifiedTaskContext
  category: string
  defaultDuration: number
  alternativeDurations: number[]
  energy: string
  type: string
  resourceSuggestion: string
  studyMethod: string
  noteDestination: string
  subtasks: string[]
  eveningFriendly: boolean
  rescueFriendly: boolean
  oldSource?: string
}

export interface UnifiedTaskSession {
  id: string
  taskId?: string
  sourceTemplateId?: string
  sourceCustomTaskId?: string
  title: string
  category?: string
  engine: UnifiedSessionEngine
  startedAt: string
  endedAt?: string
  durationPlannedMin?: number
  actualMinutes?: number
  outcome: UnifiedSessionOutcome
  noteDestination?: string
  notes?: string
  resourceUsed?: string
  oldSource?: string
  oldSourceId?: string
}

export interface UnifiedActiveTimer {
  id: string
  taskId?: string
  sourceTemplateId?: string
  sourceCustomTaskId?: string
  title: string
  category?: string
  engine: UnifiedSessionEngine
  status: 'running' | 'paused'
  sessionStartTime: number
  durationMinutes: number
  expectedEndTime: number
  pausedAccumulatedMs: number
  pauseStartedAt?: number
  noteDestination?: string
  notes?: string
  resourceUsed?: string
  oldSource?: string
  oldSourceId?: string
}

export interface TaskStore {
  schemaVersion: number
  migratedAt: string
  tasks: UnifiedTask[]
  templates: UnifiedTaskTemplate[]
  sessions: UnifiedTaskSession[]
  activeTimer?: UnifiedActiveTimer
}

export interface TaskStoreMigrationMarker {
  schemaVersion: number
  migrationVersion: string
  migratedAt: string
  sourceIds: {
    tasks: string[]
    queueBlocks: string[]
    studyTemplates: string[]
    studySessions: string[]
    focusSessions: string[]
    focusBlocks: string[]
    activeTimers: string[]
  }
}

export interface TaskStoreSummary {
  taskCount: number
  templateCount: number
  sessionCount: number
  activeTimerPresent: boolean
  studyTaskInstanceCount: number
  studySessionCount: number
  countsBySource: Record<string, number>
  countsByContext: Record<string, number>
  countsByEngine: Record<string, number>
  sessionsByOutcome: Record<string, number>
  sessionsByCategory: Record<string, number>
  migrationVersion?: string
  migratedAt?: string
}
