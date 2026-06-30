import { useState, useEffect, useRef } from 'react'
import type { TaskCategory, FocusSession, FocusStats } from '../types'
import { addFocusSession, loadFocusSessions } from '../storage'
import { getFocusStats, localDateString } from '../focus'
import FocusGarden from './FocusGarden'
import { longBlockHint } from '../durations'
import * as timerEngine from '../timerEngine'
import { writePomodoroSessionToTaskStore } from '../taskStore'
import type { TimerSession } from '../timerEngineTypes'

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

const POMODORO_TIMER_STORAGE_KEY = 'iris-pomodoro-timer-engine-active'

interface StoredPomodoroTimer {
  phase: Phase
  running: boolean
  sessionsCompleted: number
  distractionCount: number
  distractionMsg: string | null
  taskId?: string
  taskTitle: string
  category: TaskCategory
  pomodoroLength: number
  breakLength: number
  sessions: number
  timerSession: TimerSession
}

function loadStoredPomodoroTimer(input: {
  taskId?: string
  taskTitle: string
  category: TaskCategory
  pomodoroLength: number
  breakLength: number
  sessions: number
}): StoredPomodoroTimer | null {
  try {
    const raw = localStorage.getItem(POMODORO_TIMER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPomodoroTimer
    if (parsed.taskId !== input.taskId) return null
    if (!input.taskId && parsed.taskTitle !== input.taskTitle) return null
    if (parsed.category !== input.category) return null
    return {
      ...parsed,
      pomodoroLength: input.pomodoroLength,
      breakLength: input.breakLength,
      sessions: input.sessions,
    }
  } catch {
    return null
  }
}

function saveStoredPomodoroTimer(data: StoredPomodoroTimer): void {
  localStorage.setItem(POMODORO_TIMER_STORAGE_KEY, JSON.stringify(data))
}

function clearStoredPomodoroTimer(): void {
  localStorage.removeItem(POMODORO_TIMER_STORAGE_KEY)
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
          <linearGradient id="pomoHair" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#DAB48A" />
            <stop offset="100%" stopColor="#A9784D" />
          </linearGradient>
          <linearGradient id="pomoSkin" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#FFF1E5" />
            <stop offset="100%" stopColor="#FFD7CC" />
          </linearGradient>
          <linearGradient id="pomoPink" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#FFC1D8" />
            <stop offset="100%" stopColor="#EF7FAE" />
          </linearGradient>
        </defs>

        <ellipse className="pomo-ground" cx="91" cy="132" rx="60" ry="9" />

        <g className="pomo-kiss-hearts">
          <path className="pomo-heart pomo-heart-one" d="M132 48 C132 41 142 41 142 49 C142 41 153 42 153 50 C153 59 142 65 142 65 C142 65 132 58 132 48Z" />
          <path className="pomo-heart pomo-heart-two" d="M36 56 C36 51 43 51 43 57 C43 51 51 52 51 58 C51 64 43 69 43 69 C43 69 36 64 36 56Z" />
          <circle className="pomo-heart-dot" cx="148" cy="31" r="3" />
        </g>

        <g className="pomo-celebration-tree">
          <path className="pomo-trunk" d="M142 124 C142 112 141 101 144 90" />
          <path className="pomo-leaf pomo-leaf-left" d="M142 99 C126 91 121 77 130 69 C142 73 147 84 142 99Z" />
          <path className="pomo-leaf pomo-leaf-right" d="M146 96 C160 83 174 83 178 94 C170 105 156 106 146 96Z" />
          <path className="pomo-leaf pomo-leaf-top" d="M144 89 C137 75 142 61 153 58 C161 68 157 82 144 89Z" />
        </g>

        <g className="pomo-boy">
          <path className="pomo-leg pomo-leg-left" d="M75 119 C66 128 58 126 54 135" />
          <path className="pomo-leg pomo-leg-right" d="M102 120 C111 129 120 127 124 136" />

          <path className="pomo-body" d="M63 92 C65 77 79 68 94 69 C111 70 123 80 125 96 C128 116 113 127 94 127 C75 127 60 114 63 92Z" />
          <path className="pomo-scarf" d="M78 95 C92 88 107 90 121 101 C110 110 94 109 78 95Z" />

          <circle className="pomo-face" cx="92" cy="67" r="34" />
          <path className="pomo-ear pomo-ear-left" d="M58 68 C48 68 48 83 61 82" />
          <path className="pomo-ear pomo-ear-right" d="M126 68 C137 68 136 84 123 82" />
          <path className="pomo-hair" d="M57 63 C55 40 74 25 94 28 C116 30 130 44 127 67 C119 55 110 48 99 45 C98 54 85 55 79 47 C75 57 65 58 57 63Z" />
          <path className="pomo-hair-flip pomo-hair-flip-left" d="M67 42 C58 35 51 40 47 49" />
          <path className="pomo-hair-flip pomo-hair-flip-right" d="M116 40 C128 34 135 41 139 52" />

          <circle className="pomo-eye pomo-eye-left" cx="80" cy="66" r="4" />
          <path className="pomo-eye-wink" d="M102 66 Q110 62 116 67" />
          <circle className="pomo-eye-shine" cx="82" cy="64" r="1.4" />
          <circle className="pomo-cheek pomo-cheek-left" cx="72" cy="78" r="6" />
          <circle className="pomo-cheek pomo-cheek-right" cx="113" cy="79" r="6" />
          <path className="pomo-mouth pomo-mouth-smile" d="M86 84 Q95 91 104 84" />
          <path className="pomo-mouth pomo-mouth-worry" d="M87 88 Q95 82 103 88" />

          <path className="pomo-arm pomo-arm-left" d="M66 97 C53 91 49 82 51 72" />
          <path className="pomo-arm pomo-arm-right" d="M120 94 C133 86 137 77 137 65" />
          <path className="pomo-kiss-hand" d="M51 72 C58 73 61 77 61 82" />
        </g>

        <g className="pomo-tea">
          <path d="M127 103 H151 V114 C151 121 146 125 139 125 H133 C129 125 127 121 127 116Z" />
          <path d="M151 108 C162 107 162 119 151 118" />
          <path className="pomo-steam pomo-steam-one" d="M133 97 C129 92 137 89 133 84" />
          <path className="pomo-steam pomo-steam-two" d="M144 97 C140 92 148 89 144 84" />
        </g>

        <g className="pomo-sparkles">
          <path d="M32 36 L35 45 L44 48 L35 51 L32 60 L29 51 L20 48 L29 45Z" />
          <path d="M137 18 L139 25 L146 27 L139 29 L137 36 L135 29 L128 27 L135 25Z" />
          <circle cx="45" cy="26" r="3" />
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
  const restored = loadStoredPomodoroTimer({
    taskId,
    taskTitle,
    category,
    pomodoroLength,
    breakLength,
    sessions,
  })
  const [phase, setPhase] = useState<Phase>(restored?.phase ?? 'idle')
  const [running, setRunning] = useState(restored?.running ?? false)
  const [sessionsCompleted, setSessionsCompleted] = useState(restored?.sessionsCompleted ?? 0)
  const [distractionCount, setDistractionCount] = useState(restored?.distractionCount ?? 0)
  const [distractionMsg, setDistractionMsg] = useState<string | null>(restored?.distractionMsg ?? null)
  const [activeTimer, setActiveTimer] = useState<TimerSession | null>(restored?.timerSession ?? null)
  const [tick, setTick] = useState(Date.now())
  const [focusView, setFocusView] = useState(false)
  const [focusStats, setFocusStats] = useState<FocusStats>(() =>
    getFocusStats(loadFocusSessions()),
  )

  const phaseRef = useRef(phase)
  const sessionsRef = useRef(sessionsCompleted)
  const sessionsTargetRef = useRef(sessions)
  const distractionRef = useRef(distractionCount)
  const activeTimerRef = useRef<TimerSession | null>(activeTimer)
  const runningRef = useRef(running)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { sessionsRef.current = sessionsCompleted }, [sessionsCompleted])
  useEffect(() => { sessionsTargetRef.current = sessions }, [sessions])
  useEffect(() => { distractionRef.current = distractionCount }, [distractionCount])
  useEffect(() => { activeTimerRef.current = activeTimer }, [activeTimer])
  useEffect(() => { runningRef.current = running }, [running])

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000)
    const handleVisibilityTick = () => setTick(Date.now())
    document.addEventListener('visibilitychange', handleVisibilityTick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityTick)
    }
  }, [])

  useEffect(() => {
    if (phase === 'idle' || phase === 'all-done' || !activeTimer) {
      if (phase === 'idle' || phase === 'all-done') clearStoredPomodoroTimer()
      return
    }
    saveStoredPomodoroTimer({
      phase,
      running,
      sessionsCompleted,
      distractionCount,
      distractionMsg,
      taskId,
      taskTitle,
      category,
      pomodoroLength,
      breakLength,
      sessions,
      timerSession: activeTimer,
    })
  }, [
    activeTimer,
    breakLength,
    category,
    distractionCount,
    distractionMsg,
    phase,
    pomodoroLength,
    running,
    sessions,
    sessionsCompleted,
    taskId,
    taskTitle,
  ])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && runningRef.current && phaseRef.current === 'focus') {
        const timer = activeTimerRef.current
        if (timer) {
          const paused = timerEngine.pause(timer)
          setActiveTimer(paused)
        }
        setRunning(false)
        setDistractionCount(count => count + 1)
        setDistractionMsg('Focus paused after leaving the page. You can resume once; repeated distractions will not count for the garden.')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [running])

  function recordFocusSession(completedTimer: TimerSession) {
    if (distractionRef.current > 1) {
      setDistractionMsg('Session completed, but repeated distractions mean it will not count toward Focus Garden.')
      return
    }
    const completedAt = completedTimer.endedAt ? new Date(completedTimer.endedAt) : new Date()
    const focusSession: FocusSession = {
      id: completedTimer.id,
      date: localDateString(completedAt),
      taskId,
      taskTitle,
      category,
      focusMinutes: pomodoroLength,
      completedAt: completedAt.toISOString(),
    }
    const next = addFocusSession(focusSession)
    writePomodoroSessionToTaskStore(focusSession)
    setFocusStats(getFocusStats(next))
  }

  useEffect(() => {
    if (!running || !activeTimer) return
    if (timerEngine.remainingMs(activeTimer, tick) > 0) return
    const completedTimer = timerEngine.complete(activeTimer, tick)
    setActiveTimer(completedTimer)
    setRunning(false)
    if (phaseRef.current === 'focus') {
      recordFocusSession(completedTimer)
      setPhase('session-done')
    } else if (phaseRef.current === 'break') {
      const next = sessionsRef.current + 1
      setSessionsCompleted(next)
      if (next >= sessionsTargetRef.current) {
        setPhase('all-done')
      } else {
        setPhase('idle')
        setActiveTimer(null)
      }
    }
  }, [activeTimer, running, tick])

  const timeLeft = activeTimer && phase !== 'idle'
    ? Math.ceil(timerEngine.remainingMs(activeTimer, tick) / 1000)
    : pomodoroLength * 60
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
    const timerSession = timerEngine.start(
      taskId ?? `pomodoro:${taskTitle}`,
      pomodoroLength,
      'pomodoro',
    )
    setActiveTimer(timerSession)
    setPhase('focus')
    setDistractionCount(0)
    setDistractionMsg(null)
    setRunning(true)
  }

  function startBreak() {
    const timerSession = timerEngine.start(
      taskId ? `${taskId}:break` : `pomodoro-break:${taskTitle}`,
      breakLength,
      'pomodoro',
    )
    setActiveTimer(timerSession)
    setPhase('break')
    setRunning(true)
  }

  function reset() {
    if (activeTimer) {
      setActiveTimer(timerEngine.abandon(activeTimer))
    }
    clearStoredPomodoroTimer()
    setRunning(false)
    setPhase('idle')
    setActiveTimer(null)
    setSessionsCompleted(0)
    setDistractionCount(0)
    setDistractionMsg(null)
  }

  function toggleRunning() {
    if (!activeTimer) return
    if (running) {
      setActiveTimer(timerEngine.pause(activeTimer))
      setRunning(false)
      return
    }
    setActiveTimer(timerEngine.resume(activeTimer))
    setRunning(true)
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

      {longBlockHint(pomodoroLength) && (
        <div className={`long-block-hint ${pomodoroLength >= 150 ? 'strong' : ''}`}>
          {longBlockHint(pomodoroLength)}
        </div>
      )}

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
            <button className="pomo-btn pomo-btn-primary" onClick={toggleRunning}>
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
