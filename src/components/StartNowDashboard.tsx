import { useEffect, useMemo, useState } from 'react'
import { Check, Moon, Pause, Play, X } from 'lucide-react'
import { IRIS365_MOMENTUM_START_DATE } from '../iris365MomentumStorage'
import {
  addStartNowCounter,
  addStartNowSession,
  getStartNowRecordsForDate,
  getStartNowWeekRecords,
  START_NOW_ACTIONS,
  START_NOW_COUNTERS,
  START_NOW_DURATIONS,
  summarizeStartNow,
} from '../startNowStorage'
import { EffortReceipt, VisibleEffortStrip, WeeklyEffortWall } from './VisibleEffort'
import type { StartNowActionType, StartNowRecord } from '../startNowTypes'

interface StartNowDashboardProps {
  onOpenComeback?: () => void
  todayNote?: {
    lines: string[]
    caption: string
  }
  eveningNote?: string
}

function formatClock(seconds: number) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function actionHelper(action: StartNowActionType) {
  if (action === 'Before I Spiral') return '救我10分钟 · 先别开新坑'
  if (action === 'Reset') return 'Protect tomorrow.'
  if (action === 'English') return 'One sentence counts.'
  if (action === 'Move Body') return 'Gentle movement is enough.'
  if (action === 'Work / Resume') return 'Save one career proof.'
  return 'Done counts.'
}

function getIris365DayNumber() {
  const start = new Date(`${IRIS365_MOMENTUM_START_DATE}T00:00:00`)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return Math.max(1, Math.min(365, diff + 1))
}

