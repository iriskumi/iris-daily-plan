import { englishOutputRepsForDate, loadEnglishOutputJourney } from './englishOutputJourney'
import { loadExerciseLog } from './exerciseStorage'
import { getLocalDateKey } from './focus'

export interface Iris365DailyAnchorSync {
  bodyMovedAuto: boolean
  bodyMovedMinutes: number
  englishOutputAuto: boolean
  englishOutputReps: number
}

export function getIris365DailyAnchorSync(date = getLocalDateKey()): Iris365DailyAnchorSync {
  let bodyMovedMinutes = 0
  let englishOutputReps = 0

  try {
    bodyMovedMinutes = loadExerciseLog().entries
      .filter(entry => entry.date === date && entry.durationMinutes > 0)
      .reduce((sum, entry) => sum + entry.durationMinutes, 0)
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[Iris365Sync] Failed to read Exercise log', error)
  }

  try {
    englishOutputReps = englishOutputRepsForDate(loadEnglishOutputJourney(), date)
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[Iris365Sync] Failed to read English Output Journey', error)
  }

  return {
    bodyMovedAuto: bodyMovedMinutes > 0,
    bodyMovedMinutes,
    englishOutputAuto: englishOutputReps > 0,
    englishOutputReps,
  }
}
