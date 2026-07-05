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
  lowEnergyDay: boolean
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

export type Iris365ProofCategory =
  | 'English output'
  | 'Shadowing'
  | 'Cyber project'
  | 'AI workflow'
  | 'Job application'
  | 'Work experience'
  | 'Health / routine'
  | 'Personal insight'

export interface Iris365ProofItem {
  id: string
  date: string
  category: Iris365ProofCategory
  title: string
  description: string
  linkOrFile: string
  relatedEntryDate?: string
  createdAt: string
  updatedAt: string
}

export interface Iris365WeeklyReview {
  weekStartDate: string
  weekEndDate: string
  proofThisWeek: string
  attentionDrain: string
  bestReturnHabit: string
  makeEasierNextWeek: string
  nextWeekPriority: string
  updatedAt: string
}

export interface Iris365Store {
  schemaVersion: number
  startDate: string
  entries: Record<string, Iris365Entry>
  proofItems: Iris365ProofItem[]
  weeklyReviews: Record<string, Iris365WeeklyReview>
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
