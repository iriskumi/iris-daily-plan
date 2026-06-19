import type {
  FocusBlock,
  MealAnchor,
  NextBlockRecommendation,
  Task,
  TaskArea,
  TaskCategory,
  TaskEnergy,
  TaskMode,
  TaskStatus,
} from './types'
import { localDateString } from './focus'
import { DURATION_OPTIONS } from './durations'

export const TASK_AREAS: TaskArea[] = [
  'Cyber',
  'AI',
  'Vibe Coding',
  'Job',
  'English',
  'Admin',
  'Life reset',
  'Expression Review',
  'Study',
  'Other',
]

export const TASK_ENERGIES: TaskEnergy[] = ['Low', 'Medium', 'High']
export const TASK_MODES: TaskMode[] = ['Focus', 'Light', 'Admin', 'Recovery']
export const TASK_STATUSES: TaskStatus[] = ['Inbox', 'Planned', 'Doing', 'Done', 'Skipped', 'Archived']
export const ACTIVE_TASK_STATUSES: TaskStatus[] = ['Inbox', 'Planned']
export const BLOCK_LENGTHS = DURATION_OPTIONS.map(minutes => ({
  minutes,
  label: `${minutes} min`,
}))

export function areaFromCategory(category: TaskCategory): TaskArea {
  if (category === 'cyber-study' || category === 'assessment') return 'Cyber'
  if (category === 'ai') return 'AI'
  if (category === 'job-search' || category === 'consulting-freelance') return 'Job'
  if (category === 'english-practice' || category === 'japanese-practice') return 'English'
  if (category === 'admin-life' || category === 'finance-bills' || category === 'work-shift') return 'Admin'
  if (category === 'recovery' || category === 'exercise') return 'Life reset'
  return 'Other'
}

export function normalizeArea(area?: string): TaskArea {
  return TASK_AREAS.includes(area as TaskArea) ? area as TaskArea : 'Other'
}

export function categoryFromArea(area: TaskArea): TaskCategory {
  if (area === 'Cyber') return 'cyber-study'
  if (area === 'AI') return 'ai'
  if (area === 'Vibe Coding') return 'ai'
  if (area === 'Job') return 'job-search'
  if (area === 'English') return 'english-practice'
  if (area === 'Admin') return 'admin-life'
  if (area === 'Life reset') return 'recovery'
  if (area === 'Expression Review') return 'english-practice'
  if (area === 'Study') return 'assessment'
  return 'admin-life'
}

export function modeFromArea(area: TaskArea): TaskMode {
  if (area === 'Admin') return 'Admin'
  if (area === 'Life reset') return 'Recovery'
  if (area === 'Expression Review') return 'Light'
  if (area === 'Study') return 'Light'
  return 'Focus'
}

export function energyFromMinutes(minutes: number): TaskEnergy {
  if (minutes <= 15) return 'Low'
  if (minutes <= 25) return 'Medium'
  return 'High'
}

export function normalizedBlockMinutes(minutes?: number): number {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return 25
  return Math.round(minutes)
}

export function tinyActionForArea(area: TaskArea): string {
  if (area === 'Cyber') return 'Open the relevant notes, glossary, or screenshots folder.'
  if (area === 'AI') return 'Open the AI note, news item, or tool page and capture only 3 useful points.'
  if (area === 'Vibe Coding') return 'Write one English sentence: Today I will fix/build/test...'
  if (area === 'Job') return 'Open the JD and highlight 3 requirements only.'
  if (area === 'English') return 'Write or say one sentence only.'
  if (area === 'Admin') return 'Open the relevant email, form, or page only.'
  if (area === 'Life reset') return 'Get water, wash face, or clear one small surface first.'
  if (area === 'Expression Review') return 'Review 5 entries only. Do not add new entries.'
  if (area === 'Study') return 'Open the study material and read the first section only.'
  return 'Open the relevant file and do only the first visible step for 5 minutes.'
}

