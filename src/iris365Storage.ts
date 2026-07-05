import { getLocalDateKey } from './focus'
import type {
  Iris365Entry,
  Iris365FoundationStatus,
  Iris365HighStimulusPatternKey,
  Iris365HighStimulusPatternStatus,
  Iris365Phase,
  Iris365ProofCategory,
  Iris365ProofItem,
  Iris365Stats,
  Iris365Store,
  Iris365Streaks,
  Iris365WeeklyReview,
} from './iris365Types'

const STORAGE_KEY = 'iris-365'
const SCHEMA_VERSION = 1
const JOURNEY_DAYS = 365
export const IRIS_365_START_DATE = '2026-07-06'
export const IRIS_365_END_DATE = '2027-07-05'

export const IRIS_365_PROOF_CATEGORIES: Iris365ProofCategory[] = [
  'English output',
  'Shadowing',
  'Cyber project',
  'AI workflow',
  'Job application',
  'Work experience',
  'Health / routine',
  'Personal insight',
]

export const IRIS_365_HIGH_STIMULUS_PATTERNS: Iris365HighStimulusPatternKey[] = [
  'shortDramas',
  'webNovels',
  'xiaohongshuSocialMedia',
  'shopping',
  'mobileGames',
  'other',
]

function defaultHighStimulusPatterns(): Record<Iris365HighStimulusPatternKey, Iris365HighStimulusPatternStatus> {
  return {
    shortDramas: 'not-used',
    webNovels: 'not-used',
    xiaohongshuSocialMedia: 'not-used',
    shopping: 'not-used',
    mobileGames: 'not-used',
    other: 'not-used',
  }
}

export const IRIS_365_PHASES: Iris365Phase[] = [
  {
    id: 1,
    startDay: 1,
    endDay: 30,
    title: 'Stabilise the System',
    focus: 'Protect the base: sleep, movement, English output, and one real-world task.',
  },
  {
    id: 2,
    startDay: 31,
    endDay: 90,
    title: 'Build Output',
    focus: 'Turn small practice into repeatable visible output.',
  },
  {
    id: 3,
    startDay: 91,
    endDay: 180,
    title: 'Portfolio and Proof',
    focus: 'Collect evidence: projects, writing, interviews, and consistent study logs.',
  },
  {
    id: 4,
    startDay: 181,
    endDay: 365,
    title: 'Scale Up',
    focus: 'Use the proof you built to reach bigger rooms and better opportunities.',
  },
]

function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

function dayDiffInclusive(startDate: string, currentDate = getLocalDateKey()): number {
  const start = parseLocalDate(startDate)
  const current = parseLocalDate(currentDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) return 1
  return Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1
}

export function isBeforeIris365Start(currentDate = getLocalDateKey(), startDate = IRIS_365_START_DATE): boolean {
  return parseLocalDate(currentDate).getTime() < parseLocalDate(startDate).getTime()
}

export function isIris365JourneyDate(date: string): boolean {
  const time = parseLocalDate(date).getTime()
  return time >= parseLocalDate(IRIS_365_START_DATE).getTime() && time <= parseLocalDate(IRIS_365_END_DATE).getTime()
}

export function calculateCurrentDayNumber(startDate: string, currentDate = getLocalDateKey()): number {
  if (isBeforeIris365Start(currentDate, startDate)) return 0
  return Math.min(JOURNEY_DAYS, Math.max(1, dayDiffInclusive(startDate, currentDate)))
}

export function calculateDaysRemaining(startDate: string, currentDate = getLocalDateKey()): number {
  if (isBeforeIris365Start(currentDate, startDate)) return JOURNEY_DAYS
  return Math.max(0, JOURNEY_DAYS - calculateCurrentDayNumber(startDate, currentDate))
}

export function determineCurrentPhase(dayNumber: number): Iris365Phase {
  return IRIS_365_PHASES.find(phase => dayNumber >= phase.startDay && dayNumber <= phase.endDay) ?? IRIS_365_PHASES[IRIS_365_PHASES.length - 1]
}

export function emptyIris365Entry(date = getLocalDateKey()): Iris365Entry {
  return {
    date,
    lowEnergyDay: false,
    sleepRhythmProtected: false,
    bodyMoved: false,
    oneRealThingDone: false,
    englishOutput: false,
    shadowing: false,
    cyberAiProject: false,
    jobApplication: false,
    workPrep: false,
    studyCoursework: false,
    lifeAdmin: false,
    realThingToday: '',
    realityTask: false,
    movement: false,
    highStimulusControlled: false,
    sleepProtected: false,
    sleepTime: '',
    wakeTime: '',
    movementType: '',
    highStimulusPatterns: defaultHighStimulusPatterns(),
    highStimulusTrigger: '',
    mood: 3,
    energy: 3,
    tinyWin: '',
    notes: '',
    updatedAt: new Date().toISOString(),
  }
}

function fallbackStore(): Iris365Store {
  return {
    schemaVersion: SCHEMA_VERSION,
    startDate: IRIS_365_START_DATE,
    entries: {},
    proofItems: [],
    weeklyReviews: {},
  }
}

