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
  StudyTaskTemplate,
} from '../studyTypes'
import type { Iris365ProofCategory, Iris365ProofItem } from '../iris365Types'
import type { EnglishListeningDrawMode, EnglishListeningDrawResult } from '../englishListeningDraw'
import type { TimerSession } from '../timerEngineTypes'
import { consumeStudyTaskHandoff, type StudyTaskHandoff } from '../studyHandoff'
import { markQueueBlockDoneFromSession } from '../queueTaskHelpers'

const QUICK_TARGETS = [3, 5, 6, 8]
const STUDY_TIMER_ENGINE_KEY = 'iris-study-timer-engine-active'
const COURSERA_EXPIRY_DATE = '2026-09-23'
const COURSERA_CATEGORY: StudyCategory = 'Coursera AI Pathway'
const STUDY_OS_URL = 'https://iris-study-os.vercel.app/'

type StudyPickerOption = StudyCategory | 'Custom'
const STUDY_PICKER_OPTIONS: StudyPickerOption[] = ['Custom', ...STUDY_CATEGORIES]

const EMPTY_CUSTOM_TASK = {
  title: '',
  category: 'English Output' as StudyCategory,
  duration: '25',
  noteDestination: 'Obsidian/Study/Inbox.md',
  notes: '',
}

function customTaskFromTemplate(template: StudyTaskTemplate) {
  return {
    title: template.title,
    category: template.category,
    duration: String(template.defaultDuration),
    noteDestination: template.noteDestination,
    notes: template.studyMethod,
  }
}

type StudyProofDraft = Pick<Iris365ProofItem, 'date' | 'category' | 'title' | 'description' | 'linkOrFile' | 'sourceSessionId'>

interface EnglishReferenceSection {
  title: string
  purpose: string
  items: Array<{
    name: string
    use: string
    note: string
  }>
}