export function tinyActionForTask(title: string, area: TaskArea): string {
  const normalizedTitle = title.toLowerCase()
  if (/\b(sdlc|vibe coding|article|reading)\b/i.test(normalizedTitle)) {
    return 'Open the reading or note and highlight 3 useful points only. Do not summarise yet.'
  }
  if (/\b(screenshot|gophish|test case)\b/i.test(normalizedTitle)) {
    return 'Open the screenshots folder and sort screenshots by test case only.'
  }
  if (/\b(jd|job|resume)\b/i.test(normalizedTitle)) {
    return 'Open the JD and highlight 3 requirements only.'
  }
  if (/\b(email|reply|timesheet)\b/i.test(normalizedTitle)) {
    return 'Open the draft and write only the first sentence.'
  }
  if (/\b(expression|review)\b/i.test(normalizedTitle)) {
    return 'Review 5 entries only. Do not add new entries.'
  }
  if (/\b(glossary|cisco|cyber)\b/i.test(normalizedTitle)) {
    return 'Open the glossary and review 8 terms only.'
  }
  if (/\b(cursor|codex|deploy|bug|ui|project|coding)\b/i.test(normalizedTitle)) {
    return 'Write one English sentence: Today I will fix/build/test...'
  }
  return tinyActionForArea(area)
}

export function isOldAssessmentTask(task: Pick<Task, 'title'>): boolean {
  const title = task.title.toLowerCase()
  return (
    title.includes('vu23222') ||
    title.includes('cybersecurity vu23222') ||
    title.includes('current assessment requirement')
  )
}

export function isActiveTask(task: Task): boolean {
  const normalized = normalizeTask(task)
  return !normalized.done && ACTIVE_TASK_STATUSES.includes(normalized.status ?? 'Inbox')
}

export function normalizeTask(task: Task): Task {
  const area = normalizeArea(task.area) === 'Other' && !task.area
    ? areaFromCategory(task.category)
    : normalizeArea(task.area)
  const estimatedMinutes = normalizedBlockMinutes(task.estimatedMinutes)
  const shouldAutoArchiveOldAssessment =
    isOldAssessmentTask(task) &&
    (!task.status || task.status === 'Done' || task.status === 'Skipped' || task.status === 'Archived')
  const status: TaskStatus = shouldAutoArchiveOldAssessment
    ? 'Archived'
    : task.done
      ? 'Done'
      : task.status ?? 'Inbox'
  const now = new Date().toISOString()
  return {
    ...task,
    area,
    energy: task.energy ?? energyFromMinutes(estimatedMinutes),
    mode: task.mode ?? modeFromArea(area),
    estimatedMinutes,
    nextTinyAction: task.nextTinyAction?.trim() || task.nextAction?.trim() || tinyActionForTask(task.title, area),
    status,
    done: status === 'Done' ? true : task.done,
    updatedAt: task.updatedAt ?? task.createdAt ?? now,
  }
}

export function archiveCompletedOldTasks(tasks: Task[]): Task[] {
  const now = new Date().toISOString()
  return tasks.map(task => {
    const normalized = normalizeTask(task)
    if (normalized.status === 'Done' || normalized.status === 'Skipped' || isOldAssessmentTask(normalized)) {
      return {
        ...normalized,
        status: 'Archived',
        done: normalized.status === 'Done' ? true : normalized.done,
        updatedAt: now,
      }
    }
    return normalized
  })
}

