import type {
  DailyLog,
  FocusStats,
  GeneratedPlan,
  IntegrationResult,
  NotionBillsSyncResult,
  NotionDailyLogPayload,
  NotionExportResult,
} from '../types'
import type { NotionSchemaCheckResult } from '../notionSchema'
import type { StudyCategory, StudyDailyReview, StudySessionRecord } from '../studyTypes'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

export async function exportPlanToNotion(
  plan: GeneratedPlan,
  dailyLog: DailyLog,
  focusStats: FocusStats,
  context: Omit<NotionDailyLogPayload, 'plan' | 'dailyLog' | 'focusStats'>,
): Promise<IntegrationResult<NotionExportResult>> {
  try {
    const payload: NotionDailyLogPayload = {
      plan,
      dailyLog,
      focusStats,
      ...context,
    }
    const response = await fetch('/api/notion/push-daily-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = (await response.json()) as IntegrationResult<NotionExportResult>
    return result
  } catch {
    return {
      success: false,
      message: 'Notion Daily Log export failed before reaching the API route.',
      data: null,
    }
  }
}

export async function testNotionConnection(): Promise<IntegrationResult<NotionExportResult>> {
  return notConnected<NotionExportResult>()
}

async function requestNotionSchema(method: 'GET' | 'POST'): Promise<IntegrationResult<NotionSchemaCheckResult>> {
  try {
    const response = await fetch('/api/notion/schema', { method })
    return (await response.json()) as IntegrationResult<NotionSchemaCheckResult>
  } catch {
    return {
      success: false,
      message: 'Could not reach the Notion schema checker.',
      data: null,
    }
  }
}

export const checkNotionSchema = () => requestNotionSchema('GET')
export const createMissingNotionProperties = () => requestNotionSchema('POST')

export async function syncPaidBillsToNotionTransactions(): Promise<IntegrationResult<NotionBillsSyncResult>> {
  try {
    const response = await fetch('/api/notion/sync-paid-bills', { method: 'POST' })
    return (await response.json()) as IntegrationResult<NotionBillsSyncResult>
  } catch {
    return {
      success: false,
      message: 'Could not reach the Notion paid bills sync.',
      data: null,
    }
  }
}

export interface NotionStudyDailyLogPayload {
  date: string
  targetMinutes: number
  completedMinutes: number
  sessionCount: number
  categoryBreakdown: Record<StudyCategory, number>
  noteDestinations: string[]
  sessions: StudySessionRecord[]
  review: StudyDailyReview
  markdown: string
}

export async function pushStudyDailyLogToNotion(
  payload: NotionStudyDailyLogPayload,
): Promise<IntegrationResult<NotionExportResult>> {
  try {
    const response = await fetch('/api/notion/push-study-daily-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return (await response.json()) as IntegrationResult<NotionExportResult>
  } catch {
    return {
      success: false,
      message: 'Study Daily Log push failed before reaching the API route.',
      data: null,
    }
  }
}
