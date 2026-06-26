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
import { getLocalDateKey } from '../focus'
import { loadDayBlockQueue, saveDayBlockQueue } from '../storage'

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

export default function BlockQueueView() {
  const [queue, setQueue] = useState<DayBlockQueue>(() => loadDayBlockQueue(getLocalDateKey()))
  const [message, setMessage] = useState<string | null>(null)

  const blocks = useMemo(
    () => [...queue.blocks].sort((a, b) => a.order - b.order),
    [queue.blocks],
  )
  const overview = queueOverview({ ...queue, blocks })
  const nextBlock = suggestNextBlock({ ...queue, blocks })
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
      blocks: blocks.map(block =>
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
      blocks: reorderBlocks(blocks, index, direction),
      updatedAt: now,
    }, 'Block order updated.')
  }

  function convertBlock(block: DayBlock) {
    const compact = minimumViableBlock(block)
    updateBlock(block.id, compact, 'Converted to a 25-minute version.')
  }

  return (
    <section className="block-queue-section" aria-label="Block Queue">
      <div className="block-queue-header">
        <div>
          <div className="section-label">Block Queue</div>
          <h3>Today’s flexible blocks</h3>
          <p>
            Use this queue when the timetable bends. Complete useful blocks and move on.
          </p>
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

      <div className="block-queue-overview">
        <div className="block-queue-stat">
          <span>{modeConfig?.label ?? 'Normal Day'}</span>
          <small>selected mode</small>
        </div>
        <div className="block-queue-stat">
          <span>{queue.targetBlocks}</span>
          <small>target blocks</small>
        </div>
        <div className="block-queue-stat">
          <span>{overview.completedBlocks}</span>
          <small>completed</small>
        </div>
        <div className="block-queue-stat">
          <span>{overview.remainingBlocks}</span>
          <small>remaining</small>
        </div>
        <div className="block-queue-stat">
          <span>{overview.completedFocusMinutes}</span>
          <small>focus minutes</small>
        </div>
        <div className="block-queue-stat">
          <span>{overview.mustDone}/{overview.mustTotal}</span>
          <small>must-do</small>
        </div>
      </div>

      <div className="block-queue-next">
        <div>
          <div className="section-label">Suggested next block</div>
          <strong>{nextBlock?.title ?? 'No active blocks left'}</strong>
          <span>
            {nextBlock
              ? `${labelFromToken(nextBlock.priority)} · ${nextBlock.estimatedMinutes} min · ${labelFromToken(nextBlock.energyLevel)} energy`
              : 'Add a task or reopen a skipped block when needed.'}
          </span>
        </div>
        {nextBlock && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => updateBlock(nextBlock.id, { status: 'in_progress' }, 'Suggested block started.')}
          >
            <Play size={14} />
            Start
          </button>
        )}
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
            return (
              <article key={block.id} className={`block-queue-card block-queue-card-${block.status}`}>
                <div className="block-queue-card-main">
                  <div className="block-queue-title-row">
                    <h4>{block.title}</h4>
                    <span className={`block-queue-status block-queue-status-${block.status}`}>
                      {statusLabel(block.status)}
                    </span>
                  </div>
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
                    {due && <span className="queue-badge">Due {due}</span>}
                    <span className="queue-badge">{subtaskProgress(block)}</span>
                    <span className="queue-badge">{labelFromToken(block.energyLevel)} energy</span>
                  </div>
                </div>

                <div className="block-queue-actions" aria-label={`Actions for ${block.title}`}>
                  <button
                    type="button"
                    onClick={() => updateBlock(block.id, { status: 'in_progress' }, 'Block started.')}
                  >
                    <Play size={13} />
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => updateBlock(block.id, { status: 'done', completedAt: new Date().toISOString() }, 'Block completed.')}
                  >
                    <Check size={13} />
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => updateBlock(block.id, { status: 'skipped' }, 'Block skipped. Move to the next useful block.')}
                  >
                    Skip
                  </button>
                  <button type="button" onClick={() => convertBlock(block)}>
                    <RotateCcw size={13} />
                    25-min
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${block.title} up`}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(index, 1)}
                    disabled={index === blocks.length - 1}
                    aria-label={`Move ${block.title} down`}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
