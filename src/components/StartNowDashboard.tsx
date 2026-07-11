import { BookOpen, CheckCircle2, ChevronDown, Dumbbell, Image as ImageIcon, ListChecks, Mic, Pause, Pencil, Play, StickyNote, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  ACTIVE_SESSION_CHANGED_EVENT,
  clearActiveSession,
  restoreActiveSession,
  startActiveSession,
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
import { loadExerciseLog } from '../exerciseStorage'
import { getLocalDateKey } from '../focus'
import { IRIS365_MOMENTUM_START_DATE } from '../iris365MomentumStorage'
import { addStudySessionRecord, clearActiveStudySession, loadActiveStudySession, loadStudySessionRecordsForDate, saveActiveStudySession, STUDY_ACTIVE_SESSION_CHANGED_EVENT } from '../studyStorage'
import { addStudySessionEnglishOutputRep } from '../englishOutputJourney'
import type { StudyActiveSession, StudyCategory, StudySessionRecord } from '../studyTypes'
import { ensureCustomStudyTaskInTaskStore, writeStudySessionToTaskStore } from '../taskStore'
import * as timerEngine from '../timerEngine'
import type { TimerSession } from '../timerEngineTypes'
import type { DayBlock } from '../types'
import HeroImageViewport from './HeroImageViewport'

const STUDY_TIMER_ENGINE_KEY = 'iris-study-timer-engine-active'

type StartKind = 'study' | 'english-output' | 'english-input'
export type TodayStartModule = 'note' | 'done' | 'queue'

interface StartNowDashboardProps {
  onOpenStudy?: () => void
  onOpenExercise?: () => void
  nextBlock?: DayBlock | null
  onStartNextBlock?: () => void
  queueCount?: number
  expandedModule?: TodayStartModule | null
  onExpandedModuleChange?: (module: TodayStartModule | null) => void
  todayNote?: {
    lines: string[]
    caption: string
  }
  eveningNote?: string
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function startTitle(kind: StartKind) {
  if (kind === 'english-output') return 'English Output Session'
  if (kind === 'english-input') return 'English Input Session'
  return 'Study Session'
}

function startCategory(kind: StartKind): StudyCategory {
  if (kind === 'english-output') return 'English Output'
  if (kind === 'english-input') return 'English Input'
  return 'Review / NotebookLM'
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

export default function StartNowDashboard({
  onOpenStudy,
  onOpenExercise,
  nextBlock,
  onStartNextBlock,
  queueCount = 0,
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
  const [now, setNow] = useState(() => Date.now())
  const [activeStudySession, setActiveStudySession] = useState<StudyActiveSession | null>(() => restoreActiveStudySession())
  const irisDay = useMemo(() => getIris365DayNumber(), [])
  const summary = studyDoneSummary(studySessions)
  const movementMinutes = exerciseEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
  const doneItems = [
    ...summary.completed.map(session => ({
      id: session.id,
      time: timeLabel(session.completedAt),
      title: session.title,
      meta: `${session.actualMinutes} min · ${session.category}`,
    })),
    ...exerciseEntries.map(entry => ({
      id: entry.id,
      time: timeLabel(entry.createdAt),
      title: `${entry.movementType} movement`,
      meta: `${entry.durationMinutes} min · Movement`,
    })),
  ].sort((a, b) => b.time.localeCompare(a.time))

  function refreshDone() {
    setStudySessions(loadStudySessionRecordsForDate(today))
    setExerciseEntries(loadExerciseLog().entries.filter(entry => entry.date === today))
  }

  useEffect(() => {
    const refresh = () => {
      setActiveSession(restoreActiveSession())
      setActiveStudySession(restoreActiveStudySession())
    }
    const interval = window.setInterval(() => {
      setNow(Date.now())
      refresh()
    }, 30_000)
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

  function startStudy(kind: StartKind) {
    const existing = loadActiveStudySession()
    if (existing) {
      setMessage(`A Study Session is already active: ${existing.title}. Finish it in Study first.`)
      onOpenStudy?.()
      return
    }
    const start = Date.now()
    const sessionId = makeId('today-study')
    const customTaskId = `today-start:${kind}:${sessionId}`
    const category = startCategory(kind)
    const timerSession = timerEngine.start(`manual-study:${customTaskId}`, 25, 'study', {
      id: sessionId,
      startedAt: new Date(start).toISOString(),
    })
    const session: StudyActiveSession = {
      id: sessionId,
      customTaskId,
      source: 'today-start-panel',
      title: startTitle(kind),
      category,
      sessionStartTime: start,
      durationMinutes: 25,
      expectedEndTime: start + 25 * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination: category === 'English Output' || category === 'English Input'
        ? 'Obsidian/Study/English Daily Log.md'
        : 'Obsidian/Study/Daily Study Log.md',
      notes: 'Started from Today Start Panel. 统计只计算完成的 Study Session。',
      resourceUsed: 'Today Start Panel',
      timerSession,
    }
    saveActiveStudySession(session)
    timerEngine.save(STUDY_TIMER_ENGINE_KEY, timerSession)
    startActiveSession({
      id: session.id,
      origin: 'today-start-panel',
      kind,
      category,
      title: session.title,
      startedAt: new Date(start).toISOString(),
      plannedMinutes: 25,
      linkedTaskId: customTaskId,
      targetTab: 'study',
      status: 'active',
    })
    ensureCustomStudyTaskInTaskStore({
      customTaskId,
      title: session.title,
      category,
      durationMinutes: 25,
      noteDestination: session.noteDestination,
      notes: session.notes,
      activeSession: session,
    })
    setMessage(`${session.title} started. Complete it in Study for minutes to count.`)
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
      sessionStorage.setItem('iris-exercise-focus-target', 'movement-log')
    }
    setMessage('Exercise log opened. Nothing counts until you save a movement.')
    onOpenExercise?.()
  }

  function handleNextUsefulThing() {
    if (activeStudySession) {
      onOpenStudy?.()
      return
    }
    if (nextBlock && onStartNextBlock) {
      onStartNextBlock()
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

  function completeActiveStudySession(status: StudySessionRecord['status']) {
    if (!activeStudySession) return
    const completedAtMs = Date.now()
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
    if (record.status === 'completed') addStudySessionEnglishOutputRep(record)
    persistActiveStudySession(null)
    setMessage(status === 'completed' ? 'Session completed.' : 'Session abandoned.')
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
    { label: 'Study', value: `${summary.studyMinutes}m` },
    { label: 'English', value: `${summary.englishReps} rep${summary.englishReps === 1 ? '' : 's'}` },
    { label: 'Move', value: `${movementMinutes}m` },
    { label: 'Sessions', value: String(summary.completed.length) },
  ]

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
  const activeStudyMethod = activeStudySession?.notes || activeStudySession?.resourceUsed || 'Stay with this one task.'
  const activeStudyNoteDestination = activeStudySession?.noteDestination || 'Daily Study Log'
  const activeStudyNoteLabel = noteLabelFromDestination(activeStudyNoteDestination)

  return (
    <section className="start-now-dashboard today-start-flow" aria-label="Today start flow">
      {activeStudySession ? (
        <section className="today-active-session-hero" aria-label="Active focus session">
          <div className="today-active-session-main">
            <span className="today-active-status-dot">FOCUS SESSION ACTIVE</span>
            <h2>{activeStudySession.title}</h2>
            <div className="today-active-meta">
              <span>{activeStudySession.category}</span>
              <span>{activeStudySession.durationMinutes} min</span>
              <span>From {activeStudySource}</span>
              {activeStudySession.status === 'paused' && <span>Paused</span>}
            </div>
            <div className="today-active-timer" aria-label={`${activeStudyRemainingLabel} remaining`}>
              {activeStudyRemainingLabel}
            </div>
            <div className="today-active-progress-row">
              <span>{activeStudyElapsedLabel} elapsed</span>
              <div className="today-active-progress" aria-label={`Session progress ${activeStudyProgress}%`}>
                <span style={{ width: `${activeStudyProgress}%` }} />
              </div>
              <span>{activeStudyRemainingLabel} remaining</span>
            </div>
            <div className="today-active-session-metadata" aria-label="Session metadata">
              <p className="today-active-session-method">
                <span>Method:</span>
                {activeStudyMethod}
              </p>
              <p className="today-active-session-note" title={activeStudyNoteDestination}>
                <span>Note destination:</span>
                {activeStudyNoteLabel}
              </p>
              <details className="today-active-session-details">
                <summary>Session details</summary>
                <dl>
                  <div>
                    <dt>Source</dt>
                    <dd>{activeStudySource}</dd>
                  </div>
                  <div>
                    <dt>Full note path</dt>
                    <dd>{activeStudyNoteDestination}</dd>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>{activeStudyMethod}</dd>
                  </div>
                </dl>
              </details>
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
              <button type="button" className="btn btn-secondary today-active-abandon" onClick={() => completeActiveStudySession('abandoned')}>
                <X size={15} />
                Abandon
              </button>
              <button type="button" className="btn btn-secondary today-active-study-link" onClick={openActiveSession}>
                <Play size={15} />
                Open in Study
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
              <span className="today-soft-label">Today</span>
              <h2>Start</h2>
              <p>先开始一个小块。</p>
            </div>
            <div className="today-start-actions">
              <button type="button" className="today-start-action-card primary" onClick={() => startStudy('study')}>
                <span className="start-action-card__icon"><BookOpen size={20} /></span>
                <span className="start-action-card__content">
                  <span className="start-action-card__label">Study</span>
                  <span className="start-action-card__helper">Start a focus session</span>
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
                  <span className="start-action-card__label">Exercise</span>
                  <span className="start-action-card__helper">Log movement</span>
                </span>
              </button>
            </div>
          </section>

          <div className="today-progress-strip" aria-label="Today progress">
            {progressItems.map(item => (
              <span key={item.label} className="today-progress-pill">
                <strong>{item.label}</strong>
                {item.value}
              </span>
            ))}
            <span className="today-progress-pill muted">Day {irisDay}</span>
          </div>
        </>
      )}

      {!activeSession && (
        <section className="today-next-useful-card">
          <div className="today-next-copy">
            <span className="today-soft-label">Next</span>
            <h3>{nextTitle}</h3>
            <div className="today-next-chips">
              <span>{nextCategory}</span>
              <span>{nextDuration} min</span>
            </div>
          </div>
          <div className="today-next-image-panel" aria-hidden="true">
            <span className="today-next-coffee" />
            <span className="today-next-notebook" />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleNextUsefulThing}>
            <Play size={15} />
            {activeStudySession ? 'Open active session' : nextBlock ? 'Open in Study' : 'Open Study'}
          </button>
        </section>
      )}

      <div className="today-module-row" aria-label="Today modules">
        {moduleRows.map(row => (
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

      {expandedModule === 'done' && (
        <section className="today-module-panel today-done-card">
          <div className="today-done-header">
            <div>
              <span className="today-soft-label">Done</span>
              <h3>看得见的进展。</h3>
            </div>
            <button type="button" className="btn btn-secondary" onClick={refreshDone}>Refresh</button>
          </div>
          <div className="today-done-grid">
            <div><strong>{summary.studyMinutes}</strong><span>Study min</span></div>
            <div><strong>{summary.englishReps}</strong><span>English reps</span></div>
            <div><strong>{summary.englishOutputMinutes}/{summary.englishInputMinutes}</strong><span>English out/in</span></div>
            <div><strong>{movementMinutes}</strong><span>Move min</span></div>
            <div><strong>{summary.adminMinutes}</strong><span>Admin min</span></div>
          </div>
          <div className="today-done-list">
            {doneItems.length > 0 ? doneItems.slice(0, 8).map(item => (
              <div key={item.id}>
                <span>{item.time}</span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </div>
            )) : (
              <p>完成后才会记录。</p>
            )}
          </div>
        </section>
      )}

      {message && (
        <div className="start-now-message">
          {message}
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
