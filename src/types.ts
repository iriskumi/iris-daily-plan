export type EnergyLevel = 'low' | 'medium' | 'high'

export type DayType =
  | 'normal'
  | 'evening-class'
  | 'saturday-class'
  | 'work-shift'
  | 'low-energy'
  | 'admin-catchup'

export type DailyPlanBase =
  | 'english-ai-cyber-growth'
  | 'work-shift-day'
  | 'class-day'
  | 'low-energy-day'
  | 'admin-recovery-day'
  | 'free-build-day'

export type TaskCategory =
  | 'cyber-study'
  | 'assessment'
  | 'job-search'
  | 'work-shift'
  | 'admin-life'
  | 'ai'
  | 'english-practice'
  | 'japanese-practice'
  | 'exercise'
  | 'recovery'
  | 'finance-bills'
  | 'consulting-freelance'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Urgency = 'low' | 'medium' | 'high'
export type Importance = 'low' | 'medium' | 'high'

export type TaskArea =
  | 'Cyber'
  | 'AI'
  | 'Vibe Coding'
  | 'Job'
  | 'English'
  | 'Admin'
  | 'Life reset'
  | 'Expression Review'
  | 'Study'
  | 'Other'

export type TaskEnergy = 'Low' | 'Medium' | 'High'
export type TaskMode = 'Focus' | 'Light' | 'Admin' | 'Recovery'
export type TaskStatus = 'Inbox' | 'Planned' | 'Doing' | 'Done' | 'Skipped' | 'Archived'
export type FocusBlockStatus = 'Doing' | 'Done' | 'Partial' | 'Skipped' | 'Changed'
export type MealAnchorStatus = 'Followed' | 'Partial' | 'Skipped' | 'Changed' | ''
export type RecommendedWindow = 'daytime' | 'evening' | 'any'
export type OutputLevel = 'high' | 'medium' | 'mixed' | 'low'

export type DurationMinutes =
  | 5
  | 10
  | 15
  | 20
  | 25
  | 30
  | 40
  | 45
  | 60
  | 75
  | 90
  | 120
  | 150
  | 180

export interface DailyCheckin {
  date: string
  dailyPlanBase?: DailyPlanBase
  dayType: DayType
  wakeUpTime: string
  sleepTarget: string
  energyLevel: EnergyLevel
  rankedTasks?: RankedCheckinTask[]
  morningMainTask?: string
  morningSecondaryTask1?: string
  morningSecondaryTask2?: string
  morningSmallLifeTask?: string
  availableFocusTime: string
  fixedCommitments: string
  planningInstructions: string
  notes: string
}

export interface RankedCheckinTask {
  id: string
  taskId?: string
  title: string
  area: TaskArea
  estimatedMinutes: number
  orderIndex: number
}

export interface DailyLog {
  date: string
  actualDone: string
  whatChanged: string
  energyAfterDoing: string
  notes: string
  carryOverToTomorrow: string
  eveningSummary?: string
  unfinishedReview?: string
  updatedAt: string
}

export type TimeBlockFollowUpStatus = 'followed' | 'partial' | 'skipped' | 'changed' | ''

export interface TimeBlockFollowUp {
  date: string
  blockKey: string
  status: TimeBlockFollowUpStatus
  notes: string
  updatedAt: string
}

export type CarryOverClassification =
  | 'carry-over'
  | 'reduce'
  | 'postpone'
  | 'delete-ignore'

export interface CarryOverSuggestion {
  taskId: string
  taskTitle: string
  classification: CarryOverClassification
  reason: string
  suggestedAction: string
}

export interface RealityCheck {
  load: 'Light' | 'Reasonable' | 'Too much'
  estimatedFocusBlocks: number
  estimatedFocusMinutes: number
  riskNotes: string[]
}

export interface NextAction {
  title: string
  detail: string
  startTime?: string
  endTime?: string
  taskId?: string
  taskTitle?: string
  category?: TaskCategory
  focusMinutes?: number
  canStartFocus: boolean
}

export interface FocusSession {
  id: string
  date: string
  taskId?: string
  taskTitle: string
  category: TaskCategory
  focusMinutes: number
  completedAt: string
}

export interface FocusStats {
  todaySessions: number
  todayMinutes: number
  weekSessions: number
  weekMinutes: number
}

