export type ComfortMediaType =
  | 'Audiobook'
  | 'Podcast'
  | 'TV show'
  | 'Movie'
  | 'Book'
  | 'Web novel'
  | 'Variety show'
  | 'YouTube'
  | 'Drama / BL'
  | 'Short drama'

export type ComfortMediaLanguage = 'English' | 'Chinese' | 'Japanese' | 'Mixed'

export type ComfortMediaStatus =
  | 'Want to try'
  | 'In progress'
  | 'Finished'
  | 'Dropped'
  | 'Rewatch'
  | 'Relisten'

export type ComfortMediaPlatform =
  | 'Libby'
  | 'Hoopla'
  | 'YouTube'
  | 'Netflix'
  | 'Bilibili'
  | 'Spotify'
  | 'Audible'
  | 'Other'

export type ComfortMediaTriState = 'yes' | 'no' | 'unknown'

export interface ComfortMediaItem {
  id: string
  title: string
  type: ComfortMediaType
  language: ComfortMediaLanguage
  status: ComfortMediaStatus
  platform: ComfortMediaPlatform
  comfortLevel: number
  englishUsefulness: number
  dopamineRisk: number
  bedtimeSafe: boolean
  lowAngst: ComfortMediaTriState
  rewatchValue: number
  notes: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface ComfortLibraryStore {
  items: ComfortMediaItem[]
  seededAt: string
  updatedAt: string
}

export type ComfortMediaDraft = Omit<ComfortMediaItem, 'id' | 'createdAt' | 'updatedAt'>
