import { getLocalDateKey } from './focus'

export interface ExerciseLogEntry {
  id: string
  date: string
  movementType: string
  durationMinutes: number
  intensity: string
  energyBefore: string
  energyAfter: string
  notes?: string
  createdAt: string
}

export interface ExerciseLogStore {
  entries: ExerciseLogEntry[]
}

const STORAGE_KEY = 'iris-exercise-log'

export const MOVEMENT_TYPES = ['Walk', 'Strength A', 'Strength B', 'Dance', 'K-pop', 'Jog / Intervals', 'Stretch', 'Recovery', 'Other']
export const EXERCISE_INTENSITIES = ['gentle', 'medium', 'strong']
export const EXERCISE_ENERGY_BEFORE = ['low', 'medium', 'high']
export const EXERCISE_ENERGY_AFTER = ['lower', 'same', 'better']

export const MONTHLY_MOVEMENT_CHALLENGES: Record<string, { title: string; goal: string }> = {
  '2026-07': { title: '连续打卡', goal: '每天至少运动 10 分钟，不追求强度。' },
  '2026-08': { title: '恢复力量', goal: '壶铃动作变得稳定流畅。' },
  '2026-09': { title: '恢复耐力', goal: '在 Holmesglen Reserve 连续快走 60 分钟。' },
  '2026-10': { title: '恢复舞感', goal: '学会一支新的 K-pop 舞蹈。' },
  '2026-11': { title: '恢复速度', goal: '能轻松完成 5 公里快走或跑走结合。' },
  '2026-12': { title: '综合挑战', goal: '完成一次 60–90 分钟户外活动。' },
  '2027-01': { title: '重新启动', goal: '假期后恢复每周 4 次活动。' },
  '2027-02': { title: '力量稳定', goal: '每周完成 2 次力量训练。' },
  '2027-03': { title: '心肺稳定', goal: '每周一次 30 分钟跑走结合。' },
  '2027-04': { title: '舞蹈恢复', goal: '每周跳舞 2 次。' },
  '2027-05': { title: '户外节奏', goal: '每周至少一次 Holmesglen Reserve 长走。' },
  '2027-06': { title: '身体成为优势', goal: '回顾过去一年，整理最有效的运动组合。' },
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeEntry(value: unknown): ExerciseLogEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<ExerciseLogEntry>
  const now = new Date().toISOString()
  return {
    id: String(entry.id ?? makeId('exercise')),
    date: String(entry.date ?? getLocalDateKey()),
    movementType: String(entry.movementType ?? 'Walk'),
    durationMinutes: Math.max(0, Number(entry.durationMinutes) || 0),
    intensity: String(entry.intensity ?? 'gentle'),
    energyBefore: String(entry.energyBefore ?? 'medium'),
    energyAfter: String(entry.energyAfter ?? 'same'),
    notes: String(entry.notes ?? ''),
    createdAt: String(entry.createdAt ?? now),
  }
}

export function loadExerciseLog(): ExerciseLogStore {
  if (typeof localStorage === 'undefined') return { entries: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { entries: [] }
    const parsed = JSON.parse(raw) as Partial<ExerciseLogStore>
    return {
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map(normalizeEntry).filter((entry): entry is ExerciseLogEntry => Boolean(entry))
        : [],
    }
  } catch (error) {
    console.warn('[ExerciseLog] Failed to load exercise log', error)
    return { entries: [] }
  }
}

export function saveExerciseLog(store: ExerciseLogStore) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function addExerciseEntry(input: Omit<ExerciseLogEntry, 'id' | 'createdAt'>, store = loadExerciseLog()) {
  const entry: ExerciseLogEntry = {
    ...input,
    id: makeId('exercise'),
    createdAt: new Date().toISOString(),
  }
  const nextStore = { entries: [entry, ...store.entries] }
  saveExerciseLog(nextStore)
  return { entry, store: nextStore }
}

export function exerciseStats(entries: ExerciseLogEntry[], today = getLocalDateKey()) {
  const todayMinutes = entries
    .filter(entry => entry.date === today)
    .reduce((sum, entry) => sum + entry.durationMinutes, 0)
  const current = new Date(`${today}T12:00:00`)
  const weekStart = new Date(current)
  weekStart.setDate(current.getDate() - ((current.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const weekEntries = entries.filter(entry => new Date(`${entry.date}T12:00:00`) >= weekStart)
  const thisWeekMinutes = weekEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
  const daysMovedThisWeek = new Set(weekEntries.filter(entry => entry.durationMinutes > 0).map(entry => entry.date)).size
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const lastMovementDate = sorted[0]?.date ?? ''
  const yesterday = new Date(current)
  yesterday.setDate(current.getDate() - 1)
  const yesterdayKey = getLocalDateKey(yesterday)
  const movedToday = todayMinutes > 0
  const movedYesterday = entries.some(entry => entry.date === yesterdayKey && entry.durationMinutes > 0)
  const neverMissTwice = movedToday || movedYesterday || entries.length === 0
  const monthKey = today.slice(0, 7)
  const monthlyChallengeProgress = entries
    .filter(entry => entry.date.startsWith(monthKey) && entry.durationMinutes >= 10)
    .length

  return {
    todayMinutes,
    thisWeekMinutes,
    daysMovedThisWeek,
    lastMovementDate,
    neverMissTwiceStatus: neverMissTwice ? 'On track — 不要连续两天缺席。' : 'Restart today with 10 gentle minutes.',
    monthlyChallengeProgress,
  }
}

export function movementMarkdown(entry: ExerciseLogEntry) {
  return `# Movement Log - ${entry.date}

## Today’s Movement
- Type: ${entry.movementType}
- Duration: ${entry.durationMinutes} min
- Intensity: ${entry.intensity}
- Energy before: ${entry.energyBefore}
- Energy after: ${entry.energyAfter}

## What this supports
- Study:
- Work:
- English:
- AI projects:

## Notes
- ${entry.notes ?? ''}

## Tomorrow’s smallest movement
- 

Suggested destination: 10 Journal 日志/Daily/ or 04 Projects 项目/Iris Daily Hub/Movement System/`
}
