export type TodayHeroImageSourceType = 'upload' | 'preset' | 'default'
export type TodayHeroObjectPosition = 'left' | 'center' | 'right'
export type TodayHeroObjectFit = 'cover' | 'contain'

export interface TodayHeroImageSettings {
  sourceType: TodayHeroImageSourceType
  dataUrl?: string
  presetId?: string
  objectPosition: TodayHeroObjectPosition
  objectFit: TodayHeroObjectFit
}

export interface AppearanceSettings {
  todayHeroImage?: TodayHeroImageSettings
}

const STORAGE_KEY = 'iris-appearance-settings'
const MAX_STORED_BYTES = 1.5 * 1024 * 1024
const MAX_WIDTH = 1600
const MAX_HEIGHT = 1200

export const DEFAULT_TODAY_HERO_IMAGE: TodayHeroImageSettings = {
  sourceType: 'default',
  objectPosition: 'center',
  objectFit: 'cover',
}

function normaliseHeroImage(value: Partial<TodayHeroImageSettings> | undefined): TodayHeroImageSettings {
  return {
    sourceType: value?.sourceType === 'upload' || value?.sourceType === 'preset' ? value.sourceType : 'default',
    dataUrl: value?.dataUrl,
    presetId: value?.presetId,
    objectPosition: value?.objectPosition === 'left' || value?.objectPosition === 'right' ? value.objectPosition : 'center',
    objectFit: value?.objectFit === 'contain' ? 'contain' : 'cover',
  }
}

export function loadAppearanceSettings(): AppearanceSettings {
  if (typeof localStorage === 'undefined') return { todayHeroImage: DEFAULT_TODAY_HERO_IMAGE }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AppearanceSettings>
    return {
      ...parsed,
      todayHeroImage: normaliseHeroImage(parsed.todayHeroImage),
    }
  } catch {
    return { todayHeroImage: DEFAULT_TODAY_HERO_IMAGE }
  }
}

export function saveAppearanceSettings(settings: AppearanceSettings): { success: true } | { success: false; message: string } {
  if (typeof localStorage === 'undefined') return { success: true }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    window.dispatchEvent(new CustomEvent('iris-appearance-settings-changed'))
    return { success: true }
  } catch {
    return { success: false, message: 'Image is too large. Please choose a smaller image.' }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), type, quality))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function compressTodayHeroImage(file: File): Promise<{ dataUrl: string; bytes: number }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG, or WebP image.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image could not be read.'))
      image.src = objectUrl
    })

    const ratio = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight)
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image could not be processed.')
    context.drawImage(image, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, 'image/webp', 0.82)
      ?? await canvasToBlob(canvas, 'image/jpeg', 0.82)
    if (!blob) throw new Error('Image could not be compressed.')
    if (blob.size > MAX_STORED_BYTES) {
      throw new Error('Image is too large. Please choose a smaller image.')
    }

    return {
      dataUrl: await blobToDataUrl(blob),
      bytes: blob.size,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
