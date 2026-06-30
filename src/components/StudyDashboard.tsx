import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, Clipboard, Clock, Copy, Pause, Play, Square, Target, X } from 'lucide-react'
import { getLocalDateKey } from '../focus'
import { STUDY_CATEGORIES, STUDY_TASK_LIBRARY } from '../studyTaskLibrary'
import { pushStudyDailyLogToNotion } from '../services/notionService'
import {
  addStudySessionRecord,
  clearActiveStudySession,
  loadActiveStudySession,
  loadDailyStudyTarget,
  loadStudyDailyReview,
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

const QUICK_TARGETS = [3, 5, 6, 8]

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
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

function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function remainingMsForSession(session: StudyActiveSession | null, now = Date.now()): number {
  if (!session) return 0
  const referenceTime = session.status === 'paused' && session.pauseStartedAt
    ? session.pauseStartedAt
    : now
  return Math.max(0, session.expectedEndTime - referenceTime)
}

function elapsedFocusMs(session: StudyActiveSession, now = Date.now()): number {
  const activePauseMs = session.status === 'paused' && session.pauseStartedAt
    ? now - session.pauseStartedAt
    : 0
  return Math.max(0, now - session.sessionStartTime - session.pausedAccumulatedMs - activePauseMs)
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
  const [activeSession, setActiveSession] = useState<StudyActiveSession | null>(() =>
    loadActiveStudySession(),
  )
  const [nowMs, setNowMs] = useState(Date.now())
  const [sessions, setSessions] = useState(() => loadStudySessionRecordsForDate(today))
  const [review, setReview] = useState<StudyDailyReview>(() => loadStudyDailyReview(today))
  const summary = todayStudySummary(sessions)
  const completedSessions = sessions.filter(record => record.status === 'completed')
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
  const activeRemainingMs = remainingMsForSession(activeSession, nowMs)
  const activeProgress = activeSession
    ? Math.min(100, Math.round(((activeSession.durationMinutes * 60_000 - activeRemainingMs) / (activeSession.durationMinutes * 60_000)) * 100))
    : 0

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
    if (!activeSession || activeSession.status !== 'running') return
    if (remainingMsForSession(activeSession, nowMs) > 0) return
    completeSession('completed', activeSession.expectedEndTime)
  }, [activeSession, nowMs])

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

  function persistActiveSession(session: StudyActiveSession | null) {
    setActiveSession(session)
    setNowMs(Date.now())
    if (session) {
      saveActiveStudySession(session)
    } else {
      clearActiveStudySession()
    }
  }

  function startTemplateSession(durationMinutes: number) {
    if (!selectedTemplate) return
    const start = Date.now()
    persistActiveSession({
      id: crypto.randomUUID(),
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
    })
  }

  function startCustomSession() {
    const duration = Number(customTask.duration)
    const durationMinutes = Number.isFinite(duration) && duration > 0 ? duration : 25
    const title = customTask.title.trim() || 'Custom study task'
    const start = Date.now()
    persistActiveSession({
      id: crypto.randomUUID(),
      customTaskId: crypto.randomUUID(),
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
    })
  }

  function startCustomDurationSession() {
    const duration = Number(customTimerMinutes)
    if (!Number.isFinite(duration) || duration <= 0) return
    startTemplateSession(Math.round(duration))
  }

  function pauseSession() {
    if (!activeSession || activeSession.status === 'paused') return
    const next = {
      ...activeSession,
      status: 'paused' as const,
      pauseStartedAt: Date.now(),
    }
    persistActiveSession(next)
  }

  function resumeSession() {
    if (!activeSession || activeSession.status !== 'paused' || !activeSession.pauseStartedAt) return
    const now = Date.now()
    const pauseMs = now - activeSession.pauseStartedAt
    const next = {
      ...activeSession,
      status: 'running' as const,
      pauseStartedAt: undefined,
      pausedAccumulatedMs: activeSession.pausedAccumulatedMs + pauseMs,
      expectedEndTime: activeSession.expectedEndTime + pauseMs,
    }
    persistActiveSession(next)
  }

  function completeSession(status: StudySessionRecord['status'], completedAtMs = Date.now()) {
    if (!activeSession) return
    const actualMs = status === 'completed'
      ? Math.min(activeSession.durationMinutes * 60_000, elapsedFocusMs(activeSession, completedAtMs))
      : elapsedFocusMs(activeSession, completedAtMs)
    const record: StudySessionRecord = {
      id: crypto.randomUUID(),
      taskTemplateId: activeSession.taskTemplateId,
      customTaskId: activeSession.customTaskId,
      title: activeSession.title,
      category: activeSession.category,
      startedAt: new Date(activeSession.sessionStartTime).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      plannedMinutes: activeSession.durationMinutes,
      actualMinutes: status === 'completed'
        ? Math.max(1, Math.round(actualMs / 60_000))
        : Math.max(0, Math.round(actualMs / 60_000)),
      status,
      noteDestination: activeSession.noteDestination,
      notes: activeSession.notes,
      resourceUsed: activeSession.resourceUsed,
    }
    addStudySessionRecord(record)
    setSessions(loadStudySessionRecordsForDate(today))
    persistActiveSession(null)
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

  return (
    <div className="page study-page">
      <div className="page-header">
        <div className="section-label">Study cockpit</div>
        <h2 className="page-title">Study Dashboard</h2>
        <p className="page-subtitle">
          A focused place for study targets, session templates, and Obsidian-ready notes.
        </p>
      </div>

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

      <section className="study-timer-card">
        <div className="study-timer-header">
          <div>
            <div className="section-label">Focus timer</div>
            <h3>{activeSession ? activeSession.title : selectedTemplate?.title ?? 'Choose a study task'}</h3>
            <p>
              {activeSession
                ? `${activeSession.category} · ${activeSession.durationMinutes} min session`
                : 'Start a 25 or 50 minute focus session from the selected task.'}
            </p>
          </div>
          <Clock size={18} />
        </div>

        <div className="study-timer-face">
          <span>{activeSession ? formatTimer(activeRemainingMs) : '--:--'}</span>
          <div className="study-progress-bar" aria-label={`Timer progress ${activeProgress}%`}>
            <span style={{ width: `${activeProgress}%` }} />
          </div>
          {activeSession && (
            <small>
              {activeSession.status === 'paused'
                ? 'Paused'
                : activeRemainingMs === 0
                  ? 'Ready to complete'
                  : `Expected end ${new Date(activeSession.expectedEndTime).toLocaleTimeString('en-AU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`}
            </small>
          )}
        </div>

        {!activeSession ? (
          <div className="study-timer-controls">
            <button type="button" className="btn btn-primary" onClick={() => startTemplateSession(25)}>
              <Play size={14} />
              Start 25
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => startTemplateSession(50)}>
              <Play size={14} />
              Start 50
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
                Start custom
              </button>
            </div>
          </div>
        ) : (
          <div className="study-timer-controls">
            {activeSession.status === 'paused' ? (
              <button type="button" className="btn btn-primary" onClick={resumeSession}>
                <Play size={14} />
                Resume
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={pauseSession}>
                <Pause size={14} />
                Pause
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => completeSession('completed')}>
              <Check size={14} />
              Complete
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => completeSession('abandoned')}>
              <X size={14} />
              Abandon
            </button>
          </div>
        )}
      </section>

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
        </div>

        <div className="study-review-grid">
          <div className="study-review-panel">
            <h3>Sessions</h3>
            {completedSessions.length > 0 ? (
              <div className="study-session-list">
                {completedSessions.map(record => (
                  <div key={record.id} className="study-session-row">
                    <strong>
                      {timeLabel(record.startedAt)}-{timeLabel(record.completedAt)} · {record.title}
                    </strong>
                    <span>{record.category} · {record.actualMinutes} min</span>
                    <small>{record.noteDestination}</small>
                  </div>
                ))}
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
