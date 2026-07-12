import { getLocalDateKey } from './focus'
import { scheduleTaskForToday } from './queueTaskHelpers'
import {
  createExternalInboxTask,
  findExternalInboxTask,
  writeInboxTaskToTaskStore,
  type ExternalInboxTaskInput,
} from './taskStore'
import type { Task } from './types'

export interface ExternalTaskImportPayload {
  schemaVersion: 1
  type: 'task-import'
  sourceApp: 'iris-job-search'
  sourceImportId: string
  task: {
    title: string
    estimatedMinutes?: number
    context?: 'work' | 'life' | 'study' | null
    sourceUrl?: string
    notes?: string
    externalCategory?: string
    applicationId?: string
    company?: string
    jobTitle?: string
  }
}

export interface ExternalTaskImportDraft {
  title: string
  estimatedMinutes: number
  context: 'work' | 'life' | 'study'
}

export type ExternalTaskImportParseResult =
  | { ok: true; payload: ExternalTaskImportPayload }
  | { ok: false; error: string }

export const EXTERNAL_TASK_IMPORT_PARAM = 'importTask'

const MAX_IMPORT_PAYLOAD_LENGTH = 6_000

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim()
  if (!cleaned) return undefined
  return cleaned.slice(0, maxLength)
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodePayload(value: string): unknown {
  if (value.length > MAX_IMPORT_PAYLOAD_LENGTH) {
    throw new Error('Import payload is too large.')
  }
  const decoded = decodeURIComponent(value)
  const json = decoded.trim().startsWith('{') ? decoded : decodeBase64Url(decoded)
  return JSON.parse(json) as unknown
}

export function validateExternalTaskImportPayload(value: unknown): ExternalTaskImportParseResult {
  if (!isObject(value)) return { ok: false, error: 'Could not read this task import.' }
  if (value.schemaVersion !== 1) return { ok: false, error: 'Unsupported task import version.' }
  if (value.type !== 'task-import') return { ok: false, error: 'Unsupported import type.' }
  if (value.sourceApp !== 'iris-job-search') return { ok: false, error: 'Unsupported source app.' }
  const sourceImportId = cleanText(value.sourceImportId, 160)
  if (!sourceImportId) return { ok: false, error: 'Task import is missing an import id.' }
  if (!isObject(value.task)) return { ok: false, error: 'Task import is missing task details.' }
  const title = cleanText(value.task.title, 180)
  if (!title) return { ok: false, error: 'Task import is missing a title.' }
  const estimated = typeof value.task.estimatedMinutes === 'number'
    ? Math.round(value.task.estimatedMinutes)
    : 60
  const context = value.task.context === 'life' || value.task.context === 'study'
    ? value.task.context
    : 'work'
  return {
    ok: true,
    payload: {
      schemaVersion: 1,
      type: 'task-import',
      sourceApp: 'iris-job-search',
      sourceImportId,
      task: {
        title,
        estimatedMinutes: Math.min(180, Math.max(5, estimated)),
        context,
        sourceUrl: cleanText(value.task.sourceUrl, 800),
        notes: cleanText(value.task.notes, 1_200),
        externalCategory: cleanText(value.task.externalCategory, 80),
        applicationId: cleanText(value.task.applicationId, 160),
        company: cleanText(value.task.company, 120),
        jobTitle: cleanText(value.task.jobTitle, 160),
      },
    },
  }
}

export function parseExternalTaskImportFromUrl(search = window.location.search): ExternalTaskImportParseResult | null {
  const params = new URLSearchParams(search)
  const raw = params.get(EXTERNAL_TASK_IMPORT_PARAM)
  if (!raw) return null
  try {
    return validateExternalTaskImportPayload(decodePayload(raw))
  } catch {
    return { ok: false, error: 'Could not read this task import.' }
  }
}

export function clearExternalTaskImportUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(EXTERNAL_TASK_IMPORT_PARAM)) return
  url.searchParams.delete(EXTERNAL_TASK_IMPORT_PARAM)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function draftFromExternalTaskPayload(payload: ExternalTaskImportPayload): ExternalTaskImportDraft {
  return {
    title: payload.task.title,
    estimatedMinutes: payload.task.estimatedMinutes ?? 60,
    context: payload.task.context ?? 'work',
  }
}

export function existingTaskForExternalImport(payload: ExternalTaskImportPayload): Task | null {
  return findExternalInboxTask(payload.sourceApp, payload.sourceImportId)
}

function inputFromPayload(
  payload: ExternalTaskImportPayload,
  draft: ExternalTaskImportDraft,
): ExternalInboxTaskInput {
  return {
    title: draft.title.trim(),
    estimatedMinutes: Math.min(180, Math.max(5, Math.round(draft.estimatedMinutes || 60))),
    context: draft.context,
    notes: payload.task.notes,
    sourceUrl: payload.task.sourceUrl,
    externalCategory: payload.task.externalCategory,
    applicationId: payload.task.applicationId,
    company: payload.task.company,
    jobTitle: payload.task.jobTitle,
    externalSource: payload.sourceApp,
    sourceImportId: payload.sourceImportId,
  }
}

export function addExternalTaskToToday(task: Task, date = getLocalDateKey()): void {
  scheduleTaskForToday(task.id, date)
  writeInboxTaskToTaskStore(task)
}

export function importExternalTask(
  payload: ExternalTaskImportPayload,
  draft: ExternalTaskImportDraft,
  options: { addToToday?: boolean } = {},
): { task: Task; created: boolean } {
  const result = createExternalInboxTask(inputFromPayload(payload, draft))
  if (options.addToToday) addExternalTaskToToday(result.task)
  return result
}
