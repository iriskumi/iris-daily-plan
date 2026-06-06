import { useEffect, useState } from 'react'
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
  CalendarDays,
  Download,
} from 'lucide-react'
import {
  connectGoogleCalendar,
  getGoogleCalendarStatus,
  importCalendarCommitments,
} from '../services/calendarService'
import {
  loadGoogleCalendarMeta,
  saveCalendarEvents,
  saveGoogleCalendarMeta,
} from '../storage'
import type { GoogleCalendarImportMeta } from '../types'

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
  const [calendarMeta, setCalendarMeta] = useState<GoogleCalendarImportMeta>(() =>
    loadGoogleCalendarMeta(),
  )
  const [calendarMessage, setCalendarMessage] = useState('Google Calendar not connected')
  const [importingCalendar, setImportingCalendar] = useState(false)

  useEffect(() => {
    void refreshCalendarStatus()
  }, [])

  async function refreshCalendarStatus() {
    const status = await getGoogleCalendarStatus()
    const next = {
      ...calendarMeta,
      connected: status.connected,
      accountEmail: status.accountEmail ?? calendarMeta.accountEmail,
      warning: status.warning,
    }
    setCalendarMeta(next)
    saveGoogleCalendarMeta(next)
    setCalendarMessage(status.connected ? 'Google Calendar connected' : 'Google Calendar not connected')
  }

  function handleClick(action: AIAction) {
    setActiveMsg(action.placeholder)
    setTimeout(() => {}, 0)
  }

  async function handleImportCalendar() {
    setImportingCalendar(true)
    const result = await importCalendarCommitments()
    setImportingCalendar(false)

    if (!result.success || !result.data) {
      const next = {
        ...calendarMeta,
        connected: false,
      }
      setCalendarMeta(next)
      saveGoogleCalendarMeta(next)
      setCalendarMessage(result.message || 'Google Calendar not connected')
      return
    }

    const importedAt = new Date().toISOString()
    const status = await getGoogleCalendarStatus()
    const next = {
      connected: true,
      accountEmail: status.accountEmail ?? calendarMeta.accountEmail,
      lastImportedAt: importedAt,
      warning: status.warning ?? calendarMeta.warning,
    }
    saveCalendarEvents(result.data)
    saveGoogleCalendarMeta(next)
    setCalendarMeta(next)
    setCalendarMessage(result.message)
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
          AI + automation
        </div>
        <p>
          Gemini planning is available when configured. Google Calendar can now be connected
          read-only; Gmail and Notion remain manual placeholders.
        </p>
      </div>

      <div className="card calendar-integration-card">
        <div className="card-title">
          <CalendarDays size={14} />
          Google Calendar
        </div>
        <div className={`integration-status ${calendarMeta.connected ? 'connected' : 'not-connected'}`}>
          {calendarMessage}
        </div>
        {calendarMeta.lastImportedAt && (
          <div className="text-xs text-muted">
            Last imported {new Date(calendarMeta.lastImportedAt).toLocaleString('en-AU')}
          </div>
        )}
        {calendarMeta.accountEmail && (
          <div className="text-xs text-muted">Account: {calendarMeta.accountEmail}</div>
        )}
        {calendarMeta.warning && (
          <p className="text-xs text-muted calendar-storage-warning">{calendarMeta.warning}</p>
        )}
        <div className="calendar-actions">
          <button className="btn btn-secondary" onClick={connectGoogleCalendar}>
            <CalendarDays size={14} />
            Connect Google Calendar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImportCalendar}
            disabled={importingCalendar}
          >
            <Download size={14} />
            {importingCalendar ? 'Importing...' : 'Import Next 7 Days'}
          </button>
        </div>
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
