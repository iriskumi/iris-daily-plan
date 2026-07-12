import type {
  BlockTaskArea,
  BlockTaskEnergyLevel,
  BlockTaskPriority,
  BlockTaskStatus,
  BlockTaskType,
  DayBlock,
  DayBlockQueue,
  DayMode,
  DayModeConfig,
  Task,
  TaskArea,
  TaskEnergy,
  TaskMode,
} from './types'
import { getDaysUntil } from './planner'
import { normalizeTask } from './focusBlocks'
import { tasksEligibleForQueueMerge } from './queueTaskHelpers'

export const DAY_MODE_CONFIGS: Record<DayMode, DayModeConfig> = {
  'full-day': {
    id: 'full-day',
    label: 'Full Day',
    targetBlocks: 6,
    description: 'Best for early starts, steady energy, and a full study/work rhythm.',
  },
  'normal-day': {
    id: 'normal-day',
    label: 'Normal Day',
    targetBlocks: 5,
    description: 'The default flexible queue for most days.',
  },
  'late-start-day': {
    id: 'late-start-day',
    label: 'Late Start Day',
    targetBlocks: 4,
    targetRange: '3-4',
    description: 'Keeps the day useful when the first real block starts around midday.',
  },
  'rescue-day': {
    id: 'rescue-day',
    label: 'Rescue Day',
    targetBlocks: 2,
    targetRange: '1-2',
    description: 'A minimum viable day for low energy or disrupted starts.',
  },
  'evening-class': {
    id: 'evening-class',
    label: 'Evening Class',
    targetBlocks: 3,
    description: 'Protect class energy and keep the queue lighter.',
  },
  'saturday-class': {
    id: 'saturday-class',
    label: 'Saturday Class',
    targetBlocks: 3,
    targetRange: '2-3',
    description: 'A class-day queue with fewer extra blocks.',
  },
  'work-shift': {
    id: 'work-shift',
    label: 'Work Shift',
    targetBlocks: 3,
    targetRange: '2-3',
    description: 'A realistic queue around work energy and time.',
  },
  'admin-catchup': {
    id: 'admin-catchup',
    label: 'Admin Catch-Up',
    targetBlocks: 3,
    description: 'A practical queue for admin, life reset, and loose ends.',
  },
}

export const DAY_MODES = Object.values(DAY_MODE_CONFIGS)

export function suggestDayMode(now = new Date()): DayMode {
  const hour = now.getHours() + now.getMinutes() / 60
  if (hour < 10) return 'normal-day'
  if (hour < 12) return 'normal-day'
  if (hour < 14) return 'late-start-day'
  return 'rescue-day'
}

export function targetBlocksForMode(mode: DayMode): number {
  return DAY_MODE_CONFIGS[mode].targetBlocks
}

function taskAreaToBlockArea(area?: TaskArea): BlockTaskArea {
  if (area === 'Cyber') return 'cyber'
  if (area === 'AI' || area === 'Vibe Coding') return 'ai_project'
  if (area === 'English' || area === 'Expression Review') return 'english'
  if (area === 'Job') return 'work_admin'
  if (area === 'Admin') return 'life_admin'
  if (area === 'Life reset') return 'health'
  if (area === 'Study') return 'reading'
  return 'other'
}

function taskModeToBlockType(mode?: TaskMode, area?: TaskArea): BlockTaskType {
  if (mode === 'Admin') return 'admin'
  if (mode === 'Recovery') return 'recovery'
  if (mode === 'Light') return 'low_input'
  if (area === 'English' || area === 'Expression Review') return 'output'
  return 'deep_work'
}

function taskEnergyToBlockEnergy(energy?: TaskEnergy): BlockTaskEnergyLevel {
  if (energy === 'High') return 'high'
  if (energy === 'Low') return 'low'
  return 'medium'
}

function taskStatusToBlockStatus(task: Task): BlockTaskStatus {
  if (task.done || task.status === 'Done') return 'done'
  if (task.status === 'Doing') return 'in_progress'
  if (task.status === 'Skipped') return 'skipped'
  return 'not_started'
}

function taskPriority(task: Task): BlockTaskPriority {
  if (task.priority) return task.priority
  if (task.urgency === 'high' || task.importance === 'high') return 'must'
  if (task.urgency === 'medium' || task.importance === 'medium') return 'should'
  return 'could'
}

function dueDateForTask(task: Task): string | undefined {
  return task.dueDate ?? task.deadline
}

