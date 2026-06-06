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
  Copy,
  Check,
} from 'lucide-react'
import { summarizeToday, reviewUnfinishedTasks } from '../services/aiService'
import { scanGmailForWorkLeads } from '../services/gmailService'
import {
  connectGoogleCalendar,
  getGoogleCalendarStatus,
  importCalendarCommitments,
} from '../services/calendarService'
import {
  loadBills,
  loadCalendarEvents,
  loadGoogleCalendarMeta,
  loadOpportunities,
  loadPlan,
  loadTasks,
  saveCalendarEvents,
  saveGoogleCalendarMeta,
  saveOpportunities,
} from '../storage'
import type {
  GmailScannedWorkLead,
  GoogleCalendarImportMeta,
  WorkOpportunity,
  WorkOpportunityStatus,
} from '../types'

interface AIAction {
  id: string
  icon: React.ReactNode
  title: string
  desc: string
  placeholder: string
}

interface Props {
  onGeneratePlan: () => Promise<void>
}

const ACTIONS: AIAction[] = [
  {
    id: 'generate',
    icon: <Zap />,
    title: "Generate Today’s Plan with Gemini",
    desc: 'Runs the same generator used by Today’s Plan',
    placeholder: 'Generating today’s plan...',
  },
  {
    id: 'summarise',
    icon: <FileText />,
    title: 'Summarise today',
    desc: 'Summarise completed, unfinished, carry-over, reflection, and shutdown',
    placeholder: 'Summarising today...',
  },
  {
    id: 'review',
    icon: <ListChecks />,
    title: 'Review unfinished tasks',
    desc: 'Group unfinished tasks into urgent, carry-over, smaller, and ignore',
    placeholder: 'Reviewing unfinished tasks...',
  },
  {
    id: 'extract-leads',
    icon: <Briefcase />,
    title: 'Scan Gmail for Work Leads',
    desc: 'Read-only scan of recent job-related emails',
    placeholder:
      'Scanning recent job-related Gmail messages...',
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

export default function AIAssistant({ onGeneratePlan }: Props) {
  const [activeMsg, setActiveMsg] = useState<string | null>(null)
  const [resultTitle, setResultTitle] = useState<string | null>(null)
  const [resultText, setResultText] = useState<string | null>(null)
  const [scannedLeads, setScannedLeads] = useState<GmailScannedWorkLead[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [runningAction, setRunningAction] = useState<string | null>(null)
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

  function buildSummaryContext() {
    return {
      plan: loadPlan(),
      tasks: loadTasks(),
      bills: loadBills(),
      opportunities: loadOpportunities(),
      calendarEvents: loadCalendarEvents(),
    }
  }

  async function handleClick(action: AIAction) {
    setActiveMsg(null)
    setResultTitle(null)
    setResultText(null)
    setScannedLeads([])
    setSelectedLeadIds([])
    setRunningAction(action.id)

    if (action.id === 'generate') {
      await onGeneratePlan()
      setRunningAction(null)
      return
    }

    if (action.id === 'summarise' || action.id === 'review') {
      const response =
        action.id === 'summarise'
          ? await summarizeToday(buildSummaryContext())
          : await reviewUnfinishedTasks(buildSummaryContext())
      setRunningAction(null)
      if (!response.success || !response.data) {
        setActiveMsg(response.message)
        return
      }
      setResultTitle(action.id === 'summarise' ? 'Today Summary' : 'Unfinished Task Review')
      setResultText(response.data)
      return
    }

    if (action.id === 'extract-leads') {
      const response = await scanGmailForWorkLeads()
      setRunningAction(null)
      if (!response.success || !response.data) {
        setActiveMsg(response.message || 'Gmail read-only access is not connected yet.')
        return
      }
      setScannedLeads(response.data)
      setSelectedLeadIds(
        response.data
          .filter(lead => lead.classification !== 'ignore')
          .map(lead => lead.messageId),
      )
      setActiveMsg(response.message)
      return
    }

    setRunningAction(null)
    setActiveMsg(action.placeholder)
  }

  async function handleCopyResult() {
    if (!resultText) return
    await navigator.clipboard.writeText(resultText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function toggleLead(id: string) {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id],
    )
  }

  function statusFromClassification(classification: GmailScannedWorkLead['classification']): WorkOpportunityStatus {
    if (classification === 'worth-checking-today') return 'worth-checking'
    if (classification === 'later') return 'later'
    return 'ignore'
  }

  function saveSelectedLeads() {
    const existing = loadOpportunities()
    const selected = scannedLeads.filter(lead => selectedLeadIds.includes(lead.messageId))
    const imported: WorkOpportunity[] = selected.map(lead => ({
      id: crypto.randomUUID(),
      title: lead.title,
      source: lead.source || 'Gmail',
      link: lead.link,
      type: lead.type,
      fitScore: Math.max(1, Math.min(5, Math.round(lead.confidence * 5))),
      effortRequired: 'medium',
      nextAction: lead.nextAction,
      status: statusFromClassification(lead.classification),
      notes: [
        `Gmail scan: ${lead.reason}`,
        `Sender: ${lead.sender}`,
        `Subject: ${lead.subject}`,
      ].join('\n'),
      createdAt: new Date().toISOString(),
    }))
    saveOpportunities([...imported, ...existing])
    setActiveMsg(`Saved ${imported.length} lead${imported.length === 1 ? '' : 's'} to Work Collection.`)
    setScannedLeads([])
    setSelectedLeadIds([])
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
        <p className="page-subtitle">Generate, summarise, and review today with Gemini fallback support.</p>
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
            disabled={runningAction !== null}
          >
            <div className="ai-btn-icon">{action.icon}</div>
            <div>
              <div className="ai-btn-title">{action.title}</div>
              <div className="ai-btn-desc">
                {runningAction === action.id ? action.placeholder : action.desc}
              </div>
            </div>
          </button>
        ))}
      </div>

      {resultText && (
        <div className="card mt-1">
          <div className="card-header">
            <span className="card-title">{resultTitle}</span>
          </div>
          <pre className="ai-result">{resultText}</pre>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCopyResult}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy to Notion'}
            </button>
          </div>
        </div>
      )}

      {scannedLeads.length > 0 && (
        <div className="card mt-1">
          <div className="card-header">
            <span className="card-title">Review Gmail Work Leads</span>
          </div>
          <p className="text-xs text-muted" style={{ lineHeight: 1.6, marginBottom: '0.75rem' }}>
            Review before saving. Only selected leads are added to Work Collection.
          </p>
          <div className="gmail-lead-review-list">
            {scannedLeads.map(lead => (
              <label key={lead.messageId} className="gmail-lead-review-item">
                <input
                  type="checkbox"
                  checked={selectedLeadIds.includes(lead.messageId)}
                  onChange={() => toggleLead(lead.messageId)}
                />
                <div>
                  <div className="gmail-lead-title">{lead.title}</div>
                  <div className="gmail-lead-meta">
                    {lead.classification.replaceAll('-', ' ')} · {lead.source} · confidence {Math.round(lead.confidence * 100)}%
                  </div>
                  <div className="gmail-lead-reason">{lead.reason}</div>
                  <div className="gmail-lead-action">{lead.nextAction}</div>
                  {lead.link && (
                    <a href={lead.link} target="_blank" rel="noreferrer" className="text-xs">
                      Open link
                    </a>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={saveSelectedLeads}
              disabled={selectedLeadIds.length === 0}
            >
              <Check size={14} />
              Save Selected to Work Collection
            </button>
          </div>
        </div>
      )}

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
          <li>Gemini daily plan generation through the existing planner endpoint</li>
          <li>Gemini or local fallback summaries and unfinished task reviews</li>
          <li>Gmail service boundary for future bill and work-lead extraction</li>
          <li>Google Calendar read-only commitment import</li>
          <li>Notion service boundary for future direct plan export</li>
          <li>Copy-to-Notion Markdown workflows remain available now</li>
        </ul>
        <p className="text-xs text-muted mt-sm" style={{ lineHeight: 1.6 }}>
          Gmail and Notion actions still use manual workflows until those APIs are connected.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
        <Bot size={14} style={{ color: 'var(--text-3)' }} />
        <span className="text-xs text-muted">Iris Daily Plan Hub v0.1 · No data leaves your device</span>
      </div>
    </div>
  )
}
