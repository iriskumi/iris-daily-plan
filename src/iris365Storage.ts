import { getLocalDateKey } from './focus'
import type {
  Iris365Entry,
  Iris365EnglishEnvironmentItem,
  Iris365DailyProof,
  Iris365DayType,
  Iris365DopamineOutcome,
  Iris365DopamineFeedbackReason,
  Iris365DopamineState,
  Iris365DopamineSuggestionType,
  Iris365DopamineSwapLibraryItem,
  Iris365DopamineSwapLog,
  Iris365DopamineUrge,
  Iris365FoundationStatus,
  Iris365HighStimulusPatternKey,
  Iris365HighStimulusPatternStatus,
  Iris365MonthlyReview,
  Iris365MorningFeeling,
  Iris365MorningGateStatus,
  Iris365Phase,
  Iris365ProofKey,
  Iris365ProofCategory,
  Iris365ProofItem,
  Iris365Settings,
  Iris365SkillKey,
  Iris365Stats,
  Iris365Store,
  Iris365Streaks,
  Iris365SwitchLog,
  Iris365WeeklyReview,
} from './iris365Types'
import type { StudySessionRecord } from './studyTypes'

const STORAGE_KEY = 'iris-365'
const SCHEMA_VERSION = 3
export const IRIS_365_SCHEMA_VERSION = SCHEMA_VERSION
const JOURNEY_DAYS = 365
const LEGACY_PROGRAMME_START_DATE = '2026-07-13'
const LEGACY_PROGRAMME_END_DATE = '2027-07-12'
export const IRIS_365_START_DATE = '2026-07-21'
export const IRIS_365_END_DATE = '2027-07-20'

export const IRIS_365_DEFAULT_MOTTO = 'Build the foundation first. Small daily proof, not perfection.'

function programmeEndDate(startDate: string): string {
  const end = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(end.getTime())) return IRIS_365_END_DATE
  end.setDate(end.getDate() + JOURNEY_DAYS - 1)
  return getLocalDateKey(end)
}

export const IRIS_365_PROOF_BLUEPRINTS: Record<Iris365ProofKey, Omit<Iris365DailyProof, 'completed' | 'note'>> = {
  body: {
    key: 'body',
    label: 'Body moved',
    description: 'Support the body that has to carry study, work, English, and AI projects.',
    minimum: '3-10 minutes of walking, stretching, chores, or mobility.',
    standard: '20-30 minutes of walk, dance, gym, or strength.',
    push: 'A planned workout, longer walk, or strength session without turning it into punishment.',
  },
  english: {
    key: 'english',
    label: 'English output',
    description: 'One active attempt at producing English, not passive input.',
    minimum: 'One spoken sentence, short voice note, or 5 minutes of output.',
    standard: '25 minutes of speaking, shadowing with output, writing, or oral summary.',
    push: '50 minutes with reusable expressions, recording, or interview/workplace practice.',
  },
  realWorld: {
    key: 'realWorld',
    label: 'One real thing done',
    description: 'A practical action that makes life, study, career, or Australia stability more real.',
    minimum: 'One email, one form, one bill/admin step, one task opened.',
    standard: 'A complete small task or one clear progress block.',
    push: 'A visible deliverable, application, portfolio note, or solved blocker.',
  },
}

function defaultProofs(): Record<Iris365ProofKey, Iris365DailyProof> {
  return {
    body: { ...IRIS_365_PROOF_BLUEPRINTS.body, completed: false },
    english: { ...IRIS_365_PROOF_BLUEPRINTS.english, completed: false },
    realWorld: { ...IRIS_365_PROOF_BLUEPRINTS.realWorld, completed: false },
  }
}

function defaultSettings(): Iris365Settings {
  return {
    startDate: IRIS_365_START_DATE,
    endDate: IRIS_365_END_DATE,
    motto: IRIS_365_DEFAULT_MOTTO,
  }
}

function normaliseDayType(value: unknown): Iris365DayType {
  return ['normal', 'drift', 'recovery', 'push'].includes(String(value)) ? value as Iris365DayType : 'normal'
}

function normaliseEnergyLevel(value: unknown): 'low' | 'medium' | 'high' {
  return ['low', 'medium', 'high'].includes(String(value)) ? value as 'low' | 'medium' | 'high' : 'medium'
}

