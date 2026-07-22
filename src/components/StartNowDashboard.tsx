import { BookOpen, CheckCircle2, ChevronDown, ClipboardList, Clock3, Copy, Dumbbell, Folder, Image as ImageIcon, ListChecks, Mic, Monitor, Pause, Pencil, Play, StickyNote, Target, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  ACTIVE_SESSION_CHANGED_EVENT,
  clearActiveSession,
  restoreActiveSession,
  updateActiveSession,
  type ActiveSession,
} from '../activeSessionStore'
import {
  DEFAULT_TODAY_HERO_IMAGE,
  compressTodayHeroImage,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type TodayHeroImageSettings,
  type TodayHeroObjectFit,
} from '../appearanceSettings'
import { startStudySessionFromQueueBlock } from '../blockQueueStudySession'
import {
  englishOutputRepsForDate,
  englishOutputRepsForLastSevenDays,
  loadEnglishOutputJourney,
  removeStudySessionEnglishOutputRep,
} from '../englishOutputJourney'
import { deleteExerciseEntry, loadExerciseLog } from '../exerciseStorage'
import { markQueueBlockDoneFromSession } from '../queueTaskHelpers'
import { createStudyHandoffFromQueueBlock, saveStudyTaskHandoff } from '../studyHandoff'
import WeekBars, { lastSevenDayKeys, weekdayLabel } from './WeekBars'
import { getLocalDateKey } from '../focus'
import { IRIS365_MOMENTUM_START_DATE } from '../iris365MomentumStorage'
import { addStudySessionRecord, clearActiveStudySession, loadActiveStudySession, loadStudySessionRecords, loadStudySessionRecordsForDate, saveActiveStudySession, saveStudySessionRecords, STUDY_ACTIVE_SESSION_CHANGED_EVENT } from '../studyStorage'
import { addStudySessionEnglishOutputRep } from '../englishOutputJourney'
import type { StudyActiveSession, StudySessionRecord } from '../studyTypes'
import { removeTaskStoreSession, writeStudySessionToTaskStore } from '../taskStore'
import * as timerEngine from '../timerEngine'
import type { TimerSession } from '../timerEngineTypes'
import type { DayBlock } from '../types'
import { FocusStateArtwork } from './FocusStateArtwork'
import HeroImageViewport from './HeroImageViewport'
import DailyRhythmLog from './DailyRhythmLog'

const STUDY_TIMER_ENGINE_KEY = 'iris-study-timer-engine-active'
const TODAY_ENTRY_STORAGE_KEY = 'iris-today-entry-records'
const FOCUS_CELEBRATION_STORAGE_KEY = 'iris-focus-completion-celebration'
const DAILY_SERIOUS_MINUTES_TARGET = 480
const DAILY_SERIOUS_TASK_TARGET = 5

export type TodayStartModule = 'note' | 'done' | 'queue'

interface TodayEntryRecord {
  date: string
  firstOpenedAt: string
  lastOpenedAt: string
  openCount: number
}

interface FocusCelebration {
  title: string
  minutes: number
  expiresAt: number
}

let focusCelebrationCache: FocusCelebration | null = null

function loadFocusCelebration(): FocusCelebration | null {
  if (focusCelebrationCache && focusCelebrationCache.expiresAt > Date.now()) {
    return focusCelebrationCache
  }
  focusCelebrationCache = null
  if (typeof sessionStorage === 'undefined') return null
  try {
    const parsed = JSON.parse(sessionStorage.getItem(FOCUS_CELEBRATION_STORAGE_KEY) ?? 'null') as FocusCelebration | null
    if (!parsed || parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(FOCUS_CELEBRATION_STORAGE_KEY)
      return null
    }
    focusCelebrationCache = parsed
    return parsed
  } catch {
    sessionStorage.removeItem(FOCUS_CELEBRATION_STORAGE_KEY)
    return null
  }
}

function saveFocusCelebration(celebration: FocusCelebration | null) {
  focusCelebrationCache = celebration
  if (typeof sessionStorage === 'undefined') return
  if (!celebration) {
    sessionStorage.removeItem(FOCUS_CELEBRATION_STORAGE_KEY)
    return
  }
  sessionStorage.setItem(FOCUS_CELEBRATION_STORAGE_KEY, JSON.stringify(celebration))
}

interface StartNowDashboardProps {
  onOpenStudy?: () => void
  onOpenExercise?: () => void
  onOpenPlan?: () => void
  nextBlock?: DayBlock | null
  queueCount?: number
  sessionMinutesToday?: number
  expandedModule?: TodayStartModule | null
  onExpandedModuleChange?: (module: TodayStartModule | null) => void
  todayNote?: {
    lines: string[]
    caption: string
  }
  eveningNote?: string
}

