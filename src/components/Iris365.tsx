import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Flame, Leaf, Moon, TrendingUp } from 'lucide-react'
import { getLocalDateKey } from '../focus'
import {
  calculateCurrentDayNumber,
  calculateDaysRemaining,
  calculateIris365Stats,
  determineCurrentPhase,
  iris365ProgressPercent,
  loadIris365Entry,
  loadIris365Store,
  recentIris365Entries,
  saveIris365Entry,
} from '../iris365Storage'
import type { Iris365Entry } from '../iris365Types'

const CHECKBOX_FIELDS: Array<{
  key: keyof Pick<
    Iris365Entry,
    'englishOutput' | 'shadowing' | 'realityTask' | 'movement' | 'highStimulusControlled' | 'sleepProtected'
  >
  label: string
  hint: string
}> = [
  { key: 'englishOutput', label: 'English output', hint: 'One active rep, not vague input.' },
  { key: 'shadowing', label: 'Shadowing', hint: 'A small rhythm proof.' },
  { key: 'realityTask', label: 'One reality task', hint: 'A practical life/work move.' },
  { key: 'movement', label: 'Movement', hint: 'Walk, stretch, gym, or reset.' },
  { key: 'highStimulusControlled', label: 'High-stimulus controlled', hint: 'No spiral, no runaway tab loop.' },
  { key: 'sleepProtected', label: 'Sleep protected', hint: 'Protected enough to recover.' },
]

const STAT_LABELS: Array<[keyof ReturnType<typeof calculateIris365Stats>, string]> = [
  ['totalCompletedDays', 'Completed days'],
  ['englishOutputDays', 'English output'],
  ['shadowingDays', 'Shadowing'],
  ['realityTaskDays', 'Reality task'],
  ['movementDays', 'Movement'],
  ['highStimulusControlledDays', 'Stimulus controlled'],
  ['sleepProtectedDays', 'Sleep protected'],
  ['currentStreak', 'Current streak'],
  ['bestStreak', 'Best streak'],
]

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function ratingOptions(label: string, value: number, onChange: (value: number) => void) {
  return (
    <div className="iris365-rating" role="group" aria-label={label}>
      <span>{label}</span>
      <div>
        {[1, 2, 3, 4, 5].map(option => (
          <button
            key={option}
            type="button"
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Iris365() {
  const today = getLocalDateKey()
  const [store, setStore] = useState(() => loadIris365Store())
  const [entry, setEntry] = useState<Iris365Entry>(() => loadIris365Entry(today, store))

  const dayNumber = calculateCurrentDayNumber(store.startDate, today)
  const daysRemaining = calculateDaysRemaining(store.startDate, today)
  const phase = determineCurrentPhase(dayNumber)
  const progress = iris365ProgressPercent(dayNumber)
  const stats = useMemo(() => calculateIris365Stats(store.entries, today), [store.entries, today])
  const recentEntries = useMemo(() => recentIris365Entries(store.entries, 7), [store.entries])

  function updateEntry(patch: Partial<Iris365Entry>) {
    const next = {
      ...entry,
      ...patch,
      date: today,
      updatedAt: new Date().toISOString(),
    }
    setEntry(next)
    setStore(saveIris365Entry(next, store))
  }

  const savedToday = Boolean(store.entries[today])

  return (
    <div className="page iris365-page">
      <div className="page-header">
        <div className="section-label">Small daily proof</div>
        <h2 className="page-title">Iris 365</h2>
        <p className="page-subtitle">A 365-day transformation tracker for proof, not perfection.</p>
      </div>

      <section className="iris365-countdown-card">
        <div className="iris365-countdown-main">
          <div className="card-title-row">
            <CalendarDays size={17} />
            <h3>Day {dayNumber} / 365</h3>
          </div>
          <p>{phase.title}</p>
          <strong>{phase.focus}</strong>
          <div className="iris365-progress-bar" aria-label={`Iris 365 progress ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="iris365-countdown-stats">
          <div>
            <span>{formatDate(store.startDate)}</span>
            <small>Start date</small>
          </div>
          <div>
            <span>{daysRemaining}</span>
            <small>days remaining</small>
          </div>
          <div>
            <span>{progress}%</span>
            <small>overall progress</small>
          </div>
          <div>
            <span>Phase {phase.id}</span>
            <small>Day {phase.startDay}-{phase.endDay}</small>
          </div>
        </div>
      </section>

      <section className="iris365-layout">
        <div className="iris365-checkin-card">
          <div className="card-header">
            <div>
              <div className="section-label">Today’s proof</div>
              <div className="card-title">{formatShortDate(today)}</div>
            </div>
            <span className={`iris365-save-pill ${savedToday ? 'saved' : ''}`}>
              {savedToday ? 'Saved' : 'Not saved yet'}
            </span>
          </div>

          <div className="iris365-checkbox-grid">
            {CHECKBOX_FIELDS.map(item => (
              <label key={item.key} className="iris365-check-row">
                <input
                  type="checkbox"
                  checked={Boolean(entry[item.key])}
                  onChange={event => updateEntry({ [item.key]: event.target.checked })}
                />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="iris365-rating-grid">
            {ratingOptions('Mood', entry.mood, mood => updateEntry({ mood }))}
            {ratingOptions('Energy', entry.energy, energy => updateEntry({ energy }))}
          </div>

          <div className="iris365-form-grid">
            <label>
              Tiny win
              <input
                value={entry.tinyWin}
                onChange={event => updateEntry({ tinyWin: event.target.value })}
                placeholder="One small piece of proof from today"
              />
            </label>
            <label>
              Notes
              <textarea
                value={entry.notes}
                onChange={event => updateEntry({ notes: event.target.value })}
                placeholder="What helped? What needs less friction tomorrow?"
              />
            </label>
          </div>
        </div>

        <aside className="iris365-stats-card">
          <div className="card-title-row">
            <TrendingUp size={16} />
            <h3>Stats</h3>
          </div>
          <div className="iris365-stat-grid">
            {STAT_LABELS.map(([key, label]) => (
              <div key={key}>
                <span>{stats[key]}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="iris365-recent-card">
        <div className="card-header">
          <div>
            <div className="section-label">Recent entries</div>
            <div className="card-title">Last 7 saved days</div>
          </div>
          <Leaf size={16} />
        </div>
        {recentEntries.length > 0 ? (
          <div className="iris365-recent-list">
            {recentEntries.map(item => (
              <div key={item.date} className="iris365-recent-row">
                <div>
                  <strong>{formatShortDate(item.date)}</strong>
                  <small>{item.tinyWin || 'Small daily proof logged.'}</small>
                </div>
                <div className="iris365-recent-pills">
                  {item.englishOutput && <span><CheckCircle2 size={12} /> English</span>}
                  {item.shadowing && <span><Flame size={12} /> Shadowing</span>}
                  {item.movement && <span><Leaf size={12} /> Movement</span>}
                  {item.sleepProtected && <span><Moon size={12} /> Sleep</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="iris365-empty-copy">No entries yet. One checkbox is enough to begin.</p>
        )}
      </section>
    </div>
  )
}