function normaliseSkillKey(value: unknown): Iris365SkillKey | 'foundation' {
  return ['english', 'aiAutomation', 'data', 'cyber', 'japanese', 'career', 'lifeSystem', 'foundation'].includes(String(value))
    ? value as Iris365SkillKey | 'foundation'
    : 'foundation'
}

const DEFAULT_DOPAMINE_SWAP_LIBRARY: Array<Omit<Iris365DopamineSwapLibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'timesUsed'>> = [
  { text: 'Brownian noise with rain and thunder', status: 'works' },
  { text: 'Familiar Puckboy / Eden Finley / Saxon James audiobook', status: 'works' },
  { text: 'Modern Family / Brooklyn Nine-Nine / Fisk / Utopia', status: 'works' },
  { text: 'Ceylon/Assam milk tea', status: 'works' },
  { text: 'Shower or wash hair', status: 'works' },
  { text: '10-minute walk', status: 'works' },
  { text: 'Clear one tiny surface', status: 'works' },
  { text: 'Write one Do One Real Thing', status: 'works' },
  { text: 'Capture one English sentence only', status: 'works' },
  { text: 'Starting a new short drama at night', status: 'doesnt-work' },
  { text: 'Starting a new web novel at night', status: 'doesnt-work' },
  { text: 'Xiaohongshu “just for five minutes”', status: 'doesnt-work' },
  { text: 'Shopping price checking at bedtime', status: 'doesnt-work' },
  { text: 'Hardcore study as a replacement when tired', status: 'doesnt-work' },
  { text: 'Replanning my whole life at midnight', status: 'doesnt-work' },
  { text: 'Shame-based productivity language', status: 'doesnt-work' },
]

function isDopamineSuggestionType(value: unknown): value is Iris365DopamineSuggestionType {
  return [
    'bedtime-shutdown',
    'pms-damage-reduction',
    'shopping-wishlist',
    'story-familiar-comfort',
    'xiaohongshu-algorithm-exit',
    'merge-visible-completion',
    'real-life-edge',
    'english-soft-mode',
    'morning-empty',
    'general-downshift',
  ].includes(String(value))
}

function isDopamineFeedbackReason(value: unknown): value is Iris365DopamineFeedbackReason {
  return [
    'too-many-steps',
    'too-much-screen-time',
    'too-productive',
    'too-weak',
    'keeps-me-awake',
    'still-rabbit-hole',
    'not-realistic',
    'other',
  ].includes(String(value))
}

export const IRIS_365_PROOF_CATEGORIES: Iris365ProofCategory[] = [
  'English output',
  'Shadowing',
  'Cyber project',
  'Cyber / TAFE',
  'AI / Coursera',
  'AI workflow',
  'Project / AI coding',
  'Job application',
  'Career',
  'Work experience',
  'Health / routine',
  'Emotional regulation',
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
    title: '重设默认入口',
    englishLabel: 'Reset the Defaults',
    focus: '先保护起床、吃饭和睡前三个入口。识别冲动，练习延迟和换轨，不要求完美。',
  },
  {
    id: 2,
    startDay: 31,
    endDay: 90,
    title: '建立新节奏',
    englishLabel: 'Build the New Rhythm',
    focus: '让英语内容和每日运动更容易自动出现，减少每次选择所需的意志力。',
  },
  {
    id: 3,
    startDay: 91,
    endDay: 180,
    title: '让它变得普通',
    englishLabel: 'Make It Ordinary',
    focus: '英语环境不再只是学习任务，运动不需要隆重准备，旧循环出现时也能较快回来。',
  },
  {
    id: 4,
    startDay: 181,
    endDay: 365,
    title: '生活在新系统里',
    englishLabel: 'Live Inside the System',
    focus: '重点是维持、调整和继续生活，而不是冲刺或补作业。',
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
    dayNumber: calculateCurrentDayNumber(IRIS_365_START_DATE, date),
    dayType: 'normal',
    energyLevel: 'medium',
    mainFocus: 'foundation',
    proofs: defaultProofs(),
    todayIProved: '',
    englishOutputDetail: {},
    skillTouches: {},
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
    morningGateChecklist: {
      water: false,
      light: false,
      leaveBed: false,
      englishAudio: false,
      gentleMovement: false,
    },
    morningGateStatus: 'unrecorded',
    morningFeeling: '',
    switchLogs: [],
    englishEnvironmentType: '',
    englishEnvironmentTitle: '',
    englishEnvironmentItems: [],
    movementMinutes: 0,
    movementKind: '',
    foundationNote: '',
    updatedAt: new Date().toISOString(),
  }
}

