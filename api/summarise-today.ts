/// <reference types="node" />

import type {
  Bill,
  CalendarEvent,
  DailyLog,
  FocusStats,
  GeneratedPlan,
  IntegrationResult,
  Task,
  WorkOpportunity,
} from '../src/types.js'

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

interface SummaryContext {
  plan: GeneratedPlan | null
  tasks: Task[]
  bills: Bill[]
  opportunities: WorkOpportunity[]
  calendarEvents: CalendarEvent[]
  dailyLog?: DailyLog | null
  focusStats?: FocusStats
}

type SummaryMode = 'summary' | 'review'

interface SummaryRequest {
  mode?: SummaryMode
  context?: SummaryContext
}

type SummaryResult = IntegrationResult<string> & {
  aiUsed: boolean
  provider: 'gemini' | 'rule-based'
  fallbackReason?: string
}

function sendJson(res: VercelResponse, body: SummaryResult, status = 200): void {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(body)
}

function getBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') return JSON.parse(req.body) as unknown
  return req.body
}

function isSummaryContext(value: unknown): value is SummaryContext {
  if (typeof value !== 'object' || value === null) return false
  const context = value as Partial<SummaryContext>
  return (
    (typeof context.plan === 'object' || context.plan === null) &&
    Array.isArray(context.tasks) &&
    Array.isArray(context.bills) &&
    Array.isArray(context.opportunities) &&
    Array.isArray(context.calendarEvents) &&
    (
      context.dailyLog === undefined ||
      context.dailyLog === null ||
      typeof context.dailyLog === 'object'
    )
  )
}