function normaliseEntry(value: Partial<Iris365Entry>, date: string): Iris365Entry {
  const sleepRhythmProtected = value.sleepRhythmProtected ?? value.sleepProtected ?? false
  const bodyMoved = value.bodyMoved ?? value.movement ?? false
  const oneRealThingDone = value.oneRealThingDone ?? value.realityTask ?? false
  const highStimulusPatterns = {
    ...defaultHighStimulusPatterns(),
    ...(value.highStimulusPatterns ?? {}),
  }
  return {
    ...emptyIris365Entry(date),
    ...value,
    date,
    sleepRhythmProtected,
    bodyMoved,
    oneRealThingDone,
    sleepProtected: sleepRhythmProtected,
    movement: bodyMoved,
    realityTask: oneRealThingDone,
    highStimulusPatterns,
    realThingToday: value.realThingToday ?? '',
    sleepTime: value.sleepTime ?? '',
    wakeTime: value.wakeTime ?? '',
    movementType: value.movementType ?? '',
    highStimulusTrigger: value.highStimulusTrigger ?? '',
    mood: clampRating(value.mood),
    energy: clampRating(value.energy),
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  }
}

function normaliseProofItem(value: Partial<Iris365ProofItem>): Iris365ProofItem | null {
  if (!value.id || !value.date || !value.title) return null
  const category = IRIS_365_PROOF_CATEGORIES.includes(value.category as Iris365ProofCategory)
    ? value.category as Iris365ProofCategory
    : 'Personal insight'
  return {
    id: value.id,
    date: value.date,
    category,
    title: value.title,
    description: value.description ?? '',
    linkOrFile: value.linkOrFile ?? '',
    relatedEntryDate: value.relatedEntryDate,
    createdAt: value.createdAt ?? new Date().toISOString(),
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  }
}

function normaliseWeeklyReview(value: Partial<Iris365WeeklyReview>, weekStartDate: string): Iris365WeeklyReview {
  const weekEnd = parseLocalDate(weekStartDate)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return {
    weekStartDate,
    weekEndDate: value.weekEndDate ?? getLocalDateKey(weekEnd),
    proofThisWeek: value.proofThisWeek ?? '',
    attentionDrain: value.attentionDrain ?? '',
    bestReturnHabit: value.bestReturnHabit ?? '',
    makeEasierNextWeek: value.makeEasierNextWeek ?? '',
    nextWeekPriority: value.nextWeekPriority ?? '',
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  }
}

function clampRating(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 3
  return Math.min(5, Math.max(1, Math.round(numeric)))
}

function normaliseStore(value: unknown): Iris365Store {
  if (!value || typeof value !== 'object') return fallbackStore()
  const parsed = value as Partial<Iris365Store>
  const entries = Object.entries(parsed.entries ?? {}).reduce<Record<string, Iris365Entry>>((acc, [date, entry]) => {
    if (entry && typeof entry === 'object') acc[date] = normaliseEntry(entry as Partial<Iris365Entry>, date)
    return acc
  }, {})
  const proofItems = Array.isArray(parsed.proofItems)
    ? parsed.proofItems.map(normaliseProofItem).filter((item): item is Iris365ProofItem => Boolean(item))
    : []
  const weeklyReviews = Object.entries(parsed.weeklyReviews ?? {}).reduce<Record<string, Iris365WeeklyReview>>((acc, [weekStartDate, review]) => {
    if (review && typeof review === 'object') acc[weekStartDate] = normaliseWeeklyReview(review as Partial<Iris365WeeklyReview>, weekStartDate)
    return acc
  }, {})
  return {
    schemaVersion: SCHEMA_VERSION,
    startDate: IRIS_365_START_DATE,
    entries,
    proofItems,
    weeklyReviews,
  }
}

export function loadIris365Store(): Iris365Store {
  if (typeof localStorage === 'undefined') return fallbackStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const store = fallbackStore()
      saveIris365Store(store)
      return store
    }
    return saveIris365Store(normaliseStore(JSON.parse(raw)))
  } catch {
    return saveIris365Store(fallbackStore())
  }
}

