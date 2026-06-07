import type {
  ExtractedBill,
  ExtractedWorkLead,
  CalendarEvent,
  DailyLog,
  FocusStats,
  GeneratePlanContext,
  GeneratePlanResult,
  GeneratedPlan,
  IntegrationResult,
  Bill,
  WorkOpportunity,
  Task,
} from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

export async function generatePlanWithAI(
  context: GeneratePlanContext,
  options: { originalPlan?: GeneratedPlan; feedback?: string } = {},
): Promise<GeneratePlanResult> {
  try {
    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        options.originalPlan || options.feedback
          ? { context, originalPlan: options.originalPlan ?? null, feedback: options.feedback ?? '' }
          : context,
      ),
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

interface SummaryContext {
  plan: GeneratedPlan | null
  tasks: Task[]
  bills: Bill[]
  opportunities: WorkOpportunity[]
  calendarEvents: CalendarEvent[]
  dailyLog: DailyLog | null
  focusStats: FocusStats
}

async function runSummaryAction(
  mode: 'summary' | 'review',
  context: SummaryContext,
): Promise<IntegrationResult<string>> {
  try {
    const response = await fetch('/api/summarise-today', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, context }),
    })
    const result = (await response.json()) as IntegrationResult<string>
    if (!response.ok || !result.success || !result.data) {
      return {
        success: false,
        message: result.message || 'AI action unavailable',
        data: null,
      }
    }
    return result
  } catch {
    return {
      success: false,
      message: 'AI action unavailable',
      data: null,
    }
  }
}

export async function summarizeToday(
  context: SummaryContext,
): Promise<IntegrationResult<string>> {
  return runSummaryAction('summary', context)
}

export async function reviewUnfinishedTasks(
  context: SummaryContext,
): Promise<IntegrationResult<string>> {
  return runSummaryAction('review', context)
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
