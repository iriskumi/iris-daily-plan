/// <reference types="node" />

import type { IntegrationResult, NotionExportResult } from '../../src/types.js'
import type { StudyCategory, StudyDailyReview, StudySessionRecord } from '../../src/studyTypes.js'

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

interface NotionText {
  type: 'text'
  text: { content: string }
}

interface NotionBlock {
  object: 'block'
  type: 'heading_2' | 'paragraph' | 'bulleted_list_item'
  heading_2?: { rich_text: NotionText[] }
  paragraph?: { rich_text: NotionText[] }
  bulleted_list_item?: { rich_text: NotionText[] }
}

interface NotionDatabaseProperty {
  type: string
}

interface NotionDatabaseResult {
  properties?: Record<string, NotionDatabaseProperty>
  message?: string
}

interface NotionPageResult {
  id?: string
  url?: string
  message?: string
  results?: Array<{ id: string; url?: string }>
}

interface StudyPayload {
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

const STUDY_CATEGORIES: StudyCategory[] = [
  'English Output',
  'English Input',
  'Japanese',
  'AI Coding',
  'Coursera AI Pathway',
  'SQL / Excel',
  'Job / Career',
  'Review / NotebookLM',
  'Admin / Life',
  'Cyber',
  'Reset',
]

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

function isStudyPayload(value: unknown): value is StudyPayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Partial<StudyPayload>
  return (
    typeof payload.date === 'string' &&
    typeof payload.targetMinutes === 'number' &&
    typeof payload.completedMinutes === 'number' &&
    typeof payload.sessionCount === 'number' &&
    typeof payload.categoryBreakdown === 'object' &&
    payload.categoryBreakdown !== null &&
    Array.isArray(payload.noteDestinations) &&
    Array.isArray(payload.sessions) &&
    typeof payload.review === 'object' &&
    payload.review !== null &&
    typeof payload.markdown === 'string'
  )
}

function text(content: string): NotionText[] {
  return [{ type: 'text', text: { content: (content || '-').slice(0, 2000) } }]
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
    .slice(0, 80)
    .map(item => block('bulleted_list_item', item))
}

function paragraphs(content: string): NotionBlock[] {
  const clean = content.trim()
  if (!clean) return [block('paragraph', '-')]
  const chunks: string[] = []
  for (let i = 0; i < clean.length; i += 1900) chunks.push(clean.slice(i, i + 1900))
  return chunks.map(chunk => block('paragraph', chunk))
}

function timeLabel(value: string): string {
  return new Date(value).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function minutes(payload: StudyPayload, category: StudyCategory): number {
  return payload.categoryBreakdown[category] ?? 0
}

function topCategory(payload: StudyPayload): string {
  const [category, value] = STUDY_CATEGORIES
    .map(category => [category, minutes(payload, category)] as const)
    .sort((a, b) => b[1] - a[1])[0]
  return value > 0 ? category : 'None recorded'
}

function buildChildren(payload: StudyPayload): NotionBlock[] {
  const sessionLines = payload.sessions
    .filter(session => session.status === 'completed')
    .map(session => `${timeLabel(session.startedAt)}-${timeLabel(session.completedAt)} · ${session.category} · ${session.title} · ${session.actualMinutes} min`)
  const sessionDetailLines = payload.sessions
    .filter(session => session.status === 'completed')
    .flatMap(session => [
      `Resource: ${session.resourceUsed || 'Not recorded'}`,
      `Notes: ${session.noteDestination || 'Not recorded'}`,
    ])
  const categoryLines = STUDY_CATEGORIES.map(category => `${category}: ${minutes(payload, category)} min`)

  return [
    block('heading_2', 'Study Sessions'),
    ...bullets(sessionLines),
    ...bullets(sessionDetailLines),
    block('heading_2', 'Category Breakdown'),
    ...bullets(categoryLines),
    block('heading_2', 'Actual Done'),
    ...paragraphs(payload.review.actualDone),
    block('heading_2', 'Carry Over'),
    ...paragraphs(payload.review.carryOver),
    block('heading_2', 'Tomorrow’s Smallest Next Step'),
    ...paragraphs(payload.review.tomorrowNextStep),
    block('heading_2', 'Markdown Summary'),
    ...paragraphs(payload.markdown),
  ].slice(0, 95)
}

function buildPageProperties(
  schema: Record<string, NotionDatabaseProperty>,
  payload: StudyPayload,
  title: string,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const add = (name: string, allowedTypes: string[], value: (type: string) => unknown) => {
    const property = schema[name]
    if (!property || !allowedTypes.includes(property.type)) return
    properties[name] = value(property.type)
  }
  const richTextOrSelect = (content: string) => (type: string) => type === 'select'
    ? { select: { name: content.slice(0, 100) } }
    : { rich_text: text(content) }

  const titleProperty = schema.Name?.type === 'title'
    ? 'Name'
    : Object.entries(schema).find(([, property]) => property.type === 'title')?.[0]
  if (titleProperty) properties[titleProperty] = { title: text(title) }

  add('Date', ['date'], () => ({ date: { start: payload.date } }))
  add('Planner Source', ['rich_text', 'select'], richTextOrSelect('study-dashboard'))
  add('Focus Minutes', ['number'], () => ({ number: payload.completedMinutes }))
  add('Study Minutes', ['number'], () => ({ number: payload.completedMinutes }))
  add('AI Minutes', ['number'], () => ({ number: minutes(payload, 'AI Coding') }))
  add('Coursera Minutes', ['number'], () => ({ number: minutes(payload, 'Coursera AI Pathway') }))
  add('Admin Minutes', ['number'], () => ({ number: minutes(payload, 'Admin / Life') }))
  add('Carry Over', ['rich_text'], () => ({ rich_text: text(payload.review.carryOver || '-') }))
  add('Summary', ['rich_text'], () => ({ rich_text: text(payload.markdown || payload.review.actualDone || '-') }))

  add('English Minutes', ['number'], () => ({ number: minutes(payload, 'English Output') + minutes(payload, 'English Input') }))
  add('Japanese Minutes', ['number'], () => ({ number: minutes(payload, 'Japanese') }))
  add('Cyber Minutes', ['number'], () => ({ number: minutes(payload, 'Cyber') }))
  add('SQL/Data Minutes', ['number'], () => ({ number: minutes(payload, 'SQL / Excel') }))
  add('Job/Career Minutes', ['number'], () => ({ number: minutes(payload, 'Job / Career') }))
  add('Review Minutes', ['number'], () => ({ number: minutes(payload, 'Review / NotebookLM') }))
  add('Session Count', ['number'], () => ({ number: payload.sessionCount }))
  add('Top Category', ['rich_text', 'select'], richTextOrSelect(topCategory(payload)))
  add('Obsidian Notes', ['rich_text'], () => ({ rich_text: text(payload.noteDestinations.join('\n') || '-') }))
  add('Actual Done', ['rich_text'], () => ({ rich_text: text(payload.review.actualDone || '-') }))
  add('Tomorrow Next Step', ['rich_text'], () => ({ rich_text: text(payload.review.tomorrowNextStep || '-') }))

  return properties
}

async function findExistingDailyLog(
  databaseId: string,
  headers: Record<string, string>,
  date: string,
): Promise<{ id: string; url?: string } | null> {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filter: {
        property: 'Date',
        date: { equals: date },
      },
      page_size: 1,
    }),
  })
  if (!response.ok) {
    const result = (await response.json()) as { message?: string }
    throw new Error(result.message || 'Could not query Notion Daily Logs by date.')
  }
  const result = (await response.json()) as NotionPageResult
  return result.results?.[0] ?? null
}

