/// <reference types="node" />

import type { IntegrationResult, NotionExportResult } from '../../src/types.js'

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

interface Iris365Payload {
  date: string
  dayNumber: number
  progressPercent: number
  phaseEnglish: string
  phaseChinese: string
  morningGate: string
  morningFeeling: string
  morningChecklist: string[]
  englishEnvironment: string
  switchSummary: string[]
  movement: string
  foundationCount: number
  foundationNote: string
  markdown: string
}

interface NotionText {
  type: 'text'
  text: { content: string }
  plain_text?: string
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

interface NotionPage {
  id: string
  url?: string
  properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>
}

function sendJson(res: VercelResponse, body: IntegrationResult<NotionExportResult>, status = 200): void {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(body)
}

function getBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') return JSON.parse(req.body) as unknown
  return req.body
}

function isPayload(value: unknown): value is Iris365Payload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<Iris365Payload>
  return typeof payload.date === 'string'
    && typeof payload.dayNumber === 'number'
    && typeof payload.progressPercent === 'number'
    && typeof payload.phaseEnglish === 'string'
    && typeof payload.morningGate === 'string'
    && Array.isArray(payload.morningChecklist)
    && Array.isArray(payload.switchSummary)
    && typeof payload.markdown === 'string'
}

function text(content: string): NotionText[] {
  return [{ type: 'text', text: { content: (content || '-').slice(0, 2000) } }]
}

function block(type: NotionBlock['type'], content: string): NotionBlock {
  return { object: 'block', type, [type]: { rich_text: text(content) } } as NotionBlock
}

function bullets(items: string[]): NotionBlock[] {
  return (items.length ? items : ['还没有记录']).slice(0, 40).map(item => block('bulleted_list_item', item))
}

function paragraphs(content: string): NotionBlock[] {
  const clean = content.trim() || '-'
  const chunks: string[] = []
  for (let index = 0; index < clean.length; index += 1900) chunks.push(clean.slice(index, index + 1900))
  return chunks.map(item => block('paragraph', item))
}

function children(payload: Iris365Payload): NotionBlock[] {
  return [
    block('heading_2', 'Today’s Foundation'),
    block('paragraph', `Day ${payload.dayNumber} / 365 · ${payload.progressPercent}% · ${payload.phaseEnglish} / ${payload.phaseChinese}`),
    block('paragraph', `${payload.foundationCount} / 3 foundations appeared today`),
    block('heading_2', 'Morning Gate'),
    block('paragraph', payload.morningGate),
    block('paragraph', `刚醒来的感觉：${payload.morningFeeling || '未记录'}`),
    ...bullets(payload.morningChecklist),
    block('heading_2', 'Switch Log'),
    ...bullets(payload.switchSummary),
    block('heading_2', 'English Environment'),
    block('paragraph', payload.englishEnvironment),
    block('heading_2', 'Movement'),
    block('paragraph', payload.movement),
    block('heading_2', 'Note for Tomorrow'),
    block('paragraph', payload.foundationNote || '今天做一点也算。'),
    block('heading_2', 'Markdown Copy'),
    ...paragraphs(payload.markdown),
  ].slice(0, 90)
}

function titleOf(page: NotionPage): string {
  const titleProperty = Object.values(page.properties ?? {}).find(property => property.type === 'title')
  return titleProperty?.title?.map(item => item.plain_text ?? '').join('') ?? ''
}

async function clearChildren(pageId: string, headers: Record<string, string>): Promise<void> {
  const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, { headers })
  if (!response.ok) return
  const result = (await response.json()) as { results?: Array<{ id: string }> }
  await Promise.all((result.results ?? []).map(item => fetch(`https://api.notion.com/v1/blocks/${item.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ archived: true }),
  })))
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, { success: false, message: 'Method not allowed.', data: null }, 405)
    return
  }

  let payload: unknown
  try {
    payload = getBody(req)
  } catch {
    sendJson(res, { success: false, message: 'Invalid JSON payload.', data: null }, 400)
    return
  }
  if (!isPayload(payload)) {
    sendJson(res, { success: false, message: 'Invalid Iris 365 payload.', data: null }, 400)
    return
  }

  const notionKey = process.env.NOTION_API_KEY
  const databaseId = process.env.NOTION_IRIS365_DATABASE_ID || process.env.NOTION_DATABASE_ID
  if (!notionKey || !databaseId) {
    sendJson(res, { success: false, message: 'Notion requires NOTION_API_KEY and a database ID.', data: null }, 400)
    return
  }

  const headers = {
    Authorization: `Bearer ${notionKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  }
  const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, { headers })
  const database = (await databaseResponse.json()) as { properties?: Record<string, NotionDatabaseProperty>; message?: string }
  if (!databaseResponse.ok || !database.properties) {
    sendJson(res, { success: false, message: database.message || 'Could not read the Notion database.', data: null }, 400)
    return
  }

  const titleProperty = database.properties.Name?.type === 'title'
    ? 'Name'
    : Object.entries(database.properties).find(([, property]) => property.type === 'title')?.[0]
  if (!titleProperty) {
    sendJson(res, { success: false, message: 'The Notion database needs a title property.', data: null }, 400)
    return
  }

  const pageTitle = `Iris 365 · ${payload.date}`
  let existing: NotionPage | undefined
  if (database.properties.Date?.type === 'date') {
    const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ filter: { property: 'Date', date: { equals: payload.date } }, page_size: 20 }),
    })
    if (queryResponse.ok) {
      const query = (await queryResponse.json()) as { results?: NotionPage[] }
      existing = query.results?.find(page => titleOf(page) === pageTitle)
    }
  }

  const properties: Record<string, unknown> = {
    [titleProperty]: { title: text(pageTitle) },
  }
  if (database.properties.Date?.type === 'date') properties.Date = { date: { start: payload.date } }
  if (database.properties['Planner Source']?.type === 'rich_text') properties['Planner Source'] = { rich_text: text('iris-365') }
  if (database.properties.Summary?.type === 'rich_text') properties.Summary = { rich_text: text(payload.foundationNote || payload.markdown) }

  let page: NotionPage
  if (existing) {
    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ properties }),
    })
    page = (await updateResponse.json()) as NotionPage
    if (!updateResponse.ok) {
      sendJson(res, { success: false, message: 'Could not update the Iris 365 Notion page.', data: null }, 400)
      return
    }
    await clearChildren(existing.id, headers)
    await fetch(`https://api.notion.com/v1/blocks/${existing.id}/children`, {
      method: 'PATCH', headers, body: JSON.stringify({ children: children(payload) }),
    })
  } else {
    const createResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify({ parent: { database_id: databaseId }, properties, children: children(payload) }),
    })
    page = (await createResponse.json()) as NotionPage
    if (!createResponse.ok) {
      sendJson(res, { success: false, message: 'Could not create the Iris 365 Notion page.', data: null }, 400)
      return
    }
  }

  sendJson(res, {
    success: true,
    message: existing ? 'Iris 365 page updated in Notion.' : 'Iris 365 page pushed to Notion.',
    data: { pageUrl: page.url ?? existing?.url ?? '', exportedAt: new Date().toISOString() },
  })
}
