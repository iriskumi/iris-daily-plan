import { getLocalDateKey } from './focus'
import type { Task } from './types'
import { taskKindFromTask } from './taskTaxonomy'

export interface TaskScheduleDraft {
  title: string
  date: string
  startTime: string
  durationMinutes: number
  reminderMinutes: number
  notes: string
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
  if (task.deadline && isBillOrAdminTask(task)) return 24 * 60
  return taskKindFromTask(task) === 'study-work' ? 10 : 30
}

function defaultDate(task: Task): string {
  if (task.deadline) return task.deadline.slice(0, 10)
  return getLocalDateKey()
}

function defaultStartTime(task: Task): string {
  if (task.deadline && isBillOrAdminTask(task)) return '09:00'
  const hour = new Date().getHours()
  const nextHour = Math.min(20, Math.max(9, hour + 1))
  return `${String(nextHour).padStart(2, '0')}:00`
}

export function buildScheduleDraftFromTask(task: Task): TaskScheduleDraft {
  const billOrAdmin = isBillOrAdminTask(task)
  return {
    title: task.title,
    date: defaultDate(task),
    startTime: defaultStartTime(task),
    durationMinutes: defaultDuration(task),
    reminderMinutes: defaultReminderMinutes(task),
    allDay: Boolean(task.deadline && billOrAdmin && !task.deadline.includes('T')),
    notes: buildScheduleNotes(task),
  }
}

export function buildScheduleNotes(task: Task): string {
  const lines = [
    task.title,
    task.nextTinyAction ? `Next tiny action: ${task.nextTinyAction}` : null,
    task.notes?.trim() ? task.notes.trim() : null,
    'Source: Iris Daily Plan Hub',
    typeof window !== 'undefined' ? `Daily Hub: ${window.location.origin}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

export function formatScheduleDraftForCopy(draft: TaskScheduleDraft): string {
  const end = addMinutesToTime(draft.date, draft.startTime, draft.durationMinutes)
  return [
    draft.title,
    draft.allDay
      ? `Date: ${draft.date} (all day)`
      : `When: ${draft.date} ${draft.startTime} – ${end.time} (${draft.durationMinutes} min)`,
    `Reminder: ${draft.reminderMinutes} min before`,
    '',
    draft.notes,
  ].join('\n')
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
