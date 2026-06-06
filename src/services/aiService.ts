import type {
  Bill,
  DailyCheckin,
  ExtractedBill,
  ExtractedWorkLead,
  GeneratedPlan,
  IntegrationResult,
  Task,
  WorkOpportunity,
} from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

export interface PlanningContext {
  checkin: DailyCheckin | null
  tasks: Task[]
  opportunities: WorkOpportunity[]
  bills: Bill[]
}

export async function generatePlanWithAI(
  _context: PlanningContext,
): Promise<IntegrationResult<GeneratedPlan>> {
  return notConnected<GeneratedPlan>()
}

export async function summarizeToday(
  _context: PlanningContext,
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
