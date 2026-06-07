/// <reference types="node" />

import type {
  Bill,
  CalendarEvent,
  IntegrationResult,
  NotionDailyLogPayload,
  NotionExportResult,
  TimeBlock,
  WorkOpportunity,
} from '../../src/types.js'

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

interface NotionBlock {
  object: 'block'
  type: 'heading_2' | 'heading_3' | 'paragraph' | 'bulleted_list_item'
  heading_2?: { rich_text: NotionText[] }
  heading_3?: { rich_text: NotionText[] }
  paragraph?: { rich_text: NotionText[] }
  bulleted_list_item?: { rich_text: NotionText[] }
}

interface NotionText {
  type: 'text'
  text: { content: string }
}

function sendJson(
  res: VercelResponse,
  body: IntegrationResult<NotionExportResult>,
  status = 200,
): void {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(body)
}

function getBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') return JSON.parse(req.body) as unknown
  return req.body
}

function text(content: string): NotionText[] {
  return [{ type: 'text', text: { content: content.slice(0, 2000) } }]
}

function block(type: NotionBlock['type'], content: string): NotionBlock {
  return {
    object: 'block',
    type,
    [type]: { rich_text: text(content || '-') },
  } as NotionBlock
}

function bullets(items: string[]): NotionBlock[] {
  return (items.length > 0 ? items : ['-'])
    .filter(Boolean)
    .slice(0, 40)
    .map(item => block('bulleted_list_item', item))
}

function splitParagraphs(content: string): NotionBlock[] {
  const clean = content.trim()
  if (!clean) return [block('paragraph', '-')]
  const chunks: string[] = []
  for (let i = 0; i < clean.length; i += 1900) {
    chunks.push(clean.slice(i, i + 1900))
  }
  return chunks.map(chunk => block('paragraph', chunk))
}

