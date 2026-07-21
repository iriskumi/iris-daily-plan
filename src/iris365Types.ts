export type Iris365PhaseId = 1 | 2 | 3 | 4
export type Iris365DayType = 'normal' | 'drift' | 'recovery' | 'push'
export type Iris365ProofKey = 'body' | 'english' | 'realWorld'
export type Iris365SkillKey =
  | 'english'
  | 'aiAutomation'
  | 'data'
  | 'cyber'
  | 'japanese'
  | 'career'
  | 'lifeSystem'

export interface Iris365DailyProof {
  key: Iris365ProofKey
  label: string
  description: string
  minimum: string
  standard: string
  push: string
  completed: boolean
  note?: string
}

export interface Iris365Phase {
  id: Iris365PhaseId
  startDay: number
  endDay: number
  title: string
  focus: string
  englishLabel?: string
}

export type Iris365MorningGateStatus =
  | 'protected'
  | 'switched'
  | 'delayed'
  | 'interrupted'
  | 'carried-away'
  | 'unrecorded'

export type Iris365MorningFeeling =
  | 'foggy'
  | 'bored'
  | 'anxious'
  | 'stay-in-bed'
  | 'avoid-day'
  | 'automatic-reach'
  | 'other'
  | ''

export interface Iris365SwitchLog {
  id: string
  trigger: string
  oldImpulse: string
  switchAction: string
  replacement: string
  note: string
  createdAt: string
}

export interface Iris365EnglishEnvironmentItem {
  id: string
  type: string
  title: string
  createdAt: string
}

export interface Iris365Entry {
  date: string
  dayNumber: number
  dayType: Iris365DayType
  energyLevel: 'low' | 'medium' | 'high'
  mainFocus: Iris365SkillKey | 'foundation'
  proofs: Record<Iris365ProofKey, Iris365DailyProof>
  todayIProved: string
  englishOutputDetail: {
    topic?: string
    usefulExpression?: string
    confidence?: number
  }
  skillTouches: Partial<Record<Iris365SkillKey, boolean>>
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
  morningGateChecklist: Record<'water' | 'light' | 'leaveBed' | 'englishAudio' | 'gentleMovement', boolean>
  morningGateStatus: Iris365MorningGateStatus
  morningFeeling: Iris365MorningFeeling
  switchLogs: Iris365SwitchLog[]
  englishEnvironmentType: string
  englishEnvironmentTitle: string
  englishEnvironmentItems: Iris365EnglishEnvironmentItem[]
  movementMinutes: number
  movementKind: string
  foundationNote: string
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
  | 'ai-short-dramas'
  | 'chinese-web-novels'
  | 'xiaohongshu-scrolling'
  | 'shopping-price-checking'
  | 'romance-restaurant-merge-game'
  | 'bedtime-find-watch'
  | 'avoiding-real-life-tasks'

export type Iris365DopamineState =
  | 'just-woke-empty'
  | 'afternoon-low-motivation'
  | 'evening-cant-transition'
  | 'bedtime-cant-stop'
  | 'pms-low-control'
  | 'avoiding-assignment-admin'
  | 'english-feels-hard'
  | 'anxious-numb-out'

export type Iris365DopamineOutcome =
  | 'redirected'
  | 'delayed-urge'
  | 'softer-option'
  | 'rabbit-hole-avoided'
  | 'saved-tomorrow'
  | 'binged-but-noticed'
  | 'need-sleep'
  | 'need-food'
  | 'need-comfort'

export type Iris365SwapLibraryStatus = 'works' | 'doesnt-work'

export type Iris365DopamineSuggestionType =
  | 'bedtime-shutdown'
  | 'pms-damage-reduction'
  | 'shopping-wishlist'
  | 'story-familiar-comfort'
  | 'xiaohongshu-algorithm-exit'
  | 'merge-visible-completion'
  | 'real-life-edge'
  | 'english-soft-mode'
  | 'morning-empty'
  | 'general-downshift'

export type Iris365DopamineFeedbackReason =
  | 'too-many-steps'
  | 'too-much-screen-time'
  | 'too-productive'
  | 'too-weak'
  | 'keeps-me-awake'
  | 'still-rabbit-hole'
  | 'not-realistic'
  | 'other'

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
  suggestionType?: Iris365DopamineSuggestionType
  feedbackReason?: Iris365DopamineFeedbackReason
  status: Iris365SwapLibraryStatus
  timesUsed: number
  priorityScore?: number
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
  | 'Emotional regulation'
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
  scores: {
    sleep?: number
    body?: number
    english?: number
    realTasks?: number
    skills?: number
    mood?: number
  }
  updatedAt: string
}

export interface Iris365MonthlyReview {
  monthId: string
  phase: string
  whatChanged: string
  whatBecameEasier: string
  stillHard: string
  whatIAvoided: string
  proudOf: string
  stopForcing: string
  nextSmallUpgrade: string
  visibleOutput: string
  updatedAt: string
}

export interface Iris365Settings {
  startDate: string
  endDate: string
  motto: string
}

export interface Iris365Store {
  schemaVersion: number
  startDate: string
  settings: Iris365Settings
  entries: Record<string, Iris365Entry>
  proofItems: Iris365ProofItem[]
  weeklyReviews: Record<string, Iris365WeeklyReview>
  monthlyReviews: Record<string, Iris365MonthlyReview>
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
