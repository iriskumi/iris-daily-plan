import { ArrowDown, ArrowUp, Check, Clock, Play, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { BlockTaskStatus, DayBlock, DayBlockQueue, DayMode } from '../types'
import {
  DAY_MODES,
  minimumViableBlock,
  queueOverview,
  suggestNextBlock,
  targetBlocksForMode,
} from '../blockQueue'
import { createStudyHandoffFromQueueBlock, queueSessionTitle, saveStudyTaskHandoff } from '../studyHandoff'
import { startStudySessionFromQueueBlock } from '../blockQueueStudySession'
import { getLocalDateKey } from '../focus'
import { loadDayBlockQueue, loadTasks, saveDayBlockQueue } from '../storage'
import { loadStudySessionRecordsForDate } from '../studyStorage'
import { clearBlockQueueScheduleInTaskStore } from '../taskStore'
import { formatTaskLocationLine, queueTitleWithSchedule } from '../taskScheduleDisplay'

function labelFromToken(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function dueDateLabel(value?: string): string | null {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
}

function statusLabel(status: BlockTaskStatus): string {
  if (status === 'not_started') return 'Not started'
  if (status === 'in_progress') return 'In progress'
  return labelFromToken(status)
}

function subtaskProgress(block: DayBlock): string {
  if (block.subtasks.length === 0) return 'No subtasks'
  const done = block.subtasks.filter(task => task.done).length
  return `${done}/${block.subtasks.length} subtasks`
}

function reorderBlocks(blocks: DayBlock[], index: number, direction: -1 | 1): DayBlock[] {
  const next = [...blocks].sort((a, b) => a.order - b.order)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= next.length) return next
  const [moved] = next.splice(index, 1)
  next.splice(targetIndex, 0, moved)
  return next.map((block, order) => ({
    ...block,
    order,
    updatedAt: new Date().toISOString(),
  }))
}

export default function BlockQueueView({ onOpenStudy }: { onOpenStudy?: () => void }) {
  const [queue, setQueue] = useState<DayBlockQueue>(() => loadDayBlockQueue(getLocalDateKey()))
  const [message, setMessage] = useState<string | null>(null)

  const sortedBlocks = useMemo(
    () => [...queue.blocks].sort((a, b) => a.order - b.order),
    [queue.blocks],
  )
  const blocks = useMemo(
    () => sortedBlocks.filter(block => !block.hiddenToday),
    [sortedBlocks],
  )
  const completedStudyMinutes = useMemo(
    () => loadStudySessionRecordsForDate(queue.date)
      .filter(session => session.status === 'completed')
      .reduce((sum, session) => sum + session.actualMinutes, 0),
    [queue.date, message],
  )
  const overview = queueOverview({ ...queue, blocks }, completedStudyMinutes)
  const nextBlock = suggestNextBlock({ ...queue, blocks })
  const taskById = useMemo(
    () => new Map(loadTasks().map(task => [task.id, task])),
    [queue.blocks, message],
  )
  const modeConfig = DAY_MODES.find(mode => mode.id === queue.mode)

  function persist(nextQueue: DayBlockQueue, nextMessage?: string) {
    saveDayBlockQueue(nextQueue)
    setQueue(loadDayBlockQueue(nextQueue.date))
    setMessage(nextMessage ?? null)
  }

  function updateBlock(blockId: string, patch: Partial<DayBlock>, nextMessage: string) {
    const now = new Date().toISOString()
    persist({
      ...queue,
      blocks: queue.blocks.map(block =>
        block.id === blockId
          ? { ...block, ...patch, updatedAt: now }
          : block,
      ),
      updatedAt: now,
    }, nextMessage)
  }

  function changeMode(mode: DayMode) {
    const now = new Date().toISOString()
    persist({
      ...queue,
      mode,
      targetBlocks: targetBlocksForMode(mode),
      updatedAt: now,
    }, `${DAY_MODES.find(item => item.id === mode)?.label ?? 'Day mode'} selected.`)
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const now = new Date().toISOString()
    persist({
      ...queue,
      blocks: [
        ...reorderBlocks(blocks, index, direction),
        ...sortedBlocks.filter(block => block.hiddenToday),
      ],
      updatedAt: now,
    }, 'Block order updated.')
  }

  function convertBlock(block: DayBlock) {
    const compact = minimumViableBlock(block)
    updateBlock(block.id, compact, 'Converted to a 25-minute version.')
  }

  function openQueueBlockInStudy(block: DayBlock) {
    saveStudyTaskHandoff(createStudyHandoffFromQueueBlock(block, 'plan-queue'))
    setMessage('Opened in Study. Choose 25, 50, or custom there.')
    onOpenStudy?.()
  }

  function completeWithoutTimer(block: DayBlock) {
    updateBlock(block.id, { status: 'done', completedAt: new Date().toISOString() }, 'Marked done without timer. No focus minutes were added.')
  }

  function hideBlockForToday(block: DayBlock, reason: 'later' | 'removed') {
    const now = new Date().toISOString()
    clearBlockQueueScheduleInTaskStore(block, 'todo')
    persist({
      ...queue,
      blocks: queue.blocks.map(item => item.id === block.id
        ? {
            ...item,
            hiddenToday: true,
            hiddenTodayReason: reason,
            hiddenTodayAt: now,
            updatedAt: now,
          }
        : item,
      ),
      updatedAt: now,
    }, reason === 'later'
      ? 'Moved out of today. It stays in your task store for later.'
      : 'Removed from today. It stays saved, but no longer belongs to today’s queue.')
  }

  return (
    <section className="block-queue-section" aria-label="Block Queue">
      <div className="block-queue-header">
        <div>
          <div className="section-label">Block Queue</div>
          <h3>Today’s flexible blocks</h3>
          <p>Pick the next block, start in Study. Plan decides what; Study runs the timer.</p>
        </div>
        <div className="block-queue-mode">
          <label htmlFor="day-mode-select">Day mode</label>
          <select
            id="day-mode-select"
            value={queue.mode}
            onChange={event => changeMode(event.target.value as DayMode)}
          >
            {DAY_MODES.map(mode => (
              <option key={mode.id} value={mode.id}>
                {mode.label} · {mode.targetRange ?? mode.targetBlocks}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="block-queue-next block-queue-next-hero">
        <div>
          <div className="section-label">Start here</div>
          <strong>
            {nextBlock
              ? queueTitleWithSchedule(nextBlock.title, nextBlock.sourceTaskId ? taskById.get(nextBlock.sourceTaskId)?.scheduledTime : undefined, {
                  largeTask: nextBlock.estimatedMinutes >= 90,
                  sessionTitle: queueSessionTitle(nextBlock, 25),
                })
              : 'No active blocks left'}
          </strong>
          {nextBlock?.sourceTaskId && formatTaskLocationLine(taskById.get(nextBlock.sourceTaskId) ?? {}) && (
            <span className="block-queue-location-line">
              {formatTaskLocationLine(taskById.get(nextBlock.sourceTaskId) ?? {})}
            </span>
          )}
          <span>
            {nextBlock
              ? `${labelFromToken(nextBlock.priority)} · ${nextBlock.estimatedMinutes} min · ${labelFromToken(nextBlock.energyLevel)} energy${nextBlock.estimatedMinutes >= 90 ? ' · Large task' : ''}`
              : 'Add a task from Tasks, then return here.'}
          </span>
        </div>
        {nextBlock && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const result = startStudySessionFromQueueBlock(nextBlock, 25)
                setMessage(result.message)
              }}
            >
              <Play size={14} />
              Start 25 min
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openQueueBlockInStudy(nextBlock)}
            >
              Custom in Study
            </button>
          </>
        )}
      </div>

      <div className="block-queue-overview block-queue-overview-compact">
        <div className="block-queue-stat">
          <span>{overview.completedBlocks}/{queue.targetBlocks}</span>
          <small>blocks done</small>
        </div>
        <div className="block-queue-stat">
          <span>{completedStudyMinutes}</span>
          <small>session min</small>
        </div>
        <div className="block-queue-stat">
          <span>{overview.mustDone}/{overview.mustTotal}</span>
          <small>must-do</small>
        </div>
        <div className="block-queue-stat">
          <span>{modeConfig?.label ?? 'Normal Day'}</span>
          <small>mode</small>
        </div>
      </div>

      {message && <div className="block-queue-message">{message}</div>}

      <div className="block-queue-list">
        {blocks.length === 0 ? (
          <div className="block-queue-empty">
            <Clock size={22} />
            <p>No queue blocks yet. Add active tasks, then return here.</p>
          </div>
        ) : (
          blocks.map((block, index) => {
            const due = dueDateLabel(block.dueDate)
            const sourceTask = block.sourceTaskId ? taskById.get(block.sourceTaskId) : undefined
            const displayTitle = queueTitleWithSchedule(block.title, sourceTask?.scheduledTime, {
              largeTask: block.estimatedMinutes >= 90,
              sessionTitle: queueSessionTitle(block, 25),
            })
            const locationLine = sourceTask ? formatTaskLocationLine(sourceTask) : null
            return (
              <article key={block.id} className={`block-queue-card block-queue-card-${block.status}`}>
                <div className="block-queue-card-main">
                  <div className="block-queue-title-row">
                    <h4>{displayTitle}</h4>
                    <span className={`block-queue-status block-queue-status-${block.status}`}>
                      {statusLabel(block.status)}
                    </span>
                  </div>
                  {locationLine && <p className="block-queue-location-line">{locationLine}</p>}
                  {block.description && <p>{block.description}</p>}
                  <div className="block-queue-badges">
                    <span className={`queue-badge queue-badge-priority-${block.priority}`}>
                      {block.priority}
                    </span>
                    <span className={`queue-badge queue-badge-type-${block.type}`}>
                      {labelFromToken(block.type)}
                    </span>
                    <span className="queue-badge">{labelFromToken(block.area)}</span>
                    {block.project && <span className="queue-badge">{block.project}</span>}
                    <span className="queue-badge">{block.estimatedMinutes} min</span>
                    {block.estimatedMinutes >= 90 && <span className="queue-badge">Large task</span>}
                    {due && <span className="queue-badge">Due {due}</span>}
                    <span className="queue-badge">{subtaskProgress(block)}</span>
                    <span className="queue-badge">{labelFromToken(block.energyLevel)} energy</span>
                  </div>
                </div>

                {block.estimatedMinutes >= 90 && (
                  <p>Original task: {block.title}. Start with one 25-minute pass; the whole task does not need to be finished today.</p>
                )}

                <div className="block-queue-actions" aria-label={`Actions for ${block.title}`}>
                  <button
                    type="button"
                    className="block-queue-action-primary"
                    onClick={() => {
                      const result = startStudySessionFromQueueBlock(block, 25)
                      setMessage(result.message)
                    }}
                  >
                    <Play size={13} />
                    Start 25 min
                  </button>
                  <button type="button" onClick={() => openQueueBlockInStudy(block)}>
                    <Play size={13} />
                    Open in Study
                  </button>
                  <button type="button" onClick={() => completeWithoutTimer(block)}>
                    <Check size={13} />
                    Done
                  </button>
                  <details className="block-queue-actions-more">
                    <summary>More</summary>
                    <div className="block-queue-actions-secondary">
                      <button type="button" onClick={() => hideBlockForToday(block, 'later')}>Later</button>
                      <button type="button" onClick={() => updateBlock(block.id, { status: 'skipped' }, 'Block skipped. Move to the next useful block.')}>Skip</button>
                      <button type="button" onClick={() => convertBlock(block)}><RotateCcw size={13} />Convert to 25 min</button>
                      <button type="button" onClick={() => hideBlockForToday(block, 'removed')}>Remove from today</button>
                      <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label={`Move ${block.title} up`}><ArrowUp size={13} /></button>
                      <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} aria-label={`Move ${block.title} down`}><ArrowDown size={13} /></button>
                    </div>
                  </details>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