function blockTagsForTask(task: Task): string[] {
  const tags = new Set<string>(task.tags ?? [])
  tags.add(task.category)
  if (task.area) tags.add(task.area)
  return [...tags].filter(Boolean)
}

export function dayBlockFromTask(task: Task, date: string, order: number): DayBlock {
  const normalized = normalizeTask(task)
  const dueDate = dueDateForTask(normalized)
  return {
    id: `queue-${date}-${normalized.id}`,
    sourceTaskId: normalized.id,
    date,
    title: normalized.title,
    description: normalized.description ?? normalized.nextTinyAction ?? normalized.nextAction,
    notes: normalized.notes,
    type: taskModeToBlockType(normalized.mode, normalized.area),
    area: taskAreaToBlockArea(normalized.area),
    project: normalized.project,
    priority: taskPriority(normalized),
    energyLevel: taskEnergyToBlockEnergy(normalized.energy),
    estimatedMinutes: normalized.estimatedMinutes,
    dueDate,
    status: taskStatusToBlockStatus(normalized),
    subtasks: normalized.subtasks ?? (normalized.checklist ?? []).map((title, index) => ({
      id: `${normalized.id}-subtask-${index}`,
      title,
      done: false,
    })),
    tags: blockTagsForTask(normalized),
    order,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt ?? normalized.createdAt,
    completedAt: normalized.completedAt,
    skippedReason: normalized.skippedReason,
  }
}

export function sortBlocksForQueue(blocks: DayBlock[]): DayBlock[] {
  const priorityRank: Record<BlockTaskPriority, number> = { must: 0, should: 1, could: 2 }
  const statusRank: Record<BlockTaskStatus, number> = {
    in_progress: 0,
    not_started: 1,
    skipped: 2,
    done: 3,
  }
  return [...blocks]
    .sort((a, b) => {
      const statusScore = statusRank[a.status] - statusRank[b.status]
      if (statusScore !== 0) return statusScore
      const priorityScore = priorityRank[a.priority] - priorityRank[b.priority]
      if (priorityScore !== 0) return priorityScore
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (a.dueDate && !b.dueDate) return -1
      if (!a.dueDate && b.dueDate) return 1
      return a.order - b.order
    })
    .map((block, index) => ({ ...block, order: index }))
}

export function createDayBlockQueue(input: {
  date: string
  mode?: DayMode
  tasks: Task[]
  now?: Date
}): DayBlockQueue {
  const now = input.now ?? new Date()
  const suggestedMode = suggestDayMode(now)
  const mode = input.mode ?? suggestedMode
  const eligibleTasks = tasksEligibleForQueueMerge(input.tasks, input.date, [])
  const activeBlocks = eligibleTasks.map((task, index) => dayBlockFromTask(task, input.date, index))

  const blocks = sortBlocksForQueue(activeBlocks)
  const createdAt = now.toISOString()
  return {
    date: input.date,
    mode,
    suggestedMode,
    currentEnergy: 'medium',
    mainFocus: undefined,
    targetBlocks: targetBlocksForMode(mode),
    blocks,
    createdAt,
    updatedAt: createdAt,
  }
}

export function mergeQueueWithTasks(queue: DayBlockQueue, tasks: Task[]): DayBlockQueue {
  const existingByTaskId = new Map(
    queue.blocks
      .filter(block => block.sourceTaskId)
      .map(block => [block.sourceTaskId as string, block]),
  )
  const now = new Date().toISOString()
  const highestOrder = queue.blocks.reduce((max, block) => Math.max(max, block.order), -1)
  let nextOrder = highestOrder + 1
  const eligibleTasks = tasksEligibleForQueueMerge(tasks, queue.date, queue.blocks)
  const migratedBlocks = eligibleTasks.map((task, index): DayBlock => {
    const existing = existingByTaskId.get(task.id)
    if (existing?.hiddenToday) return existing
    const migrated = dayBlockFromTask(task, queue.date, existing ? existing.order : nextOrder + index)
    return existing
      ? {
          ...migrated,
          ...existing,
          title: existing.title || migrated.title,
          updatedAt: existing.updatedAt || migrated.updatedAt,
        }
      : migrated
  })

  const manualBlocks = queue.blocks.filter(block => !block.sourceTaskId)
  return {
    ...queue,
    blocks: [...migratedBlocks, ...manualBlocks].sort((a, b) => a.order - b.order),
    updatedAt: now,
  }
}