const ENGLISH_REFERENCE_SECTIONS: EnglishReferenceSection[] = [
  {
    title: 'Level 1 · 完全不学习',
    purpose: '让英语成为默认娱乐语言。不开暂停，不查词，不记笔记。',
    items: [
      { name: 'Modern Family 重看', use: '日常美语 / comfort input', note: '纯英语生活环境，不要把它变成作业。' },
      { name: 'Brooklyn Nine-Nine', use: '嘴快 / banter / reaction', note: '练节奏，不追求高级词汇。' },
      { name: 'Puckboys audiobook', use: '大量无压力输入', note: '你真的会听，这点比“优秀材料”更重要。' },
      { name: 'BBC Earth', use: '替代短剧的 curiosity dopamine', note: '适合随便开着看，精神状态比短剧稳定。' },
    ],
  },
  {
    title: 'Level 2 · Shadowing',
    purpose: '每次 5-15 分钟，只截 30-90 秒。重点是 stress / phrasing / pausing。',
    items: [
      { name: 'Modern Family', use: '日常解释、吐槽、small talk', note: '优先 Claire / Mitchell / Phil。Mitchell 很适合你的 cognitive style。' },
      { name: 'BBC documentaries', use: '清晰表达、完整信息单位', note: 'David Attenborough 学停顿和清晰度，不模仿 persona。' },
      { name: 'Fisk', use: 'professional but casual Australian English', note: 'Holmesglen 工作场景很实用。' },
      { name: 'Born a Crime', use: 'storytelling naturally', note: '练讲故事，不是朗诵。' },
      { name: 'WorkLife with Adam Grant', use: 'intellectual conversational English', note: '清晰、现代、适合跟读。' },
      { name: 'The Diplomat', use: 'clarifying / disagreement / urgency', note: '高级但更可迁移到职场。' },
    ],
  },
  {
    title: 'Level 3 · 高级英语挖矿',
    purpose: '每周 2-3 次，每集最多提取 5 个表达，不要挖 25 个。',
    items: [
      { name: 'Succession', use: 'language as power', note: '学潜台词、positioning、sarcasm，不适合全集 shadow。' },
      { name: 'The Diplomat', use: 'language as problem-solving', note: '学 framing、pushing back、summarising complex information。' },
      { name: 'Gruen', use: '观点表达 / bullshit detection', note: '比 Utopia 更可能适合你，适合学如何表达 opinion。' },
      { name: 'The White Lotus', use: 'passive aggression / class-coded language', note: '适合分析“假装礼貌”的语言。' },
      { name: 'Veep', use: 'rapid-fire sarcasm / wordplay', note: '语言很绝，但不要模仿人格。' },
    ],
  },
  {
    title: 'Australian English · 重新排序',
    purpose: '不要把澳洲英语实用性压过“你愿不愿意反复听”。',
    items: [
      { name: 'Fisk', use: '澳洲职场 + casual English', note: '第一梯队，人物更可爱、对话短。' },
      { name: 'Colin from Accounts', use: 'modern everyday Australian conversation', note: '比 Utopia 更生活化、更有人味。' },
      { name: 'The Newsreader', use: '清晰正式澳洲英语', note: '更适合正式听力和时代背景。' },
      { name: 'Gruen', use: '澳洲观点表达', note: '适合 marketing / psychology / language 分析。' },
      { name: 'Utopia', use: '澳洲职场语言', note: '正式降级：不是不好，只是不必逼自己。' },
    ],
  },
  {
    title: 'Audiobook / Podcast',
    purpose: '有声书和 podcast 按用途分，不混成一个排行榜。',
    items: [
      { name: 'Born a Crime', use: 'shadowing / storytelling', note: '练自然讲故事的高级能力。' },
      { name: 'Project Hail Mary', use: 'explaining thought process', note: '适合 “here is the problem / if X is true...” 这种表达。' },
      { name: 'Puckboys / CU Hockey / Eden Finley / Saxon James', use: '大量泛听', note: '你真的会听，负责让你待在英语里。' },
      { name: 'WorkLife', use: 'shadowing', note: '★★★★★，现代知识型口语。' },
      { name: 'No Stupid Questions', use: '展开一个 idea', note: '看两个人如何自然推进想法。' },
      { name: 'Luke’s English Podcast', use: '学习型输入', note: '有时会像上英语课，不必做主力。' },
    ],
  },
  {
    title: 'Final Top 10 · 长期核心库',
    purpose: '综合你本人、学习价值、可持续性。',
    items: [
      { name: 'BBC documentaries', use: 'hidden gem / 核心资源', note: '信息密度高，替代短剧，不靠狗血关系。' },
      { name: 'Modern Family', use: '日常 shadowing', note: '最稳定。' },
      { name: 'Succession', use: '高级英语分析', note: '学母语者的模糊、权力和潜台词。' },
      { name: 'The Diplomat', use: '高级职场沟通', note: '比 Succession 更容易迁移到工作。' },
      { name: 'Fisk / Gruen', use: '澳洲英语', note: 'Fisk 练职场，Gruen 练观点。' },
      { name: 'Born a Crime / Puckboys / WorkLife', use: 'storytelling + 泛听 + 高质量口语', note: '组成你的英语媒体健身房。' },
    ],
  },
]

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

interface StudyDashboardProps {
  actionOnly?: boolean
}