async function clearChildren(pageId: string, headers: Record<string, string>): Promise<void> {
  const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, { headers })
  if (!response.ok) return
  const payload = (await response.json()) as { results?: Array<{ id: string }> }
  await Promise.all((payload.results ?? []).map(child =>
    fetch(`https://api.notion.com/v1/blocks/${child.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ archived: true }),
    }),
  ))
}

async function appendChildren(pageId: string, headers: Record<string, string>, children: NotionBlock[]): Promise<void> {
  await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ children }),
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
    sendJson(res, { success: false, message: 'Could not read Study Daily Log payload.', data: null }, 400)
    return
  }

  if (!isStudyPayload(payload)) {
    sendJson(res, { success: false, message: 'Invalid Study Daily Log payload.', data: null }, 400)
    return
  }

  const headers = {
    Authorization: `Bearer ${notionKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }
  const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers,
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
  if (database.properties.Date?.type !== 'date') {
    sendJson(res, {
      success: false,
      message: 'Cannot safely push Study Daily Log because the Notion Daily Logs database needs a Date property.',
      data: null,
    }, 400)
    return
  }

  const title = `Daily Log - ${payload.date}`
  const properties = buildPageProperties(database.properties, payload, title)
  const children = buildChildren(payload)
  let existing: { id: string; url?: string } | null
  try {
    existing = await findExistingDailyLog(databaseId, headers, payload.date)
  } catch (error) {
    sendJson(res, {
      success: false,
      message: error instanceof Error ? error.message : 'Could not query Notion Daily Logs by date.',
      data: null,
    }, 400)
    return
  }

  if (existing) {
    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties }),
    })
    const updateResult = (await updateResponse.json()) as NotionPageResult
    if (!updateResponse.ok) {
      sendJson(res, {
        success: false,
        message: updateResult.message || `Notion returned ${updateResponse.status}.`,
        data: null,
      }, updateResponse.status)
      return
    }
    await clearChildren(existing.id, headers)
    await appendChildren(existing.id, headers, children)
    sendJson(res, {
      success: true,
      message: 'Study Daily Log updated in Notion.',
      data: {
        pageId: existing.id,
        pageUrl: updateResult.url ?? existing.url,
        exportedAt: new Date().toISOString(),
      },
    })
    return
  }

  const createResponse = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
      children,
    }),
  })
  const createResult = (await createResponse.json()) as NotionPageResult
  if (!createResponse.ok) {
    sendJson(res, {
      success: false,
      message: createResult.message || `Notion returned ${createResponse.status}.`,
      data: null,
    }, createResponse.status)
    return
  }

  sendJson(res, {
    success: true,
    message: 'Study Daily Log created in Notion.',
    data: {
      pageId: createResult.id,
      pageUrl: createResult.url,
      exportedAt: new Date().toISOString(),
    },
  })
}
