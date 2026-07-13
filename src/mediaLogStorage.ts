export interface MediaLogEntry {
  id: string
  title: string
  type: string
  language: string
  status: string
  mood: string[]
  usefulness: string[]
  sourcePlatform?: string
  link?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface MediaLogStore {
  entries: MediaLogEntry[]
}

const STORAGE_KEY = 'iris-media-log'

export const MEDIA_TYPES = ['Audiobook', 'Book', 'TV Show', 'Drama', 'Variety Show', 'Movie', 'Podcast', 'YouTube / Clip', 'Course / Learning Clip', 'Other']
export const MEDIA_LANGUAGES = ['English', 'Japanese', 'Chinese', 'Mixed', 'Other']
export const MEDIA_STATUSES = ['Want to try', 'In progress', 'Finished', 'Dropped', 'Rewatch / Relisten', 'Comfort pick']
export const MEDIA_MOODS = ['low-angst', 'funny', 'cozy', 'comfort', 'background', 'bingeable', 'easy English', 'easy Japanese', 'too intense', 'not for low-energy days', 'favourite', 'boring', 'dropped']
export const MEDIA_USEFULNESS = ['good for English', 'good for Japanese', 'good for expressions', 'good for shadowing']
export const MEDIA_PLATFORMS = ['Libby', 'Hoopla', 'Audible', 'Coursera', 'ABC iview', 'Netflix', 'YouTube', 'Podcast app', 'Other']

export const MEDIA_RECOMMENDATION_POOLS = [
  {
    title: 'Comfort watching',
    items: [
      'Utopia',
      'Fisk',
      'Rosehaven',
      'Upper Middle Bogan',
      'Have You Been Paying Attention?',
      'The Cheap Seats',
      'Thank God You’re Here',
    ],
  },
  {
    title: 'Low-angst listening',
    items: ['M/M audiobook', 'Puckboy / Eden Finley / Saxon James audiobook', 'Libby audiobook', 'easy audiobook', 'light sitcom / comedy', 'cozy podcast episode'],
  },
  {
    title: 'Light Japanese shelf',
    items: ['Japanese variety show', 'Japanese drama', 'Japanese YouTube', 'casual Japanese input', 'one short episode, no pressure'],
  },
]

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => String(item).trim()).filter(Boolean))]
}

function normalizeEntry(value: unknown): MediaLogEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<MediaLogEntry>
  const title = String(entry.title ?? '').trim()
  if (!title) return null
  const now = new Date().toISOString()
  return {
    id: String(entry.id ?? makeId('media')),
    title,
    type: String(entry.type ?? 'Audiobook'),
    language: String(entry.language ?? 'English'),
    status: String(entry.status ?? 'Want to try'),
    mood: normalizeList(entry.mood),
    usefulness: normalizeList(entry.usefulness),
    sourcePlatform: String(entry.sourcePlatform ?? ''),
    link: String(entry.link ?? ''),
    notes: String(entry.notes ?? ''),
    createdAt: String(entry.createdAt ?? now),
    updatedAt: String(entry.updatedAt ?? now),
  }
}

export function loadMediaLog(): MediaLogStore {
  if (typeof localStorage === 'undefined') return { entries: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { entries: [] }
    const parsed = JSON.parse(raw) as Partial<MediaLogStore>
    return {
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map(normalizeEntry).filter((entry): entry is MediaLogEntry => Boolean(entry))
        : [],
    }
  } catch (error) {
    console.warn('[MediaLog] Failed to load media log', error)
    return { entries: [] }
  }
}

export function saveMediaLog(store: MediaLogStore) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function addMediaEntry(input: Omit<MediaLogEntry, 'id' | 'createdAt' | 'updatedAt'>, store = loadMediaLog()) {
  const now = new Date().toISOString()
  const entry: MediaLogEntry = {
    ...input,
    id: makeId('media'),
    title: input.title.trim(),
    mood: normalizeList(input.mood),
    usefulness: normalizeList(input.usefulness),
    createdAt: now,
    updatedAt: now,
  }
  const nextStore = { entries: [entry, ...store.entries] }
  saveMediaLog(nextStore)
  return { entry, store: nextStore }
}

export function updateMediaEntry(
  id: string,
  input: Omit<MediaLogEntry, 'id' | 'createdAt' | 'updatedAt'>,
  store = loadMediaLog(),
) {
  const index = store.entries.findIndex(entry => entry.id === id)
  if (index < 0) return null
  const existing = store.entries[index]
  const now = new Date().toISOString()
  const entry: MediaLogEntry = {
    ...existing,
    ...input,
    id: existing.id,
    title: input.title.trim(),
    mood: normalizeList(input.mood),
    usefulness: normalizeList(input.usefulness),
    createdAt: existing.createdAt,
    updatedAt: now,
  }
  const entries = [...store.entries]
  entries[index] = entry
  const nextStore = { entries }
  saveMediaLog(nextStore)
  return { entry, store: nextStore }
}

export function mediaObsidianMarkdown(entry: MediaLogEntry) {
  const destination = entry.language === 'Japanese' ? '02 Japanese 日语/Media Notes/' : '01 English 英语/Media Notes/'
  return {
    destination,
    markdown: `# Media Note - ${entry.title}

## Basic Info
- Type: ${entry.type}
- Language: ${entry.language}
- Status: ${entry.status}
- Platform: ${entry.sourcePlatform ?? ''}
- Link: ${entry.link ?? ''}

## Why it is useful
- ${entry.usefulness.join(', ') || ' '}

## For English / Japanese
- Useful expressions:
- Good for shadowing: ${entry.usefulness.includes('English output material') ? 'yes' : 'no'}
- Good for low-energy input: ${entry.mood.includes('low-angst') || entry.mood.includes('background') ? 'yes' : 'no'}

## Notes
- ${entry.notes ?? ''}

Suggested destination: ${destination}`,
  }
}
