import type {
  DailyLog,
  FocusStats,
  GeneratedPlan,
  IntegrationResult,
  NotionExportResult,
} from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

export async function exportPlanToNotion(
  _plan: GeneratedPlan,
  _dailyLog?: DailyLog | null,
  _focusStats?: FocusStats,
): Promise<IntegrationResult<NotionExportResult>> {
  return notConnected<NotionExportResult>()
}

export async function testNotionConnection(): Promise<IntegrationResult<NotionExportResult>> {
  return notConnected<NotionExportResult>()
}
