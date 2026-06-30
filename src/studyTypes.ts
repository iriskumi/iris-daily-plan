export type StudyCategory =
  | 'English Output'
  | 'English Input'
  | 'Japanese'
  | 'AI Coding'
  | 'SQL / Excel'
  | 'Job / Career'
  | 'Review / NotebookLM'
  | 'Admin / Life'
  | 'Cyber'
  | 'Reset'

export type StudyEnergy = 'low' | 'medium' | 'high'

export type StudyTaskType =
  | 'output'
  | 'input'
  | 'coding'
  | 'data'
  | 'career'
  | 'review'
  | 'admin'
  | 'cyber'
  | 'recovery'

export type StudySessionStatus = 'completed' | 'abandoned'
export type StudyActiveSessionStatus = 'running' | 'paused'

export interface StudyTaskTemplate {
  id: string
  title: string
  category: StudyCategory
  defaultDuration: 25 | 50
  alternativeDurations: [25, 50]
  energy: StudyEnergy
  type: StudyTaskType
  resourceSuggestion: string
  studyMethod: string
  noteDestination: string
  subtasks: string[]
  eveningFriendly: boolean
  rescueFriendly: boolean
}

export interface DailyStudyTarget {
  date: string
  targetMinutes: number
  updatedAt: string
}

export interface StudySessionRecord {
  id: string
  taskTemplateId?: string
  customTaskId?: string
  title: string
  category: StudyCategory
  startedAt: string
  completedAt: string
  plannedMinutes: number
  actualMinutes: number
  status: StudySessionStatus
  noteDestination: string
  notes: string
  resourceUsed: string
}

export interface StudyActiveSession {
  id: string
  taskTemplateId?: string
  customTaskId?: string
  title: string
  category: StudyCategory
  sessionStartTime: number
  durationMinutes: number
  expectedEndTime: number
  pausedAccumulatedMs: number
  pauseStartedAt?: number
  status: StudyActiveSessionStatus
  noteDestination: string
  notes: string
  resourceUsed: string
}

export interface StudyDailyReview {
  date: string
  actualDone: string
  carryOver: string
  tomorrowNextStep: string
  notionLastPushedAt?: string
  updatedAt: string
}
