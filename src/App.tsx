import { useState, useEffect } from 'react'
import {
  ClipboardList,
  CheckSquare,
  Briefcase,
  CreditCard,
  Zap,
  Bot,
  AlertTriangle,
  LayoutTemplate,
  Settings as SettingsIcon,
} from 'lucide-react'
import type { GeneratedPlan, Bill } from './types'
import { loadBills, loadPlan, savePlan, loadGeneratePlanContext } from './storage'
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

type Tab = 'checkin' | 'tasks' | 'templates' | 'work' | 'bills' | 'plan' | 'ai' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'checkin', label: 'Check-in', icon: <ClipboardList /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate /> },
  { id: 'work', label: 'Work Leads', icon: <Briefcase /> },
  { id: 'bills', label: 'Bills', icon: <CreditCard /> },
  { id: 'plan', label: "Today's Plan", icon: <Zap /> },
  { id: 'ai', label: 'AI Ready', icon: <Bot /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
]

function getUrgentBills(bills: Bill[]): Bill[] {
  return bills.filter(b => {
    if (b.status === 'paid') return false
    const days = getDaysUntil(b.dueDate)
    return days <= 3
  })
}

export default function App() {
  const [tab, setTab] = useState<Tab>('checkin')
  const [plan, setPlan] = useState<GeneratedPlan | null>(() => loadPlan())
  const [urgentBills, setUrgentBills] = useState<Bill[]>([])

  useEffect(() => {
    setUrgentBills(getUrgentBills(loadBills()))
  }, [tab])

  const handleGeneratePlan = async () => {
    const context = loadGeneratePlanContext()
    if (!context) return
    const aiResult = await generatePlanWithAI(context)
    const generated = aiResult.data
      ? {
          ...aiResult.data,
          provider: aiResult.provider,
          aiUsed: aiResult.aiUsed,
          fallbackReason: aiResult.fallbackReason,
        }
      : {
          ...planAssembly(
            context.checkin,
            context.tasks,
            context.opportunities,
            context.bills,
            new Date(),
            {
              defaultRecoveryBlockEnabled: context.settings.defaultRecoveryBlockEnabled,
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
            : `${overdueBills.length} bills overdue — check Bills tab`}
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
        {tab === 'checkin' && <DailyCheckin onGenerate={handleGeneratePlan} />}
        {tab === 'tasks' && <TaskInbox />}
        {tab === 'templates' && <RecurringTemplates />}
        {tab === 'work' && <WorkCollection />}
        {tab === 'bills' && <BillsFinance onBillsChange={() => setUrgentBills(getUrgentBills(loadBills()))} />}
        {tab === 'plan' && (
          <DailyPlanView
            plan={plan}
            onGenerate={handleGeneratePlan}
            onGoToCheckin={() => setTab('checkin')}
          />
        )}
        {tab === 'ai' && <AIAssistant />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
