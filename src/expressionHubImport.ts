import {
  addImportedEnglishOutputReps,
  hasImportedEnglishOutputRep,
} from './englishOutputJourney'
import { getLocalDateKey } from './focus'
import { addStudySessionRecord, loadStudySessionRecords } from './studyStorage'
import type { StudySessionRecord } from './studyTypes'
import { writeStudySessionToTaskStore } from './taskStore'

export const EXPRESSION_HUB_IMPORT_QUEUE_KEY = 'iris-daily-hub-import-queue'
export const EXPRESSION_HUB_IMPORT_NOTICE_KEY = 'iris-expression-hub-import-notice'
export const EXPRESSION_HUB_IMPORT_PARAM = 'importExpressionOutput'

export interface ExpressionHubImportExpression {
  expression: string
  meaning?: string
  source?: string
  example?: string
  mySentence?: string
}

export interface ExpressionHubImportItem {
  schemaVersion?: 1
  id: string
  type: 'english-output-rep'
  source: 'expression-review-hub'
  title: string
  category: 'English Output'
  durationMinutes: number
  reps: number
  date: string
  obsidianPath: string
  markdown: string
  expressions: ExpressionHubImportExpression[]
  createdAt: string
  importedAt?: string
}

export interface ExpressionHubImportResult {
  success: boolean
  importedCount: number
  duplicateCount: number
  pendingCount: number
  message: string
  importedAt?: string
  error?: string
}

interface VersionedValue<T> {
  schemaVersion: number
  value: T
}

function isVersionedValue<T>(value: unknown): value is VersionedValue<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    'value' in value
  )
}

function isExpressionHubImportItem(value: unknown): value is ExpressionHubImportItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<ExpressionHubImportItem>
  return (
    (item.schemaVersion === undefined || item.schemaVersion === 1) &&
    item.type === 'english-output-rep' &&
    item.source === 'expression-review-hub' &&
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    item.category === 'English Output' &&
    typeof item.durationMinutes === 'number' &&
    typeof item.reps === 'number' &&
    typeof item.date === 'string' &&
    typeof item.obsidianPath === 'string' &&
    typeof item.markdown === 'string' &&
    typeof item.createdAt === 'string'
  )
}

