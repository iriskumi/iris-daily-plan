import { dayBlockFromTask } from './blockQueue'
import { getLocalDateKey } from './focus'
import { isActiveTask, normalizeTask } from './focusBlocks'
import { loadDayBlockQueue, loadTasks, saveDayBlockQueue, saveTasks } from './storage'
import { loadStudySessionRecordsForDate } from './studyStorage'
import type { DayBlock, Task } from './types'

export function isTaskScheduledForDate(task: Task, date = getLocalDateKey()): boolean {
  return task.scheduledForDate === date
}

export function scheduleTaskForToday(taskId: string, date = getLocalDateKey()): Task | null {
  const tasks = loadTasks()
  const index = tasks.findIndex(task => task.id === taskId)
  if (index < 0) return null
  const now = new Date().toISOString()
  const next = normalizeTask({
    ...tasks[index],
    scheduledForDate: date,
    status: tasks[index].status === 'Inbox' ? 'Planned' : tasks[index].status,
    updatedAt: now,
  })
  tasks[index] = next
  saveTasks(tasks)
  ensureQueueBlockForTask(next, date)
  return next
}

export function unscheduleTaskFromToday(taskId: string, date = getLocalDateKey()): void {
  const tasks = loadTasks()
  const index = tasks.findIndex(task => task.id === taskId)
  if (index >= 0 && tasks[index].scheduledForDate === date) {
    tasks[index] = {
      ...tasks[index],
      scheduledForDate: undefined,
      updatedAt: new Date().toISOString(),
    }
    saveTasks(tasks)
  }
  const queue = loadDayBlockQueue(date)
  saveDayBlockQueue({
    ...queue,
    blocks: queue.blocks.map(block =>
      block.sourceTaskId === taskId
        ? {
            ...block,
            hiddenToday: true,
            hiddenTodayReason: 'removed' as const,
            hiddenTodayAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : block,
    ),
    updatedAt: new Date().toISOString(),
  })
}

export function ensureQueueBlockForTask(task: Task, date = getLocalDateKey()): DayBlock {
  const queue = loadDayBlockQueue(date)
  const existing = queue.blocks.find(
    block => block.sourceTaskId === task.id && !block.hiddenToday,
  )
  if (existing) return existing
  const now = new Date().toISOString()
  const nextOrder = queue.blocks.reduce((max, block) => Math.max(max, block.order), -1) + 1
  const block = {
    ...dayBlockFromTask(task, date, nextOrder),
    unifiedTaskId: task.id,
    hiddenToday: false,
    updatedAt: now,
  }
  saveDayBlockQueue({
    ...queue,
    blocks: [...queue.blocks.filter(item => item.sourceTaskId !== task.id), block],
    updatedAt: now,
  })
  return block
}

export function tasksEligibleForQueueMerge(tasks: Task[], date: string, existingBlocks: DayBlock[]): Task[] {
  const existingTaskIds = new Set(
    existingBlocks
      .filter(block => block.sourceTaskId && !block.hiddenToday)
      .map(block => block.sourceTaskId as string),
  )
  return tasks
    .map(normalizeTask)
    .filter(task => {
      if (!isActiveTask(task)) return false
      if (isTaskScheduledForDate(task, date)) return true
      if (existingTaskIds.has(task.id)) return true
      return false
    })
}

export function markQueueBlockDoneFromSession(
  linkedBlockId: string | undefined,
  date = getLocalDateKey(),
): boolean {
  if (!linkedBlockId) return false
  const queue = loadDayBlockQueue(date)
  const block = queue.blocks.find(item => item.id === linkedBlockId)
  if (!block || block.status === 'done') return false
  const now = new Date().toISOString()
  saveDayBlockQueue({
    ...queue,
    blocks: queue.blocks.map(item =>
      item.id === linkedBlockId
        ? { ...item, status: 'done' as const, completedAt: now, updatedAt: now }
        : item,
    ),
    updatedAt: now,
  })
  return true
}

export function completedStudyMinutesForDate(date = getLocalDateKey()): number {
  return loadStudySessionRecordsForDate(date)
    .filter(session => session.status === 'completed')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
}