function normaliseMorningGateStatus(value: unknown): Iris365MorningGateStatus {
  return ['protected', 'switched', 'delayed', 'interrupted', 'carried-away', 'unrecorded'].includes(String(value))
    ? value as Iris365MorningGateStatus
    : 'unrecorded'
}

function normaliseMorningFeeling(value: unknown): Iris365MorningFeeling {
  return ['foggy', 'bored', 'anxious', 'stay-in-bed', 'avoid-day', 'automatic-reach', 'other', ''].includes(String(value))
    ? value as Iris365MorningFeeling
    : ''
}

function normaliseSwitchLogs(value: unknown): Iris365SwitchLog[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const log = item as Partial<Iris365SwitchLog>
    if (!log.id || !log.createdAt) return []
    return [{
      id: log.id,
      trigger: log.trigger ?? '',
      oldImpulse: log.oldImpulse ?? '',
      switchAction: log.switchAction ?? '',
      replacement: log.replacement ?? '',
      note: log.note ?? '',
      createdAt: log.createdAt,
    }]
  })
}

function normaliseEnglishEnvironmentItems(
  value: unknown,
  legacyType: string | undefined,
  legacyTitle: string | undefined,
  date: string,
  updatedAt: string | undefined,
): Iris365EnglishEnvironmentItem[] {
  if (Array.isArray(value)) {
    return value.flatMap(item => {
      if (!item || typeof item !== 'object') return []
      const record = item as Partial<Iris365EnglishEnvironmentItem>
      if (!record.id || !record.type) return []
      return [{
        id: record.id,
        type: record.type,
        title: record.title ?? '',
        createdAt: record.createdAt ?? updatedAt ?? new Date().toISOString(),
      }]
    })
  }
  if (!legacyType && !legacyTitle) return []
  return [{
    id: `english-legacy-${date}`,
    type: legacyType || '英语环境',
    title: legacyTitle ?? '',
    createdAt: updatedAt ?? new Date().toISOString(),
  }]
}

function fallbackStore(): Iris365Store {
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    startDate: IRIS_365_START_DATE,
    settings: defaultSettings(),
    entries: {},
    proofItems: [],
    weeklyReviews: {},
    monthlyReviews: {},
    dopamineSwapLogs: [],
    dopamineSwapLibrary: DEFAULT_DOPAMINE_SWAP_LIBRARY.map((item, index) => ({
      ...item,
      id: `iris-default-swap-${index}`,
      timesUsed: 0,
      createdAt: now,
      updatedAt: now,
    })),
  }
}