export type StartNowState =
  | 'Morning after waking'
  | 'Afternoon slump'
  | 'Before evening class'
  | 'Deadline panic'
  | 'Emotionally messy'
  | 'Low-energy but okay'

export type StartNowTimeAvailable = 5 | 15 | 25 | 45

export type StartNowArea =
  | 'Study'
  | 'Job search'
  | 'English output'
  | 'Cyber'
  | 'Admin'
  | 'Life reset'

export interface StartPlan {
  id: string
  date: string
  state: StartNowState
  energy: number
  timeAvailable: StartNowTimeAvailable
  area: StartNowArea
  bodyReset: string
  openThis: string
  firstTinyAction: string
  timerMinutes: StartNowTimeAvailable
  markedStarted: boolean
  createdAt: string
}

export interface Task {
  id: string
  title: string
  area?: TaskArea
  energy?: TaskEnergy
  mode?: TaskMode
  status?: TaskStatus
  category: TaskCategory
  deadline?: string
  estimatedMinutes: number
  difficulty: Difficulty
  urgency: Urgency
  importance: Importance
  nextTinyAction?: string
  minimumVersion?: string
  nextAction?: string
  checklist?: string[]
  pomodoroEnabled?: boolean
  pomodoroLength?: number
  breakLength?: number
  pomodoroSessions?: number
  done: boolean
  createdAt: string
  updatedAt?: string
}