function getIris365DayNumber() {
  const start = new Date(`${IRIS365_MOMENTUM_START_DATE}T00:00:00`)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return Math.max(1, Math.min(365, diff + 1))
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function labelFromToken(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function noteLabelFromDestination(value: string): string {
  const withoutExtension = value.replace(/\.[^/.]+$/, '')
  const parts = withoutExtension.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || value
}

function compactMethodKeywords(value: string): string[] {
  const normalized = value.replace(/\s+/g, ' ').trim()
  const lower = normalized.toLowerCase()

  if (/lesson|video section|course/.test(lower)) return ['One lesson', 'Minimal notes', 'Clear finish']
  if (/shadow|pronunciation|clip/.test(lower)) return ['One clip', 'Shadow aloud', 'Save one phrase']
  if (/review|notebooklm|notes/.test(lower)) return ['Open notes', 'Key points', 'One section']
  if (/code|project|debug|build/.test(lower)) return ['Open project', 'One change', 'Save progress']
  if (/write|assessment|report/.test(lower)) return ['One section', 'Rough first', 'Save draft']

  const phrases = normalized
    .split(/[.!?;]+/)
    .map(phrase => phrase.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map(phrase => {
      if (phrase.length <= 28) return phrase
      const words = phrase.split(' ')
      let compact = ''
      for (const word of words) {
        const next = compact ? `${compact} ${word}` : word
        if (next.length > 28) break
        compact = next
      }
      return compact || phrase.slice(0, 28)
    })

  return phrases.length > 0 ? phrases : ['Open task', 'One useful step']
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function activePauseStartedAt(session: TimerSession): number | undefined {
  const latest = session.pausedIntervals[session.pausedIntervals.length - 1]
  if (!latest || latest.resumedAt) return undefined
  const time = new Date(latest.pausedAt).getTime()
  return Number.isFinite(time) ? time : undefined
}

function completedPauseMs(session: TimerSession): number {
  return session.pausedIntervals.reduce((total, interval) => {
    if (!interval.resumedAt) return total
    const pausedAt = new Date(interval.pausedAt).getTime()
    const resumedAt = new Date(interval.resumedAt).getTime()
    if (!Number.isFinite(pausedAt) || !Number.isFinite(resumedAt)) return total
    return total + Math.max(0, resumedAt - pausedAt)
  }, 0)
}

function studyTimerTaskId(session: StudyActiveSession): string {
  if (session.taskTemplateId) return `study-template-instance:${session.taskTemplateId}`
  if (session.customTaskId) return `manual-study:${session.customTaskId}`
  return `active-study:${session.id}`
}

function timerFromStudySession(session: StudyActiveSession): TimerSession {
  if (session.timerSession) return session.timerSession
  const pausedIntervals: TimerSession['pausedIntervals'] = []
  if (session.pausedAccumulatedMs > 0) {
    pausedIntervals.push({
      pausedAt: new Date(session.sessionStartTime).toISOString(),
      resumedAt: new Date(session.sessionStartTime + session.pausedAccumulatedMs).toISOString(),
    })
  }
  if (session.status === 'paused' && session.pauseStartedAt) {
    pausedIntervals.push({
      pausedAt: new Date(session.pauseStartedAt).toISOString(),
    })
  }
  return {
    id: session.id,
    taskId: studyTimerTaskId(session),
    engine: 'study',
    durationPlannedMin: session.durationMinutes,
    startedAt: new Date(session.sessionStartTime).toISOString(),
    pausedIntervals,
    outcome: 'in-progress',
  }
}

function studySessionWithTimer(session: StudyActiveSession, timerSession: TimerSession): StudyActiveSession {
  const sessionStartTime = new Date(timerSession.startedAt).getTime()
  const pauseStartedAt = activePauseStartedAt(timerSession)
  return {
    ...session,
    id: timerSession.id,
    sessionStartTime: Number.isFinite(sessionStartTime) ? sessionStartTime : session.sessionStartTime,
    durationMinutes: timerSession.durationPlannedMin,
    expectedEndTime: timerEngine.expectedEndTime(timerSession),
    pausedAccumulatedMs: completedPauseMs(timerSession),
    pauseStartedAt,
    status: timerEngine.isPaused(timerSession) ? 'paused' : 'running',
    timerSession,
  }
}

function restoreActiveStudySession(): StudyActiveSession | null {
  const session = loadActiveStudySession()
  if (!session) return null
  const restoredTimer = timerEngine.restore(STUDY_TIMER_ENGINE_KEY)
  const timerSession = restoredTimer?.id === session.id
    ? restoredTimer
    : timerFromStudySession(session)
  return studySessionWithTimer(session, timerSession)
}

function studyDoneSummary(sessions: StudySessionRecord[]) {
  const completed = sessions.filter(session => session.status === 'completed')
  const studyMinutes = completed
    .filter(session => !['English Output', 'English Input', 'Admin / Life'].includes(session.category))
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishOutputMinutes = completed
    .filter(session => session.category === 'English Output')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishInputMinutes = completed
    .filter(session => session.category === 'English Input')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const adminMinutes = completed
    .filter(session => session.category === 'Admin / Life')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishReps = completed.filter(session => session.category === 'English Output').length

  return { completed, studyMinutes, englishOutputMinutes, englishInputMinutes, adminMinutes, englishReps }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function loadTodayEntryRecords(): Record<string, TodayEntryRecord> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(TODAY_ENTRY_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, TodayEntryRecord> : {}
  } catch {
    return {}
  }
}

function saveTodayEntryRecords(records: Record<string, TodayEntryRecord>): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(TODAY_ENTRY_STORAGE_KEY, JSON.stringify(records))
}

function recordTodayEntry(date: string, countOpen = true): TodayEntryRecord {
  const records = loadTodayEntryRecords()
  const nowIso = new Date().toISOString()
  const existing = records[date]
  const next: TodayEntryRecord = existing
    ? {
        ...existing,
        lastOpenedAt: nowIso,
        openCount: countOpen ? existing.openCount + 1 : existing.openCount,
      }
    : {
        date,
        firstOpenedAt: nowIso,
        lastOpenedAt: nowIso,
        openCount: 1,
      }
  saveTodayEntryRecords({ ...records, [date]: next })
  return next
}

function timeWindowLabel(now: Date): string {
  const hour = now.getHours()
  if (hour < 10) return 'morning entry'
  if (hour < 12) return 'deep work window'
  if (hour < 14) return 'midday reset'
  if (hour < 17) return 'afternoon block'
  if (hour < 21) return 'evening useful block'
  return 'shutdown window'
}

function timeWindowRecommendation(now: Date, hasQueueTask: boolean): string {
  const hour = now.getHours()
  if (hasQueueTask) {
    if (hour < 12) return 'Start the next queue task while attention is still fresh.'
    if (hour < 17) return 'Pick one serious 25-minute block before the day gets vague.'
    if (hour < 21) return 'Use the next queue task as a contained evening block.'
    return "Choose a small finishable task, or set tomorrow's first block."
  }
  if (hour < 12) return 'Add one serious task to the queue, then start a 25-minute block.'
  if (hour < 17) return 'Open Study and make one concrete task count before the next reset.'
  if (hour < 21) return 'Choose a lighter Study or admin task that still counts.'
  return 'Do a short review or prepare tomorrow’s first task.'
}

export default function StartNowDashboard({
  onOpenStudy,
  onOpenExercise,
  onOpenPlan,
  nextBlock,
  queueCount = 0,
  sessionMinutesToday = 0,
  expandedModule = null,
  onExpandedModuleChange,
  todayNote,
  eveningNote,
}: StartNowDashboardProps) {
  const today = getLocalDateKey()
  const [message, setMessage] = useState<string | null>(null)
  const [studySessions, setStudySessions] = useState(() => loadStudySessionRecordsForDate(today))
  const [exerciseEntries, setExerciseEntries] = useState(() => loadExerciseLog().entries.filter(entry => entry.date === today))
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => restoreActiveSession())
  const [heroImage, setHeroImage] = useState<TodayHeroImageSettings>(() =>
    loadAppearanceSettings().todayHeroImage ?? DEFAULT_TODAY_HERO_IMAGE,
  )
  const [heroDraft, setHeroDraft] = useState<TodayHeroImageSettings>(() => heroImage)
  const [heroPanelOpen, setHeroPanelOpen] = useState(false)
  const [heroMessage, setHeroMessage] = useState<string | null>(null)
  const [processingHeroImage, setProcessingHeroImage] = useState(false)
  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [todayEntry, setTodayEntry] = useState<TodayEntryRecord>(() => recordTodayEntry(today))
  const [activeStudySession, setActiveStudySession] = useState<StudyActiveSession | null>(() => restoreActiveStudySession())
  const [completionToast, setCompletionToast] = useState<string | null>(null)
  const [focusCelebration, setFocusCelebration] = useState<FocusCelebration | null>(() => loadFocusCelebration())
  const outputJourney = useMemo(() => loadEnglishOutputJourney(), [studySessions, completionToast])
  const englishRepsToday = englishOutputRepsForDate(outputJourney, today)
  const englishRepsWeek = englishOutputRepsForLastSevenDays(outputJourney)
  const weekStudyBars = useMemo(() => {
    const keys = lastSevenDayKeys()
    return keys.map(dateKey => ({
      key: dateKey,
      label: weekdayLabel(dateKey, today),
      value: loadStudySessionRecordsForDate(dateKey)
        .filter(session => session.status === 'completed')
        .reduce((sum, session) => sum + session.actualMinutes, 0),
      isToday: dateKey === today,
    }))
  }, [today, studySessions, completionToast])
  const summary = studyDoneSummary(studySessions)
  const movementMinutes = exerciseEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
  const doneItems = [
    ...summary.completed.map(session => ({
      id: session.id,
      kind: 'study' as const,
      time: timeLabel(session.completedAt),
      title: session.title,
      meta: `${session.actualMinutes} min · ${session.category}`,
    })),
    ...exerciseEntries.map(entry => ({
      id: entry.id,
      kind: 'exercise' as const,
      time: timeLabel(entry.createdAt),
      title: `${entry.movementType} movement`,
      meta: `${entry.durationMinutes} min · Movement`,
    })),
  ].sort((a, b) => b.time.localeCompare(a.time))

  function refreshDone() {
    setStudySessions(loadStudySessionRecordsForDate(today))
    setExerciseEntries(loadExerciseLog().entries.filter(entry => entry.date === today))
  }

  function deleteDoneItem(item: { id: string; kind: 'study' | 'exercise'; title: string }) {
    const confirmed = window.confirm(`Delete "${item.title}" from today’s completed list? This will remove its counted minutes.`)
    if (!confirmed) return
    if (item.kind === 'study') {
      saveStudySessionRecords(loadStudySessionRecords().filter(session => session.id !== item.id))
      removeStudySessionEnglishOutputRep(item.id)
      removeTaskStoreSession(item.id)
      refreshDone()
      showCompletionToast('Completed Study session deleted.')
      return
    }
    deleteExerciseEntry(item.id)
    refreshDone()
    showCompletionToast('Movement entry deleted.')
  }

  useEffect(() => {
    const refresh = () => {
      setActiveSession(restoreActiveSession())
      setActiveStudySession(restoreActiveStudySession())
    }
    const interval = window.setInterval(() => {
      setNow(Date.now())
      refresh()
    }, 1000)
    window.addEventListener(ACTIVE_SESSION_CHANGED_EVENT, refresh)
    window.addEventListener(STUDY_ACTIVE_SESSION_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(ACTIVE_SESSION_CHANGED_EVENT, refresh)
      window.removeEventListener(STUDY_ACTIVE_SESSION_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const refresh = () => setHeroImage(loadAppearanceSettings().todayHeroImage ?? DEFAULT_TODAY_HERO_IMAGE)
    window.addEventListener('iris-appearance-settings-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('iris-appearance-settings-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const touchEntry = () => setTodayEntry(recordTodayEntry(today, false))
    const handleVisibility = () => {
      if (!document.hidden) touchEntry()
    }
    window.addEventListener('focus', touchEntry)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', touchEntry)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [today])

  useEffect(() => {
    if (!activeStudySession || activeStudySession.status !== 'running') return
    const activeTimer = timerFromStudySession(activeStudySession)
    if (!timerEngine.isFinished(activeTimer, now)) return
    completeActiveStudySession('completed', timerEngine.expectedEndTime(activeTimer, now))
  }, [activeStudySession, now])

  useEffect(() => {
    if (!focusCelebration) return
    const remainingMs = focusCelebration.expiresAt - Date.now()
    if (remainingMs <= 0) {
      saveFocusCelebration(null)
      setFocusCelebration(null)
      return
    }
    const timer = window.setTimeout(() => {
      saveFocusCelebration(null)
      setFocusCelebration(null)
    }, remainingMs)
    const scrollTimer = window.setTimeout(() => {
      document.querySelector('[aria-label="Focus session completed"]')?.scrollIntoView({ block: 'start' })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(scrollTimer)
    }
  }, [focusCelebration])

  const irisDay = useMemo(() => getIris365DayNumber(), [])

  function showCompletionToast(text: string) {
    setCompletionToast(text)
    window.setTimeout(() => setCompletionToast(null), 5000)
  }

  function persistActiveStudySession(session: StudyActiveSession | null) {
    setActiveStudySession(session)
    if (session) {
      saveActiveStudySession(session)
      timerEngine.save(STUDY_TIMER_ENGINE_KEY, timerFromStudySession(session))
      updateActiveSession({ status: session.status === 'paused' ? 'paused' : 'active' })
      return
    }
    clearActiveStudySession()
    timerEngine.clear(STUDY_TIMER_ENGINE_KEY)
    clearActiveSession()
    refreshDone()
  }

  function startQueueBlock25(block: DayBlock) {
    const existing = loadActiveStudySession()
    if (existing) {
      setMessage(`Already focusing: ${existing.title}`)
      return
    }
    const result = startStudySessionFromQueueBlock(block, 25)
    if (!result.success || !result.session) {
      setMessage(result.message)
      return
    }
    const session = studySessionWithTimer(
      result.session,
      result.session.timerSession ?? timerFromStudySession(result.session),
    )
    persistActiveStudySession(session)
    setMessage(null)
  }

  function openQueueBlockInStudy(block: DayBlock) {
    saveStudyTaskHandoff(createStudyHandoffFromQueueBlock(block, 'today-queue'))
    onOpenStudy?.()
  }

  function openStudyStart() {
    const existing = loadActiveStudySession()
    if (existing) {
      setMessage(`A Study Session is already active: ${existing.title}.`)
      return
    }
    if (nextBlock) {
      startQueueBlock25(nextBlock)
      return
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('iris-study-focus-target', 'timer')
    }
    setMessage('Choose a task first.')
    onOpenStudy?.()
  }

  function openEnglishStart() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('iris-study-focus-target', 'english')
    }
    onOpenStudy?.()
  }

  function openExerciseLog() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('iris365-focus-target', 'movement')
    }
    setMessage('Movement opened in Iris 365. Nothing counts until you save an activity.')
    onOpenExercise?.()
  }

  function handleNextUsefulThing() {
    if (activeStudySession) {
      return
    }
    if (nextBlock) {
      startQueueBlock25(nextBlock)
      return
    }
    onOpenStudy?.()
  }

  function toggleModule(module: TodayStartModule) {
    onExpandedModuleChange?.(expandedModule === module ? null : module)
  }

  function openActiveSession() {
    if (activeSession?.targetTab === 'exercise') {
      onOpenExercise?.()
      return
    }
    onOpenStudy?.()
  }

  function confirmAbandonActiveStudySession() {
    setAbandonConfirmOpen(false)
    completeActiveStudySession('abandoned')
  }

  function copyActiveStudyNoteDestination() {
    if (!activeStudySession?.noteDestination || !navigator.clipboard) return
    void navigator.clipboard.writeText(activeStudySession.noteDestination)
  }

  function pauseActiveStudySession() {
    if (!activeStudySession || activeStudySession.status === 'paused') return
    const nextTimer = timerEngine.pause(timerFromStudySession(activeStudySession))
    persistActiveStudySession(studySessionWithTimer(activeStudySession, nextTimer))
  }

  function resumeActiveStudySession() {
    if (!activeStudySession || activeStudySession.status !== 'paused') return
    const nextTimer = timerEngine.resume(timerFromStudySession(activeStudySession))
    persistActiveStudySession(studySessionWithTimer(activeStudySession, nextTimer))
  }

  function completeActiveStudySession(status: StudySessionRecord['status'], completedAtMs = Date.now()) {
    if (!activeStudySession) return
    const activeTimerSession = timerFromStudySession(activeStudySession)
    const endedTimer = status === 'completed'
      ? timerEngine.complete(activeTimerSession, completedAtMs)
      : timerEngine.abandon(activeTimerSession, completedAtMs)
    const actualMs = status === 'completed'
      ? Math.min(activeStudySession.durationMinutes * 60_000, timerEngine.elapsedMs(endedTimer, completedAtMs))
      : timerEngine.elapsedMs(endedTimer, completedAtMs)
    const record: StudySessionRecord = {
      id: activeStudySession.id,
      taskTemplateId: activeStudySession.taskTemplateId,
      customTaskId: activeStudySession.customTaskId,
      source: activeStudySession.source,
      sourceImportId: activeStudySession.sourceImportId,
      title: activeStudySession.title,
      category: activeStudySession.category,
      startedAt: endedTimer.startedAt,
      completedAt: endedTimer.endedAt ?? new Date(completedAtMs).toISOString(),
      plannedMinutes: endedTimer.durationPlannedMin,
      actualMinutes: status === 'completed'
        ? Math.max(1, Math.round(actualMs / 60_000))
        : Math.max(0, Math.round(actualMs / 60_000)),
      status,
      noteDestination: activeStudySession.noteDestination,
      notes: activeStudySession.notes,
      resourceUsed: activeStudySession.resourceUsed,
    }
    addStudySessionRecord(record)
    writeStudySessionToTaskStore(record)
    if (record.status === 'completed') {
      addStudySessionEnglishOutputRep(record)
      if (record.sourceImportId) {
        markQueueBlockDoneFromSession(record.sourceImportId, today)
      }
      showCompletionToast(`+${record.actualMinutes} min · ${record.category}`)
      const celebration = {
        title: record.title,
        minutes: record.actualMinutes,
        expiresAt: Date.now() + 6500,
      }
      saveFocusCelebration(celebration)
      setFocusCelebration(celebration)
    }
    persistActiveStudySession(null)
    setMessage(status === 'completed' ? 'Session completed.' : 'Session abandoned.')
    refreshDone()
  }

  function openHeroPanel() {
    setHeroDraft(heroImage)
    setHeroMessage(null)
    setHeroPanelOpen(true)
  }

  function saveHeroDraft(nextDraft = heroDraft) {
    const current = loadAppearanceSettings()
    const result = saveAppearanceSettings({
      ...current,
      todayHeroImage: nextDraft,
    })
    if (!result.success) {
      setHeroMessage(result.message)
      return false
    }
    setHeroImage(nextDraft)
    setHeroPanelOpen(false)
    setHeroMessage(null)
    return true
  }

  async function handleHeroUpload(file: File | undefined) {
    if (!file) return
    setProcessingHeroImage(true)
    setHeroMessage(null)
    try {
      const compressed = await compressTodayHeroImage(file)
      setHeroDraft({
        ...heroDraft,
        sourceType: 'upload',
        dataUrl: compressed.dataUrl,
        naturalWidth: compressed.naturalWidth,
        naturalHeight: compressed.naturalHeight,
        objectFit: 'cover',
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      })
      setHeroMessage(`Image ready (${Math.round(compressed.bytes / 1024)} KB).`)
    } catch (error) {
      setHeroMessage(error instanceof Error ? error.message : 'Image could not be saved.')
    } finally {
      setProcessingHeroImage(false)
    }
  }

  function updateHeroFit(objectFit: TodayHeroObjectFit) {
    setHeroDraft(prev => ({ ...prev, objectFit, zoom: 1, offsetX: 0, offsetY: 0 }))
  }

  function removeHeroImage() {
    setHeroDraft(DEFAULT_TODAY_HERO_IMAGE)
  }

  function updateHeroZoom(value: number) {
    setHeroDraft(prev => ({ ...prev, zoom: clamp(value, 0.5, 3) }))
  }

  function updateHeroOffset(axis: 'x' | 'y', value: number) {
    setHeroDraft(prev => ({
      ...prev,
      offsetX: axis === 'x' ? clamp(value, -2000, 2000) : prev.offsetX,
      offsetY: axis === 'y' ? clamp(value, -2000, 2000) : prev.offsetY,
    }))
  }

  function resetHeroCrop() {
    setHeroDraft(prev => ({ ...prev, zoom: 1, offsetX: 0, offsetY: 0 }))
  }

  const doneCount = summary.completed.length + exerciseEntries.length
  const progressItems = [
    { label: 'Study', value: `${summary.studyMinutes}m`, highlight: summary.studyMinutes > 0 },
    { label: 'English', value: `${englishRepsToday} rep${englishRepsToday === 1 ? '' : 's'}`, highlight: englishRepsToday > 0 },
    { label: 'Move', value: `${movementMinutes}m`, highlight: movementMinutes > 0 },
    { label: 'Sessions', value: String(summary.completed.length), highlight: summary.completed.length > 0 },
  ]
  const seriousMinutesToday = sessionMinutesToday
  const seriousTasksToday = summary.completed.length
  const seriousMinutesRemaining = Math.max(0, DAILY_SERIOUS_MINUTES_TARGET - seriousMinutesToday)
  const seriousTasksRemaining = Math.max(0, DAILY_SERIOUS_TASK_TARGET - seriousTasksToday)
  const seriousMinutesProgress = Math.min(100, Math.round((seriousMinutesToday / DAILY_SERIOUS_MINUTES_TARGET) * 100))
  const seriousTaskProgress = Math.min(100, Math.round((seriousTasksToday / DAILY_SERIOUS_TASK_TARGET) * 100))
  const currentTime = new Date(now)
  const todayEntryWindow = timeWindowLabel(currentTime)
  const todayEntryRecommendation = timeWindowRecommendation(currentTime, Boolean(nextBlock))

  const moduleRows = [
    { id: 'note' as const, icon: <StickyNote size={16} />, label: 'Note', badge: 'today' },
    { id: 'done' as const, icon: <CheckCircle2 size={16} />, label: 'Done', badge: `${doneCount} completed` },
    { id: 'queue' as const, icon: <ListChecks size={16} />, label: 'Queue', badge: `${queueCount} block${queueCount === 1 ? '' : 's'}` },
  ]

  const nextTitle = activeStudySession?.title ?? (nextBlock ? nextBlock.title : 'Choose one Study task')
  const nextCategory = activeStudySession?.category ?? (nextBlock ? labelFromToken(nextBlock.area) : 'Study')
  const nextDuration = activeStudySession?.durationMinutes ?? (nextBlock ? Math.min(nextBlock.estimatedMinutes, 50) : 25)
  const hasCustomHeroImage = heroImage.sourceType === 'upload' && Boolean(heroImage.dataUrl)
  const activeStudyTimer = activeStudySession ? timerFromStudySession(activeStudySession) : null
  const activeStudyRemainingMs = activeStudyTimer ? timerEngine.remainingMs(activeStudyTimer, now) : 0
  const activeStudyElapsedMs = activeStudyTimer ? timerEngine.elapsedMs(activeStudyTimer, now) : 0
  const activeStudyElapsedLabel = formatTimer(activeStudyElapsedMs)
  const activeStudyRemainingLabel = formatTimer(activeStudyRemainingMs)
  const activeStudyProgress = activeStudySession
    ? Math.min(100, Math.round(((activeStudySession.durationMinutes * 60_000 - activeStudyRemainingMs) / (activeStudySession.durationMinutes * 60_000)) * 100))
    : 0
  const activeStudySource = activeStudySession?.source ? labelFromToken(activeStudySession.source) : 'Study'
  const activeStudyMethod = activeStudySession?.notes || activeStudySession?.resourceUsed || 'Follow the selected task method.'
  const activeStudyMethodKeywords = compactMethodKeywords(activeStudyMethod)
  const activeStudyNoteDestination = activeStudySession?.noteDestination || 'Daily Study Log'
  const activeStudyNoteLabel = noteLabelFromDestination(activeStudyNoteDestination)
  const activeStudyStatusLabel = activeStudySession?.status === 'paused'
    ? '已暂停'
    : activeStudyRemainingMs <= 5 * 60_000
      ? '最后 5 分钟'
      : '专注中'
  const activeStudyStatusClass = activeStudySession?.status === 'paused'
    ? 'paused'
    : activeStudyRemainingMs <= 5 * 60_000
      ? 'final'
      : 'focusing'

  return (
    <section className="start-now-dashboard today-start-flow" aria-label="Today start flow">
      {focusCelebration ? (
        <section className="focus-completion-scene" aria-label="Focus session completed">
          <FocusStateArtwork state="complete" />
          <div className="focus-completion-copy">
            <span className="focus-completion-kicker">SESSION COMPLETE</span>
            <h2>干得好</h2>
            <p>{focusCelebration.title}</p>
            <strong>+{focusCelebration.minutes} min focused</strong>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                saveFocusCelebration(null)
                setFocusCelebration(null)
              }}
            >
              Done
            </button>
          </div>
        </section>
      ) : activeStudySession ? (
        <section className={`today-active-session-hero ${activeStudyStatusClass}`} aria-label="Active focus session">
          <FocusStateArtwork state={activeStudySession.status === 'paused' ? 'paused' : 'running'} />
          <div className="today-active-session-main">
            <span className={`today-active-status-dot ${activeStudyStatusClass}`}>{activeStudyStatusLabel}</span>
            <h2>{activeStudySession.title}</h2>
            <div className="today-active-meta">
              <span>{activeStudySession.category}</span>
              <span>{activeStudySession.durationMinutes} min</span>
            </div>
            <div className="today-active-timer-card">
              <div className="today-active-timer" aria-label={`${activeStudyRemainingLabel} remaining`}>
                {activeStudyRemainingLabel}
              </div>
              <div className="today-active-progress-row">
                <span>{activeStudyElapsedLabel} elapsed</span>
                <div className="today-active-progress" aria-label={`Session progress ${activeStudyProgress}%`}>
                  <span style={{ width: `${activeStudyProgress}%` }} />
                </div>
                <span>{activeStudyRemainingLabel} left</span>
              </div>
            </div>
            <div className="today-active-session-metadata" aria-label="Session metadata">
              <div className="today-active-session-meta-item">
                <Target size={18} />
                <div>
                  <span>Source</span>
                  <strong>{activeStudySource}</strong>
                </div>
              </div>
              <div className="today-active-session-meta-item">
                <ClipboardList size={18} />
                <div>
                  <span>Focus</span>
                  <strong className="today-active-method-keywords">
                    {activeStudyMethodKeywords.map(keyword => <span key={keyword}>{keyword}</span>)}
                  </strong>
                </div>
              </div>
              <div className="today-active-session-meta-item">
                <Folder size={18} />
                <div>
                  <span>Note</span>
                  <strong title={activeStudyNoteDestination}>{activeStudyNoteLabel}</strong>
                </div>
                {activeStudyNoteDestination !== activeStudyNoteLabel && (
                  <button
                    type="button"
                    className="today-active-copy-note"
                    aria-label="Copy full note path"
                    title={activeStudyNoteDestination}
                    onClick={copyActiveStudyNoteDestination}
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="today-active-actions">
              {activeStudySession.status === 'paused' ? (
                <button type="button" className="btn btn-secondary" onClick={resumeActiveStudySession}>
                  <Play size={15} />
                  Resume
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={pauseActiveStudySession}>
                  <Pause size={15} />
                  Pause
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => completeActiveStudySession('completed')}>
                <CheckCircle2 size={15} />
                Complete
              </button>
              <button type="button" className="today-active-abandon" onClick={() => setAbandonConfirmOpen(true)}>
                <X size={15} />
                Abandon
              </button>
              <button type="button" className="btn btn-secondary today-active-study-link" onClick={openActiveSession}>
                Back to Study
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="today-start-panel">
            <div className={`today-start-photo-panel ${hasCustomHeroImage ? 'has-custom-image' : ''}`}>
              {hasCustomHeroImage ? (
                <HeroImageViewport image={heroImage} className="today-hero-image-viewport" />
              ) : (
                <>
                  <span className="today-photo-vase" />
                  <span className="today-photo-candle" />
                  <span className="today-photo-linen" />
                </>
              )}
              <button
                type="button"
                className="today-hero-edit-button"
                aria-label="Change Today hero image"
                onClick={openHeroPanel}
              >
                <Pencil size={14} />
                <span>更换图片</span>
              </button>
            </div>
            <div className="today-start-panel-copy">
              <span className="today-soft-label">Organized life</span>
              <h2>Start one real thing</h2>
              <p>学习、日语、Admin 或求职，先专注一个小块。</p>
            </div>
            <div className="today-start-actions">
              <button type="button" className="today-start-action-card primary" onClick={openStudyStart}>
                <span className="start-action-card__icon"><BookOpen size={20} /></span>
                <span className="start-action-card__content">
                  <span className="start-action-card__label">Focus</span>
                  <span className="start-action-card__helper">Choose one task and begin</span>
                </span>
              </button>
              <button type="button" className="today-start-action-card" onClick={openEnglishStart}>
                <span className="start-action-card__icon"><Mic size={20} /></span>
                <span className="start-action-card__content">
                  <span className="start-action-card__label">English</span>
                  <span className="start-action-card__helper">Listening or output</span>
                </span>
              </button>
              <button type="button" className="today-start-action-card" onClick={openExerciseLog}>
                <span className="start-action-card__icon"><Dumbbell size={20} /></span>
                <span className="start-action-card__content">
                  <span className="start-action-card__label">Movement</span>
                  <span className="start-action-card__helper">Return to Iris 365</span>
                </span>
              </button>
            </div>
          </section>

          <DailyRhythmLog />

          <section className="today-entry-card" aria-label="Today entry recommendation">
            <div className="today-entry-card-main">
              <div className="today-entry-kicker">
                <Monitor size={16} />
                <span>Day entry</span>
                <small>{todayEntryWindow}</small>
              </div>
              <h3>Open the day from here.</h3>
              <p>{todayEntryRecommendation}</p>
              <div className="today-entry-targets" aria-label="Daily serious work targets">
                <div>
                  <span>8h evidence</span>
                  <strong>{seriousMinutesToday}/{DAILY_SERIOUS_MINUTES_TARGET} min</strong>
                  <i><b style={{ width: `${seriousMinutesProgress}%` }} /></i>
                  <small>{seriousMinutesRemaining > 0 ? `${seriousMinutesRemaining} min left` : 'Target reached'}</small>
                </div>
                <div>
                  <span>5 serious tasks</span>
                  <strong>{seriousTasksToday}/{DAILY_SERIOUS_TASK_TARGET}</strong>
                  <i><b style={{ width: `${seriousTaskProgress}%` }} /></i>
                  <small>{seriousTasksRemaining > 0 ? `${seriousTasksRemaining} left` : 'Target reached'}</small>
                </div>
              </div>
            </div>
            <aside className="today-entry-next">
              <div className="today-entry-time">
                <Clock3 size={15} />
                <span>First opened {timeLabel(todayEntry.firstOpenedAt)}</span>
                <small>Last seen {timeLabel(todayEntry.lastOpenedAt)}</small>
              </div>
              <div className="today-entry-task">
                <span>Recommended now</span>
                <strong>{nextBlock ? nextBlock.title : 'Choose one Study task'}</strong>
                <small>{nextBlock ? `${labelFromToken(nextBlock.area)} · ${Math.min(nextBlock.estimatedMinutes, 50)} min` : 'No queue task selected yet'}</small>
              </div>
              <div className="today-entry-actions">
                <button type="button" className="btn btn-primary" onClick={handleNextUsefulThing}>
                  <Play size={14} />
                  {nextBlock ? 'Start 25 min' : 'Open Study'}
                </button>
                {nextBlock ? (
                  <button type="button" className="btn btn-secondary" onClick={() => openQueueBlockInStudy(nextBlock)}>
                    Custom in Study
                  </button>
                ) : onOpenPlan ? (
                  <button type="button" className="btn btn-secondary" onClick={onOpenPlan}>
                    Open queue
                  </button>
                ) : null}
              </div>
            </aside>
          </section>

          <div className="today-progress-strip" aria-label="Today progress">
            {progressItems.map(item => (
              <span key={item.label} className={`today-progress-pill ${item.highlight ? 'has-value' : ''}`}>
                <strong>{item.label}</strong>
                {item.value}
              </span>
            ))}
            <span className="today-progress-pill muted">Day {irisDay}</span>
            {englishRepsWeek > 0 && (
              <span className="today-progress-pill muted">{englishRepsWeek} reps this week</span>
            )}
          </div>
        </>
      )}

      {completionToast && (
        <div className="today-completion-toast" role="status" aria-live="polite">
          <CheckCircle2 size={16} />
          {completionToast}
        </div>
      )}

      {!activeStudySession && (
        <section className="today-done-evidence" aria-label="Today completed evidence">
          <div className="today-done-evidence-header">
            <span className="today-soft-label">Done</span>
            <h3>{doneCount > 0 ? `${doneCount} completed today` : 'Nothing logged yet'}</h3>
            <p className="today-done-evidence-sub">
              {sessionMinutesToday > 0 ? `${sessionMinutesToday} session min · ` : ''}
              {doneCount > 0 ? 'Real timed work and movement only.' : 'Complete a session or log movement.'}
            </p>
          </div>
          {doneCount > 0 ? (
            <>
              <div className="today-done-chips">
                {doneItems.slice(0, 5).map(item => (
                  <article key={item.id} className="today-done-chip">
                    <div className="today-done-chip-main">
                      <span className="today-done-chip-time">{item.time}</span>
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                    </div>
                    <button
                      type="button"
                      className="today-done-delete"
                      aria-label={`Delete completed item ${item.title}`}
                      onClick={() => deleteDoneItem(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                ))}
              </div>
              <WeekBars days={weekStudyBars} unit="m" className="today-week-bars" />
            </>
          ) : (
            <WeekBars days={weekStudyBars} unit="m" className="today-week-bars muted" />
          )}
        </section>
      )}

      {!activeSession && !activeStudySession && (
        <section className="today-next-useful-card">
          <div className="today-next-copy">
            <span className="today-soft-label">Next</span>
            <h3>{nextTitle}</h3>
            <div className="today-next-chips">
              <span>{nextCategory}</span>
              <span>{nextDuration} min</span>
            </div>
          </div>
          <button type="button" className="btn btn-primary today-next-primary" onClick={handleNextUsefulThing}>
            <Play size={15} />
            {nextBlock ? 'Start 25 min' : 'Open Study'}
          </button>
          {nextBlock && (
            <button type="button" className="today-next-secondary" onClick={() => openQueueBlockInStudy(nextBlock)}>
              Custom duration in Study
            </button>
          )}
        </section>
      )}

      {!activeStudySession && (
        <>
          <div className="today-module-row" aria-label="Today modules">
            {moduleRows.filter(row => row.id !== 'done').map(row => (
              <button
                key={row.id}
                type="button"
                className={`today-module-chip ${expandedModule === row.id ? 'active' : ''}`}
                onClick={() => toggleModule(row.id)}
              >
                {row.icon}
                <span>{row.label}</span>
                <small>{row.badge}</small>
                <ChevronDown size={15} />
              </button>
            ))}
          </div>

          {expandedModule === 'note' && (
            <section className="today-module-panel today-note-module">
              <div className="today-note-lines">
                {(todayNote?.lines?.length ? todayNote.lines : ['不用先规划完整一天。先开始一个小块。']).map(line => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              {(todayNote?.caption || eveningNote) && (
                <small>
                  {todayNote?.caption}
                  {todayNote?.caption && eveningNote ? ' · ' : ''}
                  {eveningNote}
                </small>
              )}
            </section>
          )}

          {expandedModule === 'queue' && (
            <section className="today-module-panel today-queue-summary">
              <div className="today-queue-summary-copy">
                <span className="today-soft-label">Today queue</span>
                <h3>{queueCount} block{queueCount === 1 ? '' : 's'} selected</h3>
                <p>
                  {sessionMinutesToday > 0
                    ? `${sessionMinutesToday} min from completed sessions today.`
                    : 'Queue is your menu — only finished sessions count.'}
                </p>
              </div>
              {nextBlock && (
                <div className="today-queue-summary-next">
                  <strong>{nextBlock.title}</strong>
                  <div className="today-queue-summary-actions">
                    <button type="button" className="btn btn-primary" onClick={() => startQueueBlock25(nextBlock)}>
                      <Play size={14} /> Start 25 min
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => openQueueBlockInStudy(nextBlock)}>
                      Custom in Study
                    </button>
                  </div>
                </div>
              )}
              {onOpenPlan && (
                <button type="button" className="today-queue-plan-link" onClick={onOpenPlan}>
                  Edit queue in Plan →
                </button>
              )}
            </section>
          )}
        </>
      )}

      {message && !activeStudySession && (
        <div className="start-now-message">
          {message}
        </div>
      )}

      {abandonConfirmOpen && (
        <div className="today-active-confirm-backdrop" role="presentation" onMouseDown={() => setAbandonConfirmOpen(false)}>
          <section
            className="today-active-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-active-confirm-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <h3 id="today-active-confirm-title">Abandon this session?</h3>
            <p>This session will not count as completed focus time.</p>
            <div className="today-active-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setAbandonConfirmOpen(false)}>
                Keep focusing
              </button>
              <button type="button" className="today-active-confirm-abandon" onClick={confirmAbandonActiveStudySession}>
                Abandon session
              </button>
            </div>
          </section>
        </div>
      )}

      {heroPanelOpen && (
        <div className="today-hero-modal-backdrop" role="presentation" onMouseDown={() => setHeroPanelOpen(false)}>
          <section
            className="today-hero-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-hero-modal-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="today-hero-modal-header">
              <div>
                <span className="today-soft-label">Appearance</span>
                <h3 id="today-hero-modal-title">Today hero image</h3>
              </div>
              <button type="button" aria-label="Close image settings" onClick={() => setHeroPanelOpen(false)}>
                <X size={17} />
              </button>
            </div>

            <HeroImageViewport
              image={heroDraft}
              className="today-hero-preview"
              interactive
              onChange={patch => setHeroDraft(prev => ({ ...prev, ...patch }))}
            >
              {heroDraft.sourceType === 'upload' && heroDraft.dataUrl ? (
                <span className="today-hero-drag-hint">Drag to move</span>
              ) : (
                <div className="today-hero-preview-placeholder">
                  <ImageIcon size={22} />
                  <span>Default soft image</span>
                </div>
              )}
            </HeroImageViewport>

            <label className="today-hero-upload">
              <ImageIcon size={16} />
              <span>{processingHeroImage ? 'Processing image...' : 'Upload image'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={processingHeroImage}
                onChange={event => void handleHeroUpload(event.target.files?.[0])}
              />
            </label>

            {heroDraft.sourceType === 'upload' && heroDraft.dataUrl && (!heroDraft.naturalWidth || !heroDraft.naturalHeight) && (
              <p className="today-hero-message">
                This image was saved by the older crop system. Re-upload the original image to use full positioning.
              </p>
            )}

            <div className="today-hero-setting-grid">
              <div>
                <span>Fit</span>
                <div className="today-hero-segmented">
                  {(['cover', 'contain'] as const).map(fit => (
                    <button
                      key={fit}
                      type="button"
                      className={heroDraft.objectFit === fit ? 'active' : ''}
                      onClick={() => updateHeroFit(fit)}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="today-hero-adjustments" aria-label="Fine tune hero image">
              <label>
                <span>Zoom <strong>{Math.round(heroDraft.zoom * 100)}%</strong></span>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="1"
                  value={Math.round(heroDraft.zoom * 100)}
                  onChange={event => updateHeroZoom(Number(event.target.value) / 100)}
                />
              </label>
              <label>
                <span>Move X <strong>{Math.round(heroDraft.offsetX)}</strong></span>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  step="1"
                  value={Math.round(heroDraft.offsetX)}
                  onChange={event => updateHeroOffset('x', Number(event.target.value))}
                />
              </label>
              <label>
                <span>Move Y <strong>{Math.round(heroDraft.offsetY)}</strong></span>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  step="1"
                  value={Math.round(heroDraft.offsetY)}
                  onChange={event => updateHeroOffset('y', Number(event.target.value))}
                />
              </label>
              <button type="button" onClick={resetHeroCrop}>Reset crop</button>
              <small>Drag the preview to move the image.</small>
            </div>

            {heroMessage && <p className="today-hero-message">{heroMessage}</p>}

            <div className="today-hero-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={removeHeroImage}>
                <Trash2 size={15} />
                Remove
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setHeroPanelOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => saveHeroDraft()} disabled={processingHeroImage}>
                Save
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
