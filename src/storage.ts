import type {
  AppBackup,
  AppBackupData,
  AppSettings,
  DailyCheckin,
  DailyLog,
  FocusBlock,
  FocusSession,
  MealAnchor,
  StartPlan,
  TimeBlockFollowUp,
  Task,
  WorkOpportunity,
  Bill,
  CalendarEvent,
  GeneratedPlan,
  GeneratePlanContext,
  GoogleCalendarImportMeta,
  RankedCheckinTask,
  TaskTemplate,
  Template,
  TimeBlock,
} from './types'
import { getLocalDateKey } from './focus'
import {
  archiveCompletedOldTasks,
  defaultMealAnchors,
  isActiveTask,
  isOldAssessmentTask,
  normalizeTask,
} from './focusBlocks'

export const STORAGE_SCHEMA_VERSION = 1

const KEYS = {
  checkin: 'iris-checkin',
  checkInsByDate: 'checkInsByDate',
  legacyCheckIns: 'legacyCheckIns',
  tasks: 'iris-tasks',
  opportunities: 'iris-opportunities',
  bills: 'iris-bills',
  plan: 'iris-plan',
  plansByDate: 'plansByDate',
  legacyPlans: 'legacyPlans',
  rankedTasksByDate: 'rankedTasksByDate',
  templates: 'iris-templates',
  taskTemplates: 'iris_task_templates',
  settings: 'iris-settings',
  calendarEvents: 'iris-calendar-events',
  googleCalendarMeta: 'iris-google-calendar-meta',
  dailyLogs: 'iris-daily-logs',
  timeBlockFollowUps: 'iris-time-block-follow-ups',
  focusSessions: 'iris-focus-sessions',
  startPlans: 'startPlans',
  focusBlocks: 'iris_focus_blocks',
  focusBlocksByDate: 'focusBlocksByDate',
  mealAnchors: 'iris_meal_anchors',
  mealStatusByDate: 'mealStatusByDate',
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

function mergeByDate<T extends { date?: string }>(
  key: string,
  value: T,
  fallbackLegacyKey: string,
): boolean {
  const date = value.date
  if (date) {
    save(key, {
      ...(load<Record<string, T>>(key) ?? {}),
      [date]: value,
    })
    return true
  }
  save(fallbackLegacyKey, [...(load<T[]>(fallbackLegacyKey) ?? []), value])
  return false
}

function migrateDailyStorage(): void {
  const oldCheckin = load<DailyCheckin>(KEYS.checkin)
  if (oldCheckin) {
    mergeByDate(KEYS.checkInsByDate, oldCheckin, KEYS.legacyCheckIns)
    localStorage.removeItem(KEYS.checkin)
  }

  const oldPlan = load<GeneratedPlan>(KEYS.plan)
  if (oldPlan) {
    mergeByDate(KEYS.plansByDate, oldPlan, KEYS.legacyPlans)
    localStorage.removeItem(KEYS.plan)
  }
}

export const loadCheckinsByDate = (): Record<string, DailyCheckin> => {
  migrateDailyStorage()
  return load<Record<string, DailyCheckin>>(KEYS.checkInsByDate) ?? {}
}

export const loadPlansByDate = (): Record<string, GeneratedPlan> => {
  migrateDailyStorage()
  const stored = load<Record<string, GeneratedPlan>>(KEYS.plansByDate) ?? {}
  const normalized = Object.fromEntries(
    Object.entries(stored).map(([date, plan]) => [date, normalizeGeneratedPlan(plan, date)]),
  )
  if (JSON.stringify(stored) !== JSON.stringify(normalized)) save(KEYS.plansByDate, normalized)
  return normalized
}

function blockId(date: string, block: TimeBlock, index: number): string {
  const identity = [date, block.startTime, block.endTime, block.title ?? block.label, index]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `block-${identity || index}`
}

function normalizeGeneratedPlan(plan: GeneratedPlan, fallbackDate: string): GeneratedPlan {
  const date = plan.date || fallbackDate
  const generatedAt = plan.generatedAt || new Date().toISOString()
  return {
    ...plan,
    date,
    timeBlocks: plan.timeBlocks.map((block, index) => ({
      ...block,
      id: block.id || blockId(date, block, index),
      date,
      items: block.items ?? block.bullets ?? block.details?.split('\n') ?? [],
      bullets: block.bullets ?? block.items ?? block.details?.split('\n') ?? [],
      source: block.source ?? 'generated',
      status: block.status ?? 'Planned',
      createdAt: block.createdAt ?? generatedAt,
      updatedAt: block.updatedAt ?? generatedAt,
    })),
  }
}

export const loadRankedTasksByDate = (): Record<string, RankedCheckinTask[]> => {
  migrateDailyStorage()
  return load<Record<string, RankedCheckinTask[]>>(KEYS.rankedTasksByDate) ?? {}
}

export const saveRankedTasksForDate = (
  date: string,
  rankedTasks: RankedCheckinTask[],
): void => {
  save(KEYS.rankedTasksByDate, {
    ...loadRankedTasksByDate(),
    [date]: rankedTasks,
  })
}

export const loadCheckin = (date = getLocalDateKey()): DailyCheckin | null =>
  loadCheckinsByDate()[date] ?? null

export const saveCheckin = (c: DailyCheckin): void => {
  const date = c.date || getLocalDateKey()
  const datedCheckin = { ...c, date }
  save(KEYS.checkInsByDate, {
    ...loadCheckinsByDate(),
    [date]: datedCheckin,
  })
  saveRankedTasksForDate(date, datedCheckin.rankedTasks ?? [])
}

export const loadTasks = (): Task[] => {
  const raw = load<Task[]>(KEYS.tasks) ?? []
  const normalized = raw.map(normalizeTask)
  if (JSON.stringify(raw) !== JSON.stringify(normalized)) save(KEYS.tasks, normalized)
  return normalized
}
export const saveTasks = (t: Task[]): void => save(KEYS.tasks, t.map(normalizeTask))
export const loadActiveTasks = (): Task[] => loadTasks().filter(isActiveTask)
export const archiveOldTasks = (): Task[] => {
  const next = archiveCompletedOldTasks(loadTasks())
  saveTasks(next)
  return next
}

export const loadOpportunities = (): WorkOpportunity[] =>
  load<WorkOpportunity[]>(KEYS.opportunities) ?? []
export const saveOpportunities = (o: WorkOpportunity[]): void => save(KEYS.opportunities, o)

export const loadBills = (): Bill[] => load<Bill[]>(KEYS.bills) ?? []
export const saveBills = (b: Bill[]): void => save(KEYS.bills, b)

export const loadPlan = (date = getLocalDateKey()): GeneratedPlan | null =>
  loadPlansByDate()[date] ?? null
export const savePlan = (p: GeneratedPlan): void => {
  const date = p.date || getLocalDateKey()
  const normalized = normalizeGeneratedPlan({ ...p, date }, date)
  save(KEYS.plansByDate, {
    ...loadPlansByDate(),
    [date]: normalized,
  })
}

export const loadFocusSessions = (): FocusSession[] =>
  load<FocusSession[]>(KEYS.focusSessions) ?? []
export const saveFocusSessions = (sessions: FocusSession[]): void =>
  save(KEYS.focusSessions, sessions)
export const addFocusSession = (session: FocusSession): FocusSession[] => {
  const next = [session, ...loadFocusSessions()]
  saveFocusSessions(next)
  return next
}

function groupFocusBlocksByDate(blocks: FocusBlock[]): Record<string, FocusBlock[]> {
  return blocks.reduce<Record<string, FocusBlock[]>>((grouped, block) => {
    grouped[block.date] = [...(grouped[block.date] ?? []), block]
    return grouped
  }, {})
}

export const loadFocusBlocksByDate = (): Record<string, FocusBlock[]> =>
  load<Record<string, FocusBlock[]>>(KEYS.focusBlocksByDate) ?? {}

export const loadFocusBlocks = (): FocusBlock[] => {
  const legacyBlocks = load<FocusBlock[]>(KEYS.focusBlocks) ?? []
  const datedBlocks = Object.values(loadFocusBlocksByDate()).flat()
  const byId = new Map<string, FocusBlock>()
  ;[...legacyBlocks, ...datedBlocks].forEach(block => byId.set(block.id, block))
  return [...byId.values()]
}
export const saveFocusBlocks = (blocks: FocusBlock[]): void => {
  save(KEYS.focusBlocks, blocks)
  save(KEYS.focusBlocksByDate, groupFocusBlocksByDate(blocks))
}
export const saveFocusBlock = (block: FocusBlock): FocusBlock[] => {
  const next = [block, ...loadFocusBlocks().filter(item => item.id !== block.id)]
  saveFocusBlocks(next)
  return next
}
export const updateFocusBlock = (
  id: string,
  patch: Partial<FocusBlock>,
): FocusBlock | null => {
  let updatedBlock: FocusBlock | null = null
  const next = loadFocusBlocks().map(block => {
    if (block.id !== id) return block
    updatedBlock = {
      ...block,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    return updatedBlock
  })
  saveFocusBlocks(next)
  return updatedBlock
}
export const loadFocusBlocksForDate = (date: string): FocusBlock[] =>
  loadFocusBlocks()
    .filter(block => block.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

export const loadMealAnchors = (date: string): MealAnchor[] => {
  const saved = {
    ...(load<Record<string, MealAnchor[]>>(KEYS.mealStatusByDate) ?? {}),
    ...(load<Record<string, MealAnchor[]>>(KEYS.mealAnchors) ?? {}),
  }
  const savedForDate = saved[date] ?? []
  const defaults = defaultMealAnchors(date)
  return defaults.map(anchor => savedForDate.find(item => item.id === anchor.id) ?? anchor)
}
export const saveMealAnchor = (anchor: MealAnchor): MealAnchor[] => {
  const saved = load<Record<string, MealAnchor[]>>(KEYS.mealAnchors) ?? {}
  const current = saved[anchor.date] ?? defaultMealAnchors(anchor.date)
  const nextForDate = current.map(item =>
    item.id === anchor.id ? { ...anchor, updatedAt: new Date().toISOString() } : item,
  )
  save(KEYS.mealAnchors, {
    ...saved,
    [anchor.date]: nextForDate,
  })
  save(KEYS.mealStatusByDate, {
    ...(load<Record<string, MealAnchor[]>>(KEYS.mealStatusByDate) ?? {}),
    [anchor.date]: nextForDate,
  })
  return nextForDate
}

export const loadStartPlans = (): StartPlan[] => load<StartPlan[]>(KEYS.startPlans) ?? []
export const saveStartPlans = (plans: StartPlan[]): void => {
  localStorage.setItem(KEYS.startPlans, JSON.stringify(plans))
}

export const saveStartPlan = (plan: StartPlan): StartPlan[] => {
  const next = [plan, ...loadStartPlans().filter(item => item.id !== plan.id)]
  saveStartPlans(next)
  return next
}

export const updateStartPlanStarted = (
  id: string,
  markedStarted = true,
): StartPlan | null => {
  let updatedPlan: StartPlan | null = null
  const next = loadStartPlans().map(plan => {
    if (plan.id !== id) return plan
    updatedPlan = {
      ...plan,
      markedStarted,
    }
    return updatedPlan
  })
  saveStartPlans(next)
  return updatedPlan
}

export const getLatestStartPlanForDate = (date: string): StartPlan | null => {
  return loadStartPlans()
    .filter(plan => plan.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
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

export const loadTimeBlockFollowUps = (date: string): Record<string, TimeBlockFollowUp> =>
  load<Record<string, Record<string, TimeBlockFollowUp>>>(KEYS.timeBlockFollowUps)?.[date] ?? {}

export const loadAllTimeBlockFollowUps = (): Record<string, Record<string, TimeBlockFollowUp>> =>
  load<Record<string, Record<string, TimeBlockFollowUp>>>(KEYS.timeBlockFollowUps) ?? {}

export const saveAllTimeBlockFollowUps = (
  followUps: Record<string, Record<string, TimeBlockFollowUp>>,
): void => save(KEYS.timeBlockFollowUps, followUps)

export const saveTimeBlockFollowUp = (followUp: TimeBlockFollowUp): void => {
  const all = load<Record<string, Record<string, TimeBlockFollowUp>>>(KEYS.timeBlockFollowUps) ?? {}
  save(KEYS.timeBlockFollowUps, {
    ...all,
    [followUp.date]: {
      ...(all[followUp.date] ?? {}),
      [followUp.blockKey]: {
        ...followUp,
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

export const loadTemplates = (): Template[] => load<Template[]>(KEYS.templates) ?? []
export const saveTemplates = (t: Template[]): void => save(KEYS.templates, t)
export const loadTaskTemplates = (): TaskTemplate[] => load<TaskTemplate[]>(KEYS.taskTemplates) ?? []
export const saveTaskTemplates = (t: TaskTemplate[]): void => save(KEYS.taskTemplates, t)

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
  const todayKey = getLocalDateKey()
  const savedCheckin = loadCheckin(todayKey)
  if (!savedCheckin) return null
  const activeTasks = loadActiveTasks()
  const activeTaskIds = new Set(activeTasks.map(task => task.id))
  const checkin: DailyCheckin = {
    ...savedCheckin,
    rankedTasks: (savedCheckin.rankedTasks ?? [])
      .filter(task => !isOldAssessmentTask(task))
      .filter(task => !task.taskId || activeTaskIds.has(task.taskId))
      .map((task, index) => ({ ...task, orderIndex: index })),
    planningInstructions: savedCheckin.planningInstructions ?? '',
  }
  const calendarEvents = sanitizeCalendarEvents(loadCalendarEvents())
  const planDateEvents = calendarEventsForDate(calendarEvents, todayKey)
  return {
    checkin: addCalendarCommitments({ ...checkin, date: todayKey }, planDateEvents),
    tasks: activeTasks,
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
      checkInsByDate: loadCheckinsByDate(),
      dailyLogs: Object.values(loadDailyLogs()),
      timeBlockFollowUps: loadAllTimeBlockFollowUps(),
      focusSessions: loadFocusSessions(),
      focusBlocks: loadFocusBlocks(),
      tasks: loadTasks(),
      opportunities: loadOpportunities(),
      bills: loadBills(),
      plan: loadPlan(),
      plansByDate: loadPlansByDate(),
      rankedTasksByDate: loadRankedTasksByDate(),
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
    checkInsByDate: candidate.checkInsByDate ?? {},
    dailyLogs: isArray(candidate.dailyLogs)
      ? (candidate.dailyLogs as DailyLog[])
      : [],
    timeBlockFollowUps: candidate.timeBlockFollowUps ?? {},
    focusSessions: isArray(candidate.focusSessions)
      ? (candidate.focusSessions as FocusSession[])
      : [],
    focusBlocks: isArray(candidate.focusBlocks)
      ? (candidate.focusBlocks as FocusBlock[])
      : [],
    tasks: candidate.tasks as Task[],
    opportunities: candidate.opportunities as WorkOpportunity[],
    bills: candidate.bills as Bill[],
    plan: candidate.plan ?? null,
    plansByDate: candidate.plansByDate ?? {},
    rankedTasksByDate: candidate.rankedTasksByDate ?? {},
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
  const checkInsByDate = { ...(data.checkInsByDate ?? {}) }
  if (data.checkin?.date) checkInsByDate[data.checkin.date] = data.checkin
  if (data.checkin) saveCheckin(data.checkin)
  else localStorage.removeItem(KEYS.checkin)
  save(KEYS.checkInsByDate, checkInsByDate)
  saveDailyLogs(
    Object.fromEntries(data.dailyLogs.map(log => [log.date, log])),
  )
  saveAllTimeBlockFollowUps(data.timeBlockFollowUps ?? {})
  saveFocusSessions(data.focusSessions)
  saveFocusBlocks(data.focusBlocks ?? [])
  saveTasks(data.tasks)
  saveOpportunities(data.opportunities)
  saveBills(data.bills)
  const plansByDate = { ...(data.plansByDate ?? {}) }
  if (data.plan?.date) plansByDate[data.plan.date] = data.plan
  if (data.plan) savePlan(data.plan)
  else localStorage.removeItem(KEYS.plan)
  save(KEYS.plansByDate, plansByDate)
  save(KEYS.rankedTasksByDate, data.rankedTasksByDate ?? {})
  saveTemplates(data.templates)
  saveSettings(data.settings)
  saveCalendarEvents(data.calendarEvents)
  saveGoogleCalendarMeta(data.googleCalendarMeta)
}
