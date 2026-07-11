import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, Clipboard, Clock, Copy, Play, Square, Target } from 'lucide-react'
import { getLocalDateKey } from '../focus'
import { STUDY_CATEGORIES, STUDY_TASK_LIBRARY } from '../studyTaskLibrary'
import {
  drawEnglishListeningMaterial,
  ENGLISH_LISTENING_DRAW_MODES,
  englishListeningDrawNotePrompt,
  englishListeningDrawModeLabel,
  latestEnglishListeningDraw,
  loadEnglishListeningDrawState,
  markEnglishListeningDrawStarted,
  redrawEnglishListeningMaterial,
} from '../englishListeningDraw'
import { pushStudyDailyLogToNotion } from '../services/notionService'
import {
  clearActiveSession as clearGlobalActiveSession,
  startActiveSession,
} from '../activeSessionStore'
import {
  addIris365ProofFromStudySession,
  buildProofDraftFromStudySession,
  findIris365ProofByStudySession,
  getIris365ProofItemsForDate,
  IRIS_365_PROOF_CATEGORIES,
  isProofWorthyStudySession,
  loadIris365Store,
  studySessionHasProofArtifact,
} from '../iris365Storage'
import {
  addManualEnglishOutputRep,
  addStudySessionEnglishOutputRep,
  currentEnglishOutputMilestone,
  englishOutputRepsForDate,
  englishOutputRepsForLastSevenDays,
  ENGLISH_OUTPUT_LONG_TERM_TARGET,
  loadEnglishOutputJourney,
  undoLastEnglishOutputRep,
} from '../englishOutputJourney'
import * as timerEngine from '../timerEngine'
import {
  ensureCustomStudyTaskInTaskStore,
  ensureStudyTemplateTaskInTaskStore,
  mirrorActiveStudySessionInTaskStore,
  writeStudySessionToTaskStore,
} from '../taskStore'
import {
  addStudySessionRecord,
  clearActiveStudySession,
  loadActiveStudySession,
  loadDailyStudyTarget,
  loadStudyDailyReview,
  loadStudySessionRecords,
  loadStudySessionRecordsForDate,
  saveActiveStudySession,
  saveDailyStudyTarget,
  saveStudyDailyReview,
} from '../studyStorage'
import type {
  DailyStudyTarget,
  StudyActiveSession,
  StudyCategory,
  StudyDailyReview,
  StudySessionRecord,
} from '../studyTypes'
import type { Iris365ProofCategory, Iris365ProofItem } from '../iris365Types'
import type { EnglishListeningDrawMode, EnglishListeningDrawResult } from '../englishListeningDraw'
import type { TimerSession } from '../timerEngineTypes'
import { consumeStudyTaskHandoff, type StudyTaskHandoff } from '../studyHandoff'

const QUICK_TARGETS = [3, 5, 6, 8]
const STUDY_TIMER_ENGINE_KEY = 'iris-study-timer-engine-active'
const COURSERA_EXPIRY_DATE = '2026-09-23'
const COURSERA_CATEGORY: StudyCategory = 'Coursera AI Pathway'

type StudyProofDraft = Pick<Iris365ProofItem, 'date' | 'category' | 'title' | 'description' | 'linkOrFile' | 'sourceSessionId'>

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-AU').format(value)
}

function daysUntilDate(date: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${date}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function daysSince(value?: string): number | null {
  if (!value) return null
  const current = new Date()
  current.setHours(0, 0, 0, 0)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((current.getTime() - date.getTime()) / 86_400_000))
}

function courseraActivityStatus(records: StudySessionRecord[]): {
  label: string
  detail: string
  severity: 'ok' | 'warning' | 'strong' | 'critical'
  daysInactive: number | null
} {
  const latest = records
    .filter(record => record.status === 'completed' && record.category === COURSERA_CATEGORY)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
  const inactiveDays = daysSince(latest?.completedAt)
  if (inactiveDays === null) {
    return {
      label: 'No Coursera session logged yet',
      detail: 'Log one Coursera AI Pathway session this week to establish activity.',
      severity: 'warning',
      daysInactive: null,
    }
  }
  if (inactiveDays >= 13) {
    return {
      label: `${inactiveDays} days since last Coursera session`,
      detail: 'Critical: approaching the 14-day inactivity removal risk.',
      severity: 'critical',
      daysInactive: inactiveDays,
    }
  }
  if (inactiveDays >= 10) {
    return {
      label: `${inactiveDays} days since last Coursera session`,
      detail: 'Strong warning: do a Coursera session now to protect scholarship access.',
      severity: 'strong',
      daysInactive: inactiveDays,
    }
  }
  if (inactiveDays >= 7) {
    return {
      label: `${inactiveDays} days since last Coursera session`,
      detail: 'Warning: no Coursera session logged in the last 7 days.',
      severity: 'warning',
      daysInactive: inactiveDays,
    }
  }
  return {
    label: 'Active this week',
    detail: `Last Coursera session was ${inactiveDays === 0 ? 'today' : `${inactiveDays} day${inactiveDays === 1 ? '' : 's'} ago`}.`,
    severity: 'ok',
    daysInactive: inactiveDays,
  }
}

function todayStudySummary(records: ReturnType<typeof loadStudySessionRecordsForDate>) {
  const completed = records.filter(record => record.status === 'completed')
  return {
    completedSessions: completed.length,
    completedMinutes: completed.reduce((sum, record) => sum + record.actualMinutes, 0),
  }
}

