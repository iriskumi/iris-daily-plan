import { useState, useEffect, type ReactNode } from 'react'
import {
  ClipboardList,
  BookOpen,
  CheckSquare,
  Briefcase,
  CreditCard,
  Zap,
  Plug,
  AlertTriangle,
  LayoutTemplate,
  Settings as SettingsIcon,
  ChevronRight,
  Play,
  X,
  Copy,
  Check,
  Heart,
  Clock,
  Sparkles,
  Plus,
  CalendarDays,
} from 'lucide-react'
import type {
  GeneratedPlan,
  Bill,
  WorkOpportunity,
  GeneratePlanOutcome,
  StartPlan,
  StartNowArea,
  StartNowState,
  StartNowTimeAvailable,
  FocusBlock,
  FocusBlockStatus,
  FocusSession,
  MealAnchor,
  MealAnchorStatus,
  Task,
  TaskArea,
  TaskEnergy,
  TaskStatus,
  CarryOverSuggestion,
  RankedCheckinTask,
  DailyCheckin as DailyCheckinType,
} from './types'
import {
  loadBills,
  loadCheckin,
  loadFocusSessions,
  loadOpportunities,
  loadPlan,
  loadTasks,
  loadDailyLog,
  loadGoogleCalendarMeta,
  loadCalendarEvents,
  loadSettings,
  saveCalendarEvents,
  saveCheckin,
  saveGoogleCalendarMeta,
  savePlan,
  loadGeneratePlanContext,
  getLatestStartPlanForDate,
  saveStartPlan,
  updateStartPlanStarted,
  loadFocusBlocksForDate,
  saveFocusBlock,
  updateFocusBlock,
  loadMealAnchors,
  saveMealAnchor,
  saveTasks,
  addFocusSession,
} from './storage'
import { getFocusStats, getLocalDateKey, localDateString } from './focus'
import { getDaysUntil, planAssembly } from './planner'
import { generatePlanWithAI } from './services/aiService'
import { getGoogleCalendarStatus, importCalendarCommitments } from './services/calendarService'
import {
  getCarryOverSuggestions,
  getNextAction,
  getTodayBillReminders,
  getTodayWorkReminders,
  reducePlanForLowEnergy,
} from './productivity'
import DailyCheckin from './components/DailyCheckin'
import TaskInbox from './components/TaskInbox'
import WorkCollection from './components/WorkCollection'
import BillsFinance from './components/BillsFinance'
import DailyPlanView from './components/DailyPlanView'
import BlockQueueView from './components/BlockQueueView'
import HomeCommandCentre from './components/HomeCommandCentre'
import AIAssistant from './components/AIAssistant'
import RecurringTemplates from './components/RecurringTemplates'
import Settings from './components/Settings'
import FocusGarden from './components/FocusGarden'
import PomodoroTimer from './components/PomodoroTimer'
import StudyDashboard from './components/StudyDashboard'
import Iris365, { Iris365HomeSummary } from './components/Iris365'
import irisBearIcon from './assets/iris-bear-icon.svg'
import {
  TASK_AREAS,
  TASK_ENERGIES,
  categoryFromArea,
  createFocusBlock,
  createInboxTask,
  isActiveTask,
  pickTaskForBlock,
  recommendNextBlocks,
  tinyActionForTask,
  tinyActionForArea,
  normalizeArea,
} from './focusBlocks'
import { DURATION_GROUPS, isStandardDuration, longBlockHint } from './durations'
import * as timerEngine from './timerEngine'
import { writeFocusBlockSessionToTaskStore, writeInboxTaskToTaskStore } from './taskStore'
import { consumeExpressionHubUrlImport } from './expressionHubImport'
import type { TimerSession } from './timerEngineTypes'
import './index.css'

type Tab = 'today' | 'study' | 'iris365' | 'plan' | 'tasks' | 'integrations' | 'settings'
type TaskView = 'tasks' | 'templates'

interface StartTodayResult {
  steps: string[]
  carryOverSuggestions: CarryOverSuggestion[]
}

const TABS: { id: Extract<Tab, 'today' | 'study' | 'iris365' | 'plan' | 'tasks'>; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <ClipboardList /> },
  { id: 'study', label: 'Study', icon: <BookOpen /> },
  { id: 'iris365', label: 'Iris 365', icon: <CalendarDays /> },
  { id: 'plan', label: 'Plan', icon: <Zap /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare /> },
]

function getUrgentBills(bills: Bill[]): Bill[] {
  return bills.filter(b => {
    if (b.status === 'paid') return false
    const days = getDaysUntil(b.dueDate)
    return days <= 3
  })
}

function getActiveWorkLeads(opportunities: WorkOpportunity[]): WorkOpportunity[] {
  return opportunities.filter(o => o.status !== 'ignore' && o.status !== 'later')
}