export interface FocusBlock {
  id: string
  date: string
  startTime: string
  plannedEndTime: string
  actualEndTime?: string
  minutes: number
  taskId: string
  taskTitle: string
  area: TaskArea
  mode: TaskMode
  energy: TaskEnergy
  firstTinyAction: string
  status: FocusBlockStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface MealAnchor {
  id: 'lunch' | 'dinner'
  date: string
  label: 'Lunch + reset' | 'Dinner + reset'
  aroundTime: string
  status: MealAnchorStatus
  updatedAt: string
}

export interface NextBlockRecommendation {
  id: string
  time: string
  label: string
  detail: string
  minutes: number
  area?: TaskArea
}

export interface Template {
  id: string
  name: string
  purpose: string
  category: TaskCategory
  subtasks: string[]
  estimatedMinutes: number
  pomodoroEnabled: boolean
  pomodoroLength: number
  breakLength: number
  isDefault: boolean
  createdAt: string
}

export interface TaskTemplate {
  id: string
  group: string
  title: string
  area: TaskArea
  mode: TaskMode
  energy: TaskEnergy
  estimatedMinutes: number
  recommendedWindow: RecommendedWindow
  firstTinyAction: string
  description: string
  defaultBlockType: string
  outputLevel: OutputLevel
  tags: string[]
}

export type WorkOpportunityType =
  | 'full-time'
  | 'casual'
  | 'freelance'
  | 'consulting'
  | 'ai-data'
  | 'translation-language'
  | 'university-tafe-admin'
  | 'government-council'

export type WorkOpportunityStatus =
  | 'collected'
  | 'worth-checking'
  | 'apply-today'
  | 'later'
  | 'ignore'

export interface WorkOpportunity {
  id: string
  title: string
  source: string
  link?: string
  type: WorkOpportunityType
  deadline?: string
  fitScore: number
  effortRequired: 'low' | 'medium' | 'high'
  nextAction?: string
  status: WorkOpportunityStatus
  notes?: string
  createdAt: string
}

export type BillStatus = 'not-paid' | 'scheduled' | 'paid' | 'snoozed'
export type BillPriority = 'must-pay-today' | 'pay-this-week' | 'can-wait'

export interface Bill {
  id: string
  name: string
  amount: number
  dueDate: string
  status: BillStatus
  priority: BillPriority
  notes?: string
}

export interface TimeBlock {
  id?: string
  date?: string
  period: 'morning' | 'afternoon' | 'evening' | 'recovery' | 'shutdown'
  label: string
  startTime?: string
  endTime?: string
  title?: string
  type?:
    | 'focus'
    | 'class'
    | 'work'
    | 'admin'
    | 'recovery'
    | 'meal'
    | 'buffer'
    | 'shutdown'
    | 'reset'
    | 'light'
    | 'break'
    | 'project'
    | 'output'
    | 'input'
    | 'review'
    | 'planning'
  items: string[]
  bullets?: string[]
  location?: string
  source?: 'generated' | 'calendar' | 'task' | 'manual' | 'template'
  taskId?: string
  status?: 'Planned' | 'Followed' | 'Partial' | 'Skipped' | 'Changed'
  notes?: string
  manualEdited?: boolean
  createdAt?: string
  updatedAt?: string
  baseBlockId?: string
  baseBlockName?: string
  outputLevel?: OutputLevel
  recommendedWindow?: 'daytime' | 'evening' | 'any'
  canBeMoved?: boolean
}

export type PlanProvider = 'gemini' | 'deepseek' | 'openai' | 'rule-based'

export interface GeneratedPlan {
  date: string
  dailyPlanBase?: DailyPlanBase
  theme: string
  top3: Array<{ task: string; nextAction: string }>
  timeBlocks: TimeBlock[]
  mustDo: string[]
  optional: string[]
  workLeadsToday: string[]
  billsToday: string[]
  doNotToday: string[]
  minimumViableDay: string[]
  notionMarkdown: string
  generatedAt: string
  provider?: PlanProvider
  aiUsed?: boolean
  fallbackReason?: string
  prioritiesManualEdited?: boolean
}

export interface GeneratePlanOutcome {
  success: boolean
  message: string
  plan?: GeneratedPlan
  fallbackReason?: string
}

export interface AppSettings {
  timezone: string
  defaultSleepTarget: string
  tuesdayThursdayEveningClassEnabled: boolean
  saturdayClassEnabled: boolean
  defaultRecoveryBlockEnabled: boolean
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  source: 'manual' | 'google-calendar' | 'google_calendar'
  location?: string
  description?: string
  notes?: string
}

export interface GoogleCalendarImportMeta {
  connected: boolean
  calendarConnected?: boolean
  gmailConnected?: boolean
  lastImportedAt?: string
  accountEmail?: string
  warning?: string
}

export interface EmailMessage {
  id: string
  from: string
  subject: string
  receivedAt: string
  snippet: string
  body?: string
  source: 'manual' | 'gmail'
}

export type ExtractedBill = Omit<Bill, 'id'> & {
  confidence?: number
  sourceMessageId?: string
}

export type ExtractedWorkLead = Omit<WorkOpportunity, 'id' | 'createdAt'> & {
  confidence?: number
  sourceMessageId?: string
}

export interface GmailScannedWorkLead {
  messageId: string
  title: string
  source: string
  link?: string
  type: WorkOpportunityType
  classification: 'worth-checking-today' | 'later' | 'ignore'
  reason: string
  nextAction: string
  confidence: number
  sender: string
  subject: string
  receivedAt: string
}

export interface NotionExportResult {
  pageId?: string
  pageUrl?: string
  exportedAt?: string
}

export interface NotionDailyLogPayload {
  plan: GeneratedPlan
  dailyLog: DailyLog
  focusStats: FocusStats
  followUps?: TimeBlockFollowUp[]
  checkin?: DailyCheckin | null
  tasks: Task[]
  calendarEvents: CalendarEvent[]
  opportunities: WorkOpportunity[]
  bills: Bill[]
  markdown: string
}

export interface IntegrationResult<T> {
  success: boolean
  message: string
  data: T | null
}

export interface AppBackupData {
  checkin: DailyCheckin | null
  checkInsByDate?: Record<string, DailyCheckin>
  dailyLogs: DailyLog[]
  timeBlockFollowUps?: Record<string, Record<string, TimeBlockFollowUp>>
  focusSessions: FocusSession[]
  focusBlocks?: FocusBlock[]
  tasks: Task[]
  opportunities: WorkOpportunity[]
  bills: Bill[]
  plan: GeneratedPlan | null
  plansByDate?: Record<string, GeneratedPlan>
  rankedTasksByDate?: Record<string, RankedCheckinTask[]>
  templates: Template[]
  settings: AppSettings
  calendarEvents: CalendarEvent[]
  googleCalendarMeta: GoogleCalendarImportMeta
}

export interface AppBackup {
  schemaVersion: number
  exportedAt: string
  data: AppBackupData
}

export interface GeneratePlanContext {
  checkin: DailyCheckin
  tasks: Task[]
  opportunities: WorkOpportunity[]
  bills: Bill[]
  templates: Template[]
  settings: AppSettings
  calendarEvents: CalendarEvent[]
}

export type GeneratePlanResult = IntegrationResult<GeneratedPlan> & {
  provider: PlanProvider
  aiUsed: boolean
  fallbackReason?: string
}