export default function StartNowDashboard({ onOpenComeback, todayNote, eveningNote }: StartNowDashboardProps) {
  const [duration, setDuration] = useState<(typeof START_NOW_DURATIONS)[number]>(10)
  const [actionType, setActionType] = useState<StartNowActionType>('Study')
  const [records, setRecords] = useState<StartNowRecord[]>(() => getStartNowRecordsForDate())
  const [activeSession, setActiveSession] = useState<{ actionType: StartNowActionType; duration: number; remaining: number; paused: boolean } | null>(null)
  const [completedSession, setCompletedSession] = useState<{ actionType: StartNowActionType; duration: number } | null>(null)
  const [tinyWin, setTinyWin] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [latestReceipt, setLatestReceipt] = useState<StartNowRecord | null>(null)

  const summary = useMemo(() => summarizeStartNow(records), [records])
  const weekRecords = useMemo(() => getStartNowWeekRecords(), [records])
  const irisDay = useMemo(() => getIris365DayNumber(), [])
  const isBedtimeMode = new Date().getHours() >= 21
  const visibleCounters = START_NOW_COUNTERS.filter(option =>
    actionType === 'Before I Spiral'
      ? option.actionType === 'Before I Spiral' || option.label.includes('bedtime')
      : option.actionType === actionType || (actionType === 'Project' && option.actionType === 'Study'),
  )

  useEffect(() => {
    if (!activeSession || activeSession.paused) return undefined
    if (activeSession.remaining <= 0) {
      setCompletedSession({ actionType: activeSession.actionType, duration: activeSession.duration })
      setActiveSession(null)
      return undefined
    }
    const timer = window.setInterval(() => {
      setActiveSession(current => current ? { ...current, remaining: Math.max(0, current.remaining - 1) } : null)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeSession])

  function refreshRecords() {
    setRecords(getStartNowRecordsForDate())
  }

  function startSession() {
    if (actionType === 'Before I Spiral') {
      onOpenComeback?.()
      setMessage('Opened Before I Spiral. 把刺激降一级，10分钟后再说。')
      return
    }
    setCompletedSession(null)
    setTinyWin('')
    setActiveSession({
      actionType,
      duration,
      remaining: duration * 60,
      paused: false,
    })
    setMessage(null)
  }

  function completeSessionNow() {
    if (!activeSession) return
    setCompletedSession({ actionType: activeSession.actionType, duration: activeSession.duration })
    setActiveSession(null)
  }

  function saveCompletedSession() {
    if (!completedSession) return
    const record = addStartNowSession({
      actionType: completedSession.actionType,
      durationMinutes: completedSession.duration,
      tinyWin,
    })
    setCompletedSession(null)
    setTinyWin('')
    refreshRecords()
    setLatestReceipt(record)
    setMessage('One small session saved. Today counted a little more.')
  }

  function saveCounter(label: string) {
    const option = START_NOW_COUNTERS.find(item => item.label === label)
    if (!option) return
    const record = addStartNowCounter(option)
    refreshRecords()
    setLatestReceipt(record)
    setMessage(`${label} saved. Done counts.`)
  }

  return (
    <section className="start-now-dashboard" aria-label="Start now dashboard">
      <div className="today-compact-status">
        <div>
          <h2>Today</h2>
          <p>{todayNote?.lines.join(' ') || 'One real thing counts.'}</p>
          {(todayNote?.caption || eveningNote) && (
            <small className="today-inline-note">
              {todayNote?.caption}
              {todayNote?.caption && eveningNote ? ' · ' : ''}
              {eveningNote}
            </small>
          )}
        </div>
        <div className="today-status-pills" aria-label="Today status">
          <span>Day {irisDay} / 365</span>
          <span>{summary.dayStatus}</span>
        </div>
      </div>

      <div className="quick-start-card">
        <div className="quick-start-heading">
          <div>
            <div className="section-label">Quick Start</div>
            <h3>Start small</h3>
          </div>
          <small>{summary.statusMessage}</small>
        </div>

        <div className="start-now-controls-panel">
        <div className="start-now-control-block">
          <span>Duration</span>
          <div className="start-now-pill-grid duration-grid">
            {START_NOW_DURATIONS.map(option => (
              <button
                key={option}
                type="button"
                className={duration === option ? 'active' : ''}
                onClick={() => setDuration(option)}
              >
                {option} min
              </button>
            ))}
          </div>
        </div>

        <div className="start-now-control-block">
          <span>Action</span>
          <div className="start-now-pill-grid action-grid">
            {START_NOW_ACTIONS.map(action => (
              <button
                key={action}
                type="button"
                className={actionType === action ? 'active' : ''}
                onClick={() => setActionType(action)}
              >
                {action}
              </button>
            ))}
          </div>
          <small>{actionHelper(actionType)}</small>
        </div>

        <button className="start-now-main-cta" type="button" onClick={startSession}>
          <Play size={18} />
          {actionType === 'Before I Spiral' ? '救我10分钟' : 'Start'}
        </button>
        </div>
      </div>

      <VisibleEffortStrip records={records} />

      {activeSession && (
        <div className="start-now-timer-card" role="timer" aria-live="polite">
          <div>
            <span>{activeSession.actionType}</span>
            <strong>{formatClock(activeSession.remaining)}</strong>
            <small>{activeSession.duration} min selected</small>
          </div>
          <div className="start-now-timer-actions">
            <button type="button" onClick={() => setActiveSession(session => session ? { ...session, paused: !session.paused } : null)}>
              {activeSession.paused ? <Play size={14} /> : <Pause size={14} />}
              {activeSession.paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" onClick={completeSessionNow}><Check size={14} />Complete</button>
            <button type="button" onClick={() => setActiveSession(null)}><X size={14} />Cancel</button>
          </div>
        </div>
      )}

      {completedSession && (
        <div className="start-now-complete-card">
          <div>
            <span>Done counts.</span>
            <h3>{completedSession.duration} min {completedSession.actionType}</h3>
            <p>Optional tiny win note. Quick save is the default.</p>
          </div>
          <input
            value={tinyWin}
            onChange={event => setTinyWin(event.target.value)}
            placeholder="Tiny win note, optional"
          />
          <div className="start-now-complete-actions">
            <button className="btn-primary" type="button" onClick={saveCompletedSession}>Save session</button>
            <button className="btn-secondary" type="button" onClick={() => setCompletedSession(null)}>Skip save</button>
          </div>
        </div>
      )}

      {latestReceipt && <EffortReceipt record={latestReceipt} />}

      <div className="today-counts-card">
        <div className="today-counts-header">
          <div>
            <div className="section-label">Today so far</div>
            <h3>Soft progress is still progress.</h3>
          </div>
        </div>
        <div className="today-counts-grid">
          <div><strong>{summary.studyMinutes}</strong><span>Study min</span></div>
          <div><strong>{summary.englishPoints}</strong><span>English pts</span></div>
          <div><strong>{summary.bodyReps} / {summary.bodyMinutes}</strong><span>Body reps / min</span></div>
          <div><strong>{summary.spiralsDelayed}</strong><span>Spirals delayed</span></div>
          <div><strong>{summary.realThings}</strong><span>Real things</span></div>
        </div>
      </div>

      <div className="today-minimum-card">
        <div>
          <div className="section-label">Today’s minimum</div>
          <h3>今天不用完美，先开始一点点。</h3>
        </div>
        <div className="today-minimum-grid">
          <span>Move body</span>
          <span>Do one real thing</span>
          <span>Protect sleep</span>
        </div>
      </div>

      {isBedtimeMode && (
        <div className="bedtime-shutdown-card">
          <div>
            <div className="section-label">Bedtime Shutdown</div>
            <h3>Protect tomorrow.</h3>
            <p>No new plot · No shopping · Familiar comfort only</p>
          </div>
          <button type="button" onClick={() => saveCounter('+1 bedtime shutdown')}>
            <Moon size={14} />
            Protect tomorrow
          </button>
        </div>
      )}

      <div className="start-now-counters-card">
        <div>
          <div className="section-label">Quick counters</div>
          <h3>Track reps / output points</h3>
        </div>
        <div className="start-now-counter-grid">
          {visibleCounters.map(option => (
            <button key={`${option.actionType}-${option.label}`} type="button" onClick={() => saveCounter(option.label)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <details className="home-secondary-panel">
        <summary>
          <span>Weekly effort wall</span>
          <small>This week’s traces</small>
        </summary>
        <WeeklyEffortWall records={weekRecords} />
      </details>

      {message && <div className="start-now-message">{message}</div>}
    </section>
  )
}
