import { useMemo, useState } from 'react'
import { Clock, Sparkles } from 'lucide-react'
import { getLocalDateKey } from '../focus'
import { getStartNowWeekRecords, loadStartNowRecords, summarizeStartNow } from '../startNowStorage'
import { WeeklyEffortWall } from './VisibleEffort'
import type { StartNowActionType, StartNowRecord } from '../startNowTypes'

type SessionFilter = 'Today' | 'This week' | StartNowActionType | 'Body' | 'Reset'

const SESSION_FILTERS: SessionFilter[] = [
  'Today',
  'This week',
  'Study',
  'English',
  'Body',
  'Project',
  'Reset',
  'Before I Spiral',
]

function formatSessionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function matchesFilter(record: StartNowRecord, filter: SessionFilter) {
  if (filter === 'Today') return record.date === getLocalDateKey()
  if (filter === 'This week') return true
  if (filter === 'Body') return record.actionType === 'Move Body'
  if (filter === 'Reset') return record.actionType === 'Reset'
  return record.actionType === filter
}

export default function StartSessionsPage() {
  const [filter, setFilter] = useState<SessionFilter>('Today')
  const weekRecords = useMemo(() => getStartNowWeekRecords(), [])
  const records = useMemo(
    () => filter === 'This week' ? weekRecords : loadStartNowRecords().filter(record => matchesFilter(record, filter)),
    [filter, weekRecords],
  )
  const todaySummary = useMemo(() => summarizeStartNow(loadStartNowRecords().filter(record => record.date === getLocalDateKey())), [])

  return (
    <div className="page start-sessions-page">
      <div className="page-header start-sessions-header">
        <div>
          <h2 className="page-title">Start / Sessions</h2>
          <p className="page-subtitle">A lightweight history of action, reps, and tiny wins.</p>
        </div>
        <span className="start-sessions-mark" aria-hidden="true"><Clock /></span>
      </div>

      <section className="start-sessions-summary">
        <div>
          <div className="section-label">Today counted</div>
          <h3>{todaySummary.dayStatus}</h3>
          <p>{todaySummary.statusMessage}</p>
        </div>
        <div className="start-sessions-summary-grid">
          <span><strong>{todaySummary.studyMinutes}</strong> study min</span>
          <span><strong>{todaySummary.englishPoints}</strong> English pts</span>
          <span><strong>{todaySummary.bodyMinutes}</strong> body min</span>
          <span><strong>{todaySummary.spiralsDelayed}</strong> spirals delayed</span>
        </div>
      </section>

      <WeeklyEffortWall records={weekRecords} />

      <div className="start-session-filter-row" aria-label="Session filters">
        {SESSION_FILTERS.map(item => (
          <button
            key={item}
            type="button"
            className={filter === item ? 'active' : ''}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="start-session-list" aria-label="Session history">
        {records.length === 0 ? (
          <div className="start-session-empty">
            <Sparkles />
            <span>No sessions in this view yet.</span>
            <small>Start one small thing from Today. Done counts.</small>
          </div>
        ) : records.map(record => (
          <article className="start-session-card" key={record.id}>
            <div>
              <span>{formatSessionTime(record.completedAt)} · {record.kind}</span>
              <h3>{record.title}</h3>
              <p>{record.contribution}</p>
              {record.tinyWin && <small>{record.tinyWin}</small>}
            </div>
            <div className="start-session-metrics">
              {record.completedMinutes && <span>{record.completedMinutes} min</span>}
              {record.points && <span>{record.points} pt</span>}
              {record.reps && <span>{record.reps} reps</span>}
              <span>{record.actionType}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
