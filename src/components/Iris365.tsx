import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Leaf, Plus, ShieldCheck, TrendingUp } from 'lucide-react'
import { getLocalDateKey } from '../focus'
import {
  addIris365ProofItem,
  calculateCurrentDayNumber,
  calculateDaysRemaining,
  calculateFoundationScore,
  calculateFoundationStatus,
  calculateIris365Stats,
  determineCurrentPhase,
  emptyIris365WeeklyReview,
  getIris365WeekEntries,
  getIris365WeekStart,
  IRIS_365_END_DATE,
  IRIS_365_HIGH_STIMULUS_PATTERNS,
  IRIS_365_PROOF_CATEGORIES,
  IRIS_365_START_DATE,
  iris365ProgressPercent,
  isBeforeIris365Start,
  isIris365WeeklyReviewDay,
  loadIris365Entry,
  loadIris365Store,
  recentIris365Entries,
  saveIris365Entry,
  saveIris365WeeklyReview,
} from '../iris365Storage'
import type {
  Iris365Entry,
  Iris365HighStimulusPatternKey,
  Iris365HighStimulusPatternStatus,
  Iris365ProofCategory,
  Iris365WeeklyReview,
} from '../iris365Types'

const FOUNDATION_FIELDS: Array<{
  key: 'sleepRhythmProtected' | 'bodyMoved' | 'oneRealThingDone'
  label: string
  hint: string
}> = [
  { key: 'sleepRhythmProtected', label: 'Sleep rhythm protected', hint: 'Protect bedtime, wake rhythm, or recovery window.' },
  { key: 'bodyMoved', label: 'Body moved', hint: 'Walk, stretch, gym, chores, or a five-minute reset.' },
  { key: 'oneRealThingDone', label: 'One real thing done', hint: 'A practical action that makes life, work, study, or health more real.' },
]

const GROWTH_FIELDS: Array<{
  key: 'englishOutput' | 'shadowing' | 'cyberAiProject' | 'jobApplication' | 'workPrep' | 'studyCoursework' | 'lifeAdmin'
  label: string
  hint: string
}> = [
  { key: 'englishOutput', label: 'English output', hint: 'Speaking or original writing, not passive input.' },
  { key: 'shadowing', label: 'Shadowing', hint: 'A small rhythm and pronunciation proof.' },
  { key: 'cyberAiProject', label: 'Cyber / AI project', hint: 'Portfolio, automation, cyber, or AI workflow progress.' },
  { key: 'jobApplication', label: 'Job application', hint: 'Apply, tailor, follow up, or improve a job asset.' },
  { key: 'workPrep', label: 'Work prep', hint: 'Workplace readiness, admin practice, or shift preparation.' },
  { key: 'studyCoursework', label: 'Study / coursework', hint: 'Holmesglen, Coursera, SQL, English, or structured learning.' },
  { key: 'lifeAdmin', label: 'Life admin', hint: 'Bills, documents, appointments, cleaning, or planning.' },
]

const HIGH_STIMULUS_LABELS: Record<Iris365HighStimulusPatternKey, string> = {
  shortDramas: 'Short dramas',
  webNovels: 'Web novels',
  xiaohongshuSocialMedia: 'Xiaohongshu / social media',
  shopping: 'Shopping',
  mobileGames: 'Mobile games',
  other: 'Other',
}

const STIMULUS_STATUS_LABELS: Record<Iris365HighStimulusPatternStatus, string> = {
  'not-used': 'Not used',
  controlled: 'Controlled',
  overused: 'Overused',
}

const FOUNDATION_STATS: Array<[keyof ReturnType<typeof calculateIris365Stats>, string]> = [
  ['totalRecordedDays', 'Days recorded'],
  ['validDays', 'Valid days'],
  ['foundationDays', 'Foundation days'],
  ['sleepRhythmProtectedDays', 'Sleep rhythm'],
  ['movementDays', 'Movement'],
  ['realThingDays', 'Real thing'],
  ['currentStreak', 'Current valid streak'],
  ['bestStreak', 'Best valid streak'],
]

