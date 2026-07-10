import { useEffect, useState } from 'react'
import {
  Bot,
  Zap,
  FileText,
  ListChecks,
  Briefcase,
  CreditCard,
  BookOpen,
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
  loadCheckin,
  loadDailyLog,
  loadFocusSessions,
  loadFocusBlocksForDate,
  loadGoogleCalendarMeta,
  loadOpportunities,
  loadPlan,
  loadTasks,
  loadTimeBlockFollowUps,
  saveCalendarEvents,
  saveDailyLog,
  saveGoogleCalendarMeta,
  saveOpportunities,
} from '../storage'
import {
  getExpressionHubImportStatus,
  importExpressionHubPayload,
  importExpressionHubQueue,
  loadExpressionHubImportNotice,
  parseExpressionHubImportJson,
} from '../expressionHubImport'
import { getFocusStats, getLocalDateKey } from '../focus'
import { exportPlanToNotion } from '../services/notionService'
import type {
  GmailScannedWorkLead,
  GeneratePlanOutcome,
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
  onGeneratePlan: () => Promise<GeneratePlanOutcome>
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
    title: 'Push Daily Log to Notion',
    desc: 'Create one Notion Daily Log page for today',
    placeholder:
      'Pushing Daily Log to Notion...',
  },
]

export default function AIAssistant({ onGeneratePlan }: Props) {
  const [activeMsg, setActiveMsg] = useState<string | null>(null)
  const [gmailScanMsg, setGmailScanMsg] = useState<string | null>(null)
  const [resultTitle, setResultTitle] = useState<string | null>(null)
  const [resultText, setResultText] = useState<string | null>(null)
  const [scannedLeads, setScannedLeads] = useState<GmailScannedWorkLead[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [calendarMeta, setCalendarMeta] = useState<GoogleCalendarImportMeta>(() =>
    loadGoogleCalendarMeta(),
  )
  const [importingCalendar, setImportingCalendar] = useState(false)
  const [expressionImportStatus, setExpressionImportStatus] = useState(() => getExpressionHubImportStatus())
  const [expressionImportJson, setExpressionImportJson] = useState('')
  const [expressionImportMessage, setExpressionImportMessage] = useState<string | null>(() => {
    const notice = loadExpressionHubImportNotice()
    if (!notice) return null
    return notice.error ? `${notice.message} ${notice.error}` : notice.message
  })

  useEffect(() => {
    void refreshCalendarStatus()
  }, [])

  function googleScopeLine(meta: GoogleCalendarImportMeta): string {
    return `Calendar: ${meta.calendarConnected ? 'connected' : 'not connected'} · Gmail: ${meta.gmailConnected ? 'connected' : 'not connected'}`
  }

  function gmailScanStatusLine(meta: GoogleCalendarImportMeta): string {
    return meta.gmailConnected
      ? 'Scan recent Gmail job emails'
      : 'Reconnect Google to grant Gmail read-only scope'
  }

  async function refreshGoogleStatus(): Promise<GoogleCalendarImportMeta> {
    const status = await getGoogleCalendarStatus()
    const next = {
      ...calendarMeta,
      connected: status.connected,
      calendarConnected: status.calendarConnected,
      gmailConnected: status.gmailConnected,
      accountEmail: status.accountEmail ?? calendarMeta.accountEmail,
      warning: status.warning,
    }
    setCalendarMeta(next)
    saveGoogleCalendarMeta(next)
    return next
  }

  async function refreshCalendarStatus() {
    await refreshGoogleStatus()
  }

  function buildSummaryContext() {
    const plan = loadPlan()
    const date = plan?.date ?? getLocalDateKey()
    return {
      plan,
      tasks: loadTasks(),
      bills: loadBills(),
      opportunities: loadOpportunities(),
      calendarEvents: loadCalendarEvents(),
      dailyLog: loadDailyLog(date),
      focusStats: getFocusStats(loadFocusSessions()),
    }
  }

  async function handleClick(action: AIAction) {
    setActiveMsg(null)
    setGmailScanMsg(null)
    setResultTitle(null)
    setResultText(null)
    setScannedLeads([])
    setSelectedLeadIds([])
    setRunningAction(action.id)

    if (action.id === 'generate') {
      const outcome = await onGeneratePlan()
      if (!outcome.success) setActiveMsg(outcome.message)
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
      const plan = loadPlan()
      const date = plan?.date ?? getLocalDateKey()
      const log = loadDailyLog(date)
      const updatedLog = {
        ...log,
        ...(action.id === 'summarise'
          ? { eveningSummary: response.data }
          : { unfinishedReview: response.data }),
      }
      saveDailyLog(updatedLog)
      setResultTitle(action.id === 'summarise' ? 'Today Summary' : 'Unfinished Task Review')
      setResultText(response.data)
      if (action.id === 'summarise' && plan) {
        const notionResult = await exportPlanToNotion(
          plan,
          updatedLog,
          getFocusStats(loadFocusSessions()),
          {
            checkin: loadCheckin(date),
            tasks: loadTasks(),
            calendarEvents: loadCalendarEvents(),
            opportunities: loadOpportunities(),
            bills: loadBills(),
            markdown: plan.notionMarkdown,
            focusBlocks: loadFocusBlocksForDate(date),
            followUps: Object.values(loadTimeBlockFollowUps(date)),
          },
        )
        setActiveMsg(
          notionResult.data?.pageUrl
            ? `${notionResult.message} ${notionResult.data.pageUrl}`
            : notionResult.message,
        )
      }
      return
    }

    if (action.id === 'extract-leads') {
      const status = await refreshGoogleStatus()
      if (!status.gmailConnected) {
        setRunningAction(null)
        setGmailScanMsg('Reconnect Google to grant Gmail read-only scope')
        return
      }

      const response = await scanGmailForWorkLeads()
      setRunningAction(null)
      if (!response.success || !response.data) {
        setGmailScanMsg(
          status.gmailConnected
            ? 'Gmail is connected. Scan failed; try again or reconnect Google if this keeps happening.'
            : response.message || 'Reconnect Google to grant Gmail read-only scope',
        )
        return
      }
      setScannedLeads(response.data)
      setSelectedLeadIds(
        response.data
          .filter(lead => lead.classification !== 'ignore')
          .map(lead => lead.messageId),
      )
      setActiveMsg(response.message)
      setGmailScanMsg(response.message)
      return
    }

    if (action.id === 'notion') {
      const plan = loadPlan()
      if (!plan) {
        setRunningAction(null)
        setActiveMsg('Generate a daily plan before pushing a Notion Daily Log.')
        return
      }
      const date = plan.date
      const log = loadDailyLog(date)
      const response = await exportPlanToNotion(
        plan,
        log,
        getFocusStats(loadFocusSessions()),
        {
          checkin: loadCheckin(date),
          tasks: loadTasks(),
          calendarEvents: loadCalendarEvents(),
          opportunities: loadOpportunities(),
          bills: loadBills(),
          markdown: plan.notionMarkdown,
          focusBlocks: loadFocusBlocksForDate(date),
          followUps: Object.values(loadTimeBlockFollowUps(date)),
        },
      )
      setRunningAction(null)
      setActiveMsg(response.data?.pageUrl ? `${response.message} ${response.data.pageUrl}` : response.message)
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
      return
    }

    const importedAt = new Date().toISOString()
    const status = await getGoogleCalendarStatus()
    const next = {
      connected: true,
      calendarConnected: status.calendarConnected,
      gmailConnected: status.gmailConnected,
      accountEmail: status.accountEmail ?? calendarMeta.accountEmail,
      lastImportedAt: importedAt,
      warning: status.warning ?? calendarMeta.warning,
    }
    saveCalendarEvents(result.data)
    saveGoogleCalendarMeta(next)
    setCalendarMeta(next)
  }

  function refreshExpressionStatus() {
    setExpressionImportStatus(getExpressionHubImportStatus())
  }

  function handleExpressionHubImport() {
    const result = importExpressionHubQueue()
    refreshExpressionStatus()
    if (result.importedCount > 0) {
      setExpressionImportMessage(`Imported ${result.importedCount} Expression Review Hub item${result.importedCount === 1 ? '' : 's'}.`)
      return
    }
    if (result.duplicateCount > 0) {
      setExpressionImportMessage('Expression Review Hub queue items were already imported.')
      return
    }
    setExpressionImportMessage('No new Expression Review Hub items to import.')
  }

  function handleExpressionHubJsonImport() {
    try {
      const payload = parseExpressionHubImportJson(expressionImportJson)
      const result = importExpressionHubPayload(payload)
      refreshExpressionStatus()
      setExpressionImportMessage(result.error ? `${result.message} ${result.error}` : result.message)
      if (result.success && result.importedCount > 0) {
        setExpressionImportJson('')
      }
    } catch (error) {
      setExpressionImportMessage(error instanceof Error ? error.message : 'Could not import Expression Review Hub JSON.')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Integrations</h2>
        <p className="page-subtitle">Calendar, Gmail, Gemini, and future Notion workflows.</p>
      </div>

      <div className="card calendar-integration-card">
        <div className="card-title">
          <CalendarDays size={14} />
          Google Calendar
        </div>
        <div className="scope-status-list">
          <div className={`scope-status ${calendarMeta.calendarConnected ? 'connected' : 'not-connected'}`}>
            Calendar {calendarMeta.calendarConnected ? 'connected' : 'not connected'}
          </div>
          <div className={`scope-status ${calendarMeta.gmailConnected ? 'connected' : 'not-connected'}`}>
            Gmail {calendarMeta.gmailConnected ? 'connected' : 'not connected'}
          </div>
        </div>
        {calendarMeta.lastImportedAt && (
          <div className="text-xs text-muted">
            Last imported {new Date(calendarMeta.lastImportedAt).toLocaleString('en-AU')}
          </div>
        )}
        {calendarMeta.accountEmail && (
          <div className="text-xs text-muted">Account: {calendarMeta.accountEmail}</div>
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

      <div className="card mt-1 expression-hub-import-card expression-hub-import-card-compact">
        <div>
          <div className="section-label">Expression Review Hub</div>
          <h3>Expression Review Hub</h3>
          {expressionImportStatus.pendingCount > 0 ? (
            <p>
              {expressionImportStatus.pendingCount} completed output rep{expressionImportStatus.pendingCount === 1 ? '' : 's'} ready to sync.
            </p>
          ) : (
            <p>Review saved expressions and bring completed output reps into Iris Hub.</p>
          )}
          {expressionImportStatus.lastImportedAt && (
            <small>
              Last imported {new Date(expressionImportStatus.lastImportedAt).toLocaleString('en-AU')}
            </small>
          )}
          {expressionImportMessage && <small>{expressionImportMessage}</small>}
        </div>
        <div className="expression-hub-import-actions">
          <a className="btn btn-secondary" href="https://iris-expression-review-hub.vercel.app/" target="_blank" rel="noreferrer">
            Open Expression Review Hub
          </a>
          <button type="button" className="btn btn-primary" onClick={handleExpressionHubImport}>
            Sync available reps
          </button>
          <details className="expression-hub-advanced-tools">
            <summary>Advanced import tools</summary>
            <label>
              Import Expression Hub JSON
              <textarea
                value={expressionImportJson}
                onChange={event => setExpressionImportJson(event.target.value)}
                placeholder='Paste JSON payload, e.g. {"schemaVersion":1,"type":"english-output-rep",...}'
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExpressionHubJsonImport}
              disabled={!expressionImportJson.trim()}
            >
              Import pasted JSON
            </button>
          </details>
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
              {action.id === 'extract-leads' && (
                <div className="ai-btn-desc">
                  {googleScopeLine(calendarMeta)}
                </div>
              )}
              {action.id === 'extract-leads' && (
                <div className="ai-btn-desc">
                  {gmailScanStatusLine(calendarMeta)}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className={`ai-toast mt-1 gmail-scan-status ${calendarMeta.gmailConnected ? 'connected' : 'not-connected'}`}>
        <Info size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
        <p>
          <strong>Gmail scan</strong>
          <br />
          {gmailScanMsg ?? gmailScanStatusLine(calendarMeta)}
        </p>
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
            <strong>Status</strong>
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
          <li>Notion Daily Log page creation from the current plan and reflection</li>
          <li>Copy-to-Notion Markdown workflows remain available now</li>
        </ul>
        <p className="text-xs text-muted mt-sm" style={{ lineHeight: 1.6 }}>
          Notion push requires NOTION_API_KEY and NOTION_DATABASE_ID in Vercel.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
        <Bot size={14} style={{ color: 'var(--text-3)' }} />
        <span className="text-xs text-muted">Iris Daily Plan Hub v0.1 · No data leaves your device</span>
      </div>
    </div>
  )
}
