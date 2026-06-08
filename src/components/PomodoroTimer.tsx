import { useState, useEffect, useRef } from 'react'
import type { TaskCategory, FocusStats } from '../types'
import { addFocusSession, loadFocusSessions } from '../storage'
import { getFocusStats, localDateString } from '../focus'
import FocusGarden from './FocusGarden'

type Phase = 'idle' | 'focus' | 'break' | 'session-done' | 'all-done'
type CompanionState = 'idle' | 'focus' | 'break' | 'completed' | 'distracted'

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

function companionCopy(state: CompanionState): string {
  if (state === 'focus') return 'Stay with it — one tiny forest grows.'
  if (state === 'break') return 'Rest counts. Breathe a little.'
  if (state === 'completed') return 'You earned a tree.'
  if (state === 'distracted') return 'Come back gently. You can still save this session.'
  return 'Ready when you are. One small start is enough.'
}

function FocusCompanion({ state }: { state: CompanionState }) {
  return (
    <div className={`pomo-companion pomo-companion-${state}`} aria-hidden="true">
      <svg viewBox="0 0 180 150" role="img">
        <defs>
          <linearGradient id="pomoLeaf" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#AFCB9B" />
            <stop offset="100%" stopColor="#6F9A72" />
          </linearGradient>
          <linearGradient id="pomoWarm" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#FFF8EF" />
            <stop offset="100%" stopColor="#F0E0CA" />
          </linearGradient>
        </defs>

        <ellipse className="pomo-ground" cx="90" cy="128" rx="58" ry="10" />

        <g className="pomo-tree">
          <path className="pomo-trunk" d="M92 113 C92 98 91 86 94 72" />
          <path className="pomo-leaf pomo-leaf-left" d="M92 82 C69 71 62 50 75 39 C91 45 96 61 92 82Z" />
          <path className="pomo-leaf pomo-leaf-right" d="M96 78 C116 60 137 59 144 75 C133 89 112 92 96 78Z" />
          <path className="pomo-leaf pomo-leaf-top" d="M94 70 C84 49 91 29 107 25 C119 39 112 60 94 70Z" />
        </g>

        <g className="pomo-friend">
          <path className="pomo-body" d="M58 93 C58 66 76 48 95 48 C116 48 130 67 130 94 C130 117 115 128 94 128 C73 128 58 116 58 93Z" />
          <circle className="pomo-cheek pomo-cheek-left" cx="80" cy="86" r="5" />
          <circle className="pomo-cheek pomo-cheek-right" cx="110" cy="86" r="5" />
          <circle className="pomo-eye pomo-eye-left" cx="84" cy="76" r="3" />
          <circle className="pomo-eye pomo-eye-right" cx="106" cy="76" r="3" />
          <path className="pomo-mouth" d="M88 94 Q95 101 103 94" />
          <path className="pomo-arm pomo-arm-left" d="M62 92 C48 89 42 81 39 70" />
          <path className="pomo-arm pomo-arm-right" d="M127 91 C140 83 145 72 146 61" />
        </g>

        <g className="pomo-phone">
          <rect x="136" y="44" width="18" height="28" rx="5" />
          <line x1="141" y1="49" x2="149" y2="49" />
        </g>

        <g className="pomo-tea">
          <path d="M131 100 H154 V111 C154 118 149 122 142 122 H137 C133 122 131 118 131 113Z" />
          <path d="M154 105 C165 104 165 116 154 115" />
          <path className="pomo-steam pomo-steam-one" d="M136 94 C132 89 140 86 136 81" />
          <path className="pomo-steam pomo-steam-two" d="M146 94 C142 89 150 86 146 81" />
        </g>

        <g className="pomo-sparkles">
          <path d="M38 45 L41 54 L50 57 L41 60 L38 69 L35 60 L26 57 L35 54Z" />
          <path d="M141 23 L143 29 L149 31 L143 33 L141 39 L139 33 L133 31 L139 29Z" />
          <circle cx="47" cy="31" r="3" />
        </g>
      </svg>
    </div>
  )
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
  const [focusView, setFocusView] = useState(false)
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

  const companionState: CompanionState =
    phase === 'all-done' || phase === 'session-done'
      ? 'completed'
      : phase === 'break'
        ? 'break'
        : phase === 'focus' && (!running || distractionMsg)
          ? 'distracted'
          : phase === 'focus'
            ? 'focus'
            : 'idle'

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
        <FocusCompanion state="completed" />
        <div className="pomo-microcopy">{companionCopy('completed')}</div>
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
        <FocusCompanion state="completed" />
        <div className="pomo-microcopy">{companionCopy('completed')}</div>
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
    <div className={`pomo-box ${focusView ? 'pomo-focus-view' : ''}`}>
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

      <div className="pomo-stage">
        <FocusCompanion state={companionState} />
        <div className="pomo-microcopy">{companionCopy(companionState)}</div>
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
        <button className="pomo-btn pomo-btn-ghost" onClick={() => setFocusView(view => !view)}>
          {focusView ? 'Compact' : 'Focus view'}
        </button>
      </div>
    </div>
  )
}
