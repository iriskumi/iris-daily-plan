import type {
  AppBackup,
  AppBackupData,
  AppSettings,
  DailyCheckin,
  DailyLog,
  FocusSession,
  Task,
  WorkOpportunity,
  Bill,
  CalendarEvent,
  GeneratedPlan,
  GeneratePlanContext,
  GoogleCalendarImportMeta,
  Template,
} from './types'

export const STORAGE_SCHEMA_VERSION = 1

const KEYS = {
  checkin: 'iris-checkin',
  tasks: 'iris-tasks',
  opportunities: 'iris-opportunities',
  bills: 'iris-bills',
  plan: 'iris-plan',
  templates: 'iris-templates',
  settings: 'iris-settings',
  calendarEvents: 'iris-calendar-events',
  googleCalendarMeta: 'iris-google-calendar-meta',
  dailyLogs: 'iris-daily-logs',
  focusSessions: 'iris-focus-sessions',
}

interface VersionedValue<T> {
  schemaVersion: number
  value: T
}

export const defaultSettings = (): AppSettings => ({
  timezone: 'Australia/Melbourne',
  defaultSleepTarget: '22:30',
  tuesdayThursdayEveningClassEnabled: true,
  saturdayClassEnabled: true,
  defaultRecoveryBlockEnabled: true,
})

function isVersionedValue<T>(value: unknown): value is VersionedValue<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    'value' in value
  )
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (isVersionedValue<T>(parsed)) return parsed.value
    return parsed as T
  } catch {
    return null
  }
}

function save(key: string, value: unknown): void {
  const payload: VersionedValue<unknown> = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    value,
  }
  localStorage.setItem(key, JSON.stringify(payload))
}

export const loadCheckin = (): DailyCheckin | null => load<DailyCheckin>(KEYS.checkin)
export const saveCheckin = (c: DailyCheckin): void => save(KEYS.checkin, c)

export const loadTasks = (): Task[] => load<Task[]>(KEYS.tasks) ?? []
export const saveTasks = (t: Task[]): void => save(KEYS.tasks, t)

export const loadOpportunities = (): WorkOpportunity[] =>
  load<WorkOpportunity[]>(KEYS.opportunities) ?? []
export const saveOpportunities = (o: WorkOpportunity[]): void => save(KEYS.opportunities, o)

export const loadBills = (): Bill[] => load<Bill[]>(KEYS.bills) ?? []
export const saveBills = (b: Bill[]): void => save(KEYS.bills, b)

export const loadPlan = (): GeneratedPlan | null => load<GeneratedPlan>(KEYS.plan)
export const savePlan = (p: GeneratedPlan): void => save(KEYS.plan, p)

export const loadFocusSessions = (): FocusSession[] =>
  load<FocusSession[]>(KEYS.focusSessions) ?? []
export const saveFocusSessions = (sessions: FocusSession[]): void =>
  save(KEYS.focusSessions, sessions)
export const addFocusSession = (session: FocusSession): FocusSession[] => {
  const next = [session, ...loadFocusSessions()]
  saveFocusSessions(next)
  return next
}

export const emptyDailyLog = (date: string): DailyLog => ({
  date,
  actualDone: '',
  whatChanged: '',
  energyAfterDoing: '',
  notes: '',
  carryOverToTomorrow: '',
  updatedAt: new Date().toISOString(),
})

export const loadDailyLogs = (): Record<string, DailyLog> =>
  load<Record<string, DailyLog>>(KEYS.dailyLogs) ?? {}

export const saveDailyLogs = (logs: Record<string, DailyLog>): void =>
  save(KEYS.dailyLogs, logs)

export const loadDailyLog = (date: string): DailyLog => ({
  ...emptyDailyLog(date),
  ...(loadDailyLogs()[date] ?? {}),
  date,
})

export const saveDailyLog = (log: DailyLog): void => {
  saveDailyLogs({
    ...loadDailyLogs(),
    [log.date]: {
      ...log,
      updatedAt: new Date().toISOString(),
    },
  })
}

export const loadTemplates = (): Template[] => load<Template[]>(KEYS.templates) ?? []
export const saveTemplates = (t: Template[]): void => save(KEYS.templates, t)

export const loadCalendarEvents = (): CalendarEvent[] =>
  load<CalendarEvent[]>(KEYS.calendarEvents) ?? []
export const saveCalendarEvents = (events: CalendarEvent[]): void =>
  save(KEYS.calendarEvents, events)

export const loadGoogleCalendarMeta = (): GoogleCalendarImportMeta => ({
  connected: false,
  ...(load<Partial<GoogleCalendarImportMeta>>(KEYS.googleCalendarMeta) ?? {}),
})
export const saveGoogleCalendarMeta = (meta: GoogleCalendarImportMeta): void =>
  save(KEYS.googleCalendarMeta, meta)

