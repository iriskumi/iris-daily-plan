import { useState, useEffect } from 'react'
import {
  ClipboardList,
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
} from 'lucide-react'
import type { GeneratedPlan, Bill, WorkOpportunity } from './types'
import {
  loadBills,
  loadCheckin,
  loadFocusSessions,
  loadOpportunities,
  loadPlan,
  loadTasks,
  loadDailyLog,
  loadGoogleCalendarMeta,
  saveCalendarEvents,
  saveGoogleCalendarMeta,
  savePlan,
  loadGeneratePlanContext,
} from './storage'
import { getFocusStats } from './focus'
import { getDaysUntil, planAssembly } from './planner'
import { generatePlanWithAI } from './services/aiService'
import { getGoogleCalendarStatus, importCalendarCommitments } from './services/calendarService'
import {
  formatCarryOverSuggestions,
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
import AIAssistant from './components/AIAssistant'
import RecurringTemplates from './components/RecurringTemplates'
import Settings from './components/Settings'
import FocusGarden from './components/FocusGarden'
import PomodoroTimer from './components/PomodoroTimer'
import './index.css'

type Tab = 'today' | 'plan' | 'tasks' | 'integrations' | 'settings'
type TaskView = 'tasks' | 'templates'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <ClipboardList /> },
  { id: 'plan', label: 'Plan', icon: <Zap /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare /> },
  { id: 'integrations', label: 'Integrations', icon: <Plug /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
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

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [taskView, setTaskView] = useState<TaskView>('tasks')
  const [plan, setPlan] = useState<GeneratedPlan | null>(() => loadPlan())
  const [urgentBills, setUrgentBills] = useState<Bill[]>([])
  const [activeWorkLeads, setActiveWorkLeads] = useState<WorkOpportunity[]>([])
  const [focusStats, setFocusStats] = useState(() => getFocusStats(loadFocusSessions()))

  useEffect(() => {
    setUrgentBills(getUrgentBills(loadBills()))
    setActiveWorkLeads(getActiveWorkLeads(loadOpportunities()))
    setFocusStats(getFocusStats(loadFocusSessions()))
  }, [tab])

  function refreshReminders() {
    setUrgentBills(getUrgentBills(loadBills()))
    setActiveWorkLeads(getActiveWorkLeads(loadOpportunities()))
    setFocusStats(getFocusStats(loadFocusSessions()))
  }

  const handleGeneratePlan = async (
    feedback = '',
    originalPlan?: GeneratedPlan,
    options: { stayOnTab?: boolean } = {},
  ) => {
    const context = loadGeneratePlanContext()
    if (!context) return
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
    const aiResult = await generatePlanWithAI(feedbackContext, { originalPlan, feedback })
    const generated = aiResult.data
      ? {
          ...aiResult.data,
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
          provider: 'rule-based' as const,
          aiUsed: false,
          fallbackReason: aiResult.fallbackReason || aiResult.message,
        }
    savePlan(generated)
    setPlan(generated)
    if (!options.stayOnTab) setTab('plan')
  }

  function handleLowEnergyMode() {
    if (!plan) return
    const reduced = reducePlanForLowEnergy(plan)
    savePlan(reduced)
    setPlan(reduced)
  }

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  const overdueBills = urgentBills.filter(b => getDaysUntil(b.dueDate) < 0)
  const dueSoonBills = urgentBills.filter(b => getDaysUntil(b.dueDate) >= 0)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <h1>Iris Daily Plan Hub</h1>
        </div>
        <span className="header-date">{today}</span>
      </header>

      <nav className="nav-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

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
            onStartToday={async () => {
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

              const checkin = loadCheckin()
              steps.push(checkin ? 'Today check-in found.' : 'No check-in yet; use the check-in below.')

              const yesterday = new Date()
              yesterday.setDate(yesterday.getDate() - 1)
              const yesterdayLog = loadDailyLog(yesterday.toISOString().slice(0, 10))
              const suggestions = getCarryOverSuggestions(loadTasks(), yesterdayLog)
              steps.push(
                suggestions.length > 0
                  ? `Loaded ${suggestions.length} carry-over suggestion${suggestions.length === 1 ? '' : 's'}.`
                  : 'No carry-over backlog detected.',
              )

              if (checkin && (!plan || plan.date !== checkin.date)) {
                await handleGeneratePlan(
                  suggestions.length > 0
                    ? `Start Today carry-over:\n${formatCarryOverSuggestions(suggestions)}`
                    : '',
                  undefined,
                  { stayOnTab: true },
                )
                steps.push('Generated or refreshed today’s plan.')
              } else {
                steps.push('Today’s plan is already available.')
              }

              return steps
            }}
          />
        )}
        {tab === 'plan' && (
          <DailyPlanView
            plan={plan}
            onGenerate={handleGeneratePlan}
            onRegenerate={feedback => handleGeneratePlan(feedback, plan ?? undefined)}
            onGoToCheckin={() => setTab('today')}
            onReducePlan={handleLowEnergyMode}
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
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}

interface TodayCommandCentreProps {
  urgentBills: Bill[]
  activeWorkLeads: WorkOpportunity[]
  focusStats: ReturnType<typeof getFocusStats>
  onGenerate: () => void
  onRemindersChange: () => void
  currentPlan: GeneratedPlan | null
  onStartToday: () => Promise<string[]>
}

function TodayCommandCentre({
  urgentBills,
  activeWorkLeads,
  focusStats,
  onGenerate,
  onRemindersChange,
  currentPlan,
  onStartToday,
}: TodayCommandCentreProps) {
  const [expanded, setExpanded] = useState<'bills' | 'work' | null>(null)
  const [startSteps, setStartSteps] = useState<string[]>([])
  const [starting, setStarting] = useState(false)
  const [showNextFocus, setShowNextFocus] = useState(false)
  const overdueBills = urgentBills.filter(b => getDaysUntil(b.dueDate) < 0)
  const dueSoonBills = urgentBills.filter(b => getDaysUntil(b.dueDate) >= 0)
  const workReminders = getTodayWorkReminders(activeWorkLeads)
  const billReminders = getTodayBillReminders(urgentBills)
  const nextAction = getNextAction(currentPlan)

  async function handleStartToday() {
    setStarting(true)
    const steps = await onStartToday()
    setStartSteps([...steps, `Next action: ${getNextAction(loadPlan()).title}`])
    setStarting(false)
  }

  return (
    <>
      <div className="page command-page">
        <div className="page-header">
          <h2 className="page-title">Today</h2>
          <p className="page-subtitle">Start the day, check the next action, then protect your energy.</p>
        </div>

        <section className="today-focus-section">
          <div className="today-focus-section-header">
            <div>
              <div className="section-label">Focus</div>
              <h3>Focus Garden</h3>
            </div>
          </div>
          <FocusGarden stats={focusStats} />
        </section>

        <div className="start-today-card">
          <div>
            <div className="plan-section-title">Daily command centre</div>
            <h3>Start Today</h3>
            <p>Sync commitments, check carry-over, refresh the plan, and surface the first useful action.</p>
          </div>
          <button className="btn btn-primary" onClick={handleStartToday} disabled={starting}>
            <Play size={14} />
            {starting ? 'Starting...' : 'Start Today'}
          </button>
        </div>

        {startSteps.length > 0 && (
          <div className="start-flow-steps">
            {startSteps.map(step => (
              <div key={step} className="start-flow-step">{step}</div>
            ))}
          </div>
        )}

        <div className="next-action-card">
          <div className="next-action-main">
            <div className="plan-section-title">Next Action</div>
            <h3>{nextAction.title}</h3>
            <p>{nextAction.detail}</p>
            {(nextAction.startTime || nextAction.endTime) && (
              <div className="next-action-time">
                {nextAction.startTime ?? '--'}-{nextAction.endTime ?? '--'}
              </div>
            )}
          </div>
          {nextAction.canStartFocus && (
            <div className="next-action-focus">
              <button
                className="btn btn-secondary"
                onClick={() => setShowNextFocus(value => !value)}
              >
                {showNextFocus ? 'Hide Pomodoro' : 'Start Pomodoro'}
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
      </div>

      <DailyCheckin onGenerate={onGenerate} />
    </>
  )
}