function calendarLine(event: CalendarEvent): string {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const range = `${start.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}-${end.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
  const location = event.location ? ` @ ${event.location}` : ''
  return `${range} ${event.title}${location}`
}

function billLine(bill: Bill): string {
  return `${bill.name} - $${bill.amount} due ${bill.dueDate} (${bill.status})`
}

function workLine(item: WorkOpportunity): string {
  return `${item.title} - ${item.source}${item.nextAction ? ` -> ${item.nextAction}` : ''}`
}

function timeBlockKey(blockItem: TimeBlock, index: number): string {
  return [
    blockItem.startTime ?? 'no-start',
    blockItem.endTime ?? 'no-end',
    blockItem.period,
    blockItem.type ?? 'block',
    blockItem.title ?? blockItem.label,
    index,
  ].join('|')
}

function isPayload(value: unknown): value is NotionDailyLogPayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Partial<NotionDailyLogPayload>
  return (
    typeof payload.plan === 'object' &&
    payload.plan !== null &&
    typeof payload.dailyLog === 'object' &&
    payload.dailyLog !== null &&
    typeof payload.focusStats === 'object' &&
    payload.focusStats !== null &&
    Array.isArray(payload.tasks) &&
    Array.isArray(payload.calendarEvents) &&
    Array.isArray(payload.opportunities) &&
    Array.isArray(payload.bills)
  )
}

function planSource(payload: NotionDailyLogPayload): string {
  const plan = payload.plan
  if (plan.aiUsed && plan.provider) return plan.provider
  return plan.provider ?? 'local'
}

function buildChildren(payload: NotionDailyLogPayload): NotionBlock[] {
  const { plan, dailyLog, focusStats } = payload
  const top3 = plan.top3.map((item, index) => `${index + 1}. ${item.task} -> ${item.nextAction}`)
  const schedule = plan.timeBlocks.map(blockItem => {
    const time = blockItem.startTime && blockItem.endTime
      ? `${blockItem.startTime}-${blockItem.endTime}`
      : blockItem.label
    const title = blockItem.title || blockItem.label
    return `${time} ${title}: ${blockItem.items.join('; ')}`
  })
  const followUpByKey = new Map((payload.followUps ?? []).map(item => [item.blockKey, item]))
  const followUpLines = plan.timeBlocks.map((blockItem, index) => {
    const key = timeBlockKey(blockItem, index)
    const followUp = followUpByKey.get(key)
    const time = blockItem.startTime && blockItem.endTime
      ? `${blockItem.startTime}-${blockItem.endTime}`
      : blockItem.label
    const title = blockItem.title || blockItem.label
    const status = followUp?.status || 'not recorded'
    const notes = followUp?.notes ? ` | Notes: ${followUp.notes}` : ''
    return `${time} | ${title} | ${status}${notes}`
  })
  const unfinished = payload.tasks
    .filter(task => !task.done)
    .slice(0, 12)
    .map(task => task.nextAction ? `${task.title} -> ${task.nextAction}` : task.title)
  const focusLines = [
    `Today: ${focusStats.todaySessions} sessions / ${focusStats.todayMinutes} minutes`,
    `This week: ${focusStats.weekSessions} sessions / ${focusStats.weekMinutes} minutes`,
  ]
  const dayType = payload.checkin?.dayType ?? 'Not recorded'
  const energy = payload.checkin?.energyLevel ?? (dailyLog.energyAfterDoing || 'Not recorded')

  return [
    block('heading_2', 'Daily Log'),
    block('paragraph', `Date: ${plan.date}`),
    block('paragraph', `Day Type: ${dayType}`),
    block('paragraph', `Energy: ${energy}`),
    block('paragraph', `Focus Minutes: ${focusStats.todayMinutes}`),
    block('paragraph', `Planner source: ${planSource(payload)}`),
    block('heading_3', 'Top 3'),
    ...bullets(top3),
    block('heading_3', 'Actual Done'),
    ...splitParagraphs(dailyLog.actualDone),
    block('heading_3', 'Evening Summary'),
    ...splitParagraphs(dailyLog.eveningSummary || dailyLog.unfinishedReview || 'Not recorded yet.'),
    block('heading_3', 'Carry-over Tasks'),
    ...splitParagraphs(dailyLog.carryOverToTomorrow),
    block('heading_3', 'Generated daily plan'),
    ...splitParagraphs(plan.theme),
    block('heading_3', 'Time block follow-up table'),
    ...bullets(followUpLines),
    block('heading_3', 'Hour-by-hour schedule'),
    ...bullets(schedule),
    block('heading_3', 'Notes'),
    ...splitParagraphs(dailyLog.notes),
    block('heading_3', 'Energy reflection'),
    ...splitParagraphs(dailyLog.energyAfterDoing || dailyLog.whatChanged),
    block('heading_3', 'Focus / Pomodoro stats'),
    ...bullets(focusLines),
    block('heading_3', 'Calendar commitments'),
    ...bullets(payload.calendarEvents.map(calendarLine)),
    block('heading_3', 'Work reminders'),
    ...bullets(payload.opportunities.slice(0, 5).map(workLine)),
    block('heading_3', 'Bills reminders'),
    ...bullets(payload.bills.slice(0, 5).map(billLine)),
    block('heading_3', 'Unfinished task snapshot'),
    ...bullets(unfinished),
  ].slice(0, 95)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    sendJson(res, { success: false, message: 'Method not allowed', data: null }, 405)
    return
  }

  const notionKey = process.env.NOTION_API_KEY
  const databaseId = process.env.NOTION_DATABASE_ID
  if (!notionKey || !databaseId) {
    sendJson(res, {
      success: false,
      message: 'Notion is not connected yet. Add NOTION_API_KEY and NOTION_DATABASE_ID.',
      data: null,
    })
    return
  }

  let payload: unknown
  try {
    payload = getBody(req)
  } catch {
    sendJson(res, { success: false, message: 'Could not read Notion payload.', data: null }, 400)
    return
  }

  if (!isPayload(payload)) {
    sendJson(res, { success: false, message: 'Invalid Notion Daily Log payload.', data: null }, 400)
    return
  }

  const title = `Daily Log - ${payload.plan.date}`
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: title } }],
        },
        Date: {
          date: { start: payload.plan.date },
        },
      },
      children: buildChildren(payload),
    }),
  })

  const result = (await response.json()) as { id?: string; url?: string; message?: string }
  if (!response.ok) {
    sendJson(res, {
      success: false,
      message: result.message || `Notion returned ${response.status}.`,
      data: null,
    }, response.status)
    return
  }

  sendJson(res, {
    success: true,
    message: 'Daily Log pushed to Notion.',
    data: {
      pageId: result.id,
      pageUrl: result.url,
      exportedAt: new Date().toISOString(),
    },
  })
}
