import {
  addImportedEnglishOutputReps,
  hasImportedEnglishOutputRep,
} from './englishOutputJourney'
import { getLocalDateKey } from './focus'
import { addStudySessionRecord, loadStudySessionRecords } from './studyStorage'
import type { StudySessionRecord } from './studyTypes'
import { writeStudySessionToTaskStore } from './taskStore'

export const EXPRESSION_HUB_IMPORT_QUEUE_KEY = 'iris-daily-hub-import-queue'

export interface ExpressionHubImportExpression {
  expression: string
  meaning?: string
  source?: string
  example?: string
  mySentence?: string
}

export interface ExpressionHubImportItem {
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
    item.type === 'english-output-rep' &&
    item.source === 'expression-review-hub' &&
    typeof item.id === 'string' &&
    typeof item.title === 'string'
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
  pendingCount: number
  lastImportedAt?: string
} {
  const rawQueue = readQueue()
  const existingSessions = loadStudySessionRecords()
  const importedAt = new Date().toISOString()
  let importedCount = 0

  const nextQueue = rawQueue.map(rawItem => {
    if (!isExpressionHubImportItem(rawItem) || rawItem.importedAt) return rawItem
    const alreadyImported = hasImportedEnglishOutputRep(rawItem.id)
      || existingSessions.some(session => session.id === importedSessionId(rawItem.id))
    const nextItem = alreadyImported
      ? { ...rawItem, importedAt }
      : rawItem

    if (alreadyImported) return nextItem

    const durationMinutes = Math.max(1, Math.round(Number(rawItem.durationMinutes) || 1))
    const completedAt = completedAtForItem(rawItem)
    const startedAt = new Date(new Date(completedAt).getTime() - durationMinutes * 60_000).toISOString()
    const record: StudySessionRecord = {
      id: importedSessionId(rawItem.id),
      source: 'expression-review-hub',
      sourceImportId: rawItem.id,
      title: rawItem.title,
      category: 'English Output',
      startedAt,
      completedAt,
      plannedMinutes: durationMinutes,
      actualMinutes: durationMinutes,
      status: 'completed',
      noteDestination: rawItem.obsidianPath,
      notes: summarizeExpressions(rawItem),
      resourceUsed: rawItem.obsidianPath || 'Expression Review Hub',
    }

    addStudySessionRecord(record)
    writeStudySessionToTaskStore(record)
    addImportedEnglishOutputReps({
      importItemId: rawItem.id,
      title: rawItem.title,
      date: rawItem.date || completedAt.slice(0, 10),
      reps: rawItem.reps,
      note: rawItem.obsidianPath,
      createdAt: importedAt,
    })
    importedCount += 1
    return { ...rawItem, importedAt }
  })

  writeQueue(nextQueue)
  const status = getExpressionHubImportStatus()
  return {
    importedCount,
    pendingCount: status.pendingCount,
    lastImportedAt: importedCount > 0 ? importedAt : status.lastImportedAt,
  }
}