const GROWTH_STATS: Array<[keyof ReturnType<typeof calculateIris365Stats>, string]> = [
  ['englishOutputDays', 'English output'],
  ['shadowingDays', 'Shadowing'],
  ['cyberAiProjectDays', 'Cyber / AI'],
  ['jobApplicationDays', 'Job application'],
  ['studyCourseworkDays', 'Study'],
  ['workPrepDays', 'Work prep'],
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

function foundationPatch(key: 'sleepRhythmProtected' | 'bodyMoved' | 'oneRealThingDone', value: boolean): Partial<Iris365Entry> {
  if (key === 'sleepRhythmProtected') return { sleepRhythmProtected: value, sleepProtected: value }
  if (key === 'bodyMoved') return { bodyMoved: value, movement: value }
  return { oneRealThingDone: value, realityTask: value }
}

function foundationCopy(status: ReturnType<typeof calculateFoundationStatus>): string {
  if (status === 'Foundation day') return 'All three anchors held. Strong base.'
  if (status === 'Valid day') return 'Two anchors held. The day counts.'
  if (status === 'Recovery day') return 'One anchor held. That still matters.'
  return 'Pattern spotted, not failure. Reduce friction and keep the next step small.'
}

function getMainGrowthTask(entry: Iris365Entry): string {
  if (entry.realThingToday.trim()) return entry.realThingToday.trim()
  const match = GROWTH_FIELDS.find(field => entry[field.key])
  return match?.label ?? ''
}

function updateStimulusControlledFlag(patterns: Iris365Entry['highStimulusPatterns']): boolean {
  const statuses = Object.values(patterns)
  return statuses.includes('controlled') && !statuses.includes('overused')
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

  const dayNumber = calculateCurrentDayNumber(IRIS_365_START_DATE, today)
  const daysRemaining = calculateDaysRemaining(IRIS_365_START_DATE, today)
  const preStart = isBeforeIris365Start(today, IRIS_365_START_DATE)
  const phase = determineCurrentPhase(Math.max(1, dayNumber))
  const progress = iris365ProgressPercent(dayNumber)
  const foundationScore = calculateFoundationScore(entry)
  const foundationStatus = calculateFoundationStatus(entry)
  const stats = useMemo(() => calculateIris365Stats(store.entries, today), [store.entries, today])
  const recentEntries = useMemo(() => recentIris365Entries(store.entries, 7), [store.entries])
  const weekStart = getIris365WeekStart(today)
  const weeklyReview = store.weeklyReviews[weekStart] ?? emptyIris365WeeklyReview(weekStart)
  const weekEntries = getIris365WeekEntries(store.entries, weekStart)
  const weeklyStats = calculateIris365Stats(Object.fromEntries(weekEntries.map(item => [item.date, item])), today)
  const filteredProofItems = store.proofItems.filter(item => proofCategoryFilter === 'All' || item.category === proofCategoryFilter)
  const savedToday = Boolean(store.entries[today])

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

  function updateStimulusPattern(key: Iris365HighStimulusPatternKey, status: Iris365HighStimulusPatternStatus) {
    const patterns = {
      ...entry.highStimulusPatterns,
      [key]: status,
    }
    updateEntry({
      highStimulusPatterns: patterns,
      highStimulusControlled: updateStimulusControlledFlag(patterns),
    })
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
      source: 'manual',
      relatedEntryDate: store.entries[today] ? today : undefined,
    }, store))
    setProofDraft({
      category: proofDraft.category,
      title: '',
      description: '',
      linkOrFile: '',
    })
  }

  return (
    <div className="page iris365-page">
      <div className="page-header">
        <div className="section-label">Small daily proof</div>
        <h2 className="page-title">Iris 365</h2>
        <p className="page-subtitle">Build the foundation first. Small daily proof, not perfection.</p>
      </div>

      <section className="iris365-countdown-card">
        <div className="iris365-countdown-main">
          <div className="card-title-row">
            <CalendarDays size={17} />
            <h3>Iris 365</h3>
          </div>
          <p>{preStart ? 'Starts tomorrow' : `Day ${dayNumber} / 365`}</p>
          <strong>{preStart ? 'Get ready: choose your first tiny proof.' : phase.title}</strong>
          <div className="iris365-motto">
            <span>Build the foundation first.</span>
            <span>Small daily proof, not perfection.</span>
          </div>
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
            <small>{phase.title}</small>
          </div>
          <div>
            <span>Day {phase.startDay}-{phase.endDay}</span>
            <small>{phase.focus}</small>
          </div>
        </div>
      </section>

      <section className="iris365-layout">
        <div className="iris365-main-stack">
          <section className="iris365-foundation-card">
            <div className="card-header">
              <div>
                <div className="section-label">Foundation first</div>
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
                <div className={`iris365-foundation-score status-${foundationScore}`}>
                  <span>{foundationScore} / 3</span>
                  <div>
                    <strong>{foundationStatus}</strong>
                    <small>{foundationCopy(foundationStatus)}</small>
                  </div>
                </div>

                <div className="iris365-foundation-grid">
                  {FOUNDATION_FIELDS.map(item => (
                    <label key={item.key} className="iris365-check-row iris365-foundation-row">
                      <input
                        type="checkbox"
                        checked={entry[item.key]}
                        onChange={event => updateEntry(foundationPatch(item.key, event.target.checked))}
                      />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </section>

          {!preStart && (
            <>
              <section className="iris365-growth-card">
                <div className="card-header">
                  <div>
                    <div className="section-label">Growth tracking</div>
                    <div className="card-title">What supported today’s real thing?</div>
                  </div>
                </div>
                <div className="iris365-growth-grid">
                  {GROWTH_FIELDS.map(item => (
                    <label key={item.key} className="iris365-check-row">
                      <input
                        type="checkbox"
                        checked={entry[item.key]}
                        onChange={event => updateEntry({ [item.key]: event.target.checked })}
                      />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <label className="iris365-single-field">
                  What was the real thing today?
                  <input
                    value={entry.realThingToday}
                    onChange={event => updateEntry({ realThingToday: event.target.value })}
                    placeholder="e.g. Finished one Coursera lesson, sent one application, fixed one bug"
                  />
                </label>
              </section>

              <section className="iris365-details-card">
                <div className="card-header">
                  <div>
                    <div className="section-label">Daily details</div>
                    <div className="card-title">Optional context</div>
                  </div>
                </div>
                <div className="iris365-detail-grid">
                  <label>
                    Sleep time
                    <input value={entry.sleepTime} onChange={event => updateEntry({ sleepTime: event.target.value })} placeholder="23:00" />
                  </label>
                  <label>
                    Wake time
                    <input value={entry.wakeTime} onChange={event => updateEntry({ wakeTime: event.target.value })} placeholder="07:30" />
                  </label>
                  <label>
                    Movement type
                    <input value={entry.movementType} onChange={event => updateEntry({ movementType: event.target.value })} placeholder="Walk, stretch, gym, chores" />
                  </label>
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
              </section>

              <section className="iris365-stimulus-card">
                <div className="card-header">
                  <div>
                    <div className="section-label">Pattern spotted, not failure</div>
                    <div className="card-title">High-stimulus pattern check</div>
                  </div>
                </div>
                <div className="iris365-stimulus-list">
                  {IRIS_365_HIGH_STIMULUS_PATTERNS.map(key => (
                    <div key={key} className="iris365-stimulus-row">
                      <span>{HIGH_STIMULUS_LABELS[key]}</span>
                      <div>
                        {(Object.keys(STIMULUS_STATUS_LABELS) as Iris365HighStimulusPatternStatus[]).map(status => (
                          <button
                            key={status}
                            type="button"
                            className={entry.highStimulusPatterns[key] === status ? 'active' : ''}
                            onClick={() => updateStimulusPattern(key, status)}
                          >
                            {STIMULUS_STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <label className="iris365-single-field">
                  What triggered it?
                  <input
                    value={entry.highStimulusTrigger}
                    onChange={event => updateEntry({ highStimulusTrigger: event.target.value })}
                    placeholder="Stress, boredom, transition gap, tired evening..."
                  />
                </label>
              </section>
            </>
          )}
        </div>

        <aside className="iris365-stats-card">
          <div className="card-title-row">
            <TrendingUp size={16} />
            <h3>Foundation stats</h3>
          </div>
          <div className="iris365-stat-grid">
            {FOUNDATION_STATS.map(([key, label]) => (
              <div key={key}>
                <span>{stats[key]}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <div className="card-title-row iris365-growth-stat-title">
            <ShieldCheck size={16} />
            <h3>Growth stats</h3>
          </div>
          <div className="iris365-stat-grid">
            {GROWTH_STATS.map(([key, label]) => (
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
            <span>Real thing {weeklyStats.realThingDays}</span>
            <span>Movement {weeklyStats.movementDays}</span>
            <span>Stimulus {weeklyStats.highStimulusControlledDays}</span>
            <span>Sleep {weeklyStats.sleepRhythmProtectedDays}</span>
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
            {recentEntries.map(item => {
              const score = calculateFoundationScore(item)
              const status = calculateFoundationStatus(item)
              const mainGrowthTask = getMainGrowthTask(item)
              return (
                <div key={item.date} className="iris365-recent-row">
                  <div>
                    <strong>{formatShortDate(item.date)} · Day {calculateCurrentDayNumber(IRIS_365_START_DATE, item.date)}</strong>
                    <small>{mainGrowthTask || item.tinyWin || 'Small daily proof logged.'}</small>
                    {item.tinyWin && mainGrowthTask && <small>Tiny win: {item.tinyWin}</small>}
                  </div>
                  <div className="iris365-recent-pills">
                    <span><CheckCircle2 size={12} /> {score} / 3</span>
                    <span>{status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="iris365-empty-copy">No entries yet. Sleep, movement, or one real thing is enough to begin.</p>
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

export function Iris365HomeSummary() {
  const today = getLocalDateKey()
  const store = loadIris365Store()
  const entry = loadIris365Entry(today, store)
  const dayNumber = calculateCurrentDayNumber(IRIS_365_START_DATE, today)
  const preStart = isBeforeIris365Start(today, IRIS_365_START_DATE)
  const phase = determineCurrentPhase(Math.max(1, dayNumber))
  const daysRemaining = calculateDaysRemaining(IRIS_365_START_DATE, today)
  const minimumProofComplete = entry.englishOutput && entry.oneRealThingDone && entry.bodyMoved

  return (
    <section className="iris365-home-card">
      <div>
        <div className="section-label">Iris 365</div>
        <h3>{preStart ? 'Starts tomorrow' : `Day ${dayNumber} / 365`}</h3>
        <p>{preStart ? 'Get ready: choose your first tiny proof.' : `${daysRemaining} days left · ${phase.title}`}</p>
      </div>
      <div className="iris365-home-proof">
        <span className={entry.englishOutput ? 'done' : ''}>English output</span>
        <span className={entry.oneRealThingDone ? 'done' : ''}>Reality task</span>
        <span className={entry.bodyMoved ? 'done' : ''}>Movement</span>
      </div>
      <strong>{minimumProofComplete ? 'Today has proof.' : 'Leave one small proof before the day ends.'}</strong>
    </section>
  )
}
