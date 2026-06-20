/// <reference types="node" />

import type { IntegrationResult } from '../../src/types.js'
import {
  NOTION_TIME_SCHEMA,
  notionPropertyMatches,
  type NotionSchemaCheckResult,
  type NotionSchemaRequirement,
} from '../../src/notionSchema.js'

interface VercelRequest { method?: string }
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}
interface NotionProperty { type: string }
interface NotionDatabaseResponse {
  properties?: Record<string, NotionProperty>
  message?: string
}

const SELECT_OPTIONS = [
  { name: 'Vibe Coding', color: 'purple' },
  { name: 'Cyber', color: 'blue' },
  { name: 'AI', color: 'yellow' },
  { name: 'English', color: 'orange' },
  { name: 'Expression Review', color: 'pink' },
  { name: 'Job', color: 'brown' },
  { name: 'Admin', color: 'gray' },
  { name: 'Study', color: 'blue' },
  { name: 'Other', color: 'gray' },
  { name: 'Recovery', color: 'green' },
]

function sendJson(res: VercelResponse, body: IntegrationResult<NotionSchemaCheckResult>, status = 200) {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(body)
}

function inspect(properties: Record<string, NotionProperty>): NotionSchemaCheckResult {
  const existing: string[] = []
  const missing: NotionSchemaRequirement[] = []
  const incompatible: Array<NotionSchemaRequirement & { actualType: string }> = []
  NOTION_TIME_SCHEMA.forEach(requirement => {
    const property = properties[requirement.name]
    if (!property) missing.push(requirement)
    else if (!notionPropertyMatches(requirement.kind, property.type)) {
      incompatible.push({ ...requirement, actualType: property.type })
    } else existing.push(requirement.name)
  })
  return { existing, missing, incompatible, canCreateMissing: true }
}

function definition(requirement: NotionSchemaRequirement): unknown {
  if (requirement.kind === 'number') return { number: { format: 'number' } }
  if (requirement.kind === 'select-or-text') return { select: { options: SELECT_OPTIONS } }
  if (requirement.kind === 'formula') return { formula: { expression: 'prop("Focus Minutes") / 60' } }
  return { rich_text: {} }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
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
  const headers = {
    Authorization: `Bearer ${notionKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }
  const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, { headers })
  const database = (await databaseResponse.json()) as NotionDatabaseResponse
  if (!databaseResponse.ok || !database.properties) {
    sendJson(res, { success: false, message: database.message || 'Could not inspect Notion schema.', data: null }, databaseResponse.status)
    return
  }
  let result = inspect(database.properties)
  if (req.method === 'POST' && result.missing.length > 0) {
    const properties = Object.fromEntries(result.missing.map(requirement => [requirement.name, definition(requirement)]))
    const updateResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'PATCH', headers, body: JSON.stringify({ properties }),
    })
    const updated = (await updateResponse.json()) as NotionDatabaseResponse
    if (!updateResponse.ok || !updated.properties) {
      sendJson(res, {
        success: false,
        message: updated.message || 'Notion could not create the missing database properties. Add them manually.',
        data: result,
      }, updateResponse.status)
      return
    }
    result = inspect(updated.properties)
  }
  sendJson(res, {
    success: true,
    message: result.missing.length === 0 && result.incompatible.length === 0
      ? 'Notion Daily Logs schema is ready.'
      : `Notion schema checked: ${result.missing.length} missing, ${result.incompatible.length} incompatible.`,
    data: result,
  })
}
