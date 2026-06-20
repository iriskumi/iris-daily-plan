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
import { calculateDailyTimeStatistics, type DailyTimeStatistics } from '../../src/dailyTimeStats.js'

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

interface NotionDatabaseProperty {
  type: string
}

interface NotionDatabaseResult {
  properties?: Record<string, NotionDatabaseProperty>
  message?: string
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
  if (blockItem.id) return blockItem.id
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

function morningPriorityLines(payload: NotionDailyLogPayload): string[] {
  const checkin = payload.checkin
  if (!checkin) return []
  return [
    checkin.morningMainTask?.trim() ? `Main: ${checkin.morningMainTask.trim()}` : '',
    checkin.morningSecondaryTask1?.trim() ? `Secondary 1: ${checkin.morningSecondaryTask1.trim()}` : '',
    checkin.morningSecondaryTask2?.trim() ? `Secondary 2: ${checkin.morningSecondaryTask2.trim()}` : '',
    checkin.morningSmallLifeTask?.trim() ? `Small life: ${checkin.morningSmallLifeTask.trim()}` : '',
  ].filter(Boolean)
}

function buildChildren(payload: NotionDailyLogPayload, timeStats: DailyTimeStatistics): NotionBlock[] {
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
    `Today: ${focusStats.todaySessions} sessions / ${timeStats.focusMinutes} counted minutes`,
    `This week: ${focusStats.weekSessions} sessions / ${focusStats.weekMinutes} minutes`,
  ]
  const timeSummaryLines = [
    `Focus: ${Number((timeStats.focusMinutes / 60).toFixed(1))}h`,
    `Main focus: ${timeStats.mainFocusArea}`,
    `Vibe Coding: ${timeStats.vibeCodingMinutes} min`,
    `Cyber: ${timeStats.cyberMinutes} min`,
    `AI: ${timeStats.aiMinutes} min`,
    `English Output: ${timeStats.englishOutputMinutes} min`,
    `Expression Review: ${timeStats.expressionReviewMinutes} min`,
    `Job: ${timeStats.jobMinutes} min`,
    `Admin: ${timeStats.adminMinutes} min`,
    `Study: ${timeStats.studyMinutes} min`,
    `Recovery: ${timeStats.recoveryMinutes} min`,
  ]
  const countedBlockLines = timeStats.blocks.map(item => {
    const notes = item.notes ? ` | ${item.notes}` : ''
    return `${item.time} | ${item.title} | ${item.area} | ${item.status} | ${item.countedMinutes} min counted${notes}`
  })
  const dayType = payload.checkin?.dayType ?? 'Not recorded'
  const energy = payload.checkin?.energyLevel ?? (dailyLog.energyAfterDoing || 'Not recorded')
  const morningPriorities = morningPriorityLines(payload)

  return [
    block('heading_2', 'Daily Log'),
    block('paragraph', `Date: ${plan.date}`),
    block('paragraph', `Day Type: ${dayType}`),
    block('paragraph', `Energy: ${energy}`),
    block('paragraph', `Focus Minutes: ${timeStats.focusMinutes}`),
    block('paragraph', `Planner source: ${planSource(payload)}`),
    block('heading_3', 'Morning 1+2+1 Priorities'),
    ...bullets(morningPriorities),
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
    block('heading_2', 'Time Summary'),
    ...bullets(timeSummaryLines),
    block('heading_2', 'Blocks'),
    ...bullets(countedBlockLines),
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

function buildPageProperties(
  schema: Record<string, NotionDatabaseProperty>,
  payload: NotionDailyLogPayload,
  timeStats: DailyTimeStatistics,
  title: string,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const add = (name: string, allowedTypes: string[], value: (type: string) => unknown) => {
    const property = schema[name]
    if (!property) {
      console.warn(`[Notion] Missing property skipped: ${name}`)
      return
    }
    if (!allowedTypes.includes(property.type)) {
      console.warn(`[Notion Daily Log] Skipping ${name}; expected ${allowedTypes.join(' or ')}, found ${property.type}`)
      return
    }
    properties[name] = value(property.type)
  }
  const richTextOrSelect = (content: string) => (type: string) => type === 'select'
    ? { select: { name: content.slice(0, 100) } }
    : { rich_text: text(content) }

  const titleProperty = schema.Name?.type === 'title'
    ? 'Name'
    : Object.entries(schema).find(([, property]) => property.type === 'title')?.[0]
  if (titleProperty) properties[titleProperty] = { title: text(title) }
  else console.warn('[Notion Daily Log] No title property found in database.')

  add('Date', ['date'], () => ({ date: { start: payload.plan.date } }))
  add('Summary', ['rich_text'], () => ({ rich_text: text(payload.dailyLog.eveningSummary || payload.dailyLog.actualDone || '-') }))
  add('Planner Source', ['rich_text', 'select'], richTextOrSelect(planSource(payload)))
  add('Carry Over', ['rich_text'], () => ({ rich_text: text(payload.dailyLog.carryOverToTomorrow || '-') }))

  const numberProperties: Array<[string, number]> = [
    ['Focus Minutes', timeStats.focusMinutes],
    ['Vibe Coding Minutes', timeStats.vibeCodingMinutes],
    ['Cyber Minutes', timeStats.cyberMinutes],
    ['AI Minutes', timeStats.aiMinutes],
    ['English Output Minutes', timeStats.englishOutputMinutes],
    ['Expression Review Minutes', timeStats.expressionReviewMinutes],
    ['Job Minutes', timeStats.jobMinutes],
    ['Admin Minutes', timeStats.adminMinutes],
    ['Study Minutes', timeStats.studyMinutes],
    ['Recovery Minutes', timeStats.recoveryMinutes],
    ['Completed Blocks', timeStats.completedBlocks],
    ['Partial Blocks', timeStats.partialBlocks],
    ['Skipped Blocks', timeStats.skippedBlocks],
  ]
  numberProperties.forEach(([name, value]) => add(name, ['number'], () => ({ number: value })))
  const mainFocusArea = timeStats.mainFocusArea === 'None recorded' ? 'Other' : timeStats.mainFocusArea
  add('Main Focus Area', ['rich_text', 'select'], richTextOrSelect(mainFocusArea))
  add('Useful Output Summary', ['rich_text', 'select'], richTextOrSelect(timeStats.usefulOutputSummary))
  return properties
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
  const timeStats = calculateDailyTimeStatistics({
    plan: payload.plan,
    focusBlocks: payload.focusBlocks,
    followUps: payload.followUps,
    tasks: payload.tasks,
  })
  const notionHeaders = {
    Authorization: `Bearer ${notionKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }
  const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers: notionHeaders,
  })
  const database = (await databaseResponse.json()) as NotionDatabaseResult
  if (!databaseResponse.ok || !database.properties) {
    sendJson(res, {
      success: false,
      message: database.message || 'Could not inspect the Notion Daily Logs database properties.',
      data: null,
    }, databaseResponse.status)
    return
  }
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders,
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: buildPageProperties(database.properties, payload, timeStats, title),
      children: buildChildren(payload, timeStats),
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
