import { Dumbbell, Play, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addExerciseEntry, loadExerciseLog } from '../exerciseStorage'
import { getLocalDateKey } from '../focus'
import { IRIS365_MOMENTUM_START_DATE } from '../iris365MomentumStorage'
import { loadActiveStudySession, loadStudySessionRecordsForDate, saveActiveStudySession } from '../studyStorage'
import type { StudyActiveSession, StudyCategory, StudySessionRecord } from '../studyTypes'
import { ensureCustomStudyTaskInTaskStore } from '../taskStore'
import * as timerEngine from '../timerEngine'
import type { DayBlock } from '../types'

const STUDY_TIMER_ENGINE_KEY = 'iris-study-timer-engine-active'
const RESET_RECORDS_KEY = 'iris-today-reset-records'

type StartKind = 'study' | 'english-output' | 'english-input' | 'admin'
type MovementKind = 'Walk' | 'Strength' | 'Dance' | 'Stretch' | 'Recovery'
type ResetKind = 'breathe' | 'water' | 'stretch' | 'tidy desk' | 'short walk'

interface ResetRecord {
  id: string
  date: string
  kind: ResetKind
  createdAt: string
}

interface StartNowDashboardProps {
  onOpenStudy?: () => void
  nextBlock?: DayBlock | null
  onStartNextBlock?: () => void
  todayNote?: {
    lines: string[]
    caption: string
  }
  eveningNote?: string
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getIris365DayNumber() {
  const start = new Date(`${IRIS365_MOMENTUM_START_DATE}T00:00:00`)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return Math.max(1, Math.min(365, diff + 1))
}

function loadResetRecords(date = getLocalDateKey()): ResetRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(RESET_RECORDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ResetRecord[]
    return Array.isArray(parsed) ? parsed.filter(record => record.date === date) : []
  } catch {
    return []
  }
}

