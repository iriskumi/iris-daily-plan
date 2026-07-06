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
  sleepRhythmProtected: boolean
  bodyMoved: boolean
  oneRealThingDone: boolean
  englishOutput: boolean
  shadowing: boolean
  cyberAiProject: boolean
  jobApplication: boolean
  workPrep: boolean
  studyCoursework: boolean
  lifeAdmin: boolean
  realThingToday: string
  realityTask: boolean
  movement: boolean
  highStimulusControlled: boolean
  sleepProtected: boolean
  sleepTime: string
  wakeTime: string
  movementType: string
  highStimulusPatterns: Record<Iris365HighStimulusPatternKey, Iris365HighStimulusPatternStatus>
  highStimulusTrigger: string
  mood: number
  energy: number
  tinyWin: string
  notes: string
  updatedAt: string
}

export type Iris365FoundationStatus = 'Drift day' | 'Recovery day' | 'Valid day' | 'Foundation day'

export type Iris365HighStimulusPatternKey =
  | 'shortDramas'
  | 'webNovels'
  | 'xiaohongshuSocialMedia'
  | 'shopping'
  | 'mobileGames'
  | 'other'

export type Iris365HighStimulusPatternStatus = 'not-used' | 'controlled' | 'overused'

export type Iris365DopamineUrge =
  | 'short-dramas'
  | 'web-novels'
  | 'xiaohongshu-scrolling'
  | 'shopping'
  | 'mobile-game'
  | 'random-phone-scrolling'
  | 'avoiding-everything'

export type Iris365DopamineState =
  | 'tired'
  | 'empty-bored'
  | 'anxious'
  | 'avoiding-task'
  | 'bedtime-cant-stop'
  | 'pms-low-control'
  | 'low-energy'

export type Iris365DopamineOutcome =
  | 'redirected'
  | 'delayed-urge'
  | 'softer-option'
  | 'binged-but-noticed'
  | 'need-sleep'
  | 'need-food'
  | 'need-comfort'

export type Iris365SwapLibraryStatus = 'works' | 'doesnt-work'

export interface Iris365DopamineSwapLog {
  id: string
  date: string
  urge: Iris365DopamineUrge
  state: Iris365DopamineState
  suggestion: string
  comfortOption: string
  tinyAction?: string
  outcome?: Iris365DopamineOutcome
  createdAt: string
  completedAt?: string
}

export interface Iris365DopamineSwapLibraryItem {
  id: string
  text: string
  urge?: Iris365DopamineUrge
  state?: Iris365DopamineState
  status: Iris365SwapLibraryStatus
  timesUsed: number
  createdAt: string
  updatedAt: string
}

export type Iris365ProofCategory =
  | 'English output'
  | 'Shadowing'
  | 'Cyber project'
  | 'Cyber / TAFE'
  | 'AI / Coursera'
  | 'AI workflow'
  | 'Project / AI coding'
  | 'Job application'
  | 'Career'
  | 'Work experience'
  | 'Health / routine'
  | 'Personal insight'

export type Iris365ProofSource = 'study-session' | 'manual'

export interface Iris365ProofItem {
  id: string
  date: string
  category: Iris365ProofCategory
  title: string
  description: string
  linkOrFile: string
  source: Iris365ProofSource
  sourceSessionId?: string
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
  dopamineSwapLogs: Iris365DopamineSwapLog[]
  dopamineSwapLibrary: Iris365DopamineSwapLibraryItem[]
}

export interface Iris365Streaks {
  currentStreak: number
  bestStreak: number
}

export interface Iris365Stats extends Iris365Streaks {
  totalRecordedDays: number
  validDays: number
  foundationDays: number
  sleepRhythmProtectedDays: number
  movementDays: number
  realThingDays: number
  englishOutputDays: number
  shadowingDays: number
  cyberAiProjectDays: number
  jobApplicationDays: number
  studyCourseworkDays: number
  workPrepDays: number
  highStimulusControlledDays: number
}