export const loadSettings = (): AppSettings => ({
  ...defaultSettings(),
  ...(load<Partial<AppSettings>>(KEYS.settings) ?? {}),
})
export const saveSettings = (s: AppSettings): void => save(KEYS.settings, s)

function formatCalendarCommitment(event: CalendarEvent): string {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const time = `${start.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })}-${end.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })}`
  const location = event.location ? ` @ ${event.location}` : ''
  return `${time} ${event.title}${location}`
}

function sanitizeCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    location: event.location,
    source: event.source,
  }))
}

function calendarEventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter(event => {
    const startDate = event.start.slice(0, 10)
    const endDate = event.end.slice(0, 10)
    return startDate <= date && endDate >= date
  })
}

function addCalendarCommitments(checkin: DailyCheckin, events: CalendarEvent[]): DailyCheckin {
  if (events.length === 0) return checkin
  const calendarLines = events.map(formatCalendarCommitment)
  const fixedCommitments = [
    checkin.fixedCommitments.trim(),
    'Imported Google Calendar:',
    ...calendarLines,
  ]
    .filter(Boolean)
    .join('\n')
  return {
    ...checkin,
    fixedCommitments,
  }
}

export function loadGeneratePlanContext(): GeneratePlanContext | null {
  const savedCheckin = loadCheckin()
  if (!savedCheckin) return null
  const checkin: DailyCheckin = {
    ...savedCheckin,
    planningInstructions: savedCheckin.planningInstructions ?? '',
  }
  const calendarEvents = sanitizeCalendarEvents(loadCalendarEvents())
  const planDateEvents = calendarEventsForDate(calendarEvents, checkin.date)
  return {
    checkin: addCalendarCommitments(checkin, planDateEvents),
    tasks: loadTasks(),
    opportunities: loadOpportunities(),
    bills: loadBills(),
    templates: loadTemplates(),
    settings: loadSettings(),
    calendarEvents: planDateEvents,
  }
}

export function exportBackupData(): AppBackup {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      checkin: loadCheckin(),
      dailyLogs: Object.values(loadDailyLogs()),
      focusSessions: loadFocusSessions(),
      tasks: loadTasks(),
      opportunities: loadOpportunities(),
      bills: loadBills(),
      plan: loadPlan(),
      templates: loadTemplates(),
      settings: loadSettings(),
      calendarEvents: loadCalendarEvents(),
      googleCalendarMeta: loadGoogleCalendarMeta(),
    },
  }
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

export function validateBackup(input: unknown): AppBackupData | null {
  if (typeof input !== 'object' || input === null) return null
  const maybeBackup = input as Partial<AppBackup>
  const data = maybeBackup.data
  if (typeof data !== 'object' || data === null) return null

  const candidate = data as Partial<AppBackupData>
  if (!isArray(candidate.tasks)) return null
  if (candidate.dailyLogs !== undefined && !isArray(candidate.dailyLogs)) return null
  if (candidate.focusSessions !== undefined && !isArray(candidate.focusSessions)) return null
  if (!isArray(candidate.opportunities)) return null
  if (!isArray(candidate.bills)) return null
  if (!isArray(candidate.templates)) return null

  return {
    checkin: candidate.checkin ?? null,
    dailyLogs: isArray(candidate.dailyLogs)
      ? (candidate.dailyLogs as DailyLog[])
      : [],
    focusSessions: isArray(candidate.focusSessions)
      ? (candidate.focusSessions as FocusSession[])
      : [],
    tasks: candidate.tasks as Task[],
    opportunities: candidate.opportunities as WorkOpportunity[],
    bills: candidate.bills as Bill[],
    plan: candidate.plan ?? null,
    templates: candidate.templates as Template[],
    settings: {
      ...defaultSettings(),
      ...(candidate.settings ?? {}),
    },
    calendarEvents: isArray(candidate.calendarEvents)
      ? (candidate.calendarEvents as CalendarEvent[])
      : [],
    googleCalendarMeta: {
      connected: false,
      ...(candidate.googleCalendarMeta ?? {}),
    },
  }
}

export function importBackupData(data: AppBackupData): void {
  if (data.checkin) saveCheckin(data.checkin)
  else localStorage.removeItem(KEYS.checkin)
  saveDailyLogs(
    Object.fromEntries(data.dailyLogs.map(log => [log.date, log])),
  )
  saveFocusSessions(data.focusSessions)
  saveTasks(data.tasks)
  saveOpportunities(data.opportunities)
  saveBills(data.bills)
  if (data.plan) savePlan(data.plan)
  else localStorage.removeItem(KEYS.plan)
  saveTemplates(data.templates)
  saveSettings(data.settings)
  saveCalendarEvents(data.calendarEvents)
  saveGoogleCalendarMeta(data.googleCalendarMeta)
}