function normaliseEntry(value: Partial<Iris365Entry>, date: string): Iris365Entry {
  const sleepRhythmProtected = value.sleepRhythmProtected ?? value.sleepProtected ?? false
  const bodyMoved = value.bodyMoved ?? value.movement ?? false
  const oneRealThingDone = value.oneRealThingDone ?? value.realityTask ?? false
  const baseProofs = defaultProofs()
  const proofs: Record<Iris365ProofKey, Iris365DailyProof> = {
    body: { ...baseProofs.body, ...(value.proofs?.body ?? {}), completed: value.proofs?.body?.completed ?? bodyMoved },
    english: { ...baseProofs.english, ...(value.proofs?.english ?? {}), completed: value.proofs?.english?.completed ?? value.englishOutput ?? false },
    realWorld: { ...baseProofs.realWorld, ...(value.proofs?.realWorld ?? {}), completed: value.proofs?.realWorld?.completed ?? oneRealThingDone },
  }
  const highStimulusPatterns = {
    ...defaultHighStimulusPatterns(),
    ...(value.highStimulusPatterns ?? {}),
  }
  return {
    ...emptyIris365Entry(date),
    ...value,
    date,
    dayNumber: calculateCurrentDayNumber(IRIS_365_START_DATE, date),
    dayType: normaliseDayType(value.dayType),
    energyLevel: normaliseEnergyLevel(value.energyLevel),
    mainFocus: normaliseSkillKey(value.mainFocus),
    proofs,
    todayIProved: value.todayIProved ?? value.tinyWin ?? '',
    englishOutputDetail: value.englishOutputDetail ?? {},
    skillTouches: value.skillTouches ?? {},
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
    morningGateChecklist: {
      ...emptyIris365Entry(date).morningGateChecklist,
      ...(value.morningGateChecklist ?? {}),
    },
    morningGateStatus: normaliseMorningGateStatus(value.morningGateStatus),
    morningFeeling: normaliseMorningFeeling(value.morningFeeling),
    switchLogs: normaliseSwitchLogs(value.switchLogs),
    englishEnvironmentType: value.englishEnvironmentType ?? '',
    englishEnvironmentTitle: value.englishEnvironmentTitle ?? '',
    englishEnvironmentItems: normaliseEnglishEnvironmentItems(
      value.englishEnvironmentItems,
      value.englishEnvironmentType,
      value.englishEnvironmentTitle,
      date,
      value.updatedAt,
    ),
    movementMinutes: Math.max(0, Math.round(Number(value.movementMinutes) || 0)),
    movementKind: value.movementKind ?? '',
    foundationNote: value.foundationNote ?? '',
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
    source: value.source ?? 'manual',
    sourceSessionId: value.sourceSessionId,
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
    scores: value.scores ?? {},
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  }
}

function normaliseMonthlyReview(value: Partial<Iris365MonthlyReview>, monthId: string): Iris365MonthlyReview {
  return {
    monthId,
    phase: value.phase ?? '',
    whatChanged: value.whatChanged ?? '',
    whatBecameEasier: value.whatBecameEasier ?? '',
    stillHard: value.stillHard ?? '',
    whatIAvoided: value.whatIAvoided ?? '',
    proudOf: value.proudOf ?? '',
    stopForcing: value.stopForcing ?? '',
    nextSmallUpgrade: value.nextSmallUpgrade ?? '',
    visibleOutput: value.visibleOutput ?? '',
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  }
}

function normaliseSettings(value: Partial<Iris365Settings> | undefined, sourceSchemaVersion: number): Iris365Settings {
  const resetForNewProgramme = sourceSchemaVersion < SCHEMA_VERSION
  const startDate = resetForNewProgramme || !value?.startDate || value.startDate === LEGACY_PROGRAMME_START_DATE
    ? IRIS_365_START_DATE
    : value.startDate
  const endDate = resetForNewProgramme || !value?.endDate || value.endDate === LEGACY_PROGRAMME_END_DATE
    ? programmeEndDate(startDate)
    : value.endDate
  return {
    startDate,
    endDate,
    motto: value?.motto ?? IRIS_365_DEFAULT_MOTTO,
  }
}

function normaliseDopamineUrge(value: unknown): Iris365DopamineUrge | null {
  const mapped: Record<string, Iris365DopamineUrge> = {
    'short-dramas': 'ai-short-dramas',
    'ai-short-dramas': 'ai-short-dramas',
    'web-novels': 'chinese-web-novels',
    'chinese-web-novels': 'chinese-web-novels',
    'xiaohongshu-scrolling': 'xiaohongshu-scrolling',
    shopping: 'shopping-price-checking',
    'shopping-price-checking': 'shopping-price-checking',
    'mobile-game': 'romance-restaurant-merge-game',
    'romance-restaurant-merge-game': 'romance-restaurant-merge-game',
    'random-phone-scrolling': 'xiaohongshu-scrolling',
    'bedtime-find-watch': 'bedtime-find-watch',
    'avoiding-everything': 'avoiding-real-life-tasks',
    'avoiding-real-life-tasks': 'avoiding-real-life-tasks',
  }
  return mapped[String(value)] ?? null
}