function minutesFromClock(value?: string): number | null {
  if (!value) return null
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function getNowContext(plan: GeneratedPlan | null): string {
  const now = new Date()
  const nowLabel = now.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (!plan) return `Now ${nowLabel} · Plan not generated yet`

  const todayKey = localDateString(now)
  if (plan.date !== todayKey) return `Now ${nowLabel} · Plan needs refresh`

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const activeBlock = plan.timeBlocks.find(block => {
    const start = minutesFromClock(block.startTime)
    const end = minutesFromClock(block.endTime)
    return start !== null && end !== null && nowMinutes >= start && nowMinutes <= end
  })
  if (!activeBlock) return `Now ${nowLabel} · Next block pending`
  return `Now ${nowLabel} · ${activeBlock.type ? `${activeBlock.type} block` : 'Plan block'} active`
}

const START_NOW_STATES: StartNowState[] = [
  'Morning after waking',
  'Afternoon slump',
  'Before evening class',
  'Deadline panic',
  'Emotionally messy',
  'Low-energy but okay',
]

const START_NOW_TIMES: StartNowTimeAvailable[] = [5, 15, 25, 45]

const START_NOW_AREAS: StartNowArea[] = [
  'Study',
  'Job search',
  'English output',
  'Cyber',
  'Admin',
  'Life reset',
]

const DAILY_NOTES = [
  {
    lines: ['今天不用追上理想中的自己。', '只要比半年前更靠近一点。'],
    caption: 'Quiet progress still counts.',
  },
  {
    lines: ['先把今天过顺。'],
    caption: 'Progress can stay quiet.',
  },
  {
    lines: ['不用一下子变很好。', '今天只要往前一点点。'],
    caption: 'Small steps still count.',
  },
  {
    lines: ['先保护能量，', '再做下一步。'],
    caption: 'Protect your energy. Then take the next useful step.',
  },
  {
    lines: ['不和理想化的自己较劲。', '今天只看微小进步。'],
    caption: 'Small progress is enough.',
  },
  {
    lines: ['今天不求完美，', '只求启动。'],
    caption: 'Start softer.',
  },
  {
    lines: ['今天先把节奏找回来。'],
    caption: 'One useful step is enough.',
  },
  {
    lines: ['Less pressure.', 'More momentum.'],
    caption: '',
  },
  {
    lines: ['Start softer.', 'Move closer.'],
    caption: '',
  },
  {
    lines: ['今天只做下一件对的事。'],
    caption: 'One next step is enough.',
  },
]

function dailyNoteForDate(date = getLocalDateKey()) {
  const seed = [...date].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return DAILY_NOTES[seed % DAILY_NOTES.length]
}

function makeStartPlan(input: {
  state: StartNowState
  energy: number
  timeAvailable: StartNowTimeAvailable
  area: StartNowArea
}): StartPlan {
  const recoveryFirst = input.energy <= 2

  let bodyReset = 'Drink water, relax your shoulders, and take five slow breaths.'
  if (recoveryFirst) {
    bodyReset = 'Drink water, sit somewhere steady, unclench your jaw, and take five slow breaths.'
  }
  if (input.state === 'Morning after waking') {
    bodyReset = 'Open curtains, drink water, wash your face, then sit near your work spot for one minute.'
  }
  if (input.state === 'Afternoon slump') {
    bodyReset = 'Drink water, check if you need a snack, stand up, then take five slow breaths.'
  }
  if (input.state === 'Before evening class') {
    bodyReset = 'Drink water, bathroom check, and put your class material in front of you.'
  }
  if (input.state === 'Deadline panic') {
    bodyReset = 'Put both feet on the floor, drink water, and name the file or evidence you need first.'
  }
  if (input.state === 'Emotionally messy') {
    bodyReset = 'Wash your face or hair if needed, drink water, and clear one tiny surface.'
  }

  let openThis = 'Open the one tab, note, or file that already matters most.'
  if (input.area === 'Study') openThis = 'Open the study brief, class page, or note you already know matters.'
  if (input.area === 'Job search') openThis = 'Open one job description or your resume file.'
  if (input.area === 'English output') openThis = 'Open your recorder, notes app, or one English prompt.'
  if (input.area === 'Cyber') openThis = 'Open your glossary, NotebookLM, or screenshot folder.'
  if (input.area === 'Admin') openThis = 'Open the one form, email, or list that needs the next tiny move.'
  if (input.area === 'Life reset') openThis = 'Open notes, or stand near the first reset spot.'
  if (input.state === 'Before evening class') openThis = 'Open today’s class page and glossary or terms list.'
  if (input.state === 'Deadline panic') openThis = 'Open the assignment brief and evidence, screenshot, or outline folder.'

  let firstTinyAction = 'Read the first instruction and underline one action word.'
  if (input.area === 'Job search') {
    firstTinyAction = 'Read one JD and highlight one keyword, or write one tiny resume bullet.'
  }
  if (input.area === 'English output') {
    firstTinyAction = 'Say or write one simple English sentence, even badly.'
  }
  if (input.area === 'Cyber') {
    firstTinyAction = 'Open glossary or NotebookLM, or sort one screenshot into the right folder.'
  }
  if (input.area === 'Admin') firstTinyAction = 'Fill one field or open one email only.'
  if (input.area === 'Life reset') firstTinyAction = 'Move one visible item back to its place.'
  if (input.state === 'Emotionally messy') {
    firstTinyAction = 'After water and face reset, write one messy bullet.'
  }
  if (input.state === 'Before evening class') {
    firstTinyAction = 'Preview three glossary terms and mark one confusing word.'
  }
  if (input.state === 'Deadline panic') {
    firstTinyAction = 'Make one evidence, screenshot, or outline line. No perfect writing.'
  }
  if (recoveryFirst) {
    firstTinyAction = 'Do only the body reset, then write one word: started.'
  }

  const createdAt = new Date().toISOString()
  return {
    id: `start-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    date: localDateString(new Date()),
    state: input.state,
    energy: input.energy,
    timeAvailable: input.timeAvailable,
    area: input.area,
    bodyReset,
    openThis,
    firstTinyAction,
    timerMinutes: input.timeAvailable,
    markedStarted: false,
    createdAt,
  }
}

function formatStartPlan(plan: StartPlan): string {
  return [
    `Body reset: ${plan.bodyReset}`,
    `Open this: ${plan.openThis}`,
    `First tiny action: ${plan.firstTinyAction}`,
    `Timer: ${plan.timerMinutes} min`,
  ].join('\n')
}

function defaultGrowthCheckin(date: string): DailyCheckinType {
  const settings = loadSettings()
  return {
    date,
    dailyPlanBase: 'english-ai-cyber-growth',
    dayType: 'normal',
    wakeUpTime: '09:00',
    sleepTarget: settings.defaultSleepTarget,
    energyLevel: 'medium',
    rankedTasks: [],
    morningMainTask: '',
    morningSecondaryTask1: '',
    morningSecondaryTask2: '',
    morningSmallLifeTask: '',
    availableFocusTime: 'English + AI/Cyber Growth Day scaffold',
    fixedCommitments: '',
    planningInstructions: 'Use the English + AI/Cyber growth-day scaffold. Keep high-output work before 17:00 and quiet input after 17:00.',
    notes: '',
  }
}

type ManualEditStrategy = 'keep' | 'overwrite' | 'rebuild-unstarted'

function hasManualPlanEdits(plan: GeneratedPlan | null): boolean {
  return Boolean(plan?.prioritiesManualEdited || plan?.timeBlocks.some(block =>
    block.manualEdited || block.status && block.status !== 'Planned',
  ))
}

function askManualEditStrategy(): ManualEditStrategy {
  const answer = window.prompt(
    'This plan contains manual edits. Type KEEP to keep it, OVERWRITE to replace it, or UNSTARTED to rebuild only empty/unstarted blocks.',
    'KEEP',
  )?.trim().toUpperCase()
  if (answer === 'OVERWRITE') return 'overwrite'
  if (answer === 'UNSTARTED') return 'rebuild-unstarted'
  return 'keep'
}

function mergeProtectedPlan(existing: GeneratedPlan, generated: GeneratedPlan): GeneratedPlan {
  const protectedBlocks = existing.timeBlocks.filter(block => block.manualEdited || block.status && block.status !== 'Planned')
  const replacementBlocks = [...generated.timeBlocks]
  const usedIndexes = new Set<number>()
  protectedBlocks.forEach(block => {
    let matchIndex = replacementBlocks.findIndex((candidate, index) =>
      !usedIndexes.has(index) && Boolean(
        (block.taskId && candidate.taskId === block.taskId) ||
        (block.baseBlockId && candidate.baseBlockId === block.baseBlockId) ||
        (block.id && candidate.id === block.id),
      ),
    )
    if (matchIndex < 0) {
      const originalIndex = existing.timeBlocks.findIndex(candidate => candidate.id === block.id)
      matchIndex = originalIndex < replacementBlocks.length ? originalIndex : -1
    }
    if (matchIndex >= 0) {
      replacementBlocks[matchIndex] = block
      usedIndexes.add(matchIndex)
    } else {
      replacementBlocks.push(block)
    }
  })
  return {
    ...generated,
    top3: existing.prioritiesManualEdited ? existing.top3 : generated.top3,
    prioritiesManualEdited: existing.prioritiesManualEdited,
    timeBlocks: replacementBlocks.sort((a, b) =>
      (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'),
    ),
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [taskView, setTaskView] = useState<TaskView>('tasks')
  const [appSettings, setAppSettings] = useState(() => loadSettings())
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [plan, setPlan] = useState<GeneratedPlan | null>(() => loadPlan(getLocalDateKey()))
  const [urgentBills, setUrgentBills] = useState<Bill[]>([])
  const [activeWorkLeads, setActiveWorkLeads] = useState<WorkOpportunity[]>([])
  const [focusStats, setFocusStats] = useState(() => getFocusStats(loadFocusSessions()))
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)

  useEffect(() => {
    consumeExpressionHubUrlImport()
  }, [])

  useEffect(() => {
    setUrgentBills(getUrgentBills(loadBills()))
    setActiveWorkLeads(getActiveWorkLeads(loadOpportunities()))
    setFocusStats(getFocusStats(loadFocusSessions()))
  }, [tab])

  useEffect(() => {
    if (!appSettings.fullCommandHubMode && tab === 'plan') {
      setTab('today')
    }
  }, [appSettings.fullCommandHubMode, tab])

  function refreshReminders() {
    setUrgentBills(getUrgentBills(loadBills()))
    setActiveWorkLeads(getActiveWorkLeads(loadOpportunities()))
    setFocusStats(getFocusStats(loadFocusSessions()))
  }

  const handleGeneratePlan = async (
    feedback = '',
    originalPlan?: GeneratedPlan,
    options: { stayOnTab?: boolean } = {},
  ): Promise<GeneratePlanOutcome> => {
    setGeneratingPlan(true)
    setGenerationMessage(null)
    const context = loadGeneratePlanContext()
    if (!context) {
      const message = 'Plan generation needs today’s check-in first. Fill in Daily Check-in, then try again.'
      setGenerationMessage(message)
      setGeneratingPlan(false)
      return { success: false, message }
    }
    const existingPlan = loadPlan(context.checkin.date)
    const editStrategy = hasManualPlanEdits(existingPlan) ? askManualEditStrategy() : 'overwrite'
    if (editStrategy === 'keep' && existingPlan) {
      const message = 'Kept your manually edited plan. Choose OVERWRITE or UNSTARTED when you want to rebuild it.'
      setPlan(existingPlan)
      setGenerationMessage(message)
      setGeneratingPlan(false)
      if (!options.stayOnTab) setTab('plan')
      return { success: true, message, plan: existingPlan }
    }
    console.log('[DailyPlan] active tasks used:', context.tasks)
    console.log('[DailyPlan] ranked tasks used:', context.checkin.rankedTasks ?? [])
    const feedbackContext = feedback.trim()
      ? {
          ...context,
          checkin: {
            ...context.checkin,
            planningInstructions: [
              context.checkin.planningInstructions,
              `Regeneration feedback: ${feedback.trim()}`,
            ].filter(Boolean).join('\n'),
          },
        }
      : context
    try {
      const aiResult = await generatePlanWithAI(feedbackContext, { originalPlan, feedback })
      const generated = aiResult.data
        ? {
            ...aiResult.data,
            date: feedbackContext.checkin.date,
            provider: aiResult.provider,
            aiUsed: aiResult.aiUsed,
            fallbackReason: aiResult.fallbackReason,
          }
        : {
            ...planAssembly(
              feedbackContext.checkin,
              feedbackContext.tasks,
              feedbackContext.opportunities,
              feedbackContext.bills,
              new Date(),
              {
                defaultRecoveryBlockEnabled: feedbackContext.settings.defaultRecoveryBlockEnabled,
                calendarEvents: feedbackContext.calendarEvents,
              },
            ),
            date: feedbackContext.checkin.date,
            provider: 'rule-based' as const,
            aiUsed: false,
            fallbackReason: aiResult.fallbackReason || aiResult.message,
          }
      const finalPlan = editStrategy === 'rebuild-unstarted' && existingPlan
        ? mergeProtectedPlan(existingPlan, generated)
        : generated
      const fallbackReason = finalPlan.fallbackReason || aiResult.fallbackReason
      console.log('[DailyPlan] generated blocks:', finalPlan.timeBlocks)
      const message = fallbackReason
        ? `Plan generated with local fallback. ${fallbackReason}`
        : 'Plan generated successfully.'
      savePlan(finalPlan)
      const savedPlan = loadPlan(finalPlan.date) ?? finalPlan
      setPlan(savedPlan)
      setGenerationMessage(message)
      if (!options.stayOnTab) setTab('plan')
      return {
        success: true,
        message,
        plan: savedPlan,
        fallbackReason,
      }
    } catch (error) {
      const message = error instanceof Error
        ? `Plan generation failed: ${error.message}`
        : 'Plan generation failed.'
      setGenerationMessage(message)
      return { success: false, message }
    } finally {
      setGeneratingPlan(false)
    }
  }

  function handleLowEnergyMode() {
    if (!plan) return
    const reduced = reducePlanForLowEnergy(plan)
    savePlan(reduced)
    setPlan(reduced)
  }

  function handleSendStartPlanToTodayPlan(startPlan: StartPlan): string {
    if (!plan) return 'Generate today’s plan first, then send this tiny step into it.'
    const tinyAction = startPlan.firstTinyAction
    const updated: GeneratedPlan = {
      ...plan,
      mustDo: [tinyAction, ...plan.mustDo.filter(item => item !== tinyAction)],
      minimumViableDay: [
        startPlan.bodyReset,
        startPlan.openThis,
        tinyAction,
      ],
      notionMarkdown: [
        plan.notionMarkdown,
        '',
        '## Start Now',
        formatStartPlan(startPlan),
      ].join('\n'),
      generatedAt: new Date().toISOString(),
    }
    savePlan(updated)
    setPlan(updated)
    return 'Sent to today’s plan.'
  }

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  const overdueBills = urgentBills.filter(b => getDaysUntil(b.dueDate) < 0)
  const dueSoonBills = urgentBills.filter(b => getDaysUntil(b.dueDate) >= 0)
  const visibleTabs = appSettings.fullCommandHubMode
    ? TABS
    : TABS.filter(item => item.id !== 'plan')

  function goToTab(nextTab: Tab) {
    setTab(nextTab)
    setSettingsPanelOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <img className="app-brand-icon" src={irisBearIcon} alt="" aria-hidden="true" />
          <h1>Iris Daily Plan Hub</h1>
        </div>
        <div className="app-header-actions">
          <span className="header-date">{today}</span>
          <button
            className="settings-menu-button"
            type="button"
            onClick={() => setSettingsPanelOpen(open => !open)}
            aria-label="Open settings and integrations"
            aria-expanded={settingsPanelOpen}
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      <nav className="nav-tabs">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => goToTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      {settingsPanelOpen && (
        <aside className="settings-slideover" aria-label="Settings and integrations">
          <div className="settings-slideover-header">
            <div>
              <div className="section-label">Tools</div>
              <h2>Settings & integrations</h2>
            </div>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => setSettingsPanelOpen(false)}
              aria-label="Close settings panel"
            >
              <X />
            </button>
          </div>
          <button className="settings-panel-item" type="button" onClick={() => goToTab('integrations')}>
            <Plug />
            <span>
              <strong>Integrations</strong>
              <small>Google Calendar, Gmail, Gemini, Notion</small>
            </span>
          </button>
          <button className="settings-panel-item" type="button" onClick={() => goToTab('settings')}>
            <SettingsIcon />
            <span>
              <strong>Settings</strong>
              <small>Planner defaults and preferences</small>
            </span>
          </button>
        </aside>
      )}

      {overdueBills.length > 0 && (
        <div className="alert-banner alert-red">
          <AlertTriangle />
          {overdueBills.length === 1
            ? `Overdue: ${overdueBills[0].name} — $${overdueBills[0].amount}`
            : `${overdueBills.length} bills overdue — check Today`}
        </div>
      )}

      {overdueBills.length === 0 && dueSoonBills.length > 0 && (
        <div className="alert-banner">
          <AlertTriangle />
          {dueSoonBills.length === 1
            ? `Due soon: ${dueSoonBills[0].name} — $${dueSoonBills[0].amount}`
            : `${dueSoonBills.length} bills due within 3 days`}
        </div>
      )}

      <main>
        {tab === 'today' && (
          <TodayCommandCentre
            urgentBills={urgentBills}
            activeWorkLeads={activeWorkLeads}
            focusStats={focusStats}
            onGenerate={handleGeneratePlan}
            onRemindersChange={refreshReminders}
            currentPlan={plan}
            generatingPlan={generatingPlan}
            generationMessage={generationMessage}
            onViewPlan={() => {
              if (appSettings.fullCommandHubMode) goToTab('plan')
            }}
            onOpenIris365={() => goToTab('iris365')}
            onSendStartPlanToTodayPlan={handleSendStartPlanToTodayPlan}
            onFocusBlocksChange={refreshReminders}
            showEmbeddedPlan={!appSettings.fullCommandHubMode}
            planSection={
              <PlanWorkspace
                plan={plan}
                onGenerate={handleGeneratePlan}
                onRegenerate={feedback => handleGeneratePlan(feedback, plan ?? undefined)}
                onGoToCheckin={() => goToTab('today')}
                onReducePlan={handleLowEnergyMode}
                onPlanChange={updatedPlan => {
                  savePlan(updatedPlan)
                  setPlan(loadPlan(updatedPlan.date) ?? updatedPlan)
                }}
              />
            }
            onStartToday={async () => {
              const todayKey = getLocalDateKey()
              const steps: string[] = []
              const meta = loadGoogleCalendarMeta()
              if (meta.calendarConnected) {
                const result = await importCalendarCommitments()
                if (result.success && result.data) {
                  saveCalendarEvents(result.data)
                  const status = await getGoogleCalendarStatus()
                  saveGoogleCalendarMeta({
                    connected: true,
                    calendarConnected: status.calendarConnected,
                    gmailConnected: status.gmailConnected,
                    accountEmail: status.accountEmail ?? meta.accountEmail,
                    lastImportedAt: new Date().toISOString(),
                    warning: status.warning ?? meta.warning,
                  })
                  steps.push('Calendar synced.')
                } else {
                  steps.push('Calendar sync skipped or unavailable.')
                }
              } else {
                steps.push('Calendar not connected; kept local commitments.')
              }

              const todayCheckIn = loadCheckin(todayKey)
              const todayPlan = loadPlan(todayKey)
              steps.push(todayCheckIn ? 'Today check-in found.' : 'No check-in for today yet.')

              const yesterday = new Date()
              yesterday.setDate(yesterday.getDate() - 1)
              const yesterdayLog = loadDailyLog(getLocalDateKey(yesterday))
              const suggestions = getCarryOverSuggestions(loadTasks(), yesterdayLog)
              console.log('[StartToday] todayKey', todayKey)
              console.log('[StartToday] todayCheckIn', todayCheckIn)
              console.log('[StartToday] todayPlan', todayPlan)
              console.log('[StartToday] carryOverSuggestions', suggestions)
              steps.push(
                suggestions.length > 0
                  ? `Found ${suggestions.length} unfinished task${suggestions.length === 1 ? '' : 's'} from previous days. Add them to today?`
                  : 'No carry-over backlog detected.',
              )

              if (todayPlan) {
                setPlan(todayPlan)
                steps.push('Today’s plan loaded.')
              } else if (todayCheckIn) {
                steps.push('No plan for today yet.')
                const outcome = await handleGeneratePlan('', undefined, { stayOnTab: true })
                if (outcome.success) {
                  steps.push('Built today from today’s check-in, active tasks, calendar, and meal anchors.')
                }
              } else {
                steps.push('No plan for today yet.')
                const activeTasks = loadTasks().filter(isActiveTask)
                const scaffold = planAssembly(
                  defaultGrowthCheckin(todayKey),
                  activeTasks,
                  loadOpportunities(),
                  loadBills(),
                  new Date(),
                  {
                    defaultRecoveryBlockEnabled: loadSettings().defaultRecoveryBlockEnabled,
                    calendarEvents: loadCalendarEvents(),
                  },
                )
                savePlan(scaffold)
                setPlan(loadPlan(scaffold.date) ?? scaffold)
                steps.push(
                  activeTasks.length > 0
                    ? 'Built the English + AI/Cyber scaffold and placed active tasks into suitable blocks.'
                    : 'Built the English + AI/Cyber Growth Day scaffold.',
                )
              }

              return { steps, carryOverSuggestions: suggestions }
            }}
          />
        )}
        {tab === 'study' && <StudyDashboard />}
        {tab === 'iris365' && <Iris365 />}
        {tab === 'plan' && (
          <PlanWorkspace
            plan={plan}
            onGenerate={handleGeneratePlan}
            onRegenerate={feedback => handleGeneratePlan(feedback, plan ?? undefined)}
            onGoToCheckin={() => goToTab('today')}
            onReducePlan={handleLowEnergyMode}
            onPlanChange={updatedPlan => {
              savePlan(updatedPlan)
              setPlan(loadPlan(updatedPlan.date) ?? updatedPlan)
            }}
          />
        )}
        {tab === 'tasks' && (
          <>
            <div className="subnav-shell">
              <div className="segmented-control" aria-label="Task section">
                <button
                  className={taskView === 'tasks' ? 'active' : ''}
                  onClick={() => setTaskView('tasks')}
                >
                  <CheckSquare />
                  Tasks
                </button>
                <button
                  className={taskView === 'templates' ? 'active' : ''}
                  onClick={() => setTaskView('templates')}
                >
                  <LayoutTemplate />
                  Templates
                </button>
              </div>
            </div>
            {taskView === 'tasks' ? <TaskInbox /> : <RecurringTemplates />}
          </>
        )}
        {tab === 'integrations' && <AIAssistant onGeneratePlan={handleGeneratePlan} />}
        {tab === 'settings' && <Settings onSettingsChange={setAppSettings} />}
      </main>
    </div>
  )
}

interface PlanWorkspaceProps {
  plan: GeneratedPlan | null
  onGenerate: () => Promise<GeneratePlanOutcome>
  onRegenerate: (feedback: string) => Promise<GeneratePlanOutcome>
  onGoToCheckin: () => void
  onReducePlan: () => void
  onPlanChange: (plan: GeneratedPlan) => void
}

function PlanWorkspace({
  plan,
  onGenerate,
  onRegenerate,
  onGoToCheckin,
  onReducePlan,
  onPlanChange,
}: PlanWorkspaceProps) {
  return (
    <>
      <div className="page plan-page">
        <BlockQueueView />
      </div>
      <DailyPlanView
        plan={plan}
        onGenerate={onGenerate}
        onRegenerate={onRegenerate}
        onGoToCheckin={onGoToCheckin}
        onReducePlan={onReducePlan}
        onPlanChange={onPlanChange}
      />
    </>
  )
}

interface TodayCommandCentreProps {
  urgentBills: Bill[]
  activeWorkLeads: WorkOpportunity[]
  focusStats: ReturnType<typeof getFocusStats>
  onGenerate: () => Promise<GeneratePlanOutcome>
  onRemindersChange: () => void
  currentPlan: GeneratedPlan | null
  generatingPlan: boolean
  generationMessage: string | null
  onViewPlan: () => void
  onOpenIris365: () => void
  onSendStartPlanToTodayPlan: (startPlan: StartPlan) => string
  onFocusBlocksChange: () => void
  showEmbeddedPlan: boolean
  planSection: ReactNode
  onStartToday: () => Promise<StartTodayResult>
}

function TodayCommandCentre({
  urgentBills,
  activeWorkLeads,
  focusStats,
  onGenerate,
  onRemindersChange,
  currentPlan,
  generatingPlan,
  generationMessage,
  onViewPlan,
  onOpenIris365,
  onSendStartPlanToTodayPlan,
  onFocusBlocksChange,
  showEmbeddedPlan,
  planSection,
  onStartToday,
}: TodayCommandCentreProps) {
  const [expanded, setExpanded] = useState<'bills' | 'work' | null>(null)
  const [startSteps, setStartSteps] = useState<string[]>([])
  const [carryOverSuggestions, setCarryOverSuggestions] = useState<CarryOverSuggestion[]>([])
  const [starting, setStarting] = useState(false)
  const [showNextFocus, setShowNextFocus] = useState(false)
  const [startNowState, setStartNowState] = useState<StartNowState>('Afternoon slump')
  const [startNowEnergy, setStartNowEnergy] = useState(3)
  const [startNowTime, setStartNowTime] = useState<StartNowTimeAvailable>(15)
  const [startNowArea, setStartNowArea] = useState<StartNowArea>('Study')
  const [startNowPlan, setStartNowPlan] = useState<StartPlan | null>(() =>
    getLatestStartPlanForDate(localDateString(new Date())),
  )
  const [startNowTimer, setStartNowTimer] = useState<5 | 15 | null>(null)
  const [startNowMessage, setStartNowMessage] = useState<string | null>(null)
  const [startNowCopied, setStartNowCopied] = useState(false)
  const [planSectionOpen, setPlanSectionOpen] = useState(false)
  const overdueBills = urgentBills.filter(b => getDaysUntil(b.dueDate) < 0)
  const dueSoonBills = urgentBills.filter(b => getDaysUntil(b.dueDate) >= 0)
  const workReminders = getTodayWorkReminders(activeWorkLeads)
  const billReminders = getTodayBillReminders(urgentBills)
  const nextAction = getNextAction(currentPlan)
  const nowContext = getNowContext(currentPlan)
  const dailyNote = dailyNoteForDate()
  const isEvening = new Date().getHours() >= 17

  async function handleStartToday() {
    setStarting(true)
    const result = await onStartToday()
    setCarryOverSuggestions(result.carryOverSuggestions)
    const todayKey = getLocalDateKey()
    const todayPlan = loadPlan(todayKey)
    const todayCheckin = loadCheckin(todayKey)
    const activeTodayTasks = loadTasks()
      .filter(isActiveTask)
      .filter(task => task.createdAt && localDateString(new Date(task.createdAt)) === todayKey)
    let nextActionSource = 'none'
    let nextActionTitle = 'No next action yet — add a task or complete today’s check-in.'
    if (todayPlan) {
      nextActionSource = 'todayPlan'
      nextActionTitle = getNextAction(todayPlan).title
    } else {
      const rankedTask = (todayCheckin?.rankedTasks ?? []).find(task => task.title.trim())
      if (rankedTask) {
        nextActionSource = 'todayRankedTasks'
        nextActionTitle = rankedTask.title
      } else if (activeTodayTasks[0]) {
        nextActionSource = 'todayActiveTaskInbox'
        nextActionTitle = activeTodayTasks[0].nextTinyAction || activeTodayTasks[0].title
      }
    }
    console.log('[StartToday] nextActionSource', nextActionSource)
    setStartSteps([...result.steps, `Next action: ${nextActionTitle}`])
    setStarting(false)
  }

  function handleViewPlan() {
    if (showEmbeddedPlan) setPlanSectionOpen(true)
    onViewPlan()
  }

  function handleReviewCarryOver() {
    const lines = carryOverSuggestions.map(
      suggestion => `${suggestion.taskTitle}: ${suggestion.suggestedAction}`,
    )
    setStartSteps(prev => [...prev, ...lines])
  }

  function handleAddCarryOverToToday() {
    const todayKey = getLocalDateKey()
    const todayCheckin = loadCheckin(todayKey)
    if (!todayCheckin) {
      setStartSteps(prev => [...prev, 'Start check-in first, then add carry-over to today.'])
      return
    }
    const tasks = loadTasks()
    const existingRows = todayCheckin.rankedTasks ?? []
    const existingTaskIds = new Set(existingRows.map(task => task.taskId).filter(Boolean))
    const additions: RankedCheckinTask[] = carryOverSuggestions
      .filter(suggestion => !existingTaskIds.has(suggestion.taskId))
      .map((suggestion, index) => {
        const task = tasks.find(item => item.id === suggestion.taskId)
        return {
          id: `carry-${todayKey}-${suggestion.taskId}`,
          taskId: suggestion.taskId,
          title: suggestion.taskTitle,
          area: normalizeArea(task?.area),
          estimatedMinutes: task?.estimatedMinutes ?? 15,
          orderIndex: existingRows.length + index,
        }
      })
    if (additions.length === 0) {
      setCarryOverSuggestions([])
      setStartSteps(prev => [...prev, 'Carry-over is already in today’s to-do.'])
      return
    }
    saveCheckin({
      ...todayCheckin,
      rankedTasks: [...existingRows, ...additions].map((task, index) => ({
        ...task,
        orderIndex: index,
      })),
    })
    setCarryOverSuggestions([])
    setStartSteps(prev => [...prev, `Added ${additions.length} carry-over task${additions.length === 1 ? '' : 's'} to today.`])
  }

  function handleGenerateStartPlan() {
    const generated = makeStartPlan({
      state: startNowState,
      energy: startNowEnergy,
      timeAvailable: startNowTime,
      area: startNowArea,
    })
    saveStartPlan(generated)
    setStartNowPlan(generated)
    setStartNowTimer(null)
    setStartNowMessage('A tiny start plan is ready.')
  }

  function markStartPlan(plan: StartPlan) {
    const updated = updateStartPlanStarted(plan.id, true) ?? { ...plan, markedStarted: true }
    setStartNowPlan(updated)
    setStartNowMessage('Marked started. That counts.')
    return updated
  }

  function handleStartNowTimer(minutes: 5 | 15) {
    if (!startNowPlan) return
    markStartPlan(startNowPlan)
    setStartNowTimer(minutes)
    setStartNowMessage(`${minutes} minute timer started.`)
  }

  async function handleCopyStartPlan() {
    if (!startNowPlan) return
    await navigator.clipboard.writeText(formatStartPlan(startNowPlan))
    setStartNowCopied(true)
    setStartNowMessage('Copied.')
    window.setTimeout(() => setStartNowCopied(false), 1600)
  }

  function handleSendStartPlan() {
    if (!startNowPlan) return
    setStartNowMessage(onSendStartPlanToTodayPlan(startNowPlan))
  }

  return (
    <>
      <div className="page command-page">
        <div className="page-header">
          <h2 className="page-title">Today</h2>
          <p className="page-subtitle">Start the day, check the next action, then protect your energy.</p>
        </div>

        <div className="grounding-banner" aria-label="Today note">
          <div className="grounding-label">Today Note</div>
          <p className="today-note-quote-cn" lang="zh-Hans">
            {dailyNote.lines.map(line => (
              <span key={line}>{line}</span>
            ))}
          </p>
          {(dailyNote.caption || isEvening) && (
            <small className="today-note-quote-en">
              {dailyNote.caption}
              {dailyNote.caption && isEvening ? ' · ' : ''}
              {isEvening ? 'Evening mode: quiet input and light review.' : ''}
            </small>
          )}
        </div>

        <HomeCommandCentre currentEnergy={loadCheckin(getLocalDateKey())?.energyLevel} />
        <Iris365HomeSummary onOpenIris365={onOpenIris365} />

        {showEmbeddedPlan && (
          <details
            className="home-secondary-panel"
            open={planSectionOpen}
            onToggle={event => setPlanSectionOpen(event.currentTarget.open)}
          >
            <summary>
              <span>Generate today's plan</span>
              <small>Optional schedule view for structured days</small>
            </summary>
            {/* TODO: Plan-generated blocks should eventually write to taskStore with source: 'plan-generated'. */}
            {planSection}
          </details>
        )}

        <details className="home-secondary-panel">
          <summary>
            <span>Low-energy mode</span>
            <small>Smallest useful step</small>
          </summary>
        <section className="start-now-card" aria-label="Low-energy mode">
          <div className="start-now-header">
            <div>
              <div className="section-label">Low-energy mode</div>
              <h3>Smallest useful step</h3>
              <p>Give me the smallest next step.</p>
            </div>
            <span className="start-now-charm" aria-hidden="true">
              <Heart size={18} />
            </span>
          </div>

          <div className="start-now-controls">
            <div className="start-now-control">
              <label>Current state</label>
              <div className="start-now-options">
                {START_NOW_STATES.map(state => (
                  <button
                    key={state}
                    className={`btn-option ${startNowState === state ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setStartNowState(state)}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>

            <div className="start-now-control start-now-control-compact">
              <label>Energy</label>
              <div className="start-now-options start-now-energy-options">
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    className={`btn-option start-now-number ${startNowEnergy === value ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setStartNowEnergy(value)}
                    aria-label={`Energy ${value}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="start-now-control start-now-control-compact">
              <label>Time available</label>
              <div className="start-now-options">
                {START_NOW_TIMES.map(minutes => (
                  <button
                    key={minutes}
                    className={`btn-option ${startNowTime === minutes ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setStartNowTime(minutes)}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>

            <div className="start-now-control">
              <label>Area</label>
              <div className="start-now-options">
                {START_NOW_AREAS.map(area => (
                  <button
                    key={area}
                    className={`btn-option ${startNowArea === area ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setStartNowArea(area)}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="start-now-main-action">
            <button className="btn btn-primary" type="button" onClick={handleGenerateStartPlan}>
              <Sparkles size={14} />
              Give me the smallest useful step
            </button>
            {startNowMessage && <span className="start-now-message">{startNowMessage}</span>}
          </div>

          {startNowPlan && (
            <div className="start-plan-panel">
              <div className="start-plan-meta">
                <span>{startNowPlan.state}</span>
                <span>Energy {startNowPlan.energy}/5</span>
                <span>{startNowPlan.area}</span>
              </div>
              <div className="start-plan-grid">
                <div className="start-plan-step">
                  <span>1. Body reset</span>
                  <p>{startNowPlan.bodyReset}</p>
                </div>
                <div className="start-plan-step">
                  <span>2. Open this</span>
                  <p>{startNowPlan.openThis}</p>
                </div>
                <div className="start-plan-step start-plan-step-primary">
                  <span>3. First tiny action</span>
                  <p>{startNowPlan.firstTinyAction}</p>
                </div>
                <div className="start-plan-step">
                  <span>4. Timer</span>
                  <p>{startNowPlan.timerMinutes} minutes, only this one tiny move.</p>
                </div>
              </div>
              <div className="start-plan-actions">
                <button className="btn btn-primary" type="button" onClick={() => handleStartNowTimer(5)}>
                  <Clock size={14} />
                  Start 5 min
                </button>
                <button className="btn btn-primary" type="button" onClick={() => handleStartNowTimer(15)}>
                  <Clock size={14} />
                  Start 15 min
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleSendStartPlan}>
                  Send to Today’s Plan
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleCopyStartPlan}>
                  {startNowCopied ? <Check size={14} /> : <Copy size={14} />}
                  {startNowCopied ? 'Copied' : 'Copy plan'}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => markStartPlan(startNowPlan)}
                  disabled={startNowPlan.markedStarted}
                >
                  {startNowPlan.markedStarted ? 'Started' : 'Mark started'}
                </button>
              </div>
              {startNowTimer && (
                <div className="start-now-timer">
                  <PomodoroTimer
                    pomodoroLength={startNowTimer}
                    breakLength={5}
                    sessions={1}
                    taskTitle={startNowPlan.firstTinyAction}
                    category="recovery"
                  />
                </div>
              )}
            </div>
          )}
        </section>
        </details>

        <details className="home-secondary-panel">
          <summary>
            <span>Focus tools</span>
            <small>Pomodoro, Focus Garden, legacy next action</small>
          </summary>

          <FocusBlockWorkflow onFocusBlocksChange={onFocusBlocksChange} />

          <section className="today-focus-section">
            <div className="today-focus-section-header">
              <div>
                <div className="section-label">Focus</div>
                <h3>Focus Garden</h3>
              </div>
            </div>
            <FocusGarden stats={focusStats} />
          </section>

          <div className="next-action-card">
            <div className="next-action-main">
              <div className="plan-section-title">Legacy plan next action</div>
              <h3>{nextAction.title}</h3>
              <p>{nextAction.detail}</p>
              {(nextAction.startTime || nextAction.endTime) && (
                <div className="next-action-time">
                  {nextAction.startTime ?? '--'}-{nextAction.endTime ?? '--'}
                </div>
              )}
              <div className="next-action-now">{nowContext}</div>
            </div>
            {nextAction.canStartFocus && (
              <div className="next-action-focus">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowNextFocus(value => !value)}
                >
                  {showNextFocus ? 'Hide focus' : 'Open timeline focus'}
                </button>
                <button className="btn btn-secondary" onClick={handleViewPlan}>
                  View plan
                </button>
                {showNextFocus && (
                  <PomodoroTimer
                    pomodoroLength={nextAction.focusMinutes ?? 25}
                    breakLength={5}
                    sessions={1}
                    taskId={nextAction.taskId}
                    taskTitle={nextAction.taskTitle ?? nextAction.title}
                    category={nextAction.category ?? 'cyber-study'}
                  />
                )}
              </div>
            )}
          </div>
        </details>

        <details className="home-secondary-panel">
          <summary>
            <span>Admin reminders</span>
            <small>Bills and work reminders</small>
          </summary>
        <div className="command-grid">
          <button
            className={`command-card ${urgentBills.length > 0 ? 'attention' : ''}`}
            onClick={() => setExpanded(expanded === 'bills' ? null : 'bills')}
          >
            <span className="command-card-icon"><CreditCard /></span>
            <span className="command-card-body">
              <span className="command-card-title">Bills</span>
              <span className="command-card-text">
                {overdueBills.length > 0
                  ? `${overdueBills.length} overdue`
                  : dueSoonBills.length > 0
                    ? `${dueSoonBills.length} due soon`
                    : 'No urgent bills'}
                </span>
            </span>
            <ChevronRight className="command-card-chevron" />
          </button>

          <button
            className="command-card"
            onClick={() => setExpanded(expanded === 'work' ? null : 'work')}
          >
            <span className="command-card-icon"><Briefcase /></span>
            <span className="command-card-body">
              <span className="command-card-title">Work reminders</span>
              <span className="command-card-text">
                {workReminders.length > 0
                  ? `${workReminders.length} to check`
                  : activeWorkLeads.length > 0
                    ? `${activeWorkLeads.length} light reminders`
                    : 'No active reminders'}
                </span>
            </span>
            <ChevronRight className="command-card-chevron" />
          </button>
        </div>

        {expanded === 'bills' && (
          <div className="command-inline-manager">
            {billReminders.length > 0 && (
              <div className="light-reminder-list">
                {billReminders.map(bill => (
                  <div key={bill.id} className="light-reminder-item">
                    <span>{bill.name}</span>
                    <span>${bill.amount} · due {bill.dueDate}</span>
                  </div>
                ))}
              </div>
            )}
            <BillsFinance onBillsChange={onRemindersChange} />
          </div>
        )}

        {expanded === 'work' && (
          <div className="command-inline-manager">
            {workReminders.length > 0 && (
              <div className="light-reminder-list">
                {workReminders.map(item => (
                  <div key={item.id} className="light-reminder-item">
                    <span>{item.title}</span>
                    <span>{item.nextAction ?? item.source}</span>
                  </div>
                ))}
              </div>
            )}
            <WorkCollection onOpportunitiesChange={onRemindersChange} />
          </div>
        )}
        </details>

        <details className="home-secondary-panel">
          <summary>
            <span>Sync & refresh</span>
            <small>Calendar, carry-over, plan refresh</small>
          </summary>
          <div className="start-today-card">
            <div>
              <div className="plan-section-title">Daily command centre</div>
              <h3>Refresh today</h3>
              <p>Sync commitments, check carry-over, refresh the plan, and surface the first useful action.</p>
            </div>
            <button className="btn btn-secondary" onClick={handleStartToday} disabled={starting}>
              <Play size={14} />
              {starting ? 'Refreshing...' : 'Sync & refresh'}
            </button>
          </div>

          {startSteps.length > 0 && (
            <div className="start-flow-steps">
              {startSteps.map(step => (
                <div key={step} className="start-flow-step">{step}</div>
              ))}
              {carryOverSuggestions.length > 0 && (
                <div className="start-plan-actions carry-over-actions">
                  <button className="btn btn-secondary" type="button" onClick={handleReviewCarryOver}>
                    Review carry-over
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={handleAddCarryOverToToday}>
                    Add selected to today
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setCarryOverSuggestions([])}>
                    Skip for now
                  </button>
                </div>
              )}
            </div>
          )}
        </details>
      </div>

      <details className="home-secondary-panel home-checkin-panel">
        <summary>
          <span>Full check-in</span>
          <small>Morning setup and plan generation</small>
        </summary>
        <DailyCheckin
          onGenerate={onGenerate}
          isGenerating={generatingPlan}
          generationMessage={generationMessage}
          hasPlan={Boolean(currentPlan)}
          onViewPlan={handleViewPlan}
        />
      </details>
    </>
  )
}

function formatBlockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const FOCUS_BLOCK_TIMER_ENGINE_KEY = 'iris-focus-block-timer-engine-active'

function timerFromFocusBlock(block: FocusBlock): TimerSession {
  const restored = timerEngine.restore(FOCUS_BLOCK_TIMER_ENGINE_KEY)
  if (restored?.id === block.id && restored.engine === 'focus-block') {
    return restored
  }
  return timerEngine.start(block.taskId, block.minutes, 'focus-block', {
    id: block.id,
    startedAt: block.startTime,
  })
}

function FocusBlockWorkflow({ onFocusBlocksChange }: { onFocusBlocksChange: () => void }) {
  const today = localDateString(new Date())
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [blocks, setBlocks] = useState<FocusBlock[]>(() => loadFocusBlocksForDate(today))
  const [mealAnchors, setMealAnchors] = useState<MealAnchor[]>(() => loadMealAnchors(today))
  const [blockMinutes, setBlockMinutes] = useState<number>(15)
  const [energy, setEnergy] = useState<TaskEnergy>('Medium')
  const [areaFilter, setAreaFilter] = useState<TaskArea | 'Any'>('Any')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [quickTitle, setQuickTitle] = useState('')
  const [showQuickTask, setShowQuickTask] = useState(false)
  const [blockMessage, setBlockMessage] = useState<string | null>(null)
  const [tick, setTick] = useState(Date.now())

  const rankedTasks = (loadCheckin()?.rankedTasks ?? [])
    .filter(task => task.title.trim())
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const pendingTasks = tasks.filter(isActiveTask)
  const rankedOrder = new Map<string, number>()
  rankedTasks.forEach((rankedTask, index) => {
    if (rankedTask.taskId) rankedOrder.set(`id:${rankedTask.taskId}`, index)
    rankedOrder.set(`title:${rankedTask.title.trim().toLowerCase()}`, index)
  })
  const orderedTasks = rankedTasks.length > 0
    ? pendingTasks
        .filter(task =>
          rankedOrder.has(`id:${task.id}`) ||
          rankedOrder.has(`title:${task.title.trim().toLowerCase()}`),
        )
        .sort((a, b) => {
          const aRank = rankedOrder.get(`id:${a.id}`) ?? rankedOrder.get(`title:${a.title.trim().toLowerCase()}`) ?? 999
          const bRank = rankedOrder.get(`id:${b.id}`) ?? rankedOrder.get(`title:${b.title.trim().toLowerCase()}`) ?? 999
          return aRank - bRank
        })
    : pendingTasks
  const filteredTasks = orderedTasks.filter(task => areaFilter === 'Any' || task.area === areaFilter)

  const activeBlock = blocks.find(block => block.status === 'Doing')
  const activeBlockTimer = activeBlock ? timerFromFocusBlock(activeBlock) : null
  const selectedTask = filteredTasks.find(task => task.id === selectedTaskId) ?? filteredTasks[0] ?? null
  const recommendations = recommendNextBlocks({
    tasks: rankedTasks.length > 0 ? orderedTasks : tasks,
    energy,
    areaFilter,
    preserveOrder: rankedTasks.length > 0,
  })

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000)
    const handleVisibilityChange = () => setTick(Date.now())
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (activeBlock && activeBlockTimer) {
      timerEngine.save(FOCUS_BLOCK_TIMER_ENGINE_KEY, activeBlockTimer)
    }
    if (!activeBlock) {
      timerEngine.clear(FOCUS_BLOCK_TIMER_ENGINE_KEY)
    }
  }, [activeBlock?.id])

  useEffect(() => {
    if (!selectedTaskId && filteredTasks[0]) setSelectedTaskId(filteredTasks[0].id)
    if (selectedTaskId && !filteredTasks.some(task => task.id === selectedTaskId)) {
      setSelectedTaskId(filteredTasks[0]?.id ?? '')
    }
  }, [areaFilter, energy, filteredTasks, selectedTaskId])

  function refresh() {
    setTasks(loadTasks())
    setBlocks(loadFocusBlocksForDate(today))
    setMealAnchors(loadMealAnchors(today))
    onFocusBlocksChange()
  }

  function updateTasks(next: Task[]) {
    saveTasks(next)
    setTasks(loadTasks())
  }

  function markTaskStatus(taskId: string, status: TaskStatus) {
    const now = new Date().toISOString()
    updateTasks(tasks.map(task => (
      task.id === taskId
        ? { ...task, status, done: status === 'Done', updatedAt: now }
        : task
    )))
  }

  function handleAddQuickTask() {
    if (!quickTitle.trim()) return
    const task = createInboxTask({
      title: quickTitle,
      area: areaFilter === 'Any' ? 'Other' : areaFilter,
      energy,
      mode: areaFilter === 'Life reset' ? 'Recovery' : areaFilter === 'Admin' ? 'Admin' : 'Focus',
      estimatedMinutes: blockMinutes,
      nextTinyAction: areaFilter === 'Any' ? undefined : tinyActionForArea(areaFilter),
    })
    const nextTasks = [task, ...tasks]
    saveTasks(nextTasks)
    try {
      writeInboxTaskToTaskStore(task)
    } catch (error) {
      console.warn('Could not mirror quick task to taskStore', error)
    }
    const normalized = loadTasks()
    setTasks(normalized)
    setSelectedTaskId(task.id)
    setQuickTitle('')
    setShowQuickTask(false)
    setBlockMessage('Quick task added.')
  }

  function handlePickForMe() {
    const picked = rankedTasks.length > 0
      ? filteredTasks[0] ?? null
      : pickTaskForBlock(tasks, energy, areaFilter)
    if (!picked) {
      setBlockMessage('Add one tiny task first.')
      return
    }
    setSelectedTaskId(picked.id)
    setBlockMinutes(picked.estimatedMinutes)
    setBlockMessage(`Picked: ${picked.title}`)
  }

  function handleStartBlock() {
    if (!selectedTask) {
      setBlockMessage('Choose or add one task first.')
      return
    }
    const block = createFocusBlock({
      minutes: blockMinutes,
      task: selectedTask,
      energy,
    })
    const focusTimer = timerEngine.start(selectedTask.id, block.minutes, 'focus-block', {
      id: block.id,
      startedAt: block.startTime,
    })
    saveFocusBlock(block)
    timerEngine.save(FOCUS_BLOCK_TIMER_ENGINE_KEY, focusTimer)
    markTaskStatus(selectedTask.id, 'Doing')
    setBlocks(loadFocusBlocksForDate(today))
    setBlockMessage('Focus block started.')
  }

  function finishBlock(status: FocusBlockStatus) {
    if (!activeBlock) return
    const timerSession = activeBlockTimer ?? timerFromFocusBlock(activeBlock)
    const endedTimer = status === 'Done'
      ? timerEngine.complete(timerSession)
      : timerEngine.abandon(timerSession)
    const actualEndTime = endedTimer.endedAt ?? new Date().toISOString()
    updateFocusBlock(activeBlock.id, { status, actualEndTime })
    const actualMinutes = Math.max(0, Math.round(timerEngine.elapsedMs(endedTimer) / 60_000))
    let focusSession: FocusSession | undefined
    if (status === 'Done') {
      markTaskStatus(activeBlock.taskId, 'Done')
      focusSession = {
        id: `focus-session:${activeBlock.id}`,
        date: activeBlock.date,
        taskId: activeBlock.taskId,
        taskTitle: activeBlock.taskTitle,
        category: categoryFromArea(activeBlock.area),
        focusMinutes: activeBlock.minutes,
        completedAt: actualEndTime,
      }
      addFocusSession(focusSession)
    } else if (status === 'Partial') {
      markTaskStatus(activeBlock.taskId, 'Planned')
    } else if (status === 'Skipped') {
      markTaskStatus(activeBlock.taskId, 'Skipped')
    }
    try {
      writeFocusBlockSessionToTaskStore({
        block: activeBlock,
        focusSession,
        status,
        startedAt: endedTimer.startedAt,
        endedAt: actualEndTime,
        actualMinutes,
      })
    } catch (error) {
      console.warn('Could not mirror focus block session to taskStore', error)
    }
    timerEngine.clear(FOCUS_BLOCK_TIMER_ENGINE_KEY)
    refresh()
    setBlockMessage(`Block marked ${status}.`)
  }

  function addFiveMinutes() {
    if (!activeBlock) return
    const nextEnd = new Date(new Date(activeBlock.plannedEndTime).getTime() + 5 * 60 * 1000)
    const nextMinutes = activeBlock.minutes + 5
    updateFocusBlock(activeBlock.id, {
      minutes: nextMinutes,
      plannedEndTime: nextEnd.toISOString(),
    })
    const timerSession = activeBlockTimer ?? timerFromFocusBlock(activeBlock)
    timerEngine.save(FOCUS_BLOCK_TIMER_ENGINE_KEY, {
      ...timerSession,
      durationPlannedMin: nextMinutes,
    })
    refresh()
  }

  function changeTask() {
    if (!activeBlock) return
    const timerSession = activeBlockTimer ?? timerFromFocusBlock(activeBlock)
    const endedTimer = timerEngine.abandon(timerSession)
    const actualEndTime = endedTimer.endedAt ?? new Date().toISOString()
    updateFocusBlock(activeBlock.id, {
      status: 'Changed',
      actualEndTime,
    })
    markTaskStatus(activeBlock.taskId, 'Planned')
    try {
      writeFocusBlockSessionToTaskStore({
        block: activeBlock,
        status: 'Changed',
        startedAt: endedTimer.startedAt,
        endedAt: actualEndTime,
        actualMinutes: Math.max(0, Math.round(timerEngine.elapsedMs(endedTimer) / 60_000)),
      })
    } catch (error) {
      console.warn('Could not mirror changed focus block to taskStore', error)
    }
    timerEngine.clear(FOCUS_BLOCK_TIMER_ENGINE_KEY)
    refresh()
  }

  function updateBlockNotes(block: FocusBlock, notes: string) {
    updateFocusBlock(block.id, { notes })
    setBlocks(prev => prev.map(item => item.id === block.id ? { ...item, notes } : item))
  }

  function regenerateActiveTinyAction() {
    if (!activeBlock) return
    const task = tasks.find(item => item.id === activeBlock.taskId)
    const nextAction = tinyActionForTask(task?.title ?? activeBlock.taskTitle, task?.area ?? activeBlock.area)
    updateFocusBlock(activeBlock.id, { firstTinyAction: nextAction })
    if (task) {
      updateTasks(tasks.map(item => (
        item.id === task.id
          ? {
              ...item,
              nextTinyAction: nextAction,
              nextAction,
              updatedAt: new Date().toISOString(),
            }
          : item
      )))
    }
    setBlocks(loadFocusBlocksForDate(today))
    setBlockMessage('Tiny action regenerated.')
  }

  function updateMeal(anchor: MealAnchor, status: MealAnchorStatus) {
    const next = saveMealAnchor({ ...anchor, status })
    setMealAnchors(next)
  }

  const remainingSeconds = activeBlockTimer
    ? Math.ceil(timerEngine.remainingMs(activeBlockTimer, tick) / 1000)
    : 0

  return (
    <section className="focus-block-card" aria-label="Focus Block workflow">
      <div className="focus-block-header">
        <div>
          <div className="section-label">Focus tools</div>
          <h3>Focus block</h3>
          <p>Choose one inbox task and start a timer when you need it.</p>
        </div>
        <span className="focus-block-soft-pill">{pendingTasks.length} active</span>
      </div>

      {activeBlock ? (
        <div className="current-block-panel">
          <div className="current-block-topline">
            <span>Current Block</span>
            <strong>{activeBlock.minutes} min · {activeBlock.area}</strong>
          </div>
          <div className="current-block-task">
            <span>Task</span>
            <strong>{activeBlock.taskTitle}</strong>
          </div>
          <div className="current-block-action">
            <span>First tiny action</span>
            <strong>{activeBlock.firstTinyAction}</strong>
          </div>
          <div className="current-block-timer">{formatCountdown(remainingSeconds)}</div>
          {longBlockHint(activeBlock.minutes) && (
            <div className={`long-block-hint ${activeBlock.minutes >= 150 ? 'strong' : ''}`}>
              {longBlockHint(activeBlock.minutes)}
            </div>
          )}
          <div className="start-plan-actions">
            <button className="btn btn-secondary" type="button" onClick={regenerateActiveTinyAction}>
              <Sparkles size={14} />
              Regenerate tiny action
            </button>
            <button className="btn btn-primary" type="button" onClick={() => finishBlock('Done')}>Done</button>
            <button className="btn btn-secondary" type="button" onClick={() => finishBlock('Partial')}>Partial</button>
            <button className="btn btn-secondary" type="button" onClick={() => finishBlock('Skipped')}>Skip</button>
            <button className="btn btn-secondary" type="button" onClick={changeTask}>Change task</button>
            <button className="btn btn-secondary" type="button" onClick={addFiveMinutes}>Add 5 min</button>
          </div>
        </div>
      ) : (
        <>
          <div className="focus-block-builder">
            <div className="start-now-control">
              <label>Block length</label>
              <select value={blockMinutes} onChange={event => setBlockMinutes(Number(event.target.value))}>
                {!isStandardDuration(blockMinutes) && (
                  <option value={blockMinutes}>{blockMinutes} min (custom / legacy)</option>
                )}
                {DURATION_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.values.map(minutes => (
                      <option key={minutes} value={minutes}>{minutes} min</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {longBlockHint(blockMinutes) && (
                <div className={`long-block-hint ${blockMinutes >= 150 ? 'strong' : ''}`}>
                  {longBlockHint(blockMinutes)}
                </div>
              )}
            </div>
            <div className="start-now-control">
              <label>Current energy</label>
              <div className="start-now-options">
                {TASK_ENERGIES.map(item => (
                  <button
                    key={item}
                    className={`btn-option ${energy === item ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setEnergy(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="start-now-control">
              <label>Area filter</label>
              <div className="start-now-options">
                {(['Any', ...TASK_AREAS] as Array<TaskArea | 'Any'>).map(item => (
                  <button
                    key={item}
                    className={`btn-option ${areaFilter === item ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setAreaFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="start-now-control">
              <label>Choose task</label>
              <select value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)}>
                {filteredTasks.length === 0 && (
                  <option value="">No active tasks yet — add a task or choose a template.</option>
                )}
                {filteredTasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title} · {task.area} · {task.energy}
                  </option>
                ))}
              </select>
              {selectedTask && (
                <p className="focus-block-tiny-preview">
                  {selectedTask.nextTinyAction || tinyActionForArea(selectedTask.area ?? 'Other')}
                </p>
              )}
            </div>
          </div>
          <div className="start-plan-actions">
            <button className="btn btn-primary" type="button" onClick={handleStartBlock}>
              <Play size={14} />
              Start block
            </button>
            <button className="btn btn-secondary" type="button" onClick={handlePickForMe}>
              <Sparkles size={14} />
              Pick for me
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setShowQuickTask(value => !value)}>
              <Plus size={14} />
              Add quick task
            </button>
            {blockMessage && <span className="start-now-message">{blockMessage}</span>}
          </div>
          {showQuickTask && (
            <div className="quick-task-row">
              <input
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder="e.g. 整理 GoPhish 截图"
              />
              <button className="btn btn-primary" type="button" onClick={handleAddQuickTask}>
                Add
              </button>
            </div>
          )}
        </>
      )}

      <div className="meal-anchor-grid">
        {mealAnchors.map(anchor => (
          <div key={anchor.id} className="meal-anchor-card">
            <div>
              <span>{anchor.aroundTime}</span>
              <strong>{anchor.label}</strong>
            </div>
            <div className="meal-anchor-actions">
              {(['Followed', 'Partial', 'Skipped', 'Changed'] as MealAnchorStatus[]).map(status => (
                <button
                  key={status}
                  className={`btn-option ${anchor.status === status ? 'selected' : ''}`}
                  type="button"
                  onClick={() => updateMeal(anchor, status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="next-three-blocks">
        <div className="plan-section-title">Next 3 Blocks</div>
        {recommendations.map(item => (
          <div key={item.id} className="next-three-item">
            <span>{item.time}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="today-block-log">
        <div className="plan-section-title">Today’s Blocks</div>
        {blocks.length === 0 ? (
          <p className="focus-block-empty">No focus blocks yet today.</p>
        ) : (
          blocks.map(block => (
            <div key={block.id} className="today-block-item">
              <div className="today-block-meta">
                <span>{formatBlockTime(block.startTime)}</span>
                <strong>{block.minutes}m · {block.taskTitle}</strong>
                <em>{block.area} · {block.status}</em>
              </div>
              <textarea
                value={block.notes}
                onChange={e => updateBlockNotes(block, e.target.value)}
                placeholder="What actually happened?"
              />
            </div>
          ))
        )}
      </div>
    </section>
  )
}
