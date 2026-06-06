import type { GeneratedPlan, IntegrationResult, NotionExportResult } from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

export async function exportPlanToNotion(
  _plan: GeneratedPlan,
): Promise<IntegrationResult<NotionExportResult>> {
  return notConnected<NotionExportResult>()
}

export async function testNotionConnection(): Promise<IntegrationResult<NotionExportResult>> {
  return notConnected<NotionExportResult>()
}
