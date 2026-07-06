export type StartNowActionType =
  | 'Study'
  | 'English'
  | 'Move Body'
  | 'Project'
  | 'Work / Resume'
  | 'Life Admin'
  | 'Reset'
  | 'Before I Spiral'

export type StartNowRecordKind = 'session' | 'counter'

export type StartNowMetric =
  | 'studyMinutes'
  | 'englishPoints'
  | 'bodyReps'
  | 'bodyMinutes'
  | 'realThings'
  | 'spiralsDelayed'
  | 'resetSessions'

export type StartNowDayStatus = 'Counted Day' | 'Strong Day' | 'High Value Day' | 'Recovery Day' | 'Reset Day'

export interface StartNowRecord {
  id: string
  date: string
  kind: StartNowRecordKind
  actionType: StartNowActionType
  title: string
  durationMinutes?: number
  completedMinutes?: number
  metric?: StartNowMetric
  points?: number
  reps?: number
  tinyWin?: string
  contribution: string
  createdAt: string
  completedAt: string
}

export interface StartNowSummary {
  studyMinutes: number
  englishPoints: number
  bodyReps: number
  bodyMinutes: number
  realThings: number
  spiralsDelayed: number
  resetSessions: number
  completedSessions: number
  dayStatus: StartNowDayStatus
  statusMessage: string
}
