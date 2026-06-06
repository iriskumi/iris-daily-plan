import type {
  ExtractedBill,
  ExtractedWorkLead,
  GeneratePlanContext,
  GeneratePlanResult,
  IntegrationResult,
  Task,
} from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

export async function generatePlanWithAI(
  context: GeneratePlanContext,
): Promise<GeneratePlanResult> {
  try {
    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    })

    if (!response.ok) {
      const message = `AI plan API returned ${response.status}; using local planner fallback`
      return {
        success: false,
        message,
        data: null,
        provider: 'rule-based',
        aiUsed: false,
        fallbackReason: message,
      }
    }

    const result = (await response.json()) as GeneratePlanResult
    if (!result.success || !result.data) {
      const message = result.message || 'AI plan integration unavailable; using local planner fallback'
      return {
        success: false,
        message,
        data: null,
        provider: 'rule-based',
        aiUsed: false,
        fallbackReason: result.fallbackReason || message,
      }
    }

    return result
  } catch {
    const message = 'AI plan API unavailable; using local planner fallback'
    return {
      success: false,
      message,
      data: null,
      provider: 'rule-based',
      aiUsed: false,
      fallbackReason: message,
    }
  }
}

export async function summarizeToday(
  _context: GeneratePlanContext,
): Promise<IntegrationResult<string>> {
  return notConnected<string>()
}

export async function reviewUnfinishedTasks(
  _tasks: Task[],
): Promise<IntegrationResult<string[]>> {
  return notConnected<string[]>()
}

export async function extractBillsFromText(
  _text: string,
): Promise<IntegrationResult<ExtractedBill[]>> {
  return notConnected<ExtractedBill[]>()
}

export async function extractWorkLeadsFromText(
  _text: string,
): Promise<IntegrationResult<ExtractedWorkLead[]>> {
  return notConnected<ExtractedWorkLead[]>()
}
