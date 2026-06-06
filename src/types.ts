export type EnergyLevel = 'low' | 'medium' | 'high'

export type DayType =
  | 'normal'
  | 'evening-class'
  | 'saturday-class'
  | 'work-shift'
  | 'low-energy'
  | 'admin-catchup'

export type TaskCategory =
  | 'cyber-study'
  | 'assessment'
  | 'job-search'
  | 'work-shift'
  | 'admin-life'
  | 'english-practice'
  | 'recovery'
  | 'finance-bills'
  | 'consulting-freelance'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Urgency = 'low' | 'medium' | 'high'
export type Importance = 'low' | 'medium' | 'high'

export interface DailyCheckin {
  date: string
  dayType: DayType
  wakeUpTime: string
  sleepTarget: string
  energyLevel: EnergyLevel
  availableFocusTime: string
  fixedCommitments: string
  notes: string
}

export interface Task {
  id: string
  title: string
  category: TaskCategory
  deadline?: string
  estimatedMinutes: number
  difficulty: Difficulty
  urgency: Urgency
  importance: Importance
  minimumVersion?: string
  nextAction?: string
  checklist?: string[]
  pomodoroEnabled?: boolean
  pomodoroLength?: number
  breakLength?: number
  pomodoroSessions?: number
  done: boolean
  createdAt: string
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
  period: 'morning' | 'afternoon' | 'evening' | 'recovery' | 'shutdown'
  label: string
  items: string[]
}

export type PlanProvider = 'gemini' | 'deepseek' | 'openai' | 'rule-based'

export interface GeneratedPlan {
  date: string
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

export interface NotionExportResult {
  pageId?: string
  pageUrl?: string
  exportedAt?: string
}

export interface IntegrationResult<T> {
  success: boolean
  message: string
  data: T | null
}

export interface AppBackupData {
  checkin: DailyCheckin | null
  tasks: Task[]
  opportunities: WorkOpportunity[]
  bills: Bill[]
  plan: GeneratedPlan | null
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