function normaliseDopamineState(value: unknown): Iris365DopamineState | null {
  const mapped: Record<string, Iris365DopamineState> = {
    tired: 'afternoon-low-motivation',
    'empty-bored': 'just-woke-empty',
    anxious: 'anxious-numb-out',
    'avoiding-task': 'avoiding-assignment-admin',
    'bedtime-cant-stop': 'bedtime-cant-stop',
    'pms-low-control': 'pms-low-control',
    'low-energy': 'afternoon-low-motivation',
    'just-woke-empty': 'just-woke-empty',
    'afternoon-low-motivation': 'afternoon-low-motivation',
    'evening-cant-transition': 'evening-cant-transition',
    'avoiding-assignment-admin': 'avoiding-assignment-admin',
    'english-feels-hard': 'english-feels-hard',
    'anxious-numb-out': 'anxious-numb-out',
  }
  return mapped[String(value)] ?? null
}

function isDopamineOutcome(value: unknown): value is Iris365DopamineOutcome {
  return [
    'redirected',
    'delayed-urge',
    'softer-option',
    'rabbit-hole-avoided',
    'saved-tomorrow',
    'binged-but-noticed',
    'need-sleep',
    'need-food',
    'need-comfort',
  ].includes(String(value))
}

function normaliseSwapLog(value: Partial<Iris365DopamineSwapLog>): Iris365DopamineSwapLog | null {
  const urge = normaliseDopamineUrge(value.urge)
  const state = normaliseDopamineState(value.state)
  if (!value.id || !value.date || !urge || !state) return null
  return {
    id: value.id,
    date: value.date,
    urge,
    state,
    suggestion: value.suggestion ?? '',
    comfortOption: value.comfortOption ?? '',
    tinyAction: value.tinyAction,
    outcome: isDopamineOutcome(value.outcome) ? value.outcome : undefined,
    createdAt: value.createdAt ?? new Date().toISOString(),
    completedAt: value.completedAt,
  }
}

