import { useState, useEffect, useRef } from 'react'
import type { TaskCategory, FocusStats } from '../types'
import { addFocusSession, loadFocusSessions } from '../storage'
import { getFocusStats, localDateString } from '../focus'
import FocusGarden from './FocusGarden'

type Phase = 'idle' | 'focus' | 'break' | 'session-done' | 'all-done'

interface Props {
  pomodoroLength: number
  breakLength: number
  sessions: number
  taskId?: string
  taskTitle?: string
  category?: TaskCategory
  onMarkDone?: () => void
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function PomodoroTimer({
  pomodoroLength,
  breakLength,
  sessions,
  taskId,
  taskTitle = 'Focus session',
  category = 'cyber-study',
  onMarkDone,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [timeLeft, setTimeLeft] = useState(pomodoroLength * 60)
  const [running, setRunning] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [distractionCount, setDistractionCount] = useState(0)
  const [distractionMsg, setDistractionMsg] = useState<string | null>(null)
  const [focusStats, setFocusStats] = useState<FocusStats>(() =>
    getFocusStats(loadFocusSessions()),
  )

  const phaseRef = useRef(phase)
  const sessionsRef = useRef(sessionsCompleted)
  const sessionsTargetRef = useRef(sessions)
  const distractionRef = useRef(distractionCount)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { sessionsRef.current = sessionsCompleted }, [sessionsCompleted])
  useEffect(() => { sessionsTargetRef.current = sessions }, [sessions])
  useEffect(() => { distractionRef.current = distractionCount }, [distractionCount])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && running && phaseRef.current === 'focus') {
        setRunning(false)
        setDistractionCount(count => count + 1)
        setDistractionMsg('Focus paused after leaving the page. You can resume once; repeated distractions will not count for the garden.')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [running])

  function recordFocusSession() {
    if (distractionRef.current > 1) {
      setDistractionMsg('Session completed, but repeated distractions mean it will not count toward Focus Garden.')
      return
    }
    const completedAt = new Date()
    const next = addFocusSession({
      id: crypto.randomUUID(),
      date: localDateString(completedAt),
      taskId,
      taskTitle,
      category,
      focusMinutes: pomodoroLength,
      completedAt: completedAt.toISOString(),
    })
    setFocusStats(getFocusStats(next))
  }

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setRunning(false)
          if (phaseRef.current === 'focus') {
            recordFocusSession()
            setPhase('session-done')
          } else if (phaseRef.current === 'break') {
            const next = sessionsRef.current + 1
            setSessionsCompleted(next)
            if (next >= sessionsTargetRef.current) {
              setPhase('all-done')
            } else {
              setPhase('idle')
              return pomodoroLength * 60
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [running, pomodoroLength])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timeStr = `${pad(minutes)}:${pad(seconds)}`

  const progressPct =
    phase === 'focus'
      ? ((pomodoroLength * 60 - timeLeft) / (pomodoroLength * 60)) * 100
      : phase === 'break'
        ? ((breakLength * 60 - timeLeft) / (breakLength * 60)) * 100
        : 0

  function startFocus() {
    setPhase('focus')
    setTimeLeft(pomodoroLength * 60)
    setDistractionCount(0)
    setDistractionMsg(null)
    setRunning(true)
  }

  function startBreak() {
    setPhase('break')
    setTimeLeft(breakLength * 60)
    setRunning(true)
  }

  function reset() {
    setRunning(false)
    setPhase('idle')
    setTimeLeft(pomodoroLength * 60)
    setSessionsCompleted(0)
    setDistractionCount(0)
    setDistractionMsg(null)
  }

  if (phase === 'all-done') {
    return (
      <div className="pomo-box pomo-done">
        <FocusGarden stats={focusStats} compact />
        <div className="pomo-done-icon">✓</div>
        <div className="pomo-done-text">
          All {sessions} session{sessions > 1 ? 's' : ''} complete
        </div>
        <div className="pomo-btn-row">
          {onMarkDone && (
            <button className="pomo-btn pomo-btn-primary" onClick={onMarkDone}>
              Mark task done
            </button>
          )}
          <button className="pomo-btn pomo-btn-ghost" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'session-done') {
    return (
      <div className="pomo-box pomo-session-done">
        <FocusGarden stats={focusStats} compact />
        <div className="pomo-session-done-label">Session complete ✓</div>
        <div className="pomo-break-hint">{breakLength} min break</div>
        <div className="pomo-btn-row">
          <button className="pomo-btn pomo-btn-primary" onClick={startBreak}>
            Start break
          </button>
          <button className="pomo-btn pomo-btn-ghost" onClick={reset}>
            Skip
          </button>
          {onMarkDone && (
            <button className="pomo-btn pomo-btn-ghost" onClick={onMarkDone}>
              Mark done
            </button>
          )}
        </div>
        <div className="pomo-session-count">
          {sessionsCompleted + 1}/{sessions}
        </div>
      </div>
    )
  }

  return (
    <div className="pomo-box">
      <FocusGarden stats={focusStats} compact />
      <div className="pomo-header">
        <span className="pomo-phase-label">
          {phase === 'idle'
            ? `${pomodoroLength}min focus`
            : phase === 'break'
              ? `${breakLength}min break`
              : 'Focus'}
        </span>
        <span className="pomo-session-count">
          {sessionsCompleted}/{sessions}
        </span>
      </div>

      {phase !== 'idle' && (
        <>
          <div className="pomo-time">{timeStr}</div>
          <div className="pomo-progress-bar">
            <div className="pomo-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {distractionMsg && (
            <div className="pomo-distraction-note">{distractionMsg}</div>
          )}
        </>
      )}

      <div className="pomo-btn-row">
        {phase === 'idle' ? (
          <button className="pomo-btn pomo-btn-primary" onClick={startFocus}>
            ▶ Start
          </button>
        ) : (
          <>
            <button className="pomo-btn pomo-btn-primary" onClick={() => setRunning(r => !r)}>
              {running ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button className="pomo-btn pomo-btn-ghost" onClick={reset}>
              ↺ Reset
            </button>
          </>
        )}
      </div>
    </div>
  )
}
