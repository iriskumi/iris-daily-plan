import type { Task } from './types'

export function taskEffectiveDate(task: Pick<Task, 'scheduledDate' | 'deadline'>): string | undefined {
  const raw = task.scheduledDate ?? task.deadline
  return raw?.slice(0, 10) || undefined
}

export function formatTaskDateLabel(date?: string): string | null {
  if (!date) return null
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function formatTaskTimeLabel(time?: string): string | null {
  if (!time?.trim()) return null
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
  return time.trim().slice(0, 5)
}

export function formatTaskWhenLine(task: Pick<Task, 'scheduledDate' | 'deadline' | 'scheduledTime'>): string | null {
  const date = formatTaskDateLabel(taskEffectiveDate(task))
  const time = formatTaskTimeLabel(task.scheduledTime)
  if (date && time) return `${date} · ${time}`
  if (date) return date
  if (time) return time
  return null
}

export function formatTaskLocationLine(task: Pick<Task, 'location'>): string | null {
  const location = task.location?.trim()
  return location || null
}

export function queueTitleWithSchedule(
  title: string,
  scheduledTime?: string,
  options?: { largeTask?: boolean; sessionTitle?: string },
): string {
  if (options?.largeTask && options.sessionTitle) return options.sessionTitle
  const time = formatTaskTimeLabel(scheduledTime)
  return time ? `${time} · ${title}` : title
}
