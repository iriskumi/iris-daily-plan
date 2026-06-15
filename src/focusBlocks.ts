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

export const TASK_AREAS: TaskArea[] = [
  'Cyber',
  'Job',
  'English',
  'Admin',
  'Life reset',
  'Expression Review',
  'Other',
]

export const TASK_ENERGIES: TaskEnergy[] = ['Low', 'Medium', 'High']
export const TASK_MODES: TaskMode[] = ['Focus', 'Light', 'Admin', 'Recovery']
export const TASK_STATUSES: TaskStatus[] = ['Inbox', 'Planned', 'Doing', 'Done', 'Skipped']
export const BLOCK_LENGTHS = [
  { minutes: 5 as const, label: '5 min Start' },
  { minutes: 15 as const, label: '15 min Light' },
  { minutes: 25 as const, label: '25 min Focus' },
  { minutes: 45 as const, label: '45 min Deep' },
]

export function areaFromCategory(category: TaskCategory): TaskArea {
  if (category === 'cyber-study' || category === 'assessment' || category === 'ai') return 'Cyber'
  if (category === 'job-search' || category === 'consulting-freelance') return 'Job'
  if (category === 'english-practice' || category === 'japanese-practice') return 'English'
  if (category === 'admin-life' || category === 'finance-bills' || category === 'work-shift') return 'Admin'
  if (category === 'recovery' || category === 'exercise') return 'Life reset'
  return 'Other'
}

export function categoryFromArea(area: TaskArea): TaskCategory {
  if (area === 'Cyber') return 'cyber-study'
  if (area === 'Job') return 'job-search'
  if (area === 'English') return 'english-practice'
  if (area === 'Admin') return 'admin-life'
  if (area === 'Life reset') return 'recovery'
  if (area === 'Expression Review') return 'english-practice'
  return 'admin-life'
}

export function modeFromArea(area: TaskArea): TaskMode {
  if (area === 'Admin') return 'Admin'
  if (area === 'Life reset') return 'Recovery'
  if (area === 'Expression Review') return 'Light'
  return 'Focus'
}

export function energyFromMinutes(minutes: number): TaskEnergy {
  if (minutes <= 15) return 'Low'
  if (minutes <= 25) return 'Medium'
  return 'High'
}

export function normalizedBlockMinutes(minutes?: number): 5 | 15 | 25 | 45 {
  if (!minutes || minutes <= 5) return 5
  if (minutes <= 15) return 15
  if (minutes <= 25) return 25
  return 45
}

export function tinyActionForArea(area: TaskArea): string {
  if (area === 'Cyber') return 'Open the glossary and review 8 terms only.'
  if (area === 'Job') return 'Open the JD and highlight 3 requirements only.'
  if (area === 'English') return 'Write or say one sentence only.'
  if (area === 'Admin') return 'Open the relevant email or page and do the first visible step only.'
  if (area === 'Life reset') return 'Get water or wash face first.'
  if (area === 'Expression Review') return 'Review 5 entries only. Do not add new entries.'
  return 'Open the relevant file and do only the first visible step for 5 minutes.'
}

export function tinyActionForTask(title: string, area: TaskArea): string {
  const normalizedTitle = title.toLowerCase()
  if (/\b(sdlc|vibe coding|article|reading)\b/i.test(normalizedTitle)) {
    return 'Open the reading/note and highlight 3 useful points only. Do not summarise yet.'
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
  return tinyActionForArea(area)
}

export function normalizeTask(task: Task): Task {
  const area = task.area ?? areaFromCategory(task.category)
  const estimatedMinutes = normalizedBlockMinutes(task.estimatedMinutes)
  const status: TaskStatus = task.done ? 'Done' : task.status ?? 'Inbox'
  const now = new Date().toISOString()
  return {
    ...task,
    area,
    energy: task.energy ?? energyFromMinutes(estimatedMinutes),
    mode: task.mode ?? modeFromArea(area),
    estimatedMinutes,
    nextTinyAction: task.nextTinyAction?.trim() || task.nextAction?.trim() || tinyActionForTask(task.title, area),
    status,
    updatedAt: task.updatedAt ?? task.createdAt ?? now,
  }
}

export function createInboxTask(input: {
  title: string
  area: TaskArea
  energy: TaskEnergy
  mode: TaskMode
  estimatedMinutes: 5 | 15 | 25 | 45
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
    .filter(task => !task.done && task.status !== 'Done' && task.status !== 'Skipped')
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
  minutes: 5 | 15 | 25 | 45
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
      label: task ? `Focus: ${task.title}` : 'Focus: add one task first',
      detail: task?.nextTinyAction || 'Choose one inbox task and make the first action tiny.',
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
