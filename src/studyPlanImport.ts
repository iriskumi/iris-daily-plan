import { getLocalDateKey } from './focus'
import { addExternalTaskToToday } from './externalTaskImport'
import {
  createExternalInboxTask,
  findExternalInboxTask,
} from './taskStore'
import type { TaskArea, TaskEnergy, TaskMode } from './types'

export const STUDY_PLAN_IMPORT_PARAM = 'importStudyPlan'

const MAX_IMPORT_PAYLOAD_LENGTH = 12_000
const MAX_BLOCKS = 10

export interface StudyPlanBlockPayload {
  id: string
  title: string
  estimatedMinutes: number
  category: string
  tools?: string
  minimum?: string
}

export interface StudyPlanImportPayload {
  schemaVersion: 1
  type: 'study-plan-import'
  sourceApp: 'iris-study-os'
  sourceImportId: string
  date: string
  mode: '3h' | '5h' | '8h'
  title: string
  finishLine?: string
  blocks: StudyPlanBlockPayload[]
}

export interface StudyPlanBlockDraft extends StudyPlanBlockPayload {
  selected: boolean
  alreadyImported: boolean
}

export type StudyPlanImportParseResult =
  | { ok: true; payload: StudyPlanImportPayload }
  | { ok: false; error: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim()
  return cleaned ? cleaned.slice(0, maxLength) : undefined
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodePayload(value: string): unknown {
  if (value.length > MAX_IMPORT_PAYLOAD_LENGTH) throw new Error('Import payload is too large.')
  const decoded = decodeURIComponent(value)
  const json = decoded.trim().startsWith('{') ? decoded : decodeBase64Url(decoded)
  return JSON.parse(json) as unknown
}

function validateBlock(value: unknown, index: number): StudyPlanBlockPayload | null {
  if (!isObject(value)) return null
  const title = cleanText(value.title, 180)
  if (!title) return null
  const id = cleanText(value.id, 100) ?? `block-${index + 1}`
  const estimated = typeof value.estimatedMinutes === 'number'
    ? Math.round(value.estimatedMinutes)
    : 25
  return {
    id,
    title,
    estimatedMinutes: Math.min(180, Math.max(5, estimated)),
    category: cleanText(value.category, 80) ?? 'Study',
    tools: cleanText(value.tools, 500),
    minimum: cleanText(value.minimum, 500),
  }
}

export function validateStudyPlanImportPayload(value: unknown): StudyPlanImportParseResult {
  if (!isObject(value)) return { ok: false, error: 'Could not read this study plan.' }
  if (value.schemaVersion !== 1 || value.type !== 'study-plan-import') {
    return { ok: false, error: 'Unsupported study plan version.' }
  }
  if (value.sourceApp !== 'iris-study-os') return { ok: false, error: 'Unsupported study plan source.' }
  const sourceImportId = cleanText(value.sourceImportId, 180)
  const title = cleanText(value.title, 180)
  const mode = value.mode === '5h' || value.mode === '8h' ? value.mode : value.mode === '3h' ? '3h' : null
  const date = cleanText(value.date, 10)
  const rawBlocks = Array.isArray(value.blocks) ? value.blocks.slice(0, MAX_BLOCKS) : []
  const blocks = rawBlocks
    .map((block, index) => validateBlock(block, index))
    .filter((block): block is StudyPlanBlockPayload => Boolean(block))
  if (!sourceImportId || !title || !mode || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || blocks.length === 0) {
    return { ok: false, error: 'This study plan is missing required details.' }
  }
  return {
    ok: true,
    payload: {
      schemaVersion: 1,
      type: 'study-plan-import',
      sourceApp: 'iris-study-os',
      sourceImportId,
      date,
      mode,
      title,
      finishLine: cleanText(value.finishLine, 600),
      blocks,
    },
  }
}

export function parseStudyPlanImportFromUrl(search = window.location.search): StudyPlanImportParseResult | null {
  const raw = new URLSearchParams(search).get(STUDY_PLAN_IMPORT_PARAM)
  if (!raw) return null
  try {
    return validateStudyPlanImportPayload(decodePayload(raw))
  } catch {
    return { ok: false, error: 'Could not read this study plan.' }
  }
}

export function clearStudyPlanImportUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(STUDY_PLAN_IMPORT_PARAM)) return
  url.searchParams.delete(STUDY_PLAN_IMPORT_PARAM)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function sourceImportIdForBlock(payload: StudyPlanImportPayload, block: StudyPlanBlockPayload): string {
  return `${payload.sourceImportId}:${block.id}`
}

export function studyPlanDraft(payload: StudyPlanImportPayload): StudyPlanBlockDraft[] {
  return payload.blocks.map(block => {
    const alreadyImported = Boolean(findExternalInboxTask('iris-study-os', sourceImportIdForBlock(payload, block)))
    return { ...block, selected: true, alreadyImported }
  })
}

function taskArea(category: string): TaskArea {
  const normalized = category.toLowerCase()
  if (normalized.includes('english')) return 'English'
  if (normalized.includes('cyber')) return 'Cyber'
  if (normalized === 'ai' || normalized.includes('ai ')) return 'AI'
  if (normalized.includes('career')) return 'Job'
  if (normalized.includes('routine') || normalized.includes('body')) return 'Life reset'
  if (normalized.includes('expression')) return 'Expression Review'
  return 'Study'
}

function taskMode(area: TaskArea): TaskMode {
  if (area === 'Life reset') return 'Recovery'
  if (area === 'Expression Review' || area === 'Study') return 'Light'
  return 'Focus'
}

function taskEnergy(minutes: number, area: TaskArea): TaskEnergy {
  if (area === 'Life reset' || minutes <= 20) return 'Low'
  if (minutes <= 45) return 'Medium'
  return 'High'
}

export function importStudyPlan(
  payload: StudyPlanImportPayload,
  draft: StudyPlanBlockDraft[],
): { imported: number; alreadyExisting: number; scheduled: number; date: string } {
  const targetDate = payload.date || getLocalDateKey()
  let imported = 0
  let alreadyExisting = 0
  let scheduled = 0
  draft.filter(block => block.selected).forEach(block => {
    const area = taskArea(block.category)
    const result = createExternalInboxTask({
      title: block.title,
      estimatedMinutes: block.estimatedMinutes,
      context: 'study',
      area,
      energy: taskEnergy(block.estimatedMinutes, area),
      mode: taskMode(area),
      project: `Study OS · ${payload.title}`,
      tags: [`study-mode:${payload.mode}`, block.category.toLowerCase().replace(/\s+/g, '-')],
      nextTinyAction: block.minimum || 'Open the material and do the first visible step.',
      notes: [
        block.tools ? `Tools: ${block.tools}` : '',
        block.minimum ? `Minimum: ${block.minimum}` : '',
        payload.finishLine ? `Plan finish line: ${payload.finishLine}` : '',
      ].filter(Boolean).join('\n'),
      externalCategory: block.category,
      externalSource: 'iris-study-os',
      sourceImportId: sourceImportIdForBlock(payload, block),
    })
    if (result.created) imported += 1
    else alreadyExisting += 1
    addExternalTaskToToday(result.task, targetDate)
    scheduled += 1
  })
  return { imported, alreadyExisting, scheduled, date: targetDate }
}
