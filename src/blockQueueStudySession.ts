import type { DayBlock } from './types'
import type { StudyActiveSession, StudyCategory } from './studyTypes'
import { loadActiveStudySession, saveActiveStudySession } from './studyStorage'
import { ensureCustomStudyTaskInTaskStore } from './taskStore'
import * as timerEngine from './timerEngine'

const STUDY_TIMER_ENGINE_KEY = 'iris-study-timer-engine-active'

function categoryForBlock(block: DayBlock): StudyCategory {
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

export function startStudySessionFromQueueBlock(block: DayBlock, durationMinutes: 25 | 50): {
  success: boolean
  message: string
  session?: StudyActiveSession
} {
  const existing = loadActiveStudySession()
  if (existing) {
    return {
      success: false,
      message: `A Study timer is already running: ${existing.title}. Finish or abandon it before starting another.`,
    }
  }

  const start = Date.now()
  const sessionId = crypto.randomUUID()
  const customTaskId = `queue-block:${block.id}`
  const title = queueSessionTitle(block, durationMinutes)
  const timerSession = timerEngine.start(
    `manual-study:${customTaskId}`,
    durationMinutes,
    'study',
    { id: sessionId, startedAt: new Date(start).toISOString() },
  )
  const session: StudyActiveSession = {
    id: sessionId,
    customTaskId,
    source: 'block-queue',
    sourceImportId: block.id,
    title,
    category: categoryForBlock(block),
    sessionStartTime: start,
    durationMinutes,
    expectedEndTime: start + durationMinutes * 60_000,
    pausedAccumulatedMs: 0,
    status: 'running',
    noteDestination: 'Obsidian/Study/Queue Sessions.md',
    notes: [
      block.notes,
      block.description,
      block.estimatedMinutes >= 90 ? `Original large task: ${block.title} (${block.estimatedMinutes} min).` : '',
      'Started from Today Block Queue. Queue presence does not count as progress; only completed timer sessions count.',
    ].filter(Boolean).join('\n'),
    resourceUsed: block.project ?? block.area,
    timerSession,
  }

  saveActiveStudySession(session)
  timerEngine.save(STUDY_TIMER_ENGINE_KEY, timerSession)
  ensureCustomStudyTaskInTaskStore({
    customTaskId,
    title,
    category: session.category,
    durationMinutes,
    noteDestination: session.noteDestination,
    notes: session.notes,
    activeSession: session,
  })

  return {
    success: true,
    message: `${durationMinutes}-min Study timer started. Complete it in Study to count the minutes.`,
    session,
  }
}
