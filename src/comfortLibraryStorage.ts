import type {
  ComfortLibraryStore,
  ComfortMediaDraft,
  ComfortMediaItem,
  ComfortMediaLanguage,
  ComfortMediaPlatform,
  ComfortMediaStatus,
  ComfortMediaTriState,
  ComfortMediaType,
} from './comfortLibraryTypes'

const STORAGE_KEY = 'iris-comfort-library'

export const COMFORT_MEDIA_TYPES: ComfortMediaType[] = [
  'Audiobook',
  'Podcast',
  'TV show',
  'Movie',
  'Book',
  'Web novel',
  'Variety show',
  'YouTube',
  'Drama / BL',
  'Short drama',
]

export const COMFORT_MEDIA_LANGUAGES: ComfortMediaLanguage[] = ['English', 'Chinese', 'Japanese', 'Mixed']

export const COMFORT_MEDIA_STATUSES: ComfortMediaStatus[] = [
  'Want to try',
  'In progress',
  'Finished',
  'Dropped',
  'Rewatch',
  'Relisten',
]

export const COMFORT_MEDIA_PLATFORMS: ComfortMediaPlatform[] = [
  'Libby',
  'Hoopla',
  'YouTube',
  'Netflix',
  'Bilibili',
  'Spotify',
  'Audible',
  'Other',
]

export const COMFORT_SUGGESTED_TAGS = [
  'Puckboy-like',
  'low angst',
  'funny',
  'good banter',
  'found family',
  'spicy',
  'good narrator',
  'comfort listen',
  'comfort show',
  'bedtime safe',
  'Aussie English',
  'daily English',
  'too addictive',
  'too boring',
  'not for me',
  'short-drama replacement',
  'English shadowing material',
  'background listening',
] as const

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function clampRating(value: unknown, fallback = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(5, Math.round(number)))
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.includes(value as T)
}

function normalizeTriState(value: unknown): ComfortMediaTriState {
  return isOneOf(value, ['yes', 'no', 'unknown'] as const) ? value : 'unknown'
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(tag => String(tag).trim()).filter(Boolean))]
}

function normalizeItem(value: unknown): ComfortMediaItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<ComfortMediaItem>
  const title = String(item.title ?? '').trim()
  if (!title) return null

  const now = new Date().toISOString()
  return {
    id: String(item.id ?? makeId('comfort')),
    title,
    type: isOneOf(item.type, COMFORT_MEDIA_TYPES) ? item.type : 'Audiobook',
    language: isOneOf(item.language, COMFORT_MEDIA_LANGUAGES) ? item.language : 'English',
    status: isOneOf(item.status, COMFORT_MEDIA_STATUSES) ? item.status : 'Want to try',
    platform: isOneOf(item.platform, COMFORT_MEDIA_PLATFORMS) ? item.platform : 'Other',
    comfortLevel: clampRating(item.comfortLevel),
    englishUsefulness: clampRating(item.englishUsefulness),
    dopamineRisk: clampRating(item.dopamineRisk),
    bedtimeSafe: Boolean(item.bedtimeSafe),
    lowAngst: normalizeTriState(item.lowAngst),
    rewatchValue: clampRating(item.rewatchValue),
    notes: String(item.notes ?? ''),
    tags: normalizeTags(item.tags),
    createdAt: String(item.createdAt ?? now),
    updatedAt: String(item.updatedAt ?? now),
  }
}