function getDaysUntil(dateStr: string, referenceDate = new Date()): number {
  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function taskLine(task: Task): string {
  return task.nextAction ? `${task.title} -> ${task.nextAction}` : task.title
}

function hasDailyLogContent(log?: DailyLog | null): log is DailyLog {
  if (!log) return false
  return [
    log.actualDone,
    log.whatChanged,
    log.energyAfterDoing,
    log.notes,
    log.carryOverToTomorrow,
  ].some(value => value.trim())
}

function dailyLogLines(log?: DailyLog | null): string[] {
  if (!hasDailyLogContent(log)) return ['- No actual done notes recorded yet']
  return [
    log.actualDone.trim() ? `- Actual done: ${log.actualDone.trim()}` : '',
    log.whatChanged.trim() ? `- What changed: ${log.whatChanged.trim()}` : '',
    log.energyAfterDoing.trim() ? `- Energy after doing: ${log.energyAfterDoing.trim()}` : '',
    log.notes.trim() ? `- Notes: ${log.notes.trim()}` : '',
    log.carryOverToTomorrow.trim()
      ? `- Carry over to tomorrow: ${log.carryOverToTomorrow.trim()}`
      : '',
  ].filter(Boolean)
}

function focusStatsLines(stats?: FocusStats): string[] {
  const safe = stats ?? {
    todaySessions: 0,
    todayMinutes: 0,
    weekSessions: 0,
    weekMinutes: 0,
  }
  return [
    `- Today: ${safe.todaySessions} focus session${safe.todaySessions === 1 ? '' : 's'} / ${safe.todayMinutes} min`,
    `- This week: ${safe.weekSessions} focus session${safe.weekSessions === 1 ? '' : 's'} / ${safe.weekMinutes} min`,
  ]
}

function localSummary(context: SummaryContext): string {
  const completed = context.tasks.filter(task => task.done)
  const unfinished = context.tasks.filter(task => !task.done)
  const urgentBills = context.bills.filter(bill => bill.status !== 'paid' && getDaysUntil(bill.dueDate) <= 1)
  const carryOver = unfinished
    .filter(task => task.urgency === 'high' || task.importance === 'high' || (task.deadline && getDaysUntil(task.deadline) <= 2))
    .slice(0, 5)

  return [
    '# Today Summary',
    '',
    '## What I completed today',
    [
      completed.length > 0
        ? completed.map(task => `- ${task.title}`).join('\n')
        : '- Nothing marked complete yet',
      hasDailyLogContent(context.dailyLog) && context.dailyLog.actualDone.trim()
        ? `- Actual done notes: ${context.dailyLog.actualDone.trim()}`
        : '',
    ].filter(Boolean).join('\n'),
    '',
    '## Actual Done & Notes',
    dailyLogLines(context.dailyLog).join('\n'),
    '',
    '## Focus Garden',
    focusStatsLines(context.focusStats).join('\n'),
    '',
    '## What is unfinished',
    unfinished.length > 0 ? unfinished.slice(0, 8).map(task => `- ${taskLine(task)}`).join('\n') : '- No unfinished tasks',
    '',
    '## What should carry over tomorrow',
    carryOver.length > 0 ? carryOver.map(task => `- ${taskLine(task)}`).join('\n') : '- Pick one small useful task tomorrow',
    hasDailyLogContent(context.dailyLog) && context.dailyLog.carryOverToTomorrow.trim()
      ? `- Daily log carry-over: ${context.dailyLog.carryOverToTomorrow.trim()}`
      : '',
    urgentBills.length > 0 ? urgentBills.map(bill => `- Bill: ${bill.name} - $${bill.amount}`).join('\n') : '',
    '',
    '## Realistic reflection',
    context.plan
      ? `- Today was planned around: ${context.plan.theme}. Count the work you protected, not only what you finished.`
      : '- A useful day is still useful even when the plan changes.',
    '',
    '## Shutdown suggestion',
    '- Close tabs, update carried-over tasks, and choose the first small action for tomorrow.',
  ].filter(Boolean).join('\n')
}

function localReview(context: SummaryContext): string {
  const unfinished = context.tasks.filter(task => !task.done)
  const stillUrgent = unfinished.filter(task =>
    task.urgency === 'high' || (task.deadline ? getDaysUntil(task.deadline) <= 1 : false),
  )
  const carryOver = unfinished.filter(task =>
    !stillUrgent.includes(task) && (task.importance === 'high' || task.urgency === 'medium'),
  )
  const reduce = unfinished.filter(task =>
    !stillUrgent.includes(task) && !carryOver.includes(task) && (task.difficulty === 'hard' || task.estimatedMinutes >= 90),
  )
  const ignore = unfinished.filter(task =>
    !stillUrgent.includes(task) && !carryOver.includes(task) && !reduce.includes(task),
  )

  const section = (title: string, tasks: Task[], empty: string) => [
    `## ${title}`,
    tasks.length > 0 ? tasks.slice(0, 8).map(task => `- ${taskLine(task)}`).join('\n') : `- ${empty}`,
  ].join('\n')

  return [
    '# Unfinished Task Review',
    '',
    '## Actual Done & Notes',
    dailyLogLines(context.dailyLog).join('\n'),
    '',
    '## Focus Garden',
    focusStatsLines(context.focusStats).join('\n'),
    '',
    section('Still urgent today', stillUrgent, 'Nothing still urgent today'),
    '',
    section('Carry over tomorrow', carryOver, 'No clear carry-over tasks'),
    '',
    section('Reduce to smaller version', reduce, 'No tasks need shrinking'),
    '',
    section('Ignore/delete', ignore, 'Nothing obvious to ignore'),
  ].join('\n')
}

function safeContext(context: SummaryContext) {
  return {
    plan: context.plan
      ? {
          date: context.plan.date,
          theme: context.plan.theme,
          top3: context.plan.top3,
          timeBlocks: context.plan.timeBlocks,
          mustDo: context.plan.mustDo,
          optional: context.plan.optional,
          workLeadsToday: context.plan.workLeadsToday,
          billsToday: context.plan.billsToday,
          doNotToday: context.plan.doNotToday,
          minimumViableDay: context.plan.minimumViableDay,
        }
      : null,
    tasks: context.tasks.map(task => ({
      title: task.title,
      category: task.category,
      deadline: task.deadline,
      estimatedMinutes: task.estimatedMinutes,
      difficulty: task.difficulty,
      urgency: task.urgency,
      importance: task.importance,
      nextAction: task.nextAction,
      done: task.done,
    })),
    bills: context.bills,
    opportunities: context.opportunities.map(lead => ({
      title: lead.title,
      source: lead.source,
      type: lead.type,
      deadline: lead.deadline,
      fitScore: lead.fitScore,
      effortRequired: lead.effortRequired,
      nextAction: lead.nextAction,
      status: lead.status,
    })),
    calendarEvents: context.calendarEvents.map(event => ({
      title: event.title,
      start: event.start,
      end: event.end,
      location: event.location,
      source: event.source,
    })),
    dailyLog: context.dailyLog
      ? {
          date: context.dailyLog.date,
          actualDone: context.dailyLog.actualDone,
          whatChanged: context.dailyLog.whatChanged,
          energyAfterDoing: context.dailyLog.energyAfterDoing,
          notes: context.dailyLog.notes,
          carryOverToTomorrow: context.dailyLog.carryOverToTomorrow,
        }
      : null,
    focusStats: context.focusStats ?? {
      todaySessions: 0,
      todayMinutes: 0,
      weekSessions: 0,
      weekMinutes: 0,
    },
  }
}

async function callGemini(mode: SummaryMode, context: SummaryContext): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const instruction =
    mode === 'summary'
      ? 'Create a concise Markdown end-of-day summary with exactly these sections: What I completed today, Actual Done & Notes, Focus Garden, What is unfinished, What should carry over tomorrow, One realistic reflection, One shutdown suggestion. Use dailyLog as the source of what actually happened and focusStats for Focus Garden.'
      : 'Create a concise Markdown unfinished task review with exactly these sections: Actual Done & Notes, Focus Garden, Still urgent today, Carry over tomorrow, Reduce to smaller version, Ignore/delete. Use dailyLog carry-over notes when deciding what should carry over and include focusStats.'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'You are a practical daily planning assistant. Return Markdown only. Do not invent completed work.',
                  instruction,
                  JSON.stringify(safeContext(context)),
                ].join('\n\n'),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    },
  )

  if (!response.ok) return null
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  return typeof text === 'string' && text.trim() ? text.trim() : null
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, {
      success: false,
      message: 'Method not allowed',
      data: null,
      aiUsed: false,
      provider: 'rule-based',
    }, 405)
    return
  }

  let mode: SummaryMode
  let context: SummaryContext
  try {
    const body = getBody(req) as SummaryRequest
    mode = body.mode === 'review' ? 'review' : 'summary'
    if (!isSummaryContext(body.context)) throw new Error('Invalid summary context')
    context = body.context
  } catch {
    sendJson(res, {
      success: false,
      message: 'Invalid summary context',
      data: null,
      aiUsed: false,
      provider: 'rule-based',
    }, 400)
    return
  }

  try {
    const geminiText = await callGemini(mode, context)
    if (geminiText) {
      sendJson(res, {
        success: true,
        message: 'Generated with Gemini',
        data: geminiText,
        aiUsed: true,
        provider: 'gemini',
      })
      return
    }
  } catch {
    // Use local fallback below.
  }

  sendJson(res, {
    success: true,
    message: 'Generated with local fallback',
    data: mode === 'review' ? localReview(context) : localSummary(context),
    aiUsed: false,
    provider: 'rule-based',
    fallbackReason: 'Gemini summary unavailable; used local fallback',
  })
}
