import { useState } from 'react'
import {
  Bot,
  Zap,
  FileText,
  ListChecks,
  Briefcase,
  CreditCard,
  BookOpen,
  Sparkles,
  Info,
} from 'lucide-react'

interface AIAction {
  id: string
  icon: React.ReactNode
  title: string
  desc: string
  placeholder: string
}

const ACTIONS: AIAction[] = [
  {
    id: 'generate',
    icon: <Zap />,
    title: 'Generate plan with AI later',
    desc: 'Integration not connected yet — use the local planner for now',
    placeholder:
      'Integration not connected yet. Paste data manually or connect an AI API later.',
  },
  {
    id: 'summarise',
    icon: <FileText />,
    title: 'Summarise today',
    desc: 'Integration not connected yet — manual summaries can be added later',
    placeholder:
      'Integration not connected yet. Use the generated local plan, or connect an AI API later.',
  },
  {
    id: 'review',
    icon: <ListChecks />,
    title: 'Review unfinished tasks',
    desc: 'Integration not connected yet — task review remains manual',
    placeholder:
      'Integration not connected yet. Review pending tasks manually or connect an AI API later.',
  },
  {
    id: 'extract-leads',
    icon: <Briefcase />,
    title: 'Extract work leads',
    desc: 'Paste data manually now; automated extraction can connect later',
    placeholder:
      'Integration not connected yet. Paste job details manually into Work Leads, or connect Gmail/AI later.',
  },
  {
    id: 'extract-bills',
    icon: <CreditCard />,
    title: 'Extract bills from text',
    desc: 'Paste data manually now; automated extraction can connect later',
    placeholder:
      'Integration not connected yet. Paste bill details manually into Bills, or connect Gmail/AI later.',
  },
  {
    id: 'notion',
    icon: <BookOpen />,
    title: 'Draft Notion plan',
    desc: 'Integration not connected yet — Markdown copy still works',
    placeholder:
      "Integration not connected yet. Use Today's Plan to copy Markdown manually, or connect Notion later.",
  },
]

export default function AIAssistant() {
  const [activeMsg, setActiveMsg] = useState<string | null>(null)

  function handleClick(action: AIAction) {
    setActiveMsg(action.placeholder)
    setTimeout(() => {}, 0)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">AI Assistant</h2>
        <p className="page-subtitle">Automation boundaries — APIs are not connected yet</p>
      </div>

      <div className="ai-header">
        <div className="ai-header-badge">
          <Sparkles size={11} />
          Local-only
        </div>
        <p>
          Integration not connected yet. Paste data manually for now; Google Calendar, Gmail,
          Notion, and AI APIs can be connected later through the new service boundaries.
        </p>
      </div>

      <div className="ai-panel">
        {ACTIONS.map(action => (
          <button
            key={action.id}
            className="ai-btn"
            onClick={() => handleClick(action)}
          >
            <div className="ai-btn-icon">{action.icon}</div>
            <div>
              <div className="ai-btn-title">{action.title}</div>
              <div className="ai-btn-desc">{action.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {activeMsg && (
        <div className="ai-toast mt-1">
          <Info size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <p>
            <strong>Integration not connected yet.</strong>
            <br />
            {activeMsg}
          </p>
        </div>
      )}

      <div className="card mt-2">
        <div className="card-title" style={{ marginBottom: '0.6rem' }}>What connects here</div>
        <ul className="plan-list" style={{ lineHeight: 1.8 }}>
          <li>AI service boundary for future natural language planning</li>
          <li>Gmail service boundary for future bill and work-lead extraction</li>
          <li>Google Calendar service boundary for future commitment import</li>
          <li>Notion service boundary for future direct plan export</li>
          <li>Manual paste workflows remain available now</li>
        </ul>
        <p className="text-xs text-muted mt-sm" style={{ lineHeight: 1.6 }}>
          Current behavior is local-only. Service functions return "Integration not connected yet"
          until real API auth and backend handling are added.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
        <Bot size={14} style={{ color: 'var(--text-3)' }} />
        <span className="text-xs text-muted">Iris Daily Plan Hub v0.1 · No data leaves your device</span>
      </div>
    </div>
  )
}