function seededItems(now: string): ComfortMediaItem[] {
  return [
    {
      id: 'comfort-seed-shameless-puckboy',
      title: 'Shameless Puckboy',
      type: 'Audiobook',
      language: 'English',
      status: 'Finished',
      platform: 'Audible',
      comfortLevel: 5,
      englishUsefulness: 4,
      dopamineRisk: 2,
      bedtimeSafe: true,
      lowAngst: 'yes',
      rewatchValue: 5,
      tags: ['Puckboy-like', 'low angst', 'funny', 'good banter', 'comfort listen', 'good narrator', 'short-drama replacement'],
      notes: 'Strong comfort listen. Good replacement for short dramas/web novels.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'comfort-seed-blindsided',
      title: 'Blindsided',
      type: 'Audiobook',
      language: 'English',
      status: 'Dropped',
      platform: 'Audible',
      comfortLevel: 2,
      englishUsefulness: 2,
      dopamineRisk: 1,
      bedtimeSafe: true,
      lowAngst: 'unknown',
      rewatchValue: 1,
      tags: ['too boring', 'not for me'],
      notes: 'Felt boring compared with Puckboy.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'comfort-seed-fisk',
      title: 'Fisk',
      type: 'TV show',
      language: 'English',
      status: 'In progress',
      platform: 'Netflix',
      comfortLevel: 4,
      englishUsefulness: 5,
      dopamineRisk: 2,
      bedtimeSafe: true,
      lowAngst: 'yes',
      rewatchValue: 4,
      tags: ['Aussie English', 'daily English', 'comfort show', 'background listening'],
      notes: 'Useful for Australian daily English without feeling too serious.',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function createComfortMediaDraft(): ComfortMediaDraft {
  return {
    title: '',
    type: 'Audiobook',
    language: 'English',
    status: 'Want to try',
    platform: 'Other',
    comfortLevel: 3,
    englishUsefulness: 3,
    dopamineRisk: 3,
    bedtimeSafe: false,
    lowAngst: 'unknown',
    rewatchValue: 3,
    notes: '',
    tags: [],
  }
}

export function loadComfortLibraryStore(): ComfortLibraryStore {
  if (typeof localStorage === 'undefined') {
    const now = new Date().toISOString()
    return { items: seededItems(now), seededAt: now, updatedAt: now }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const now = new Date().toISOString()
      const seeded = { items: seededItems(now), seededAt: now, updatedAt: now }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw) as Partial<ComfortLibraryStore>
    const items = Array.isArray(parsed.items) ? parsed.items.map(normalizeItem).filter(Boolean) as ComfortMediaItem[] : []
    const now = new Date().toISOString()
    return {
      items,
      seededAt: String(parsed.seededAt ?? now),
      updatedAt: String(parsed.updatedAt ?? now),
    }
  } catch (error) {
    console.warn('[ComfortLibrary] Failed to load store', error)
    const now = new Date().toISOString()
    return { items: seededItems(now), seededAt: now, updatedAt: now }
  }
}

export function saveComfortLibraryStore(store: ComfortLibraryStore) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function addComfortMediaItem(draft: ComfortMediaDraft, currentStore = loadComfortLibraryStore()) {
  const now = new Date().toISOString()
  const item: ComfortMediaItem = {
    ...draft,
    id: makeId('comfort'),
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    tags: normalizeTags(draft.tags),
    comfortLevel: clampRating(draft.comfortLevel),
    englishUsefulness: clampRating(draft.englishUsefulness),
    dopamineRisk: clampRating(draft.dopamineRisk),
    rewatchValue: clampRating(draft.rewatchValue),
    createdAt: now,
    updatedAt: now,
  }
  const store = {
    ...currentStore,
    items: [item, ...currentStore.items],
    updatedAt: now,
  }
  saveComfortLibraryStore(store)
  return { item, store }
}

export function comfortLibraryStats(items: ComfortMediaItem[]) {
  const finishedItems = items.filter(item => item.status === 'Finished' || item.status === 'Rewatch' || item.status === 'Relisten')
  const droppedItems = items.filter(item => item.status === 'Dropped')
  const bestComfort = [...items].sort((a, b) => b.comfortLevel - a.comfortLevel || b.rewatchValue - a.rewatchValue)[0] ?? null
  const bestEnglish = [...items].sort((a, b) => b.englishUsefulness - a.englishUsefulness || b.comfortLevel - a.comfortLevel)[0] ?? null
  const highestRisk = [...items].sort((a, b) => b.dopamineRisk - a.dopamineRisk || b.comfortLevel - a.comfortLevel)[0] ?? null

  return {
    total: items.length,
    finished: finishedItems.length,
    dropped: droppedItems.length,
    bestComfort,
    bestEnglish,
    highestRisk,
  }
}