function normaliseSwapLibraryItem(value: Partial<Iris365DopamineSwapLibraryItem>): Iris365DopamineSwapLibraryItem | null {
  if (!value.id || !value.text) return null
  return {
    id: value.id,
    text: value.text,
    urge: normaliseDopamineUrge(value.urge) ?? undefined,
    state: normaliseDopamineState(value.state) ?? undefined,
    suggestionType: isDopamineSuggestionType(value.suggestionType) ? value.suggestionType : undefined,
    feedbackReason: isDopamineFeedbackReason(value.feedbackReason) ? value.feedbackReason : undefined,
    status: value.status === 'doesnt-work' ? 'doesnt-work' : 'works',
    timesUsed: Math.max(0, Math.round(Number(value.timesUsed) || 0)),
    priorityScore: Number.isFinite(Number(value.priorityScore)) ? Number(value.priorityScore) : undefined,
    createdAt: value.createdAt ?? new Date().toISOString(),
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
  const sourceSchemaVersion = Number(parsed.schemaVersion) || 0
  const now = new Date().toISOString()
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
  const monthlyReviews = Object.entries(parsed.monthlyReviews ?? {}).reduce<Record<string, Iris365MonthlyReview>>((acc, [monthId, review]) => {
    if (review && typeof review === 'object') acc[monthId] = normaliseMonthlyReview(review as Partial<Iris365MonthlyReview>, monthId)
    return acc
  }, {})
  const dopamineSwapLogs = Array.isArray(parsed.dopamineSwapLogs)
    ? parsed.dopamineSwapLogs.map(normaliseSwapLog).filter((item): item is Iris365DopamineSwapLog => Boolean(item))
    : []
  const savedSwapLibrary = Array.isArray(parsed.dopamineSwapLibrary)
    ? parsed.dopamineSwapLibrary.map(normaliseSwapLibraryItem).filter((item): item is Iris365DopamineSwapLibraryItem => Boolean(item))
    : []
  const libraryTexts = new Set(savedSwapLibrary.map(item => item.text.toLowerCase()))
  const dopamineSwapLibrary = [
    ...savedSwapLibrary,
    ...DEFAULT_DOPAMINE_SWAP_LIBRARY
      .filter(item => !libraryTexts.has(item.text.toLowerCase()))
      .map((item, index) => ({
        ...item,
        id: `iris-default-swap-${index}`,
        timesUsed: 0,
        createdAt: now,
        updatedAt: now,
      })),
  ]
  return {
    schemaVersion: SCHEMA_VERSION,
    startDate: IRIS_365_START_DATE,
    settings: normaliseSettings(parsed.settings, sourceSchemaVersion),
    entries,
    proofItems,
    weeklyReviews,
    monthlyReviews,
    dopamineSwapLogs,
    dopamineSwapLibrary,
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

export function updateIris365StartDate(startDate: string, store = loadIris365Store()): Iris365Store {
  return saveIris365Store({
    ...store,
    startDate,
    settings: {
      ...store.settings,
      startDate,
      endDate: programmeEndDate(startDate),
    },
  })
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
    scores: {},
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

export function getIris365MonthId(date = getLocalDateKey()): string {
  return date.slice(0, 7)
}

export function emptyIris365MonthlyReview(monthId = getIris365MonthId()): Iris365MonthlyReview {
  return normaliseMonthlyReview({}, monthId)
}

export function saveIris365MonthlyReview(review: Iris365MonthlyReview, store = loadIris365Store()): Iris365Store {
  return saveIris365Store({
    ...store,
    monthlyReviews: {
      ...store.monthlyReviews,
      [review.monthId]: {
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

export function addIris365DopamineSwapLog(
  input: Omit<Iris365DopamineSwapLog, 'id' | 'createdAt'>,
  store = loadIris365Store(),
): Iris365Store {
  const now = new Date().toISOString()
  return saveIris365Store({
    ...store,
    dopamineSwapLogs: [
      {
        ...input,
        id: crypto.randomUUID(),
        createdAt: now,
      },
      ...store.dopamineSwapLogs,
    ],
  })
}

export function updateIris365DopamineSwapLog(
  logId: string,
  patch: Partial<Iris365DopamineSwapLog>,
  store = loadIris365Store(),
): Iris365Store {
  return saveIris365Store({
    ...store,
    dopamineSwapLogs: store.dopamineSwapLogs.map(log =>
      log.id === logId ? { ...log, ...patch } : log,
    ),
  })
}

export function saveIris365SwapLibraryItem(
  input: Omit<Iris365DopamineSwapLibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'timesUsed'>,
  store = loadIris365Store(),
): Iris365Store {
  const now = new Date().toISOString()
  const existing = store.dopamineSwapLibrary.find(item => item.text.toLowerCase() === input.text.toLowerCase())
  const nextItem: Iris365DopamineSwapLibraryItem = existing
    ? {
        ...existing,
        ...input,
        timesUsed: existing.timesUsed + (input.status === 'works' ? 1 : 0),
        priorityScore: (existing.priorityScore ?? 0) + (input.status === 'works' ? 2 : -2),
        updatedAt: now,
      }
    : {
        ...input,
        id: crypto.randomUUID(),
        timesUsed: input.status === 'works' ? 1 : 0,
        priorityScore: input.status === 'works' ? 2 : -2,
        createdAt: now,
        updatedAt: now,
      }
  return saveIris365Store({
    ...store,
    dopamineSwapLibrary: [
      nextItem,
      ...store.dopamineSwapLibrary.filter(item => item.id !== nextItem.id),
    ],
  })
}

export function getIris365DopamineWeekStats(store = loadIris365Store(), date = getLocalDateKey()): {
  swapsAttempted: number
  mostCommonUrge: Iris365DopamineUrge | null
  mostCommonState: Iris365DopamineState | null
  mostEffectiveSavedSwap: Iris365DopamineSwapLibraryItem | null
  delayedCount: number
  rabbitHolesAvoided: number
  savedTomorrowCount: number
} {
  const weekStart = getIris365WeekStart(date)
  const start = parseLocalDate(weekStart)
  const end = parseLocalDate(weekStart)
  end.setDate(end.getDate() + 6)
  const logs = store.dopamineSwapLogs.filter(log => {
    const current = parseLocalDate(log.date)
    return current >= start && current <= end
  })
  const mostCommon = <T extends string>(values: T[]): T | null => {
    const counts = values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1
      return acc
    }, {})
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
    return (winner as T | undefined) ?? null
  }
  return {
    swapsAttempted: logs.length,
    mostCommonUrge: mostCommon(logs.map(log => log.urge)),
    mostCommonState: mostCommon(logs.map(log => log.state)),
    mostEffectiveSavedSwap: [...store.dopamineSwapLibrary]
      .filter(item => item.status === 'works')
      .sort((a, b) => b.timesUsed - a.timesUsed)[0] ?? null,
    delayedCount: logs.filter(log => log.outcome === 'delayed-urge').length,
    rabbitHolesAvoided: logs.filter(log => log.outcome === 'rabbit-hole-avoided').length,
    savedTomorrowCount: logs.filter(log => log.outcome === 'saved-tomorrow' || log.outcome === 'need-sleep').length,
  }
}

export function addIris365ProofItem(
  input: Omit<Iris365ProofItem, 'id' | 'createdAt' | 'updatedAt'>,
  store = loadIris365Store(),
): Iris365Store {
  const now = new Date().toISOString()
  if (input.sourceSessionId && store.proofItems.some(item => item.sourceSessionId === input.sourceSessionId)) {
    return store
  }
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

export function findIris365ProofByStudySession(
  sessionId: string,
  store = loadIris365Store(),
): Iris365ProofItem | null {
  return store.proofItems.find(item => item.sourceSessionId === sessionId) ?? null
}

export function getIris365ProofItemsForDate(
  date = getLocalDateKey(),
  store = loadIris365Store(),
): Iris365ProofItem[] {
  return store.proofItems.filter(item => item.date === date)
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

export function isProofWorthyStudySession(session: StudySessionRecord): boolean {
  return ['English Output', 'Coursera AI Pathway', 'AI Coding', 'Job / Career', 'Cyber'].includes(session.category)
}

export function studySessionHasProofArtifact(session: StudySessionRecord): boolean {
  return Boolean(
    session.notes.trim()
    || session.noteDestination.trim()
    || session.resourceUsed.trim(),
  )
}

export function studySessionProofCategory(session: StudySessionRecord): Iris365ProofCategory {
  if (session.category === 'English Output') return 'English output'
  if (session.category === 'Coursera AI Pathway') return 'AI / Coursera'
  if (session.category === 'AI Coding') return 'Project / AI coding'
  if (session.category === 'Job / Career') return 'Career'
  if (session.category === 'Cyber') return 'Cyber / TAFE'
  return 'Personal insight'
}

export function studySessionProofDescription(session: StudySessionRecord): string {
  if (session.category === 'English Output') {
    return `Completed an English output session: ${session.title}. Practised speaking, shadowing, oral summary, or original English and created reusable expressions or notes.`
  }
  if (session.category === 'Coursera AI Pathway') {
    return `Completed a Coursera AI Pathway study session: ${session.title}. Captured key concepts and potential portfolio or application ideas.`
  }
  if (session.category === 'AI Coding') {
    return `Worked on an AI/project implementation session: ${session.title}. This can be used as evidence of hands-on AI workflow or coding practice.`
  }
  if (session.category === 'Job / Career') {
    return `Completed a career development session: ${session.title}. This may support CV, LinkedIn, applications, or interview preparation.`
  }
  if (session.category === 'Cyber') {
    return `Completed a cyber security learning session: ${session.title}. This supports my cyber foundation and TAFE assessment progress.`
  }
  return `Completed a study session: ${session.title}. This may become visible evidence if it produced a reusable note, artifact, or next action.`
}

export function buildProofDraftFromStudySession(
  session: StudySessionRecord,
): Omit<Iris365ProofItem, 'id' | 'createdAt' | 'updatedAt'> {
  const resource = session.resourceUsed.trim()
  const noteDestination = session.noteDestination.trim()
  return {
    date: getLocalDateKey(new Date(session.completedAt)),
    category: studySessionProofCategory(session),
    title: session.title,
    linkOrFile: isUrl(resource) ? resource : noteDestination || resource,
    description: studySessionProofDescription(session),
    source: 'study-session',
    sourceSessionId: session.id,
  }
}

export function addIris365ProofFromStudySession(
  session: StudySessionRecord,
  input: Partial<Omit<Iris365ProofItem, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'sourceSessionId'>> = {},
  store = loadIris365Store(),
): Iris365Store {
  const draft = {
    ...buildProofDraftFromStudySession(session),
    ...input,
    source: 'study-session' as const,
    sourceSessionId: session.id,
  }
  return addIris365ProofItem(draft, store)
}