export function saveIris365Store(store: Iris365Store): Iris365Store {
  const next = normaliseStore(store)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

export function loadIris365Entry(date = getLocalDateKey(), store = loadIris365Store()): Iris365Entry {
  return store.entries[date] ?? emptyIris365Entry(date)
}

export function saveIris365Entry(entry: Iris365Entry, store = loadIris365Store()): Iris365Store {
  const normalisedEntry = normaliseEntry(entry, entry.date)
  return saveIris365Store({
    ...store,
    entries: {
      ...store.entries,
      [normalisedEntry.date]: {
        ...normalisedEntry,
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

export function calculateFoundationScore(entry: Iris365Entry): number {
  return [
    entry.sleepRhythmProtected,
    entry.bodyMoved,
    entry.oneRealThingDone,
  ].filter(Boolean).length
}

export function foundationStatusForScore(score: number): Iris365FoundationStatus {
  if (score >= 3) return 'Foundation day'
  if (score === 2) return 'Valid day'
  if (score === 1) return 'Recovery day'
  return 'Drift day'
}

export function calculateFoundationStatus(entry: Iris365Entry): Iris365FoundationStatus {
  return foundationStatusForScore(calculateFoundationScore(entry))
}

export function isValidIris365Day(entry: Iris365Entry): boolean {
  return calculateFoundationScore(entry) >= 2
}

export function calculateIris365Streaks(entries: Record<string, Iris365Entry>, currentDate = getLocalDateKey()): Iris365Streaks {
  const entryDates = new Set(Object.values(entries).filter(entry => isIris365JourneyDate(entry.date) && isValidIris365Day(entry)).map(entry => entry.date))
  let currentStreak = 0
  const cursor = parseLocalDate(currentDate)
  while (entryDates.has(getLocalDateKey(cursor))) {
    currentStreak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  const sortedDates = [...entryDates].sort()
  let bestStreak = 0
  let running = 0
  let previous: Date | null = null
  sortedDates.forEach(date => {
    const current = parseLocalDate(date)
    if (previous && Math.round((current.getTime() - previous.getTime()) / 86_400_000) === 1) {
      running += 1
    } else {
      running = 1
    }
    bestStreak = Math.max(bestStreak, running)
    previous = current
  })

  return { currentStreak, bestStreak }
}

export function calculateIris365Stats(entries: Record<string, Iris365Entry>, currentDate = getLocalDateKey()): Iris365Stats {
  const list = Object.values(entries).filter(entry => isIris365JourneyDate(entry.date))
  const streaks = calculateIris365Streaks(entries, currentDate)
  return {
    totalRecordedDays: list.length,
    validDays: list.filter(entry => calculateFoundationScore(entry) >= 2).length,
    foundationDays: list.filter(entry => calculateFoundationScore(entry) === 3).length,
    sleepRhythmProtectedDays: list.filter(entry => entry.sleepRhythmProtected).length,
    movementDays: list.filter(entry => entry.bodyMoved).length,
    realThingDays: list.filter(entry => entry.oneRealThingDone).length,
    englishOutputDays: list.filter(entry => entry.englishOutput).length,
    shadowingDays: list.filter(entry => entry.shadowing).length,
    cyberAiProjectDays: list.filter(entry => entry.cyberAiProject).length,
    jobApplicationDays: list.filter(entry => entry.jobApplication).length,
    studyCourseworkDays: list.filter(entry => entry.studyCoursework).length,
    workPrepDays: list.filter(entry => entry.workPrep).length,
    highStimulusControlledDays: list.filter(entry => entry.highStimulusControlled).length,
    ...streaks,
  }
}

export function recentIris365Entries(entries: Record<string, Iris365Entry>, count = 7): Iris365Entry[] {
  return Object.values(entries)
    .filter(entry => isIris365JourneyDate(entry.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, count)
}

export function iris365ProgressPercent(dayNumber: number): number {
  return Math.min(100, Math.max(0, Math.round((dayNumber / JOURNEY_DAYS) * 100)))
}

export function getIris365WeekStart(date = getLocalDateKey()): string {
  const current = parseLocalDate(date)
  const day = current.getDay()
  current.setDate(current.getDate() - day)
  return getLocalDateKey(current)
}

export function isIris365WeeklyReviewDay(date = getLocalDateKey()): boolean {
  return parseLocalDate(date).getDay() === 0
}

export function emptyIris365WeeklyReview(weekStartDate = getIris365WeekStart()): Iris365WeeklyReview {
  const weekEnd = parseLocalDate(weekStartDate)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return {
    weekStartDate,
    weekEndDate: getLocalDateKey(weekEnd),
    proofThisWeek: '',
    attentionDrain: '',
    bestReturnHabit: '',
    makeEasierNextWeek: '',
    nextWeekPriority: '',
    updatedAt: new Date().toISOString(),
  }
}

export function saveIris365WeeklyReview(review: Iris365WeeklyReview, store = loadIris365Store()): Iris365Store {
  return saveIris365Store({
    ...store,
    weeklyReviews: {
      ...store.weeklyReviews,
      [review.weekStartDate]: {
        ...review,
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

export function getIris365WeekEntries(entries: Record<string, Iris365Entry>, weekStartDate = getIris365WeekStart()): Iris365Entry[] {
  const start = parseLocalDate(weekStartDate)
  const dates = new Set(Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return getLocalDateKey(date)
  }))
  return Object.values(entries).filter(entry => dates.has(entry.date))
}

export function addIris365ProofItem(
  input: Omit<Iris365ProofItem, 'id' | 'createdAt' | 'updatedAt'>,
  store = loadIris365Store(),
): Iris365Store {
  const now = new Date().toISOString()
  return saveIris365Store({
    ...store,
    proofItems: [
      {
        ...input,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      },
      ...store.proofItems,
    ],
  })
}
