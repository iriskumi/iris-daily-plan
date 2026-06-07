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
} from 'lucide-react'
import type { GeneratedPlan, Bill, WorkOpportunity } from './types'
import {
  loadBills,
  loadOpportunities,
  loadPlan,
  savePlan,
  loadGeneratePlanContext,
} from './storage'
import { getDaysUntil, planAssembly } from './planner'
import { generatePlanWithAI } from './services/aiService'
import DailyCheckin from './components/DailyCheckin'
import TaskInbox from './components/TaskInbox'
import WorkCollection from './components/WorkCollection'
import BillsFinance from './components/BillsFinance'
import DailyPlanView from './components/DailyPlanView'
import AIAssistant from './components/AIAssistant'
import RecurringTemplates from './components/RecurringTemplates'
import Settings from './components/Settings'
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

  useEffect(() => {
    setUrgentBills(getUrgentBills(loadBills()))
    setActiveWorkLeads(getActiveWorkLeads(loadOpportunities()))
  }, [tab])

  function refreshReminders() {
    setUrgentBills(getUrgentBills(loadBills()))
    setActiveWorkLeads(getActiveWorkLeads(loadOpportunities()))
  }

  const handleGeneratePlan = async (feedback = '', originalPlan?: GeneratedPlan) => {
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
    setTab('plan')
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
            onGenerate={handleGeneratePlan}
            onRemindersChange={refreshReminders}
          />
        )}
        {tab === 'plan' && (
          <DailyPlanView
            plan={plan}
            onGenerate={handleGeneratePlan}
            onRegenerate={feedback => handleGeneratePlan(feedback, plan ?? undefined)}
            onGoToCheckin={() => setTab('today')}
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
  onGenerate: () => void
  onRemindersChange: () => void
}

function TodayCommandCentre({
  urgentBills,
  activeWorkLeads,
  onGenerate,
  onRemindersChange,
}: TodayCommandCentreProps) {
  const [expanded, setExpanded] = useState<'bills' | 'work' | null>(null)
  const overdueBills = urgentBills.filter(b => getDaysUntil(b.dueDate) < 0)
  const dueSoonBills = urgentBills.filter(b => getDaysUntil(b.dueDate) >= 0)
  const applyTodayLeads = activeWorkLeads.filter(o => o.status === 'apply-today')

  return (
    <>
      <div className="page command-page">
        <div className="page-header">
          <h2 className="page-title">Today</h2>
          <p className="page-subtitle">Check in, notice deadlines, then generate the plan.</p>
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
              <span className="command-card-title">Work leads</span>
              <span className="command-card-text">
                {applyTodayLeads.length > 0
                  ? `${applyTodayLeads.length} apply today`
                  : activeWorkLeads.length > 0
                    ? `${activeWorkLeads.length} active`
                    : 'No active reminders'}
                </span>
            </span>
            <ChevronRight className="command-card-chevron" />
          </button>
        </div>

        {expanded === 'bills' && (
          <div className="command-inline-manager">
            <BillsFinance onBillsChange={onRemindersChange} />
          </div>
        )}

        {expanded === 'work' && (
          <div className="command-inline-manager">
            <WorkCollection onOpportunitiesChange={onRemindersChange} />
          </div>
        )}
      </div>

      <DailyCheckin onGenerate={onGenerate} />
    </>
  )
}
