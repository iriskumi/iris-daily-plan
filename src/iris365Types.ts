export type Iris365PhaseId = 1 | 2 | 3 | 4

export interface Iris365Phase {
  id: Iris365PhaseId
  startDay: number
  endDay: number
  title: string
  focus: string
}

export interface Iris365Entry {
  date: string
  englishOutput: boolean
  shadowing: boolean
  realityTask: boolean
  movement: boolean
  highStimulusControlled: boolean
  sleepProtected: boolean
  mood: number
  energy: number
  tinyWin: string
  notes: string
  updatedAt: string
}

export interface Iris365Store {
  schemaVersion: number
  startDate: string
  entries: Record<string, Iris365Entry>
}

export interface Iris365Streaks {
  currentStreak: number
  bestStreak: number
}

export interface Iris365Stats extends Iris365Streaks {
  totalCompletedDays: number
  englishOutputDays: number
  shadowingDays: number
  realityTaskDays: number
  movementDays: number
  highStimulusControlledDays: number
  sleepProtectedDays: number
}