export function createInboxTask(input: {
  title: string
  area: TaskArea
  energy: TaskEnergy
  mode: TaskMode
  estimatedMinutes: number
  nextTinyAction?: string
}): Task {
  const now = new Date().toISOString()
  const nextTinyAction = input.nextTinyAction?.trim() || tinyActionForTask(input.title, input.area)
  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    area: input.area,
    energy: input.energy,
    mode: input.mode,
    estimatedMinutes: input.estimatedMinutes,
    nextTinyAction,
    status: 'Inbox',
    category: categoryFromArea(input.area),
    difficulty: input.energy === 'High' ? 'hard' : input.energy === 'Medium' ? 'medium' : 'easy',
    urgency: 'medium',
    importance: 'medium',
    nextAction: nextTinyAction,
    pomodoroEnabled: input.mode === 'Focus',
    pomodoroLength: input.estimatedMinutes,
    breakLength: input.estimatedMinutes >= 25 ? 10 : 5,
    pomodoroSessions: 1,
    done: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function pickTaskForBlock(
  tasks: Task[],
  energy: TaskEnergy,
  areaFilter: TaskArea | 'Any',
  options: { preserveOrder?: boolean } = {},
): Task | null {
  const usable = tasks
    .map(normalizeTask)
    .filter(isActiveTask)
    .filter(task => areaFilter === 'Any' || task.area === areaFilter)
  if (usable.length === 0) return null
  if (options.preserveOrder) return usable[0]
  const energyOrder: Record<TaskEnergy, TaskEnergy[]> = {
    Low: ['Low', 'Medium', 'High'],
    Medium: ['Medium', 'Low', 'High'],
    High: ['High', 'Medium', 'Low'],
  }
  return [...usable].sort((a, b) => {
    const energyScore =
      energyOrder[energy].indexOf(a.energy ?? 'Medium') -
      energyOrder[energy].indexOf(b.energy ?? 'Medium')
    if (energyScore !== 0) return energyScore
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })[0]
}

export function createFocusBlock(input: {
  minutes: number
  task: Task
  energy: TaskEnergy
}): FocusBlock {
  const task = normalizeTask(input.task)
  const now = new Date()
  const end = new Date(now.getTime() + input.minutes * 60 * 1000)
  return {
    id: crypto.randomUUID(),
    date: localDateString(now),
    startTime: now.toISOString(),
    plannedEndTime: end.toISOString(),
    minutes: input.minutes,
    taskId: task.id,
    taskTitle: task.title,
    area: task.area ?? 'Other',
    mode: task.mode ?? 'Focus',
    energy: input.energy,
    firstTinyAction: tinyActionForTask(task.title, task.area ?? 'Other'),
    status: 'Doing',
    notes: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

export function defaultMealAnchors(date = localDateString()): MealAnchor[] {
  const now = new Date().toISOString()
  return [
    { id: 'lunch', date, label: 'Lunch + reset', aroundTime: '12:00', status: '', updatedAt: now },
    { id: 'dinner', date, label: 'Dinner + reset', aroundTime: '17:00', status: '', updatedAt: now },
  ]
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

export function recommendNextBlocks(input: {
  tasks: Task[]
  energy: TaskEnergy
  areaFilter: TaskArea | 'Any'
  preserveOrder?: boolean
  now?: Date
}): NextBlockRecommendation[] {
  const now = input.now ?? new Date()
  const resetMinutes = input.energy === 'Low' ? 10 : 5
  const focusMinutes = input.energy === 'Low' ? 15 : input.energy === 'Medium' ? 25 : 45
  const task = pickTaskForBlock(input.tasks, input.energy, input.areaFilter, {
    preserveOrder: input.preserveOrder,
  })
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const eveningMode = minutesNow >= 17 * 60
  const defaultLabel = eveningMode ? 'Quiet reading' : 'Project / Coding'
  const defaultDetail = eveningMode
    ? 'Open one document and mark only New concept / Useful phrase.'
    : 'Write one English sentence: Today I will fix/build/test...'
  const firstEnd = addMinutes(now, resetMinutes)
  const secondEnd = addMinutes(firstEnd, focusMinutes)
  const breakEnd = addMinutes(secondEnd, 10)

  return [
    {
      id: 'reset',
      time: `${formatTime(now)}-${formatTime(firstEnd)}`,
      label: 'Reset',
      detail: input.energy === 'Low' ? 'Water, face, desk open.' : 'Water and one breath before starting.',
      minutes: resetMinutes,
      area: 'Life reset',
    },
    {
      id: 'focus',
      time: `${formatTime(firstEnd)}-${formatTime(secondEnd)}`,
      label: task ? `Focus: ${task.title}` : defaultLabel,
      detail: task?.nextTinyAction || defaultDetail,
      minutes: focusMinutes,
      area: task?.area,
    },
    {
      id: 'break',
      time: `${formatTime(secondEnd)}-${formatTime(breakEnd)}`,
      label: 'Break',
      detail: 'Look away, stretch, refill water.',
      minutes: 10,
      area: 'Life reset',
    },
  ]
}
