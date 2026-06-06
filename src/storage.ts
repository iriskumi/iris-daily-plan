import type {
  AppBackup,
  AppBackupData,
  AppSettings,
  DailyCheckin,
  Task,
  WorkOpportunity,
  Bill,
  GeneratedPlan,
  GeneratePlanContext,
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

export const loadTemplates = (): Template[] => load<Template[]>(KEYS.templates) ?? []
export const saveTemplates = (t: Template[]): void => save(KEYS.templates, t)

export const loadSettings = (): AppSettings => ({
  ...defaultSettings(),
  ...(load<Partial<AppSettings>>(KEYS.settings) ?? {}),
})
export const saveSettings = (s: AppSettings): void => save(KEYS.settings, s)

export function loadGeneratePlanContext(): GeneratePlanContext | null {
  const checkin = loadCheckin()
  if (!checkin) return null
  return {
    checkin,
    tasks: loadTasks(),
    opportunities: loadOpportunities(),
    bills: loadBills(),
    templates: loadTemplates(),
    settings: loadSettings(),
  }
}

export function exportBackupData(): AppBackup {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      checkin: loadCheckin(),
      tasks: loadTasks(),
      opportunities: loadOpportunities(),
      bills: loadBills(),
      plan: loadPlan(),
      templates: loadTemplates(),
      settings: loadSettings(),
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
  if (!isArray(candidate.opportunities)) return null
  if (!isArray(candidate.bills)) return null
  if (!isArray(candidate.templates)) return null

  return {
    checkin: candidate.checkin ?? null,
    tasks: candidate.tasks as Task[],
    opportunities: candidate.opportunities as WorkOpportunity[],
    bills: candidate.bills as Bill[],
    plan: candidate.plan ?? null,
    templates: candidate.templates as Template[],
    settings: {
      ...defaultSettings(),
      ...(candidate.settings ?? {}),
    },
  }
}

export function importBackupData(data: AppBackupData): void {
  if (data.checkin) saveCheckin(data.checkin)
  else localStorage.removeItem(KEYS.checkin)
  saveTasks(data.tasks)
  saveOpportunities(data.opportunities)
  saveBills(data.bills)
  if (data.plan) savePlan(data.plan)
  else localStorage.removeItem(KEYS.plan)
  saveTemplates(data.templates)
  saveSettings(data.settings)
}
