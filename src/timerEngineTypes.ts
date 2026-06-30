export type TimerEngineKind = 'study' | 'pomodoro' | 'focus-block'
export type TimerOutcome = 'completed' | 'abandoned' | 'in-progress'

export interface TimerPausedInterval {
  pausedAt: string
  resumedAt?: string
}

export interface TimerSession {
  id: string
  taskId: string
  engine: TimerEngineKind
  durationPlannedMin: number
  startedAt: string
  pausedIntervals: TimerPausedInterval[]
  endedAt?: string
  outcome: TimerOutcome
}