function timeLabel(value: string): string {
  return new Date(value).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function categoryBreakdown(records: StudySessionRecord[]): Record<StudyCategory, number> {
  const empty = Object.fromEntries(STUDY_CATEGORIES.map(category => [category, 0])) as Record<StudyCategory, number>
  return records
    .filter(record => record.status === 'completed')
    .reduce<Record<StudyCategory, number>>((breakdown, record) => {
      breakdown[record.category] += record.actualMinutes
      return breakdown
    }, empty)
}

function canSaveSessionAsProof(record: StudySessionRecord): boolean {
  if (record.status !== 'completed') return false
  return isProofWorthyStudySession(record) || studySessionHasProofArtifact(record)
}

function activeSessionKindForStudy(category: StudyCategory): 'study' | 'english-output' | 'english-input' {
  if (category === 'English Output') return 'english-output'
  if (category === 'English Input') return 'english-input'
  return 'study'
}

function activeSessionOriginForStudy(session: StudyActiveSession): 'today-start-panel' | 'study' | 'english-listening-draw' | 'block-queue' {
  if (session.source === 'today-start-panel') return 'today-start-panel'
  if (session.source === 'english-listening-draw') return 'english-listening-draw'
  if (session.source === 'block-queue') return 'block-queue'
  return 'study'
}

function proofSessionMicrocopy(record: StudySessionRecord): string {
  if (isProofWorthyStudySession(record)) {
    return 'This may help future CV / LinkedIn / portfolio / interview answers.'
  }
  return 'Save only if this produced a reusable note, link, or visible artifact.'
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

export default function StudyDashboard() {
  const today = getLocalDateKey()
  const [target, setTarget] = useState<DailyStudyTarget>(() => loadDailyStudyTarget(today))
  const [selectedCategory, setSelectedCategory] = useState<StudyCategory>('English Output')
  const [selectedTemplateId, setSelectedTemplateId] = useState(STUDY_TASK_LIBRARY[0]?.id ?? '')
  const [customHours, setCustomHours] = useState(() => String(target.targetMinutes / 60))
  const [copied, setCopied] = useState<string | null>(null)
  const [customTask, setCustomTask] = useState({
    title: '',
    category: 'English Output' as StudyCategory,
    duration: '25',
    noteDestination: 'Obsidian/Study/Inbox.md',
    notes: '',
  })
  const [customTimerMinutes, setCustomTimerMinutes] = useState('25')
  const [notionStatus, setNotionStatus] = useState<string | null>(null)
  const [notionUrl, setNotionUrl] = useState<string | null>(null)
  const [pushingNotion, setPushingNotion] = useState(false)
  const [selectedQueueTask, setSelectedQueueTask] = useState<StudyTaskHandoff | null>(null)
  const [outputJourney, setOutputJourney] = useState(() => loadEnglishOutputJourney())
  const [manualRepNote, setManualRepNote] = useState('')
  const [drawMode, setDrawMode] = useState<EnglishListeningDrawMode>('shadowing')
  const [listeningDrawState, setListeningDrawState] = useState(() => loadEnglishListeningDrawState())
  const [activeSession, setActiveSession] = useState<StudyActiveSession | null>(() =>
    restoreActiveStudySession(),
  )
  const [nowMs, setNowMs] = useState(Date.now())
  const [sessions, setSessions] = useState(() => loadStudySessionRecordsForDate(today))
  const [allStudySessions, setAllStudySessions] = useState(() => loadStudySessionRecords())
  const [review, setReview] = useState<StudyDailyReview>(() => loadStudyDailyReview(today))
  const [proofStore, setProofStore] = useState(() => loadIris365Store())
  const [pendingProofSession, setPendingProofSession] = useState<StudySessionRecord | null>(null)
  const [proofDraft, setProofDraft] = useState<StudyProofDraft | null>(null)
  const summary = todayStudySummary(sessions)
  const completedSessions = sessions.filter(record => record.status === 'completed')
  const proofsToday = useMemo(() => getIris365ProofItemsForDate(today, proofStore), [proofStore, today])
  const breakdown = categoryBreakdown(sessions)
  const noteDestinations = Array.from(
    new Set(completedSessions.map(record => record.noteDestination).filter(Boolean)),
  )
  const remainingMinutes = Math.max(0, target.targetMinutes - summary.completedMinutes)
  const progress = target.targetMinutes > 0
    ? Math.min(100, Math.round((summary.completedMinutes / target.targetMinutes) * 100))
    : 0

  const visibleTemplates = useMemo(
    () => STUDY_TASK_LIBRARY.filter(template => template.category === selectedCategory),
    [selectedCategory],
  )
  const selectedTemplate =
    STUDY_TASK_LIBRARY.find(template => template.id === selectedTemplateId) ??
    visibleTemplates[0] ??
    STUDY_TASK_LIBRARY[0]
  const activeTimer = activeSession ? timerFromStudySession(activeSession) : null
  const activeRemainingMs = activeTimer ? timerEngine.remainingMs(activeTimer, nowMs) : 0
  const activeProgress = activeSession
    ? Math.min(100, Math.round(((activeSession.durationMinutes * 60_000 - activeRemainingMs) / (activeSession.durationMinutes * 60_000)) * 100))
    : 0
  const courseraDaysRemaining = daysUntilDate(COURSERA_EXPIRY_DATE)
  const courseraStatus = courseraActivityStatus(allStudySessions)
  const outputMilestone = currentEnglishOutputMilestone(outputJourney.totalReps)
  const outputMilestoneTotal = Math.min(outputJourney.totalReps, outputMilestone.next)
  const outputToday = englishOutputRepsForDate(outputJourney, today)
  const outputWeek = englishOutputRepsForLastSevenDays(outputJourney)
  const outputMilestonePercent = Math.min(100, Math.round((outputMilestone.progress / outputMilestone.span) * 100))
  const outputLongTermPercent = Math.min(100, (outputJourney.totalReps / ENGLISH_OUTPUT_LONG_TERM_TARGET) * 100)
  const latestListeningDraw = latestEnglishListeningDraw(listeningDrawState)
  const listeningDrawRedrawsRemaining = Math.max(0, listeningDrawState.redrawLimit - listeningDrawState.redrawsUsed)

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    const handleVisibilityChange = () => setNowMs(Date.now())
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    const target = sessionStorage.getItem('iris-study-focus-target')
    if (target !== 'english') return
    sessionStorage.removeItem('iris-study-focus-target')
    window.setTimeout(() => {
      document.getElementById('english-listening-draw')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 80)
  }, [])

  useEffect(() => {
    if (!activeSession || !activeTimer || activeSession.status !== 'running') return
    if (!timerEngine.isFinished(activeTimer, nowMs)) return
    completeSession('completed', timerEngine.expectedEndTime(activeTimer, nowMs))
  }, [activeSession, nowMs])

  useEffect(() => {
    const handoff = consumeStudyTaskHandoff()
    if (!handoff) return
    setSelectedQueueTask(handoff)
    setSelectedCategory(handoff.category)
    setCustomTimerMinutes(String(handoff.durationMinutes || 25))
    setCustomTask({
      title: handoff.title,
      category: handoff.category,
      duration: String(handoff.durationMinutes || 25),
      noteDestination: handoff.noteDestination,
      notes: handoff.notes,
    })
    window.setTimeout(() => {
      document.getElementById('study-focus-timer')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }, [])

  function updateTargetMinutes(targetMinutes: number) {
    const next = {
      ...target,
      targetMinutes,
    }
    setTarget(next)
    setCustomHours(String(targetMinutes / 60))
    saveDailyStudyTarget(next)
  }

  function applyCustomTarget() {
    const parsed = Number(customHours)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    updateTargetMinutes(Math.round(parsed * 60))
  }

  function selectCategory(category: StudyCategory) {
    setSelectedCategory(category)
    setSelectedTemplateId(
      STUDY_TASK_LIBRARY.find(template => template.category === category)?.id ?? selectedTemplateId,
    )
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
  }

  function templateSummary() {
    if (!selectedTemplate) return ''
    return [
      `# ${selectedTemplate.title}`,
      '',
      `Category: ${selectedTemplate.category}`,
      `Duration: ${selectedTemplate.defaultDuration} min`,
      `Energy: ${selectedTemplate.energy}`,
      `Note: ${selectedTemplate.noteDestination}`,
      '',
      `Resource: ${selectedTemplate.resourceSuggestion}`,
      `Method: ${selectedTemplate.studyMethod}`,
      '',
      'Subtasks:',
      ...selectedTemplate.subtasks.map(subtask => `- ${subtask}`),
    ].join('\n')
  }

  function listeningDrawSummary(draw: EnglishListeningDrawResult) {
    return [
      `# ${draw.title}`,
      '',
      `Mode: ${englishListeningDrawModeLabel(draw.mode)}`,
      `Material: ${draw.materialTitle}`,
      `Source: ${draw.sourceName}`,
      `Open: ${draw.suggestedWhereToOpen}`,
      `Category: ${draw.category}`,
      `Duration: ${draw.recommendedDuration} min`,
      `Counts as English Output Rep: ${draw.countsAsEnglishOutputRep ? 'Yes, if completed with output' : 'No, unless output is added'}`,
      `Note: ${draw.noteDestination}`,
      '',
      `Method: ${draw.studyMethod}`,
      '',
      'Subtasks:',
      ...draw.subtasks.map(subtask => `- ${subtask}`),
    ].join('\n')
  }

  function customTaskSummary() {
    const title = customTask.title.trim() || 'Custom study task'
    return [
      `# ${title}`,
      '',
      `Category: ${customTask.category}`,
      `Duration: ${customTask.duration || 25} min`,
      `Note: ${customTask.noteDestination || 'Obsidian/Study/Inbox.md'}`,
      '',
      customTask.notes.trim() ? `Notes: ${customTask.notes.trim()}` : 'Notes:',
    ].join('\n')
  }

  function handleListeningDraw() {
    if (listeningDrawState.draws.length > 0) return
    setListeningDrawState(drawEnglishListeningMaterial(drawMode, listeningDrawState))
  }

  function handleListeningRedraw() {
    setListeningDrawState(redrawEnglishListeningMaterial(drawMode, listeningDrawState))
  }

  function persistActiveSession(session: StudyActiveSession | null) {
    setActiveSession(session)
    setNowMs(Date.now())
    mirrorActiveStudySessionInTaskStore(session)
    if (session) {
      saveActiveStudySession(session)
      timerEngine.save(STUDY_TIMER_ENGINE_KEY, timerFromStudySession(session))
      startActiveSession({
        id: session.id,
        origin: activeSessionOriginForStudy(session),
        kind: activeSessionKindForStudy(session.category),
        category: session.category,
        title: session.title,
        startedAt: new Date(session.sessionStartTime).toISOString(),
        plannedMinutes: session.durationMinutes,
        linkedTaskId: session.customTaskId ?? session.taskTemplateId,
        linkedQueueBlockId: session.source === 'block-queue' ? session.sourceImportId : undefined,
        targetTab: 'study',
        status: session.status === 'paused' ? 'paused' : 'active',
      })
    } else {
      clearActiveStudySession()
      timerEngine.clear(STUDY_TIMER_ENGINE_KEY)
      clearGlobalActiveSession()
    }
  }

  function startTemplateSession(durationMinutes: number) {
    if (!selectedTemplate) return
    const start = Date.now()
    const sessionId = crypto.randomUUID()
    const timerSession = timerEngine.start(
      `study-template-instance:${selectedTemplate.id}`,
      durationMinutes,
      'study',
      { id: sessionId, startedAt: new Date(start).toISOString() },
    )
    const session = studySessionWithTimer({
      id: sessionId,
      taskTemplateId: selectedTemplate.id,
      title: selectedTemplate.title,
      category: selectedTemplate.category,
      sessionStartTime: start,
      durationMinutes,
      expectedEndTime: start + durationMinutes * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination: selectedTemplate.noteDestination,
      notes: selectedTemplate.studyMethod,
      resourceUsed: selectedTemplate.resourceSuggestion,
    }, timerSession)
    ensureStudyTemplateTaskInTaskStore(selectedTemplate, durationMinutes, session)
    persistActiveSession(session)
  }

  function startCustomSession() {
    const duration = Number(customTask.duration)
    const durationMinutes = Number.isFinite(duration) && duration > 0 ? duration : 25
    const title = customTask.title.trim() || 'Custom study task'
    const start = Date.now()
    const customTaskId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const timerSession = timerEngine.start(
      `manual-study:${customTaskId}`,
      durationMinutes,
      'study',
      { id: sessionId, startedAt: new Date(start).toISOString() },
    )
    const session = studySessionWithTimer({
      id: sessionId,
      customTaskId,
      title,
      category: customTask.category,
      sessionStartTime: start,
      durationMinutes,
      expectedEndTime: start + durationMinutes * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination: customTask.noteDestination || 'Obsidian/Study/Inbox.md',
      notes: customTask.notes,
      resourceUsed: customTask.notes,
    }, timerSession)
    ensureCustomStudyTaskInTaskStore({
      customTaskId,
      title,
      category: customTask.category,
      durationMinutes,
      noteDestination: session.noteDestination,
      notes: customTask.notes,
      activeSession: session,
    })
    persistActiveSession(session)
  }

  function startQueueHandoffSession(durationMinutes: number) {
    if (!selectedQueueTask) return
    const start = Date.now()
    const customTaskId = selectedQueueTask.selectedStudyTaskId
    const sessionId = crypto.randomUUID()
    const timerSession = timerEngine.start(
      `manual-study:${customTaskId}`,
      durationMinutes,
      'study',
      { id: sessionId, startedAt: new Date(start).toISOString() },
    )
    const session = studySessionWithTimer({
      id: sessionId,
      customTaskId,
      source: 'block-queue',
      sourceImportId: selectedQueueTask.linkedQueueBlockId,
      title: selectedQueueTask.title,
      category: selectedQueueTask.category,
      sessionStartTime: start,
      durationMinutes,
      expectedEndTime: start + durationMinutes * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination: selectedQueueTask.noteDestination,
      notes: selectedQueueTask.notes,
      resourceUsed: selectedQueueTask.resourceUsed,
    }, timerSession)
    ensureCustomStudyTaskInTaskStore({
      customTaskId,
      title: selectedQueueTask.title,
      category: selectedQueueTask.category,
      durationMinutes,
      noteDestination: selectedQueueTask.noteDestination,
      notes: selectedQueueTask.notes,
      activeSession: session,
    })
    persistActiveSession(session)
  }

  function startSelectedStudySession(durationMinutes: number) {
    if (selectedQueueTask) {
      startQueueHandoffSession(durationMinutes)
      return
    }
    startTemplateSession(durationMinutes)
  }

  function startListeningDrawSession(draw: EnglishListeningDrawResult) {
    if (activeSession) return
    const start = Date.now()
    const customTaskId = draw.id
    const sessionId = crypto.randomUUID()
    const timerSession = timerEngine.start(
      `english-listening-draw:${draw.id}`,
      draw.recommendedDuration,
      'study',
      { id: sessionId, startedAt: new Date(start).toISOString() },
    )
    const session = studySessionWithTimer({
      id: sessionId,
      customTaskId,
      source: draw.source,
      sourceImportId: draw.id,
      title: draw.title,
      category: draw.category,
      sessionStartTime: start,
      durationMinutes: draw.recommendedDuration,
      expectedEndTime: start + draw.recommendedDuration * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination: draw.noteDestination,
      notes: draw.studyMethod,
      resourceUsed: draw.resourceSuggestion,
    }, timerSession)
    ensureCustomStudyTaskInTaskStore({
      customTaskId,
      title: draw.title,
      category: draw.category,
      durationMinutes: draw.recommendedDuration,
      noteDestination: draw.noteDestination,
      notes: draw.studyMethod,
      activeSession: session,
    })
    persistActiveSession(session)
    setListeningDrawState(markEnglishListeningDrawStarted(draw.id, sessionId, listeningDrawState))
  }

  function startCustomDurationSession() {
    const duration = Number(customTimerMinutes)
    if (!Number.isFinite(duration) || duration <= 0) return
    startSelectedStudySession(Math.round(duration))
  }

  function completeSession(status: StudySessionRecord['status'], completedAtMs = Date.now()) {
    if (!activeSession) return
    const activeTimerSession = timerFromStudySession(activeSession)
    const endedTimer = status === 'completed'
      ? timerEngine.complete(activeTimerSession, completedAtMs)
      : timerEngine.abandon(activeTimerSession, completedAtMs)
    const actualMs = status === 'completed'
      ? Math.min(activeSession.durationMinutes * 60_000, timerEngine.elapsedMs(endedTimer, completedAtMs))
      : timerEngine.elapsedMs(endedTimer, completedAtMs)
    const record: StudySessionRecord = {
      id: activeSession.id,
      taskTemplateId: activeSession.taskTemplateId,
      customTaskId: activeSession.customTaskId,
      source: activeSession.source,
      sourceImportId: activeSession.sourceImportId,
      title: activeSession.title,
      category: activeSession.category,
      startedAt: endedTimer.startedAt,
      completedAt: endedTimer.endedAt ?? new Date(completedAtMs).toISOString(),
      plannedMinutes: endedTimer.durationPlannedMin,
      actualMinutes: status === 'completed'
        ? Math.max(1, Math.round(actualMs / 60_000))
        : Math.max(0, Math.round(actualMs / 60_000)),
      status,
      noteDestination: activeSession.noteDestination,
      notes: activeSession.notes,
      resourceUsed: activeSession.resourceUsed,
    }
    addStudySessionRecord(record)
    writeStudySessionToTaskStore(record)
    if (record.status === 'completed') {
      setOutputJourney(addStudySessionEnglishOutputRep(record))
      if (canSaveSessionAsProof(record) && !findIris365ProofByStudySession(record.id, proofStore)) {
        setPendingProofSession(record)
      }
    }
    setSessions(loadStudySessionRecordsForDate(today))
    setAllStudySessions(loadStudySessionRecords())
    persistActiveSession(null)
  }

  function returnToFocusScreen() {
    window.dispatchEvent(new CustomEvent('iris-open-tab', { detail: { tab: 'today', focus: 'active-session' } }))
    window.setTimeout(() => {
      document.querySelector('[aria-label="Active focus session"]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
  }

  function handleManualOutputRep() {
    setOutputJourney(addManualEnglishOutputRep(manualRepNote))
    setManualRepNote('')
  }

  function handleUndoOutputRep() {
    setOutputJourney(undoLastEnglishOutputRep())
  }

  function updateReview(patch: Partial<StudyDailyReview>) {
    const next = {
      ...review,
      ...patch,
      date: today,
    }
    setReview(next)
    saveStudyDailyReview(next)
  }

  function saveSessionAsProof(record: StudySessionRecord, overrides: Partial<StudyProofDraft> = {}) {
    const nextStore = addIris365ProofFromStudySession(record, overrides, proofStore)
    setProofStore(nextStore)
    setPendingProofSession(current => current?.id === record.id ? null : current)
    setProofDraft(null)
  }

  function editSessionProof(record: StudySessionRecord) {
    const draft = buildProofDraftFromStudySession(record)
    setProofDraft({
      date: draft.date,
      category: draft.category,
      title: draft.title,
      description: draft.description,
      linkOrFile: draft.linkOrFile,
      sourceSessionId: record.id,
    })
    setPendingProofSession(current => current?.id === record.id ? null : current)
  }

  function saveProofDraft() {
    if (!proofDraft?.sourceSessionId) return
    const record = completedSessions.find(session => session.id === proofDraft.sourceSessionId)
    if (!record) return
    saveSessionAsProof(record, proofDraft)
  }

  function dailyStudyMarkdown() {
    const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    const sessionLines = completedSessions.length > 0
      ? completedSessions.map(record => [
          `- ${timeLabel(record.startedAt)}-${timeLabel(record.completedAt)} · ${record.category} · ${record.title} · ${record.actualMinutes} min`,
          `  - Resource: ${record.resourceUsed || 'Not recorded'}`,
          `  - Notes: ${record.noteDestination || 'Not recorded'}`,
        ].join('\n'))
      : ['- No completed study sessions recorded.']
    const proofLines = proofsToday.length > 0
      ? proofsToday.map(item => `- ${item.category}: ${item.title}${item.linkOrFile ? ` — ${item.linkOrFile}` : ''}`)
      : ['- None recorded.']

    return [
      `# Daily Study Log - ${dateLabel}`,
      '',
      '## Target',
      `- Target focus time: ${formatHours(target.targetMinutes)}`,
      `- Completed focus time: ${formatHours(summary.completedMinutes)}`,
      `- Session count: ${summary.completedSessions}`,
      '',
      '## Sessions',
      ...sessionLines,
      '',
      '## Category Breakdown',
      ...STUDY_CATEGORIES.map(category => `- ${category}: ${formatHours(breakdown[category])}`),
      '',
      '## English Output Journey',
      `- Today: ${outputToday} reps`,
      `- This week: ${outputWeek} reps`,
      `- Total: ${formatNumber(outputJourney.totalReps)} / ${formatNumber(ENGLISH_OUTPUT_LONG_TERM_TARGET)}`,
      `- Current milestone: ${formatNumber(outputMilestoneTotal)} / ${formatNumber(outputMilestone.next)}`,
      '',
      '## Proof I’m Not Stuck',
      ...proofLines,
      '',
      '## Actual Done',
      review.actualDone || '',
      '',
      '## Carry Over',
      review.carryOver || '',
      '',
      '## Tomorrow’s Smallest Next Step',
      review.tomorrowNextStep || '',
    ].join('\n')
  }

  async function pushStudyLogToNotion() {
    setPushingNotion(true)
    setNotionStatus(null)
    setNotionUrl(null)
    const response = await pushStudyDailyLogToNotion({
      date: today,
      targetMinutes: target.targetMinutes,
      completedMinutes: summary.completedMinutes,
      sessionCount: summary.completedSessions,
      categoryBreakdown: breakdown,
      noteDestinations,
      sessions: completedSessions,
      review,
      markdown: dailyStudyMarkdown(),
    })
    setPushingNotion(false)
    setNotionStatus(response.message)
    if (response.success && response.data) {
      setNotionUrl(response.data.pageUrl ?? null)
      if (response.data.exportedAt) {
        updateReview({ notionLastPushedAt: response.data.exportedAt })
      }
    }
  }

  function renderStudyTimerSection() {
    return (
      <section className="study-timer-card" id="study-focus-timer">
        <div className="study-timer-header">
          <div>
            <div className="section-label">Selected task</div>
            <h3>{selectedQueueTask?.title ?? selectedTemplate?.title ?? 'Choose a study task'}</h3>
            <p>
              {selectedQueueTask
                ? `${selectedQueueTask.source === 'plan-queue' ? 'Plan queue' : 'Today queue'} · ${selectedQueueTask.category} · Study runs the timer.`
                : 'Start a 25 or 50 minute focus session from the selected task.'}
            </p>
            {selectedQueueTask && (
              <button type="button" className="study-change-task-link" onClick={() => setSelectedQueueTask(null)}>
                Change task
              </button>
            )}
          </div>
          <Clock size={18} />
        </div>

        <div className="study-timer-face">
          <span>--:--</span>
          <div className="study-progress-bar" aria-label="Timer progress 0%">
            <span style={{ width: '0%' }} />
          </div>
        </div>

        <div className="study-timer-controls">
          <button type="button" className="btn btn-primary" onClick={() => startSelectedStudySession(25)}>
            <Play size={14} />
            Start 25-min Study
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => startSelectedStudySession(50)}>
            <Play size={14} />
            Start 50-min Study
          </button>
          <div className="study-timer-custom">
            <input
              aria-label="Custom focus duration minutes"
              type="number"
              min="1"
              step="1"
              value={customTimerMinutes}
              onChange={event => setCustomTimerMinutes(event.target.value)}
            />
            <button type="button" className="btn btn-secondary" onClick={startCustomDurationSession}>
              Start custom Study
            </button>
          </div>
        </div>
      </section>
    )
  }

  function renderActiveSessionCompactBanner() {
    if (!activeSession) return null
    return (
      <section className="study-active-session-banner" aria-label="Active study session">
        <div className="study-active-session-copy">
          <div className="section-label">Active session</div>
          <h3>{activeSession.title}</h3>
          <p>
            {activeSession.category} · {formatTimer(activeRemainingMs)} remaining
            {activeSession.status === 'paused' ? ' · Paused' : ''}
          </p>
          <div className="study-active-session-progress" aria-label={`Session progress ${activeProgress}%`}>
            <span style={{ width: `${activeProgress}%` }} />
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={returnToFocusScreen}>
          Return to session
        </button>
      </section>
    )
  }

  return (
    <div className="page study-page">
      <div className="page-header">
        <div className="section-label">Study cockpit</div>
        <h2 className="page-title">Study Dashboard</h2>
        <p className="page-subtitle">
          A focused place for study targets, session templates, and Obsidian-ready notes.
        </p>
      </div>

      {activeSession && renderActiveSessionCompactBanner()}

      <section className="study-hero-card">
        <div className="study-hero-main">
          <div className="card-title-row">
            <Target size={16} />
            <h3>Daily Study Target</h3>
          </div>
          <div className="study-target-number">{formatHours(target.targetMinutes)}</div>
          <div className="study-progress-bar" aria-label={`Study progress ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="study-target-meta">
            <span>{formatHours(summary.completedMinutes)} completed</span>
            <span>{formatHours(remainingMinutes)} remaining</span>
            <span>{summary.completedSessions} sessions</span>
          </div>
        </div>

        <div className="study-target-controls">
          <div className="btn-group" aria-label="Quick study targets">
            {QUICK_TARGETS.map(hours => (
              <button
                key={hours}
                type="button"
                className={`btn-option ${target.targetMinutes === hours * 60 ? 'selected' : ''}`}
                onClick={() => updateTargetMinutes(hours * 60)}
              >
                {hours}h
              </button>
            ))}
          </div>
          <div className="study-custom-target">
            <input
              aria-label="Custom study target hours"
              type="number"
              min="0.25"
              step="0.25"
              value={customHours}
              onChange={event => setCustomHours(event.target.value)}
            />
            <button type="button" className="btn btn-secondary" onClick={applyCustomTarget}>
              Set custom
            </button>
          </div>
        </div>
      </section>

      <section className={`coursera-scholarship-card ${courseraStatus.severity}`}>
        <div className="coursera-scholarship-main">
          <div className="section-label">High priority study project</div>
          <h3>She Plus Tech x Coursera AI Scholarship</h3>
          <p>Access until Sep 23, 2026 · Stay active every week</p>
          <strong>Do at least one Coursera session each week to stay active.</strong>
        </div>
        <div className="coursera-scholarship-stats">
          <div>
            <span>{Math.max(0, courseraDaysRemaining)}</span>
            <small>days remaining</small>
          </div>
          <div>
            <span>{courseraStatus.daysInactive === null ? '—' : courseraStatus.daysInactive}</span>
            <small>days inactive</small>
          </div>
        </div>
        <div className="coursera-activity-status">
          <span>{courseraStatus.label}</span>
          <p>{courseraStatus.detail}</p>
        </div>
      </section>

      <section className="coursera-course-plan-card">
        <div>
          <div className="section-label">Suggested course plan</div>
          <h3>Priority courses</h3>
          <p>Guidance only, not a forced plan.</p>
        </div>
        <ol>
          <li>Google AI Essentials</li>
          <li>Vanderbilt Generative AI Automation</li>
          <li>Build Powerful AI Agents with OpenAI Tools</li>
          <li>Google Cloud Generative AI Leader</li>
        </ol>
      </section>

      <section className="english-output-journey-card">
        <div className="english-output-journey-main">
          <div className="section-label">English Output Journey</div>
          <h3>English Output Journey</h3>
          <p>Track active output, not vague input time.</p>
          <p>Auto-counts completed English Output sessions. Manual +1 is for outside-app practice.</p>
          <strong>Every rep is one vote for fluent English.</strong>
          <div className="english-output-rule-summary">
            25 min output ≈ 1 rep · 50 min output ≈ 2 reps
          </div>
        </div>
        <div className="english-output-journey-stats">
          <div>
            <span>{formatNumber(outputJourney.totalReps)}</span>
            <small>total reps</small>
          </div>
          <div>
            <span>{formatNumber(outputMilestoneTotal)} / {formatNumber(outputMilestone.next)}</span>
            <small>current milestone</small>
          </div>
          <div>
            <span>{outputToday}</span>
            <small>today</small>
          </div>
          <div>
            <span>{outputWeek}</span>
            <small>last 7 days</small>
          </div>
        </div>
        <div className="english-output-progress">
          <div>
            <span>Next milestone</span>
            <strong>{formatNumber(outputMilestone.next)} reps</strong>
          </div>
          <div className="study-progress-bar" aria-label={`English output milestone progress ${outputMilestonePercent}%`}>
            <span style={{ width: `${outputMilestonePercent}%` }} />
          </div>
          <div className="english-output-long-term-row">
            <span>{formatNumber(outputJourney.totalReps)} / {formatNumber(ENGLISH_OUTPUT_LONG_TERM_TARGET)}</span>
            <div className="english-output-long-term-bar" aria-label={`English output long-term progress ${outputLongTermPercent.toFixed(1)}%`}>
              <span style={{ width: `${outputLongTermPercent}%` }} />
            </div>
          </div>
        </div>
        <div className="english-output-manual-row">
          <input
            aria-label="Manual English output rep note"
            value={manualRepNote}
            onChange={event => setManualRepNote(event.target.value)}
            placeholder="Outside-app practice note, e.g. Interview answer practice"
          />
          <button type="button" className="btn btn-secondary" onClick={handleManualOutputRep}>
            +1 Manual Output Rep
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleUndoOutputRep}
            disabled={outputJourney.history.length === 0}
          >
            Undo last rep
          </button>
          <small>Use this only for English output done outside the timer.</small>
        </div>
      </section>

      <section className="english-listening-draw-card" id="english-listening-draw">
        <div className="english-listening-draw-header">
          <div>
            <div className="section-label">今日英语抽签</div>
            <h3>English Listening Draw</h3>
            <p>今天摸一张英语签</p>
            <small>抽到什么就从这里开始，不用想太多。摸一张签，开始就赢了。</small>
          </div>
          <div className="english-listening-redraws">
            <span>{listeningDrawRedrawsRemaining}</span>
            <small>今日剩余重抽</small>
          </div>
        </div>

        <div className="english-listening-draw-controls">
          <label>
            模式
            <select
              value={drawMode}
              onChange={event => setDrawMode(event.target.value as EnglishListeningDrawMode)}
            >
              {ENGLISH_LISTENING_DRAW_MODES.map(mode => (
                <option key={mode} value={mode}>{englishListeningDrawModeLabel(mode)}</option>
              ))}
            </select>
          </label>
          <div className="english-listening-draw-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleListeningDraw}
              disabled={listeningDrawState.draws.length > 0}
            >
              今天摸一张 🎲
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleListeningRedraw}
              disabled={listeningDrawState.draws.length > 0 && listeningDrawRedrawsRemaining === 0}
            >
              不合心意？再摸一张
            </button>
          </div>
        </div>

        {latestListeningDraw ? (
          <div className="english-listening-result">
            <div className="english-listening-result-main">
              <span>{englishListeningDrawModeLabel(latestListeningDraw.mode)}</span>
              <h4>{latestListeningDraw.materialTitle}</h4>
              <small className="english-listening-source">
                {latestListeningDraw.sourceName} · {latestListeningDraw.suggestedWhereToOpen}
              </small>
              <p>{latestListeningDraw.studyMethod}</p>
              <div className="english-listening-result-meta">
                <span>{latestListeningDraw.recommendedDuration} min</span>
                <span>{latestListeningDraw.category}</span>
                <span>{latestListeningDraw.energy} energy</span>
                <span>{latestListeningDraw.countsAsEnglishOutputRep ? '可算 Output Rep' : '泛听默认不计 rep'}</span>
              </div>
            </div>
            <ul className="english-listening-subtasks">
              {latestListeningDraw.subtasks.map(subtask => (
                <li key={subtask}>{subtask}</li>
              ))}
            </ul>
            <div className="english-listening-draw-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startListeningDrawSession(latestListeningDraw)}
                disabled={Boolean(activeSession)}
              >
                <Play size={14} />
                Start as Study Session
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyText('listening-draw-prompt', englishListeningDrawNotePrompt(latestListeningDraw, today))}
              >
                {copied === 'listening-draw-prompt' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'listening-draw-prompt' ? 'Copied' : 'Copy Obsidian note prompt'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyText('listening-draw-summary', listeningDrawSummary(latestListeningDraw))}
              >
                {copied === 'listening-draw-summary' ? <Check size={14} /> : <Clipboard size={14} />}
                {copied === 'listening-draw-summary' ? 'Copied' : 'Copy task summary'}
              </button>
              {latestListeningDraw.startedSessionId && (
                <small>今天已经从这张签开始过一次。</small>
              )}
              {activeSession && (
                <small>先完成或放弃当前 Study session，再开始这张签。</small>
              )}
            </div>
          </div>
        ) : (
          <div className="english-listening-empty">
            <p>今天还没摸签。选一个模式，摸一张轻轻开始。</p>
          </div>
        )}
      </section>

      {!activeSession && renderStudyTimerSection()}

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-label">Task library</div>
            <div className="card-title">Study Task Picker</div>
          </div>
          <BookOpen size={16} />
        </div>

        <div className="study-category-grid" aria-label="Study categories">
          {STUDY_CATEGORIES.map(category => (
            <button
              key={category}
              type="button"
              className={`study-category-chip ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => selectCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="study-picker-layout">
          <div className="study-template-list">
            {visibleTemplates.map(template => (
              <button
                key={template.id}
                type="button"
                className={`study-template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <div className="study-template-header">
                  <div>
                    <h3>{template.title}</h3>
                    <p>
                      {template.defaultDuration} min default · {template.energy} energy · {template.type}
                    </p>
                  </div>
                  <span>{template.eveningFriendly ? 'Evening OK' : 'Daytime better'}</span>
                </div>
                <p className="study-template-method">{template.studyMethod}</p>
              </button>
            ))}
          </div>

          {selectedTemplate && (
            <aside className="study-selected-panel" aria-label="Selected study task preview">
              <div className="section-label">Selected task</div>
              <h3>{selectedTemplate.title}</h3>
              <div className="study-duration-row">
                <span>{selectedTemplate.defaultDuration} min default</span>
                {selectedTemplate.alternativeDurations.map(duration => (
                  <span key={duration}>{duration} min</span>
                ))}
              </div>
              <div className="study-preview-block">
                <strong>Resource</strong>
                <p>{selectedTemplate.resourceSuggestion}</p>
              </div>
              <div className="study-preview-block">
                <strong>Method</strong>
                <p>{selectedTemplate.studyMethod}</p>
              </div>
              <div className="study-preview-block">
                <strong>Obsidian</strong>
                <p>{selectedTemplate.noteDestination}</p>
              </div>
              {selectedTemplate.subtasks.length > 0 && (
                <ul className="study-subtask-list">
                  {selectedTemplate.subtasks.map(subtask => (
                    <li key={subtask}>{subtask}</li>
                  ))}
                </ul>
              )}
              <div className="study-copy-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => copyText('path', selectedTemplate.noteDestination)}
                >
                  {copied === 'path' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'path' ? 'Copied' : 'Copy note path'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => copyText('summary', templateSummary())}
                >
                  {copied === 'summary' ? <Check size={14} /> : <Clipboard size={14} />}
                  {copied === 'summary' ? 'Copied' : 'Copy task summary'}
                </button>
              </div>
            </aside>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-label">Custom task</div>
            <div className="card-title">Make a one-off study task</div>
          </div>
          <Clipboard size={16} />
        </div>
        <div className="study-custom-grid">
          <div className="form-group">
            <label htmlFor="study-custom-title">Task title</label>
            <input
              id="study-custom-title"
              value={customTask.title}
              onChange={event => setCustomTask(prev => ({ ...prev, title: event.target.value }))}
              placeholder="e.g. Write cyber assessment intro"
            />
          </div>
          <div className="form-group">
            <label htmlFor="study-custom-category">Category</label>
            <select
              id="study-custom-category"
              value={customTask.category}
              onChange={event => setCustomTask(prev => ({
                ...prev,
                category: event.target.value as StudyCategory,
              }))}
            >
              {STUDY_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="study-custom-duration">Duration</label>
            <select
              id="study-custom-duration"
              value={customTask.duration}
              onChange={event => setCustomTask(prev => ({ ...prev, duration: event.target.value }))}
            >
              <option value="25">25 min</option>
              <option value="50">50 min</option>
              <option value="75">75 min</option>
              <option value="90">90 min</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="study-custom-note">Obsidian note destination</label>
            <input
              id="study-custom-note"
              value={customTask.noteDestination}
              onChange={event => setCustomTask(prev => ({
                ...prev,
                noteDestination: event.target.value,
              }))}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="study-custom-notes">Notes</label>
          <textarea
            id="study-custom-notes"
            value={customTask.notes}
            onChange={event => setCustomTask(prev => ({ ...prev, notes: event.target.value }))}
            placeholder="Useful resource, tiny outcome, or what to open first."
          />
        </div>
        <div className="study-copy-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={startCustomSession}
            disabled={Boolean(activeSession)}
          >
            <Play size={14} />
            Start custom task
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => copyText('custom-path', customTask.noteDestination || 'Obsidian/Study/Inbox.md')}
          >
            {copied === 'custom-path' ? <Check size={14} /> : <Copy size={14} />}
            {copied === 'custom-path' ? 'Copied' : 'Copy note path'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => copyText('custom-summary', customTaskSummary())}
          >
            {copied === 'custom-summary' ? <Check size={14} /> : <Clipboard size={14} />}
            {copied === 'custom-summary' ? 'Copied' : 'Copy task summary'}
          </button>
        </div>
      </section>

      <section className="card study-review-section">
        <div className="card-header">
          <div>
            <div className="section-label">Study review</div>
            <div className="card-title">Daily Study Log</div>
          </div>
          <Square size={16} />
        </div>

        {pendingProofSession && (
          <div className="study-proof-prompt">
            <div>
              <strong>要不要存成一个小证据？</strong>
              <p>{pendingProofSession.title} · {proofSessionMicrocopy(pendingProofSession)}</p>
            </div>
            <div>
              <button type="button" className="btn btn-primary" onClick={() => saveSessionAsProof(pendingProofSession)}>
                Save tiny proof
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => editSessionProof(pendingProofSession)}>
                Edit first
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingProofSession(null)}>
                Skip
              </button>
            </div>
          </div>
        )}

        {proofDraft && (
          <div className="study-proof-draft-card">
            <div className="card-header">
              <div>
                <div className="section-label">Small evidence still counts</div>
                <div className="card-title">Edit tiny proof</div>
              </div>
            </div>
            <div className="study-proof-draft-grid">
              <label>
                Category
                <select
                  value={proofDraft.category}
                  onChange={event => setProofDraft(prev => prev ? { ...prev, category: event.target.value as Iris365ProofCategory } : prev)}
                >
                  {IRIS_365_PROOF_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  value={proofDraft.title}
                  onChange={event => setProofDraft(prev => prev ? { ...prev, title: event.target.value } : prev)}
                />
              </label>
              <label>
                Link or file
                <input
                  value={proofDraft.linkOrFile}
                  onChange={event => setProofDraft(prev => prev ? { ...prev, linkOrFile: event.target.value } : prev)}
                />
              </label>
              <label className="study-proof-draft-description">
                Description
                <textarea
                  value={proofDraft.description}
                  onChange={event => setProofDraft(prev => prev ? { ...prev, description: event.target.value } : prev)}
                />
              </label>
            </div>
            <div className="study-copy-row">
              <button type="button" className="btn btn-primary" onClick={saveProofDraft}>
                Save tiny proof
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setProofDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="study-review-stats">
          <div>
            <span>{summary.completedSessions}</span>
            <small>sessions completed today</small>
          </div>
          <div>
            <span>{formatHours(summary.completedMinutes)}</span>
            <small>total focus time</small>
          </div>
          <div>
            <span>{noteDestinations.length}</span>
            <small>note destinations</small>
          </div>
          <div>
            <span>{outputToday}</span>
            <small>English reps today</small>
          </div>
          <div>
            <span>{outputWeek}</span>
            <small>English reps this week</small>
          </div>
          <div>
            <span>{formatNumber(outputJourney.totalReps)}</span>
            <small>English reps total</small>
          </div>
          <div>
            <span>{proofsToday.length}</span>
            <small>tiny proofs today</small>
          </div>
        </div>

        <div className="study-review-panel study-proof-today-panel">
          <h3>Proof I’m Not Stuck</h3>
          {proofsToday.length > 0 ? (
            <div className="study-proof-created-list">
              {proofsToday.map(item => (
                <div key={item.id}>
                  <span>{item.category}</span>
                  <strong>{item.title}</strong>
                  {item.linkOrFile && <small>{item.linkOrFile}</small>}
                </div>
              ))}
            </div>
          ) : (
            <p className="study-muted-copy">None recorded yet. Small evidence still counts when progress feels invisible.</p>
          )}
        </div>


        <div className="study-review-panel english-output-review-panel">
          <h3>English Output Journey</h3>
          <div className="study-breakdown-list">
            <div>
              <span>Today</span>
              <strong>{outputToday} reps</strong>
            </div>
            <div>
              <span>This week</span>
              <strong>{outputWeek} reps</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatNumber(outputJourney.totalReps)} / {formatNumber(ENGLISH_OUTPUT_LONG_TERM_TARGET)}</strong>
            </div>
            <div>
              <span>Current milestone</span>
              <strong>{formatNumber(outputMilestoneTotal)} / {formatNumber(outputMilestone.next)}</strong>
            </div>
          </div>
        </div>

        <div className="study-review-grid">
          <div className="study-review-panel">
            <h3>Sessions</h3>
            {completedSessions.length > 0 ? (
              <div className="study-session-list">
                {completedSessions.map(record => {
                  const existingProof = findIris365ProofByStudySession(record.id, proofStore)
                  const canSaveProof = canSaveSessionAsProof(record)
                  return (
                    <div key={record.id} className="study-session-row">
                      <strong>
                        {timeLabel(record.startedAt)}-{timeLabel(record.completedAt)} · {record.title}
                      </strong>
                      <span>{record.category} · {record.actualMinutes} min</span>
                      <small>{record.noteDestination}</small>
                      {canSaveProof && (
                        <div className="study-session-proof-actions">
                          {existingProof ? (
                            <span>Tiny proof saved</span>
                          ) : (
                            <>
                              <button type="button" onClick={() => saveSessionAsProof(record)}>
                                Save tiny proof
                              </button>
                              <button type="button" onClick={() => editSessionProof(record)}>
                                Edit first
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="study-muted-copy">No completed Study sessions yet today.</p>
            )}
          </div>

          <div className="study-review-panel">
            <h3>Category Breakdown</h3>
            <div className="study-breakdown-list">
              {STUDY_CATEGORIES.map(category => (
                <div key={category}>
                  <span>{category}</span>
                  <strong>{formatHours(breakdown[category])}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="study-review-panel study-note-destinations">
          <h3>Note Destinations Used</h3>
          {noteDestinations.length > 0 ? (
            <ul>
              {noteDestinations.map(destination => (
                <li key={destination}>{destination}</li>
              ))}
            </ul>
          ) : (
            <p className="study-muted-copy">No note destinations recorded yet.</p>
          )}
        </div>

        <div className="study-review-fields">
          <div className="form-group">
            <label htmlFor="study-review-actual">Actual Done</label>
            <textarea
              id="study-review-actual"
              value={review.actualDone}
              onChange={event => updateReview({ actualDone: event.target.value })}
              placeholder="What actually moved forward today?"
            />
          </div>
          <div className="form-group">
            <label htmlFor="study-review-carry">Carry Over</label>
            <textarea
              id="study-review-carry"
              value={review.carryOver}
              onChange={event => updateReview({ carryOver: event.target.value })}
              placeholder="What should continue tomorrow?"
            />
          </div>
          <div className="form-group">
            <label htmlFor="study-review-next">Tomorrow’s Smallest Next Step</label>
            <textarea
              id="study-review-next"
              value={review.tomorrowNextStep}
              onChange={event => updateReview({ tomorrowNextStep: event.target.value })}
              placeholder="The smallest useful restart step."
            />
          </div>
        </div>

        <div className="study-copy-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => copyText('daily-study-markdown', dailyStudyMarkdown())}
          >
            {copied === 'daily-study-markdown' ? <Check size={14} /> : <Clipboard size={14} />}
            {copied === 'daily-study-markdown' ? 'Copied Markdown' : 'Copy daily study summary as Markdown'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={pushStudyLogToNotion}
            disabled={pushingNotion}
          >
            <BookOpen size={14} />
            {pushingNotion ? 'Pushing...' : 'Push to Notion'}
          </button>
        </div>
        {(notionStatus || review.notionLastPushedAt) && (
          <div className="study-notion-status">
            {notionStatus && <p>{notionStatus}</p>}
            {notionUrl && (
              <a href={notionUrl} target="_blank" rel="noreferrer">
                Open Notion page
              </a>
            )}
            {review.notionLastPushedAt && (
              <small>
                Last pushed {new Date(review.notionLastPushedAt).toLocaleString('en-AU')}
              </small>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