function readQueue(): unknown[] {
  try {
    const raw = localStorage.getItem(EXPRESSION_HUB_IMPORT_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    const value = isVersionedValue<unknown[]>(parsed) ? parsed.value : parsed
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeQueue(queue: unknown[]): void {
  localStorage.setItem(EXPRESSION_HUB_IMPORT_QUEUE_KEY, JSON.stringify(queue))
}

function safeIso(value: string | undefined, fallbackDate: string): string {
  if (value) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return new Date(`${fallbackDate || getLocalDateKey()}T12:00:00`).toISOString()
}

function completedAtForItem(item: ExpressionHubImportItem): string {
  const createdAt = safeIso(item.createdAt, item.date)
  if (item.date && createdAt.slice(0, 10) === item.date) return createdAt
  return safeIso(undefined, item.date)
}

function importedSessionId(itemId: string): string {
  return `expression-hub-session:${itemId}`
}

function summarizeExpressions(item: ExpressionHubImportItem): string {
  const expressionLines = item.expressions?.length
    ? [
        '',
        'Expressions:',
        ...item.expressions.slice(0, 8).map(expression => {
          const parts = [
            expression.expression,
            expression.meaning,
            expression.mySentence ? `My sentence: ${expression.mySentence}` : '',
          ].filter(Boolean)
          return `- ${parts.join(' - ')}`
        }),
      ]
    : []
  return [
    item.markdown?.trim() || `Imported from Expression Review Hub: ${item.title}`,
    ...expressionLines,
  ].join('\n')
}

function normalizeImportPayload(value: unknown): ExpressionHubImportItem {
  const candidate = isVersionedValue<unknown>(value) ? value.value : value
  if (!isExpressionHubImportItem(candidate)) {
    throw new Error('Import payload is not a valid Expression Review Hub English output item.')
  }
  return {
    ...candidate,
    expressions: Array.isArray(candidate.expressions) ? candidate.expressions : [],
  }
}

export function parseExpressionHubImportJson(json: string): ExpressionHubImportItem {
  try {
    return normalizeImportPayload(JSON.parse(json) as unknown)
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Could not parse Expression Review Hub JSON.')
  }
}

export function decodeExpressionHubImportParam(value: string): ExpressionHubImportItem {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return normalizeImportPayload(JSON.parse(new TextDecoder().decode(bytes)) as unknown)
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Could not decode Expression Review Hub import URL.')
  }
}

function importExpressionHubItem(item: ExpressionHubImportItem, importedAt = new Date().toISOString()): {
  imported: boolean
  duplicate: boolean
  importedAt: string
} {
  const sessionId = importedSessionId(item.id)
  const duplicate = hasImportedEnglishOutputRep(item.id)
    || loadStudySessionRecords().some(session => session.id === sessionId)
  if (duplicate) return { imported: false, duplicate: true, importedAt }

  const durationMinutes = Math.max(1, Math.round(Number(item.durationMinutes) || 1))
  const completedAt = completedAtForItem(item)
  const startedAt = new Date(new Date(completedAt).getTime() - durationMinutes * 60_000).toISOString()
  const record: StudySessionRecord = {
    id: sessionId,
    source: 'expression-review-hub',
    sourceImportId: item.id,
    title: item.title,
    category: 'English Output',
    startedAt,
    completedAt,
    plannedMinutes: durationMinutes,
    actualMinutes: durationMinutes,
    status: 'completed',
    noteDestination: item.obsidianPath,
    notes: item.markdown?.trim() || summarizeExpressions(item),
    resourceUsed: item.obsidianPath || 'Expression Review Hub',
  }

  addStudySessionRecord(record)
  writeStudySessionToTaskStore(record)
  addImportedEnglishOutputReps({
    importItemId: item.id,
    title: item.title,
    date: item.date || completedAt.slice(0, 10),
    reps: item.reps,
    note: item.obsidianPath,
    createdAt: importedAt,
  })
  return { imported: true, duplicate: false, importedAt }
}

export function loadExpressionHubImportQueue(): ExpressionHubImportItem[] {
  return readQueue().filter(isExpressionHubImportItem)
}

export function pendingExpressionHubImports(): ExpressionHubImportItem[] {
  return loadExpressionHubImportQueue().filter(item =>
    !item.importedAt &&
    !hasImportedEnglishOutputRep(item.id),
  )
}

export function getExpressionHubImportStatus(): {
  pendingCount: number
  lastImportedAt?: string
} {
  const items = loadExpressionHubImportQueue()
  const imported = items
    .map(item => item.importedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
  return {
    pendingCount: pendingExpressionHubImports().length,
    lastImportedAt: imported[imported.length - 1],
  }
}

export function importExpressionHubQueue(): {
  importedCount: number
  duplicateCount: number
  pendingCount: number
  lastImportedAt?: string
} {
  const rawQueue = readQueue()
  const importedAt = new Date().toISOString()
  let importedCount = 0
  let duplicateCount = 0

  const nextQueue = rawQueue.map(rawItem => {
    if (!isExpressionHubImportItem(rawItem) || rawItem.importedAt) return rawItem
    const result = importExpressionHubItem(rawItem, importedAt)
    if (result.imported) importedCount += 1
    if (result.duplicate) duplicateCount += 1
    return { ...rawItem, importedAt }
  })

  writeQueue(nextQueue)
  const status = getExpressionHubImportStatus()
  return {
    importedCount,
    duplicateCount,
    pendingCount: status.pendingCount,
    lastImportedAt: importedCount > 0 ? importedAt : status.lastImportedAt,
  }
}

export function importExpressionHubPayload(payload: ExpressionHubImportItem): ExpressionHubImportResult {
  const importedAt = new Date().toISOString()
  const result = importExpressionHubItem(payload, importedAt)
  const pendingCount = getExpressionHubImportStatus().pendingCount
  if (result.imported) {
    return {
      success: true,
      importedCount: 1,
      duplicateCount: 0,
      pendingCount,
      importedAt,
      message: `Imported "${payload.title}" from Expression Review Hub.`,
    }
  }
  if (result.duplicate) {
    return {
      success: true,
      importedCount: 0,
      duplicateCount: 1,
      pendingCount,
      importedAt,
      message: 'This Expression Review Hub output was already imported.',
    }
  }
  return {
    success: false,
    importedCount: 0,
    duplicateCount: 0,
    pendingCount,
    importedAt,
    message: 'Expression Review Hub import did not complete.',
  }
}

export function saveExpressionHubImportNotice(result: ExpressionHubImportResult): void {
  sessionStorage.setItem(EXPRESSION_HUB_IMPORT_NOTICE_KEY, JSON.stringify(result))
}

export function loadExpressionHubImportNotice(): ExpressionHubImportResult | null {
  try {
    const raw = sessionStorage.getItem(EXPRESSION_HUB_IMPORT_NOTICE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ExpressionHubImportResult
  } catch {
    return null
  }
}

export function consumeExpressionHubUrlImport(): ExpressionHubImportResult | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const encoded = url.searchParams.get(EXPRESSION_HUB_IMPORT_PARAM)
  if (!encoded) return null

  let result: ExpressionHubImportResult
  try {
    const payload = decodeExpressionHubImportParam(encoded)
    result = importExpressionHubPayload(payload)
  } catch (error) {
    result = {
      success: false,
      importedCount: 0,
      duplicateCount: 0,
      pendingCount: getExpressionHubImportStatus().pendingCount,
      message: 'Expression Review Hub import failed.',
      error: error instanceof Error ? error.message : 'Unknown import error.',
    }
  }

  url.searchParams.delete(EXPRESSION_HUB_IMPORT_PARAM)
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  saveExpressionHubImportNotice(result)
  return result
}
