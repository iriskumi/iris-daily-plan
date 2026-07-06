import { useEffect, useMemo, useState } from 'react'
import { Check, Pause, Play, RotateCcw, X } from 'lucide-react'
import {
  addStartNowCounter,
  addStartNowSession,
  getStartNowRecordsForDate,
  START_NOW_ACTIONS,
  START_NOW_COUNTERS,
  START_NOW_DURATIONS,
  summarizeStartNow,
} from '../startNowStorage'
import type { StartNowActionType, StartNowRecord } from '../startNowTypes'

interface StartNowDashboardProps {
  onOpenComeback?: () => void
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

export default function StartNowDashboard({ onOpenComeback }: StartNowDashboardProps) {
  const [duration, setDuration] = useState<(typeof START_NOW_DURATIONS)[number]>(10)
  const [actionType, setActionType] = useState<StartNowActionType>('Study')
  const [records, setRecords] = useState<StartNowRecord[]>(() => getStartNowRecordsForDate())
  const [activeSession, setActiveSession] = useState<{ actionType: StartNowActionType; duration: number; remaining: number; paused: boolean } | null>(null)
  const [completedSession, setCompletedSession] = useState<{ actionType: StartNowActionType; duration: number } | null>(null)
  const [tinyWin, setTinyWin] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const summary = useMemo(() => summarizeStartNow(records), [records])
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
    addStartNowSession({
      actionType: completedSession.actionType,
      durationMinutes: completedSession.duration,
      tinyWin,
    })
    setCompletedSession(null)
    setTinyWin('')
    refreshRecords()
    setMessage('One small session saved. Today counted a little more.')
  }

  function saveCounter(label: string) {
    const option = START_NOW_COUNTERS.find(item => item.label === label)
    if (!option) return
    addStartNowCounter(option)
    refreshRecords()
    setMessage(`${label} saved. Done counts.`)
  }

  return (
    <section className="start-now-dashboard" aria-label="Start now dashboard">
      <div className="start-now-hero">
        <div>
          <div className="section-label">Start Now</div>
          <h2>What can I start right now?</h2>
          <p>Open app → choose action → start timer or add reps → save → today counted.</p>
        </div>
        <div className="start-now-status">
          <span>{summary.dayStatus}</span>
          <strong>{summary.statusMessage}</strong>
        </div>
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
          {actionType === 'Before I Spiral' ? '救我10分钟' : 'Start now'}
        </button>
      </div>

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

      <div className="today-counts-card">
        <div className="today-counts-header">
          <div>
            <div className="section-label">Today so far</div>
            <h3>{summary.statusMessage}</h3>
          </div>
          <RotateCcw aria-hidden="true" />
        </div>
        <div className="today-counts-grid">
          <div><strong>{summary.studyMinutes}</strong><span>Study min</span></div>
          <div><strong>{summary.englishPoints}</strong><span>English pts</span></div>
          <div><strong>{summary.bodyReps} / {summary.bodyMinutes}</strong><span>Body reps / min</span></div>
          <div><strong>{summary.realThings}</strong><span>Real things</span></div>
          <div><strong>{summary.spiralsDelayed}</strong><span>Spirals delayed</span></div>
          <div><strong>{summary.resetSessions}</strong><span>Reset sessions</span></div>
        </div>
      </div>

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

      {message && <div className="start-now-message">{message}</div>}
    </section>
  )
}
