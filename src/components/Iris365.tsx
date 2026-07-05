import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Flame, Leaf, Moon, Plus, ShieldCheck, TrendingUp } from 'lucide-react'
import { getLocalDateKey } from '../focus'
import {
  calculateCurrentDayNumber,
  calculateDaysRemaining,
  calculateIris365Stats,
  determineCurrentPhase,
  emptyIris365WeeklyReview,
  getIris365WeekEntries,
  getIris365WeekStart,
  IRIS_365_END_DATE,
  IRIS_365_PROOF_CATEGORIES,
  IRIS_365_START_DATE,
  iris365ProgressPercent,
  isBeforeIris365Start,
  isIris365WeeklyReviewDay,
  addIris365ProofItem,
  loadIris365Entry,
  loadIris365Store,
  recentIris365Entries,
  saveIris365Entry,
  saveIris365WeeklyReview,
} from '../iris365Storage'
import type { Iris365Entry, Iris365ProofCategory, Iris365WeeklyReview } from '../iris365Types'

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

const WEEKLY_REVIEW_FIELDS: Array<[keyof Omit<Iris365WeeklyReview, 'weekStartDate' | 'weekEndDate' | 'updatedAt'>, string]> = [
  ['proofThisWeek', 'What proof did I leave this week?'],
  ['attentionDrain', 'What drained my attention the most?'],
  ['bestReturnHabit', 'Which habit gave me the best return?'],
  ['makeEasierNextWeek', 'What should I make easier next week?'],
  ['nextWeekPriority', 'What is next week’s one priority?'],
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
  const [proofCategoryFilter, setProofCategoryFilter] = useState<Iris365ProofCategory | 'All'>('All')
  const [proofDraft, setProofDraft] = useState({
    category: 'English output' as Iris365ProofCategory,
    title: '',
    description: '',
    linkOrFile: '',
  })

  const dayNumber = calculateCurrentDayNumber(store.startDate, today)
  const daysRemaining = calculateDaysRemaining(store.startDate, today)
  const preStart = isBeforeIris365Start(today, store.startDate)
  const phase = determineCurrentPhase(Math.max(1, dayNumber))
  const progress = iris365ProgressPercent(dayNumber)
  const stats = useMemo(() => calculateIris365Stats(store.entries, today), [store.entries, today])
  const recentEntries = useMemo(() => recentIris365Entries(store.entries, 7), [store.entries])
  const weekStart = getIris365WeekStart(today)
  const weeklyReview = store.weeklyReviews[weekStart] ?? emptyIris365WeeklyReview(weekStart)
  const weekEntries = getIris365WeekEntries(store.entries, weekStart)
  const weeklyStats = calculateIris365Stats(Object.fromEntries(weekEntries.map(item => [item.date, item])), today)
  const filteredProofItems = store.proofItems.filter(item => proofCategoryFilter === 'All' || item.category === proofCategoryFilter)
  const lowEnergyCompletedCount = [entry.englishOutput, entry.realityTask, entry.movement, entry.sleepProtected].filter(Boolean).length

  function updateEntry(patch: Partial<Iris365Entry>) {
    if (preStart) return
    const next = {
      ...entry,
      ...patch,
      date: today,
      updatedAt: new Date().toISOString(),
    }
    setEntry(next)
    setStore(saveIris365Entry(next, store))
  }

  function updateWeeklyReview(patch: Partial<Iris365WeeklyReview>) {
    const next = {
      ...weeklyReview,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    setStore(saveIris365WeeklyReview(next, store))
  }

  function saveProofItem() {
    const title = proofDraft.title.trim()
    if (!title) return
    setStore(addIris365ProofItem({
      date: today,
      category: proofDraft.category,
      title,
      description: proofDraft.description.trim(),
      linkOrFile: proofDraft.linkOrFile.trim(),
      relatedEntryDate: store.entries[today] ? today : undefined,
    }, store))
    setProofDraft({
      category: proofDraft.category,
      title: '',
      description: '',
      linkOrFile: '',
    })
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
            <h3>{preStart ? 'Starts tomorrow' : `Day ${dayNumber} / 365`}</h3>
          </div>
          <p>{preStart ? 'Get ready: choose your first tiny proof.' : phase.title}</p>
          <strong>{preStart ? 'Day 1 starts on 6 Jul 2026. Small daily proof, not perfection.' : phase.focus}</strong>
          <div className="iris365-progress-bar" aria-label={`Iris 365 progress ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="iris365-countdown-stats">
          <div>
            <span>{formatDate(IRIS_365_START_DATE)}</span>
            <small>Start date</small>
          </div>
          <div>
            <span>{formatDate(IRIS_365_END_DATE)}</span>
            <small>End date</small>
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

          {preStart ? (
            <div className="iris365-prestart-note">
              <strong>Starts tomorrow</strong>
              <p>Get ready: choose your first tiny proof. The daily check-in unlocks on 6 Jul 2026.</p>
            </div>
          ) : (
            <>
              <label className="iris365-low-energy-toggle">
                <input
                  type="checkbox"
                  checked={entry.lowEnergyDay}
                  onChange={event => updateEntry({ lowEnergyDay: event.target.checked })}
                />
                <span>
                  <strong>Low Energy Day</strong>
                  <small>2 out of 4 tiny proofs makes the day valid.</small>
                </span>
              </label>

              {entry.lowEnergyDay && (
                <div className={`iris365-low-energy-status ${lowEnergyCompletedCount >= 2 ? 'valid' : ''}`}>
                  <ShieldCheck size={15} />
                  <span>{lowEnergyCompletedCount} / 4 tiny proofs complete</span>
                </div>
              )}

              <div className="iris365-checkbox-grid">
                {(entry.lowEnergyDay
                  ? CHECKBOX_FIELDS.filter(item => ['englishOutput', 'realityTask', 'movement', 'sleepProtected'].includes(item.key))
                  : CHECKBOX_FIELDS
                ).map(item => (
                  <label key={item.key} className="iris365-check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(entry[item.key])}
                      onChange={event => updateEntry({ [item.key]: event.target.checked })}
                    />
                    <span>
                      <strong>{entry.lowEnergyDay ? lowEnergyLabel(item.key, item.label) : item.label}</strong>
                      <small>{entry.lowEnergyDay ? lowEnergyHint(item.key, item.hint) : item.hint}</small>
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
            </>
          )}
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

      {isIris365WeeklyReviewDay(today) && (
        <section className="iris365-weekly-card">
          <div className="card-header">
            <div>
              <div className="section-label">Sunday review</div>
              <div className="card-title">Weekly review</div>
            </div>
            <span>{formatDate(weeklyReview.weekStartDate)} - {formatDate(weeklyReview.weekEndDate)}</span>
          </div>
          <div className="iris365-weekly-summary">
            <span>English {weeklyStats.englishOutputDays}</span>
            <span>Reality {weeklyStats.realityTaskDays}</span>
            <span>Movement {weeklyStats.movementDays}</span>
            <span>Stimulus {weeklyStats.highStimulusControlledDays}</span>
            <span>Sleep {weeklyStats.sleepProtectedDays}</span>
          </div>
          <div className="iris365-weekly-grid">
            {WEEKLY_REVIEW_FIELDS.map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  value={weeklyReview[key]}
                  onChange={event => updateWeeklyReview({ [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
        </section>
      )}

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
                  {item.lowEnergyDay && <span><ShieldCheck size={12} /> Low Energy Day</span>}
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

      <section className="iris365-proof-card">
        <div className="card-header">
          <div>
            <div className="section-label">Proof Vault</div>
            <div className="card-title">Visible evidence of progress</div>
          </div>
          <Plus size={16} />
        </div>
        <div className="iris365-proof-form">
          <label>
            Category
            <select
              value={proofDraft.category}
              onChange={event => setProofDraft({ ...proofDraft, category: event.target.value as Iris365ProofCategory })}
            >
              {IRIS_365_PROOF_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={proofDraft.title}
              onChange={event => setProofDraft({ ...proofDraft, title: event.target.value })}
              placeholder="What proof did you create?"
            />
          </label>
          <label>
            Link or file
            <input
              value={proofDraft.linkOrFile}
              onChange={event => setProofDraft({ ...proofDraft, linkOrFile: event.target.value })}
              placeholder="Optional URL, file path, repo, Notion page"
            />
          </label>
          <label className="iris365-proof-description">
            Description
            <textarea
              value={proofDraft.description}
              onChange={event => setProofDraft({ ...proofDraft, description: event.target.value })}
              placeholder="What does this prove?"
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={saveProofItem}>
            Save proof
          </button>
        </div>

        <div className="iris365-proof-filter">
          <button
            type="button"
            className={proofCategoryFilter === 'All' ? 'active' : ''}
            onClick={() => setProofCategoryFilter('All')}
          >
            All
          </button>
          {IRIS_365_PROOF_CATEGORIES.map(category => (
            <button
              key={category}
              type="button"
              className={proofCategoryFilter === category ? 'active' : ''}
              onClick={() => setProofCategoryFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="iris365-proof-list">
          {filteredProofItems.length > 0 ? filteredProofItems.map(item => (
            <article key={item.id} className="iris365-proof-item">
              <div>
                <span>{item.category} · {formatShortDate(item.date)}</span>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
                {item.linkOrFile && <small>{item.linkOrFile}</small>}
              </div>
            </article>
          )) : (
            <p className="iris365-empty-copy">No proof items yet. Save one small artifact when something becomes visible.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function lowEnergyLabel(key: string, fallback: string): string {
  if (key === 'englishOutput') return '3-minute English output'
  if (key === 'realityTask') return '10-minute reality task'
  if (key === 'movement') return '5-minute movement'
  if (key === 'sleepProtected') return 'Sleep protected'
  return fallback
}

function lowEnergyHint(key: string, fallback: string): string {
  if (key === 'englishOutput') return 'One tiny active sentence, voice note, or rep.'
  if (key === 'realityTask') return 'A practical 10-minute move is enough.'
  if (key === 'movement') return 'Five minutes still counts.'
  if (key === 'sleepProtected') return 'Protect recovery, not perfection.'
  return fallback
}

export function Iris365HomeSummary() {
  const today = getLocalDateKey()
  const store = loadIris365Store()
  const entry = loadIris365Entry(today, store)
  const dayNumber = calculateCurrentDayNumber(store.startDate, today)
  const preStart = isBeforeIris365Start(today, store.startDate)
  const phase = determineCurrentPhase(Math.max(1, dayNumber))
  const daysRemaining = calculateDaysRemaining(store.startDate, today)
  const minimumProofComplete = entry.englishOutput && entry.realityTask && entry.movement

  return (
    <section className="iris365-home-card">
      <div>
        <div className="section-label">Iris 365</div>
        <h3>{preStart ? 'Starts tomorrow' : `Day ${dayNumber} / 365`}</h3>
        <p>{preStart ? 'Get ready: choose your first tiny proof.' : `${daysRemaining} days left · ${phase.title}`}</p>
      </div>
      <div className="iris365-home-proof">
        <span className={entry.englishOutput ? 'done' : ''}>English output</span>
        <span className={entry.realityTask ? 'done' : ''}>Reality task</span>
        <span className={entry.movement ? 'done' : ''}>Movement</span>
      </div>
      <strong>{minimumProofComplete ? 'Today has proof.' : 'Leave one small proof before the day ends.'}</strong>
    </section>
  )
}