export function suggestNextBlock(
  queue: DayBlockQueue,
  now = new Date(),
  options: { currentEnergy?: DayBlockQueue['currentEnergy']; mainFocus?: BlockTaskArea } = {},
): DayBlock | null {
  const afterFive = now.getHours() >= 17
  const candidates = sortBlocksForQueue(
    queue.blocks.filter(block => block.status === 'not_started' || block.status === 'in_progress'),
  )
  if (candidates.length === 0) return null

  const currentEnergy = options.currentEnergy ?? queue.currentEnergy
  const mainFocus = options.mainFocus ?? queue.mainFocus
  const priorityScore: Record<BlockTaskPriority, number> = { must: 90, should: 55, could: 25 }
  const preferredLightTypes: BlockTaskType[] = ['low_input', 'study', 'review', 'admin', 'recovery']
  const highOutputTypes: BlockTaskType[] = ['deep_work', 'output']

  function score(block: DayBlock): number {
    let value = priorityScore[block.priority] - block.order
    if (block.status === 'in_progress') value += 45
    if (mainFocus && block.area === mainFocus) value += 42
    if (block.dueDate) {
      const days = getDaysUntil(block.dueDate, now)
      if (days < 0) value += 45
      else if (days === 0) value += 35
      else if (days <= 3) value += 18
    }

    if (currentEnergy === 'low') {
      if (preferredLightTypes.includes(block.type)) value += 36
      if (block.energyLevel === 'low') value += 24
      if (block.energyLevel === 'high' || highOutputTypes.includes(block.type)) value -= 35
    }

    if (currentEnergy === 'medium' && block.energyLevel === 'medium') value += 12

    if (currentEnergy === 'high') {
      if (highOutputTypes.includes(block.type)) value += 20
      if (block.energyLevel === 'high') value += 10
    }

    if (queue.mode === 'rescue-day') {
      if (block.priority === 'could') value -= 25
      if (preferredLightTypes.includes(block.type) || block.energyLevel === 'low') value += 40
      if (block.energyLevel === 'high') value -= 40
    }

    if (queue.mode === 'admin-catchup') {
      if (block.type === 'admin' || block.area === 'life_admin' || block.area === 'work_admin') value += 45
      if (highOutputTypes.includes(block.type)) value -= 18
    }

    if (queue.mode === 'evening-class' || queue.mode === 'saturday-class' || queue.mode === 'work-shift') {
      if (preferredLightTypes.includes(block.type)) value += 18
      if (block.energyLevel === 'high' && block.priority !== 'must') value -= 16
    }

    if (afterFive) {
      if (preferredLightTypes.includes(block.type) || block.area === 'reading') value += 30
      if (highOutputTypes.includes(block.type) && block.priority !== 'must') value -= 22
    }

    return value
  }

  return [...candidates].sort((a, b) => score(b) - score(a))[0]
}

export function minimumViableBlock(block: DayBlock): DayBlock {
  const now = new Date().toISOString()
  return {
    ...block,
    title: `${block.title} - 25 min version`,
    estimatedMinutes: Math.min(block.estimatedMinutes, 25),
    energyLevel: block.energyLevel === 'high' ? 'medium' : block.energyLevel,
    description: block.description
      ? `${block.description}\nMinimum viable version: do only the first useful step.`
      : 'Minimum viable version: do only the first useful step.',
    updatedAt: now,
  }
}

export function queueOverview(
  queue: DayBlockQueue,
  sessionMinutesToday = 0,
): {
  completedBlocks: number
  remainingBlocks: number
  completedFocusMinutes: number
  mustDone: number
  mustTotal: number
  markedDoneWithoutTimer: number
} {
  const visibleBlocks = queue.blocks.filter(block => !block.hiddenToday)
  const doneBlocks = visibleBlocks.filter(block => block.status === 'done')
  const mustBlocks = visibleBlocks.filter(block => block.priority === 'must')
  return {
    completedBlocks: doneBlocks.length,
    remainingBlocks: visibleBlocks.filter(block => block.status !== 'done' && block.status !== 'skipped').length,
    completedFocusMinutes: sessionMinutesToday,
    mustDone: mustBlocks.filter(block => block.status === 'done').length,
    mustTotal: mustBlocks.length,
    markedDoneWithoutTimer: doneBlocks.length,
  }
}

export function dueDateBucket(block: DayBlock, today: Date = new Date()): 'overdue' | 'today' | 'upcoming' | 'none' {
  if (!block.dueDate) return 'none'
  const days = getDaysUntil(block.dueDate, today)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  return 'upcoming'
}
