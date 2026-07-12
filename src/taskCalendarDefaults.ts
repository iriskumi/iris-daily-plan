import { areaFromCategory } from './focusBlocks'
import { getLocalDateKey } from './focus'
import type { Task } from './types'
import { taskKindFromTask, taskKindLabel } from './taskTaxonomy'
import { formatTaskTimeLabel, taskEffectiveDate } from './taskScheduleDisplay'

export interface TaskScheduleDraft {
  title: string
  date: string
  startTime: string
  durationMinutes: number
  reminderMinutes: number
  notes: string
  location: string
  allDay: boolean
}

function isBillOrAdminTask(task: Task): boolean {
  return task.category === 'finance-bills'
    || task.category === 'admin-life'
    || task.area === 'Admin'
}

function defaultDuration(task: Task): number {
  const estimate = task.estimatedMinutes
  if (estimate && estimate > 0) return estimate
  if (isBillOrAdminTask(task)) return 30
  return taskKindFromTask(task) === 'study-work' ? 50 : 30
}

function defaultReminderMinutes(task: Task): number {
  const effectiveDate = taskEffectiveDate(task)
  if (effectiveDate && isBillOrAdminTask(task)) return 24 * 60
  return taskKindFromTask(task) === 'study-work' ? 10 : 30
}

function defaultDate(task: Task): string {
  const effective = taskEffectiveDate(task)
  if (effective) return effective
  return getLocalDateKey()
}

function defaultStartTime(task: Task): string {
  return formatTaskTimeLabel(task.scheduledTime) ?? ''
}

export function buildScheduleDraftFromTask(task: Task): TaskScheduleDraft {
  const billOrAdmin = isBillOrAdminTask(task)
  const hasDate = Boolean(taskEffectiveDate(task))
  const hasTime = Boolean(task.scheduledTime?.trim())
  return {
    title: task.title,
    date: defaultDate(task),
    startTime: defaultStartTime(task),
    durationMinutes: defaultDuration(task),
    reminderMinutes: defaultReminderMinutes(task),
    location: task.location?.trim() ?? '',
    allDay: Boolean(hasDate && billOrAdmin && !hasTime),
    notes: buildScheduleNotes(task),
  }
}

export function buildScheduleNotes(task: Task): string {
  const kind = taskKindFromTask(task)
  const area = task.area ?? areaFromCategory(task.category)
  const lines = [
    task.nextTinyAction ? `Next tiny action: ${task.nextTinyAction}` : null,
    `Type: ${taskKindLabel(kind)}`,
    area ? `Area / tag: ${area}` : null,
    task.notes?.trim() ? task.notes.trim() : null,
    'Source: Iris Daily Plan Hub',
    typeof window !== 'undefined' ? `Daily Hub: ${window.location.origin}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

export function formatScheduleDraftForCopy(draft: TaskScheduleDraft): string {
  const end = draft.allDay
    ? null
    : addMinutesToTime(draft.date, draft.startTime, draft.durationMinutes)
  return [
    draft.title,
    draft.allDay
      ? `Date: ${draft.date} (all day)`
      : end
        ? `When: ${draft.date} ${draft.startTime} – ${end.time} (${draft.durationMinutes} min)`
        : `Date: ${draft.date} (choose a start time for a timed block)`,
    draft.location ? `Location: ${draft.location}` : null,
    `Reminder: ${draft.reminderMinutes} min before`,
    '',
    draft.notes,
  ].filter(line => line !== null).join('\n')
}

export function addMinutesToTime(date: string, startTime: string, minutes: number): { date: string; time: string } {
  const [hour, minute] = startTime.split(':').map(Number)
  const start = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
  start.setMinutes(start.getMinutes() + minutes)
  return {
    date: start.toISOString().slice(0, 10),
    time: start.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
  }
}

export function formatScheduledChipLabel(calendarStart?: string): string | null {
  if (!calendarStart) return null
  const date = new Date(calendarStart)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