export default function StudyDashboard({ actionOnly = false }: StudyDashboardProps) {
  const today = getLocalDateKey()
  const [target, setTarget] = useState<DailyStudyTarget>(() => loadDailyStudyTarget(today))
  const [selectedPicker, setSelectedPicker] = useState<StudyPickerOption>('Custom')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [customHours, setCustomHours] = useState(() => String(target.targetMinutes / 60))
  const [copied, setCopied] = useState<string | null>(null)
  const [customTask, setCustomTask] = useState({ ...EMPTY_CUSTOM_TASK })
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
  const [sessionStartMessage, setSessionStartMessage] = useState<string | null>(null)
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
    () => selectedPicker === 'Custom'
      ? []
      : STUDY_TASK_LIBRARY.filter(template => template.category === selectedPicker),
    [selectedPicker],
  )
  const selectedTemplate = STUDY_TASK_LIBRARY.find(template => template.id === selectedTemplateId) ?? null
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
  const hasSelectedEditableTask = Boolean(
    (selectedPicker === 'Custom' || selectedTemplate) && customTask.title.trim(),
  )
  const hasSelectedTask = Boolean(selectedQueueTask || hasSelectedEditableTask)
  const selectedTaskTitle = selectedQueueTask?.title
    ?? (hasSelectedEditableTask ? customTask.title.trim() : null)
  const selectedTaskCategory = selectedQueueTask?.category
    ?? (hasSelectedEditableTask ? customTask.category : null)
  const previewDuration = selectedQueueTask?.durationMinutes
    ?? (hasSelectedEditableTask ? (Number(customTask.duration) || 25) : (Number(customTimerMinutes) || 25))

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
    sessionStorage.removeItem('iris-study-focus-target')
    if (target !== 'english' && target !== 'timer') return
    window.setTimeout(() => {
      document.getElementById(target === 'english' ? 'english-listening-draw' : 'study-focus-timer')?.scrollIntoView({
        behavior: 'smooth',
        block: target === 'english' ? 'start' : 'center',
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
    setSelectedPicker(handoff.category)
    setSelectedTemplateId('')
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

  function selectPicker(picker: StudyPickerOption) {
    setSelectedPicker(picker)
    setSelectedTemplateId('')
    setSelectedQueueTask(null)
    setSessionStartMessage(null)
    if (picker === 'Custom') {
      setCustomTask({ ...EMPTY_CUSTOM_TASK })
      setCustomTimerMinutes('25')
      return
    }
    setCustomTask({ ...EMPTY_CUSTOM_TASK, category: picker })
  }

  function selectTemplate(template: StudyTaskTemplate) {
    setSelectedTemplateId(template.id)
    setSelectedQueueTask(null)
    setSessionStartMessage(null)
    setCustomTask(customTaskFromTemplate(template))
    setCustomTimerMinutes(String(template.defaultDuration))
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
  }

  function templateSummary() {
    if (!selectedTemplate) return ''
    const title = customTask.title.trim() || selectedTemplate.title
    return [
      `# ${title}`,
      '',
      `Category: ${customTask.category || selectedTemplate.category}`,
      `Duration: ${customTask.duration || selectedTemplate.defaultDuration} min`,
      `Energy: ${selectedTemplate.energy}`,
      `Note: ${customTask.noteDestination || selectedTemplate.noteDestination}`,
      '',
      `Resource: ${selectedTemplate.resourceSuggestion}`,
      `Method: ${customTask.notes.trim() || selectedTemplate.studyMethod}`,
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

  function logStudySessionStart(input: {
    requestedTaskId?: string
    resolvedTaskId?: string
    resolvedTitle: string
    source: string
  }) {
    if (!import.meta.env.DEV) return
    console.debug('[StudySessionStart]', input)
  }

  function showChooseTaskMessage() {
    setSessionStartMessage('Choose a task first.')
    window.setTimeout(() => {
      document.getElementById('study-task-picker')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function startTemplateSession(durationMinutes: number) {
    if (!selectedTemplate) {
      showChooseTaskMessage()
      return
    }
    const title = customTask.title.trim() || selectedTemplate.title
    const noteDestination = customTask.noteDestination.trim() || selectedTemplate.noteDestination
    const notes = customTask.notes.trim() || selectedTemplate.studyMethod
    const category = customTask.category || selectedTemplate.category
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
      title,
      category,
      sessionStartTime: start,
      durationMinutes,
      expectedEndTime: start + durationMinutes * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination,
      notes,
      resourceUsed: selectedTemplate.resourceSuggestion,
    }, timerSession)
    logStudySessionStart({
      requestedTaskId: selectedTemplate.id,
      resolvedTaskId: selectedTemplate.id,
      resolvedTitle: title,
      source: 'study-template',
    })
    ensureStudyTemplateTaskInTaskStore(selectedTemplate, durationMinutes, session, {
      title,
      noteDestination,
      studyMethod: notes,
    })
    persistActiveSession(session)
    setSessionStartMessage(null)
  }

  function startCustomSessionWithDuration(durationMinutes?: number) {
    const parsed = durationMinutes ?? Number(customTask.duration)
    const durationMinutesFinal = Number.isFinite(parsed) && parsed > 0 ? parsed : 25
    const title = customTask.title.trim()
    if (!title) {
      setSessionStartMessage('Add a custom task title first.')
      return
    }
    const start = Date.now()
    const customTaskId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const timerSession = timerEngine.start(
      `manual-study:${customTaskId}`,
      durationMinutesFinal,
      'study',
      { id: sessionId, startedAt: new Date(start).toISOString() },
    )
    const session = studySessionWithTimer({
      id: sessionId,
      customTaskId,
      title,
      category: customTask.category,
      sessionStartTime: start,
      durationMinutes: durationMinutesFinal,
      expectedEndTime: start + durationMinutesFinal * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination: customTask.noteDestination || 'Obsidian/Study/Inbox.md',
      notes: customTask.notes,
      resourceUsed: customTask.notes,
    }, timerSession)
    logStudySessionStart({
      requestedTaskId: customTaskId,
      resolvedTaskId: customTaskId,
      resolvedTitle: title,
      source: 'manual',
    })
    ensureCustomStudyTaskInTaskStore({
      customTaskId,
      title,
      category: customTask.category,
      durationMinutes: durationMinutesFinal,
      noteDestination: session.noteDestination,
      notes: customTask.notes,
      activeSession: session,
    })
    persistActiveSession(session)
    setSessionStartMessage(null)
  }

  function startCustomSession() {
    startCustomSessionWithDuration(Number(customTask.duration) || 25)
  }

  function startQueueHandoffSession(durationMinutes: number) {
    if (!selectedQueueTask) {
      showChooseTaskMessage()
      return
    }
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
    logStudySessionStart({
      requestedTaskId: selectedQueueTask.selectedStudyTaskId,
      resolvedTaskId: customTaskId,
      resolvedTitle: selectedQueueTask.title,
      source: selectedQueueTask.source,
    })
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
    setSessionStartMessage(null)
  }

  function startSelectedStudySession(durationMinutes: number) {
    if (selectedQueueTask) {
      startQueueHandoffSession(durationMinutes)
      return
    }
    if (selectedPicker === 'Custom') {
      startCustomSessionWithDuration(durationMinutes)
      return
    }
    if (selectedTemplate) {
      startTemplateSession(durationMinutes)
      return
    }
    showChooseTaskMessage()
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
    logStudySessionStart({
      requestedTaskId: draw.id,
      resolvedTaskId: draw.id,
      resolvedTitle: draw.title,
      source: draw.source,
    })
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
    setSessionStartMessage(null)
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
      if (record.sourceImportId) {
        markQueueBlockDoneFromSession(record.sourceImportId, today)
      }
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

  function renderTaskEditForm(mode: 'custom' | 'library') {
    return (
      <div className="study-custom-picker-inline">
        <div className="form-group">
          <label htmlFor="study-picker-custom-title">Task title</label>
          <input
            id="study-picker-custom-title"
            value={customTask.title}
            onChange={event => setCustomTask(prev => ({ ...prev, title: event.target.value }))}
            placeholder={mode === 'library' ? 'Adjust the title if needed' : 'e.g. Write cyber assessment intro'}
          />
        </div>
        <div className="study-custom-picker-row">
          <div className="form-group">
            <label htmlFor="study-picker-custom-category">Category</label>
            <select
              id="study-picker-custom-category"
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
            <label htmlFor="study-picker-custom-duration">Default duration</label>
            <select
              id="study-picker-custom-duration"
              value={customTask.duration}
              onChange={event => {
                const duration = event.target.value
                setCustomTask(prev => ({ ...prev, duration }))
                setCustomTimerMinutes(duration)
              }}
            >
              <option value="25">25 min</option>
              <option value="50">50 min</option>
              <option value="75">75 min</option>
              <option value="90">90 min</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="study-picker-custom-notes">Notes / method</label>
          <textarea
            id="study-picker-custom-notes"
            value={customTask.notes}
            onChange={event => setCustomTask(prev => ({ ...prev, notes: event.target.value }))}
            placeholder="What to open first, or how to run this block."
            rows={2}
          />
        </div>
        {mode === 'custom' ? (
          <p className="hub-support-copy">
            {actionOnly
              ? 'Add a clear title, then start the timer below.'
              : 'Add a title, then start the timer below. Obsidian path is in the full form further down.'}
          </p>
        ) : (
          <p className="hub-support-copy">Library defaults are pre-filled. Tweak anything, then start focus below.</p>
        )}
      </div>
    )
  }

  function renderTaskPickerStep() {
    if (selectedQueueTask) {
      return (
        <div className="study-queue-task-selected">
          <div>
            <span className="study-queue-task-source">
              {selectedQueueTask.source === 'plan-queue' ? 'From Plan queue' : 'From Today queue'}
            </span>
            <h4>{selectedQueueTask.title}</h4>
            <p>{selectedQueueTask.category} · {selectedQueueTask.durationMinutes || 25} min suggested</p>
          </div>
          <button type="button" className="study-change-task-link" onClick={() => setSelectedQueueTask(null)}>
            Pick from library instead
          </button>
        </div>
      )
    }

    return (
      <>
        <div className="study-category-grid study-category-grid-compact" aria-label="Study categories">
          {STUDY_PICKER_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              className={`study-category-chip ${selectedPicker === option ? 'active' : ''}`}
              onClick={() => selectPicker(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {selectedPicker === 'Custom' ? (
          renderTaskEditForm('custom')
        ) : (
          <>
            <div className="study-template-list study-template-list-compact">
              {visibleTemplates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  className={`study-template-card study-template-card-compact ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                  onClick={() => selectTemplate(template)}
                >
                  <div className="study-template-header">
                    <div>
                      <h3>{template.title}</h3>
                      <p>{template.defaultDuration} min · {template.energy} energy</p>
                    </div>
                    {selectedTemplate?.id === template.id && <span>Selected</span>}
                  </div>
                </button>
              ))}
            </div>
            {selectedTemplate && renderTaskEditForm('library')}
          </>
        )}
      </>
    )
  }

  function renderSelectedTaskPreview() {
    if (!selectedTemplate || selectedQueueTask) return null
    return (
      <details className="study-task-preview-details">
        <summary>Task details &amp; copy shortcuts</summary>
        <aside className="study-selected-panel" aria-label="Selected study task preview">
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
      </details>
    )
  }

  function renderStudyFocusHero() {
    const timerPreview = hasSelectedTask
      ? `${String(previewDuration).padStart(2, '0')}:00`
      : '--:--'

    return (
      <section className="study-focus-hero" id="study-focus-timer">
        <div className="study-focus-step study-focus-step-picker" id="study-task-picker">
          <div className="study-focus-step-head">
            <span className="study-step-num" aria-hidden="true">1</span>
            <div>
              <strong>Pick a task</strong>
              <p>Choose custom, a library block, or a task sent from Today.</p>
            </div>
          </div>
          {renderTaskPickerStep()}
        </div>

        <div className={`study-focus-step study-focus-step-start ${hasSelectedTask ? 'ready' : 'idle'}`}>
          <div className="study-focus-step-head">
            <span className="study-step-num" aria-hidden="true">2</span>
            <div>
              <strong>Start focus</strong>
              <p>
                {hasSelectedTask && selectedTaskTitle
                  ? `${selectedTaskTitle}${selectedTaskCategory ? ` · ${selectedTaskCategory}` : ''}`
                  : 'Select a task above, then start the timer.'}
              </p>
            </div>
            <Clock size={18} />
          </div>

          <div className="study-timer-face">
            <span>{timerPreview}</span>
            <small>{hasSelectedTask ? 'Planned duration · timer starts on click' : 'Waiting for task selection'}</small>
            <div className="study-progress-bar" aria-label="Timer progress 0%">
              <span style={{ width: '0%' }} />
            </div>
          </div>

          <div className="study-timer-controls">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!hasSelectedTask}
              title={hasSelectedTask ? undefined : 'Pick a task first'}
              onClick={() => startSelectedStudySession(25)}
            >
              <Play size={14} />
              Start 25-min Study
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!hasSelectedTask}
              title={hasSelectedTask ? undefined : 'Pick a task first'}
              onClick={() => startSelectedStudySession(50)}
            >
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
                disabled={!hasSelectedTask}
                onChange={event => setCustomTimerMinutes(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!hasSelectedTask}
                onClick={startCustomDurationSession}
              >
                Start custom Study
              </button>
            </div>
          </div>
          {sessionStartMessage && (
            <div className="study-start-message">
              <span>{sessionStartMessage}</span>
              <button type="button" className="study-change-task-link" onClick={showChooseTaskMessage}>
                Show task list
              </button>
            </div>
          )}
        </div>

        {renderSelectedTaskPreview()}
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

  if (actionOnly) {
    const recentCompletedSessions = [...completedSessions].reverse().slice(0, 4)
    return (
      <div className="page study-page study-action-page">
        <header className="study-action-header">
          <div>
            <div className="section-label">Start action now</div>
            <h2 className="page-title">Start a study block</h2>
            <p className="page-subtitle">
              Choose one task, start the timer, finish the block. Plans, materials, tools, and prompts live in Iris Study OS.
            </p>
          </div>
          <a className="btn btn-secondary study-os-reference-link" href={STUDY_OS_URL} target="_blank" rel="noreferrer">
            <BookOpen size={15} />
            Open Iris Study OS
          </a>
        </header>

        {activeSession ? renderActiveSessionCompactBanner() : renderStudyFocusHero()}

        {pendingProofSession && (
          <section className="study-action-proof" aria-label="Save completed study proof">
            <div>
              <div className="section-label">Block complete</div>
              <h3>{pendingProofSession.title}</h3>
              <p>{proofSessionMicrocopy(pendingProofSession)}</p>
            </div>
            <div className="study-action-proof-actions">
              <button type="button" className="btn btn-primary" onClick={() => saveSessionAsProof(pendingProofSession)}>
                Save tiny proof
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingProofSession(null)}>
                Done
              </button>
            </div>
          </section>
        )}

        <section className="study-action-done" aria-label="Study blocks completed today">
          <div className="study-action-done-heading">
            <div>
              <div className="section-label">Done today</div>
              <h3>{summary.completedSessions} block{summary.completedSessions === 1 ? '' : 's'} · {formatHours(summary.completedMinutes)}</h3>
            </div>
            {proofsToday.length > 0 && <span>{proofsToday.length} proof{proofsToday.length === 1 ? '' : 's'} saved</span>}
          </div>
          {recentCompletedSessions.length > 0 ? (
            <div className="study-action-session-list">
              {recentCompletedSessions.map(record => {
                const existingProof = findIris365ProofByStudySession(record.id, proofStore)
                const canSaveProof = canSaveSessionAsProof(record)
                return (
                  <article key={record.id}>
                    <div>
                      <strong>{record.title}</strong>
                      <span>{record.category} · {record.actualMinutes} min</span>
                    </div>
                    {canSaveProof && (
                      existingProof
                        ? <small>Proof saved</small>
                        : <button type="button" onClick={() => saveSessionAsProof(record)}>Save proof</button>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="study-muted-copy">No completed block yet. Pick one task above and start 25 minutes.</p>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="page study-page">
      <div className="page-header">
        <div className="section-label">Study cockpit</div>
        <h2 className="page-title">Study Dashboard</h2>
        <p className="page-subtitle">
          Pick a task, start the timer, complete one block. Everything else is reference.
        </p>
      </div>

      {activeSession && renderActiveSessionCompactBanner()}

      {!activeSession && renderStudyFocusHero()}

      <details className="hub-secondary-details study-secondary-details">
        <summary>Daily study target &amp; progress</summary>
      <section className="study-hero-card study-hero-card-compact">
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
      </details>

      <details className="study-secondary-details">
        <summary>Projects &amp; targets (Coursera, course plan)</summary>
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
      </details>

      <details className="study-secondary-details">
        <summary>English practice tools</summary>

      <section className="english-output-journey-card english-output-journey-card-compact">
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

      <section className="english-reference-card">
        <div className="english-reference-header">
          <div>
            <div className="section-label">English reference</div>
            <h3>English Media Matrix</h3>
            <p>按用途选材料，不要把所有英语内容都变成任务。</p>
          </div>
          <span>抓重点</span>
        </div>
        <div className="english-reference-list">
          {ENGLISH_REFERENCE_SECTIONS.map(section => (
            <details key={section.title} className="english-reference-section">
              <summary>
                <span>{section.title}</span>
                <small>{section.purpose}</small>
              </summary>
              <div className="english-reference-items">
                {section.items.map(item => (
                  <article key={`${section.title}-${item.name}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.use}</span>
                    </div>
                    <p>{item.note}</p>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
      </details>

      <details className="study-secondary-details">
        <summary>Custom one-off task — full form</summary>
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
      </details>

      <details className="study-secondary-details">
        <summary>Daily study log &amp; review</summary>
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
      </details>
    </div>
  )
}
