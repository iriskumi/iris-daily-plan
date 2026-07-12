import type { Task, TaskArea, TaskCategory } from './types'
import { areaFromCategory } from './focusBlocks'

export type TaskKind = 'study-work' | 'life'

export const STUDY_WORK_AREAS: TaskArea[] = [
  'Cyber',
  'AI',
  'Vibe Coding',
  'Job',
  'English',
  'Study',
  'Expression Review',
  'Other',
]

export const LIFE_AREAS: TaskArea[] = [
  'Admin',
  'Life reset',
  'Other',
]

const LIFE_CATEGORIES = new Set<TaskCategory>([
  'admin-life',
  'finance-bills',
  'recovery',
  'exercise',
  'work-shift',
])

export function taskKindFromArea(area?: TaskArea): TaskKind {
  if (!area) return 'study-work'
  if (area === 'Admin' || area === 'Life reset') return 'life'
  if (STUDY_WORK_AREAS.includes(area) && area !== 'Other') return 'study-work'
  return 'life'
}

export function taskKindFromTask(task: Pick<Task, 'area' | 'category'>): TaskKind {
  if (LIFE_CATEGORIES.has(task.category)) return 'life'
  const area = task.area ?? areaFromCategory(task.category)
  return taskKindFromArea(area)
}

export function areasForTaskKind(kind: TaskKind): TaskArea[] {
  return kind === 'study-work' ? STUDY_WORK_AREAS : LIFE_AREAS
}

export function defaultAreaForKind(kind: TaskKind): TaskArea {
  return kind === 'study-work' ? 'Cyber' : 'Admin'
}

export function taskKindLabel(kind: TaskKind): string {
  return kind === 'study-work' ? 'Study / Work' : 'Life'
}
