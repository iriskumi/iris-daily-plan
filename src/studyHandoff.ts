import type { StudyCategory } from './studyTypes'
import type { DayBlock } from './types'

const STUDY_HANDOFF_KEY = 'iris-study-selected-task-handoff'

export interface StudyTaskHandoff {
  selectedStudyTaskId: string
  source: 'plan-queue' | 'today-queue'
  linkedQueueBlockId?: string
  title: string
  category: StudyCategory
  durationMinutes: number
  noteDestination: string
  notes: string
  resourceUsed: string
  createdAt: string
}

export function studyCategoryForQueueBlock(block: DayBlock): StudyCategory {
  if (block.area === 'english') return block.type === 'output' ? 'English Output' : 'English Input'
  if (block.area === 'japanese') return 'Japanese'
  if (block.area === 'ai_project') return 'AI Coding'
  if (block.area === 'sql_data') return 'SQL / Excel'
  if (block.area === 'work_admin') return 'Job / Career'
  if (block.area === 'life_admin') return 'Admin / Life'
  if (block.area === 'cyber') return 'Cyber'
  if (block.area === 'health' || block.type === 'recovery') return 'Reset'
  return 'Review / NotebookLM'
}

export function queueSessionTitle(block: DayBlock, durationMinutes = 25): string {
  const compactAiAgentsTitle = block.title.toLowerCase().includes('ai agents')
  if (compactAiAgentsTitle) return `AI Agents course - ${durationMinutes}-min pass`
  if (block.estimatedMinutes >= 90) return `First ${durationMinutes} min: ${block.title}`
  return block.title
}

export function createStudyHandoffFromQueueBlock(
  block: DayBlock,
  source: StudyTaskHandoff['source'],
): StudyTaskHandoff {
  const durationMinutes = Math.min(50, Math.max(25, block.estimatedMinutes >= 90 ? 25 : block.estimatedMinutes))
  return {
    selectedStudyTaskId: block.unifiedTaskId ?? block.sourceTaskId ?? `queue-block:${block.id}`,
    source,
    linkedQueueBlockId: block.id,
    title: queueSessionTitle(block, 25),
    category: studyCategoryForQueueBlock(block),
    durationMinutes,
    noteDestination: 'Obsidian/Study/Queue Sessions.md',
    notes: [
      block.notes,
      block.description,
      block.estimatedMinutes >= 90 ? `Original large task: ${block.title} (${block.estimatedMinutes} min).` : '',
      'Plan chose this task. Study runs the timer and completion record.',
    ].filter(Boolean).join('\n'),
    resourceUsed: block.project ?? block.area,
    createdAt: new Date().toISOString(),
  }
}

export function saveStudyTaskHandoff(handoff: StudyTaskHandoff): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(STUDY_HANDOFF_KEY, JSON.stringify(handoff))
  sessionStorage.setItem('iris-study-focus-target', 'timer')
}

export function consumeStudyTaskHandoff(): StudyTaskHandoff | null {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(STUDY_HANDOFF_KEY)
  if (!raw) return null
  sessionStorage.removeItem(STUDY_HANDOFF_KEY)
  try {
    const parsed = JSON.parse(raw) as Partial<StudyTaskHandoff>
    if (!parsed.selectedStudyTaskId || !parsed.title || !parsed.category) return null
    return {
      selectedStudyTaskId: parsed.selectedStudyTaskId,
      source: parsed.source === 'plan-queue' ? 'plan-queue' : 'today-queue',
      linkedQueueBlockId: parsed.linkedQueueBlockId,
      title: parsed.title,
      category: parsed.category as StudyCategory,
      durationMinutes: parsed.durationMinutes ?? 25,
      noteDestination: parsed.noteDestination ?? 'Obsidian/Study/Queue Sessions.md',
      notes: parsed.notes ?? '',
      resourceUsed: parsed.resourceUsed ?? '',
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}