function saveResetRecord(kind: ResetKind): ResetRecord[] {
  const date = getLocalDateKey()
  const existing = (() => {
    try {
      return JSON.parse(localStorage.getItem(RESET_RECORDS_KEY) ?? '[]') as ResetRecord[]
    } catch {
      return []
    }
  })()
  const record: ResetRecord = {
    id: makeId('reset'),
    date,
    kind,
    createdAt: new Date().toISOString(),
  }
  const next = [record, ...existing]
  localStorage.setItem(RESET_RECORDS_KEY, JSON.stringify(next))
  return next.filter(item => item.date === date)
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function startTitle(kind: StartKind) {
  if (kind === 'english-output') return 'English Output Session'
  if (kind === 'english-input') return 'English Input Session'
  if (kind === 'admin') return 'Admin / Life Session'
  return 'Study Session'
}

function startCategory(kind: StartKind): StudyCategory {
  if (kind === 'english-output') return 'English Output'
  if (kind === 'english-input') return 'English Input'
  if (kind === 'admin') return 'Admin / Life'
  return 'Review / NotebookLM'
}

function studyDoneSummary(sessions: StudySessionRecord[]) {
  const completed = sessions.filter(session => session.status === 'completed')
  const studyMinutes = completed
    .filter(session => !['English Output', 'English Input', 'Admin / Life'].includes(session.category))
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishOutputMinutes = completed
    .filter(session => session.category === 'English Output')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishInputMinutes = completed
    .filter(session => session.category === 'English Input')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const adminMinutes = completed
    .filter(session => session.category === 'Admin / Life')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishReps = completed.filter(session => session.category === 'English Output').length

  return { completed, studyMinutes, englishOutputMinutes, englishInputMinutes, adminMinutes, englishReps }
}

export default function StartNowDashboard({
  onOpenStudy,
  nextBlock,
  onStartNextBlock,
  todayNote,
  eveningNote,
}: StartNowDashboardProps) {
  const today = getLocalDateKey()
  const [message, setMessage] = useState<string | null>(null)
  const [englishChoiceOpen, setEnglishChoiceOpen] = useState(false)
  const [exerciseChoiceOpen, setExerciseChoiceOpen] = useState(false)
  const [resetChoiceOpen, setResetChoiceOpen] = useState(false)
  const [studySessions, setStudySessions] = useState(() => loadStudySessionRecordsForDate(today))
  const [exerciseEntries, setExerciseEntries] = useState(() => loadExerciseLog().entries.filter(entry => entry.date === today))
  const [resetRecords, setResetRecords] = useState(() => loadResetRecords(today))
  const activeStudySession = loadActiveStudySession()
  const irisDay = useMemo(() => getIris365DayNumber(), [])
  const summary = studyDoneSummary(studySessions)
  const movementMinutes = exerciseEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
  const doneItems = [
    ...summary.completed.map(session => ({
      id: session.id,
      time: timeLabel(session.completedAt),
      title: session.title,
      meta: `${session.actualMinutes} min · ${session.category}`,
    })),
    ...exerciseEntries.map(entry => ({
      id: entry.id,
      time: timeLabel(entry.createdAt),
      title: `${entry.movementType} movement`,
      meta: `${entry.durationMinutes} min · Movement`,
    })),
    ...resetRecords.map(record => ({
      id: record.id,
      time: timeLabel(record.createdAt),
      title: record.kind,
      meta: 'Reset',
    })),
  ].sort((a, b) => b.time.localeCompare(a.time))

  function refreshDone() {
    setStudySessions(loadStudySessionRecordsForDate(today))
    setExerciseEntries(loadExerciseLog().entries.filter(entry => entry.date === today))
    setResetRecords(loadResetRecords(today))
  }

  function startStudy(kind: StartKind) {
    const existing = loadActiveStudySession()
    if (existing) {
      setMessage(`A Study Session is already active: ${existing.title}. Finish it in Study first.`)
      onOpenStudy?.()
      return
    }
    const start = Date.now()
    const sessionId = makeId('today-study')
    const customTaskId = `today-start:${kind}:${sessionId}`
    const category = startCategory(kind)
    const timerSession = timerEngine.start(`manual-study:${customTaskId}`, 25, 'study', {
      id: sessionId,
      startedAt: new Date(start).toISOString(),
    })
    const session: StudyActiveSession = {
      id: sessionId,
      customTaskId,
      source: 'today-start-panel',
      title: startTitle(kind),
      category,
      sessionStartTime: start,
      durationMinutes: 25,
      expectedEndTime: start + 25 * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination: category === 'English Output' || category === 'English Input'
        ? 'Obsidian/Study/English Daily Log.md'
        : 'Obsidian/Study/Daily Study Log.md',
      notes: 'Started from Today Start Panel. 统计只计算完成的 Study Session。',
      resourceUsed: 'Today Start Panel',
      timerSession,
    }
    saveActiveStudySession(session)
    timerEngine.save(STUDY_TIMER_ENGINE_KEY, timerSession)
    ensureCustomStudyTaskInTaskStore({
      customTaskId,
      title: session.title,
      category,
      durationMinutes: 25,
      noteDestination: session.noteDestination,
      notes: session.notes,
      activeSession: session,
    })
    setMessage(`${session.title} started. Complete it in Study for minutes to count.`)
    onOpenStudy?.()
  }

  function logMovement(movementType: MovementKind) {
    const result = addExerciseEntry({
      date: today,
      movementType,
      durationMinutes: movementType === 'Recovery' ? 10 : 20,
      intensity: movementType === 'Strength' ? 'medium' : 'gentle',
      energyBefore: 'medium',
      energyAfter: 'better',
      notes: 'Logged from Today Start Panel.',
    })
    setExerciseEntries(result.store.entries.filter(entry => entry.date === today))
    setMessage(`${movementType} logged. Movement minutes now show in Today Done.`)
    setExerciseChoiceOpen(false)
  }

  function logReset(kind: ResetKind) {
    setResetRecords(saveResetRecord(kind))
    setMessage(`Reset saved: ${kind}.`)
    setResetChoiceOpen(false)
  }

  function handleNextUsefulThing() {
    if (activeStudySession) {
      onOpenStudy?.()
      return
    }
    if (nextBlock && onStartNextBlock) {
      onStartNextBlock()
      return
    }
    startStudy('study')
  }

  return (
    <section className="start-now-dashboard today-start-flow" aria-label="Today start flow">
      <div className="today-compact-status">
        <div>
          <div className="section-label">Today Note</div>
          <h2>Today</h2>
          <p>{todayNote?.lines.join(' ') || '不用先规划完整一天。先开始一个小块。'}</p>
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
          <span>Done counts</span>
        </div>
      </div>

      <section className="today-start-panel">
        <div className="today-start-panel-copy">
          <div className="section-label">Start Panel</div>
          <h3>Start Now</h3>
          <p>不用先规划完整一天。先开始一个小块。</p>
          <small>统计只计算完成的 Study Session。Queue 是今日菜单，不是压力清单。</small>
        </div>
        <div className="today-start-actions">
          <button type="button" className="btn btn-primary" onClick={() => startStudy('study')}><Play size={15} />Start Study</button>
          <button type="button" className="btn btn-secondary" onClick={() => setEnglishChoiceOpen(value => !value)}>Start English</button>
          <button type="button" className="btn btn-secondary" onClick={() => setExerciseChoiceOpen(value => !value)}><Dumbbell size={15} />Start Exercise</button>
          <button type="button" className="btn btn-secondary" onClick={() => startStudy('admin')}>Start Admin</button>
          <button type="button" className="btn btn-secondary" onClick={() => setResetChoiceOpen(value => !value)}><RotateCcw size={15} />Start Reset</button>
        </div>
        {englishChoiceOpen && (
          <div className="today-start-choice-row">
            <button type="button" onClick={() => startStudy('english-output')}>English Output</button>
            <button type="button" onClick={() => startStudy('english-input')}>English Input</button>
          </div>
        )}
        {exerciseChoiceOpen && (
          <div className="today-start-choice-row">
            {(['Walk', 'Strength', 'Dance', 'Stretch', 'Recovery'] as MovementKind[]).map(item => (
              <button key={item} type="button" onClick={() => logMovement(item)}>{item}</button>
            ))}
          </div>
        )}
        {resetChoiceOpen && (
          <div className="today-start-choice-row">
            {(['breathe', 'water', 'stretch', 'tidy desk', 'short walk'] as ResetKind[]).map(item => (
              <button key={item} type="button" onClick={() => logReset(item)}>{item}</button>
            ))}
          </div>
        )}
      </section>

      <section className="today-next-useful-card">
        <div>
          <div className="section-label">Next Useful Thing</div>
          <h3>{activeStudySession?.title ?? (nextBlock ? nextBlock.title : 'Start one 25-min Study Session')}</h3>
          <p>
            {activeStudySession
              ? `${activeStudySession.category} · ${activeStudySession.durationMinutes} min already active`
              : nextBlock
                ? `${nextBlock.priority} · ${nextBlock.estimatedMinutes >= 90 ? 'Large task, start with 25 min' : `${nextBlock.estimatedMinutes} min suggested`}`
                : 'No queue item needed. Start small.'}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleNextUsefulThing}>
          <Play size={15} />
          {activeStudySession ? 'Open Study Session' : nextBlock ? 'Start Study Session' : 'Start Study Session'}
        </button>
      </section>

      <section className="today-done-card">
        <div className="today-done-header">
          <div>
            <div className="section-label">Today Done</div>
            <h3>看得见的进展，不用证明给任何人。</h3>
          </div>
          <button type="button" className="btn btn-secondary" onClick={refreshDone}>Refresh</button>
        </div>
        <div className="today-done-grid">
          <div><strong>{summary.studyMinutes}</strong><span>Study min</span></div>
          <div><strong>{summary.englishReps}</strong><span>English reps</span></div>
          <div><strong>{summary.englishOutputMinutes}/{summary.englishInputMinutes}</strong><span>English output/input min</span></div>
          <div><strong>{movementMinutes}</strong><span>Movement min</span></div>
          <div><strong>{summary.adminMinutes}</strong><span>Admin min</span></div>
          <div><strong>{resetRecords.length}</strong><span>Reset sessions</span></div>
        </div>
        <div className="today-done-list">
          {doneItems.length > 0 ? doneItems.slice(0, 8).map(item => (
            <div key={item.id}>
              <span>{item.time}</span>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </div>
          )) : (
            <p>No completed items yet. Finish one session or log one reset to start the list.</p>
          )}
        </div>
      </section>

      {message && <div className="start-now-message">{message}</div>}
    </section>
  )
}
