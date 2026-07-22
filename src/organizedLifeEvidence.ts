import { getLocalDateKey } from './focus'
import type { ExerciseLogEntry } from './exerciseStorage'
import type { Iris365Entry } from './iris365Types'
import type { StudyCategory, StudySessionRecord } from './studyTypes'

export type OrganizedLifeArea =
  | 'Study'
  | 'Japanese'
  | 'English'
  | 'AI / Cyber'
  | 'Career'
  | 'Admin'
  | 'Life'
  | 'Movement'

export interface OrganizedLifeManualEntry {
  id: string
  date: string
  area: OrganizedLifeArea
  title: string
  createdAt: string
}

export interface OrganizedLifeEvidenceEntry {
  id: string
  sourceId: string
  source: 'study-session' | 'movement' | 'iris365-movement' | 'manual'
  date: string
  area: OrganizedLifeArea
  title: string
  minutes?: number
  createdAt: string
}

export interface RelaxedRhythmStats {
  activeDaysThisWeek: number
  currentRhythm: number
  bestRhythm: number
}

const STORAGE_KEY = 'iris-organized-life-entries'

export const ORGANIZED_LIFE_AREAS: OrganizedLifeArea[] = [
  'Study',
  'Japanese',
  'English',
  'AI / Cyber',
  'Career',
  'Admin',
  'Life',
]

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `evidence-${crypto.randomUUID()}`
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeManualEntry(value: unknown): OrganizedLifeManualEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<OrganizedLifeManualEntry>
  if (!entry.title?.trim() || !entry.date || !ORGANIZED_LIFE_AREAS.includes(entry.area as OrganizedLifeArea)) return null
  return {
    id: String(entry.id ?? makeId()),
    date: String(entry.date),
    area: entry.area as OrganizedLifeArea,
    title: entry.title.trim(),
    createdAt: String(entry.createdAt ?? new Date().toISOString()),
  }
}

export function loadOrganizedLifeManualEntries(): OrganizedLifeManualEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.map(normalizeManualEntry).filter((entry): entry is OrganizedLifeManualEntry => Boolean(entry))
      : []
  } catch {
    return []
  }
}

function saveOrganizedLifeManualEntries(entries: OrganizedLifeManualEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function addOrganizedLifeManualEntry(
  input: Pick<OrganizedLifeManualEntry, 'date' | 'area' | 'title'>,
  entries = loadOrganizedLifeManualEntries(),
) {
  const entry: OrganizedLifeManualEntry = {
    ...input,
    title: input.title.trim(),
    id: makeId(),
    createdAt: new Date().toISOString(),
  }
  const next = [entry, ...entries]
  saveOrganizedLifeManualEntries(next)
  return { entry, entries: next }
}

export function deleteOrganizedLifeManualEntry(
  id: string,
  entries = loadOrganizedLifeManualEntries(),
) {
  const next = entries.filter(entry => entry.id !== id)
  saveOrganizedLifeManualEntries(next)
  return next
}

export function organizedLifeAreaForStudyCategory(category: StudyCategory): OrganizedLifeArea {
  if (category === 'Japanese') return 'Japanese'
  if (category === 'English Output' || category === 'English Input') return 'English'
  if (category === 'AI Coding' || category === 'Coursera AI Pathway' || category === 'Cyber' || category === 'SQL / Excel') return 'AI / Cyber'
  if (category === 'Job / Career') return 'Career'
  if (category === 'Admin / Life') return 'Admin'
  if (category === 'Reset') return 'Life'
  return 'Study'
}

export function buildOrganizedLifeEvidence(
  sessions: StudySessionRecord[],
  movements: ExerciseLogEntry[],
  manualEntries: OrganizedLifeManualEntry[],
  iris365Entries: Record<string, Iris365Entry> = {},
): OrganizedLifeEvidenceEntry[] {
  const studyEvidence = sessions
    .filter(session => session.status === 'completed')
    .map(session => ({
      id: `study:${session.id}`,
      sourceId: session.id,
      source: 'study-session' as const,
      date: getLocalDateKey(new Date(session.completedAt || session.startedAt)),
      area: organizedLifeAreaForStudyCategory(session.category),
      title: session.title,
      minutes: session.actualMinutes,
      createdAt: session.completedAt || session.startedAt,
    }))
  const movementEvidence = movements
    .filter(entry => entry.durationMinutes > 0)
    .map(entry => ({
      id: `movement:${entry.id}`,
      sourceId: entry.id,
      source: 'movement' as const,
      date: entry.date,
      area: 'Movement' as const,
      title: `${entry.movementType} movement`,
      minutes: entry.durationMinutes,
      createdAt: entry.createdAt,
    }))
  const manualEvidence = manualEntries.map(entry => ({
    id: `manual:${entry.id}`,
    sourceId: entry.id,
    source: 'manual' as const,
    date: entry.date,
    area: entry.area,
    title: entry.title,
    createdAt: entry.createdAt,
  }))
  const iris365MovementEvidence = Object.values(iris365Entries).flatMap(entry =>
    (entry.movementItems ?? []).map(item => ({
      id: `iris365-movement:${item.id}`,
      sourceId: item.id,
      source: 'iris365-movement' as const,
      date: entry.date,
      area: 'Movement' as const,
      title: `${item.kind} movement`,
      minutes: item.minutes,
      createdAt: item.createdAt,
    })),
  )
  return [...studyEvidence, ...movementEvidence, ...iris365MovementEvidence, ...manualEvidence]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function dateNumber(date: string) {
  return new Date(`${date}T12:00:00`).getTime()
}

export function calculateRelaxedRhythm(
  evidence: OrganizedLifeEvidenceEntry[],
  today = getLocalDateKey(),
): RelaxedRhythmStats {
  const dates = [...new Set(evidence.map(entry => entry.date))].sort()
  const todayTime = dateNumber(today)
  const weekStart = todayTime - 6 * 86_400_000
  const activeDaysThisWeek = dates.filter(date => {
    const time = dateNumber(date)
    return time >= weekStart && time <= todayTime
  }).length
  if (dates.length === 0) return { activeDaysThisWeek, currentRhythm: 0, bestRhythm: 0 }

  let bestRhythm = 1
  let run = 1
  for (let index = 1; index < dates.length; index += 1) {
    const gapDays = Math.round((dateNumber(dates[index]) - dateNumber(dates[index - 1])) / 86_400_000)
    run = gapDays <= 2 ? run + 1 : 1
    bestRhythm = Math.max(bestRhythm, run)
  }

  const latestDate = dates[dates.length - 1]
  const latestGap = Math.round((todayTime - dateNumber(latestDate)) / 86_400_000)
  if (latestGap > 1) return { activeDaysThisWeek, currentRhythm: 0, bestRhythm }
  let currentRhythm = 1
  for (let index = dates.length - 1; index > 0; index -= 1) {
    const gapDays = Math.round((dateNumber(dates[index]) - dateNumber(dates[index - 1])) / 86_400_000)
    if (gapDays > 2) break
    currentRhythm += 1
  }
  return { activeDaysThisWeek, currentRhythm, bestRhythm }
}
