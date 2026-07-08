import { useEffect, useMemo, useState } from 'react'
import { Copy, Plus } from 'lucide-react'
import { clearActiveSession, startActiveSession } from '../activeSessionStore'
import { getLocalDateKey } from '../focus'
import {
  addExerciseEntry,
  exerciseStats,
  EXERCISE_ENERGY_AFTER,
  EXERCISE_ENERGY_BEFORE,
  EXERCISE_INTENSITIES,
  loadExerciseLog,
  MONTHLY_MOVEMENT_CHALLENGES,
  MOVEMENT_TYPES,
  movementMarkdown,
  type ExerciseLogEntry,
} from '../exerciseStorage'

const WEEKLY_PLAN = [
  ['Monday', 'Holmesglen Reserve walk 30 min + Strength A 20 min'],
  ['Tuesday', 'K-pop Day · Dance 30 min · just move and enjoy'],
  ['Wednesday', 'Holmesglen Reserve walk/jog · 3 min walk + 2 min jog × 6'],
  ['Thursday', 'Strength B · 20–30 min'],
  ['Friday', 'Dance Day · Hip-hop / K-pop / dance workout'],
  ['Saturday', 'Holmesglen Reserve 40–60 min walk · podcast/audiobook allowed'],
  ['Sunday', 'Recovery · stretch · acupressure mat · easy 20 min walk'],
]

const STRENGTH_A = ['Goblet Squat with 6kg kettlebell: 3×10', 'Romanian Deadlift: 3×10', 'Knee push-up: 3 sets', 'Single Arm Row with kettlebell: 3×10', 'Plank: 30 sec × 3']
const STRENGTH_B = ['Reverse Lunge: 3×10', 'Hip Bridge: 3×15', 'Shoulder Press with 2kg dumbbells: 3×12', 'Dead Bug: 3 sets', 'Side Plank: 2 sets']

const initialDraft = {
  date: getLocalDateKey(),
  movementType: 'Walk',
  durationMinutes: 10,
  intensity: 'gentle',
  energyBefore: 'medium',
  energyAfter: 'same',
  notes: '',
}

export default function ExerciseTab() {
  const [store, setStore] = useState(() => loadExerciseLog())
  const [draft, setDraft] = useState(initialDraft)
  const [message, setMessage] = useState('')
  const stats = useMemo(() => exerciseStats(store.entries), [store.entries])
  const monthKey = getLocalDateKey().slice(0, 7)
  const challenge = MONTHLY_MOVEMENT_CHALLENGES[monthKey] ?? MONTHLY_MOVEMENT_CHALLENGES['2026-07']

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    const target = sessionStorage.getItem('iris-exercise-focus-target')
    if (target !== 'movement-log') return
    sessionStorage.removeItem('iris-exercise-focus-target')
    window.setTimeout(() => {
      document.getElementById('exercise-movement-log')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 80)
  }, [])

  function saveMovement() {
    startActiveSession({
      origin: 'exercise',
      kind: 'exercise',
      category: draft.movementType,
      title: `${draft.movementType} movement`,
      startedAt: new Date().toISOString(),
      plannedMinutes: draft.durationMinutes,
      targetTab: 'exercise',
      status: 'active',
    })
    const result = addExerciseEntry(draft, store)
    setStore(result.store)
    setDraft({ ...initialDraft, date: getLocalDateKey() })
    setMessage('Movement saved. 不要连续两天缺席。')
    clearActiveSession()
  }

  async function copyMovement(entry?: ExerciseLogEntry) {
    const target = entry ?? store.entries[0]
    if (!target) {
      setMessage('Save one movement first.')
      return
    }
    await navigator.clipboard.writeText(movementMarkdown(target))
    setMessage('Copied movement summary as Markdown.')
  }

  return (
    <div className="page exercise-tab-page">
      <div className="page-header">
        <h2 className="page-title">Exercise</h2>
        <p className="page-subtitle">Iris Movement System · Never miss twice.</p>
      </div>

      <section className="life-system-card movement-mission-card">
        <div className="section-label">Iris Movement System</div>
        <h3>目标不是减肥，也不是三个月练出马甲线。</h3>
        <p>目标是把身体恢复成能够支撑未来 5–10 年学习、工作、英语和 AI 项目的状态。</p>
        <p>运动是 Life System 的一部分，不是另一个用来责备自己的任务。</p>
      </section>

      <section className="life-stat-grid">
        <div><strong>{stats.todayMinutes}</strong><span>today min</span></div>
        <div><strong>{stats.thisWeekMinutes}</strong><span>week min</span></div>
        <div><strong>{stats.daysMovedThisWeek}</strong><span>days moved</span></div>
        <div><strong>{stats.monthlyChallengeProgress}</strong><span>monthly 10m days</span></div>
      </section>

      <section className="life-system-card" id="exercise-movement-log">
        <div className="life-card-heading">
          <div>
            <div className="section-label">Never miss twice</div>
            <h3>{stats.neverMissTwiceStatus}</h3>
            <p>Last movement: {stats.lastMovementDate || 'not logged yet'}</p>
          </div>
          <button className="btn-secondary" type="button" onClick={() => copyMovement()}><Copy size={14} />Copy Markdown</button>
        </div>
      </section>

      <section className="life-system-card">
        <div className="section-label">Monthly challenge</div>
        <h3>{challenge.title}</h3>
        <p>{challenge.goal}</p>
      </section>

      <section className="life-system-card">
        <div className="life-card-heading">
          <div>
            <div className="section-label">Exercise check-in</div>
            <h3>Save today’s movement</h3>
          </div>
          <button className="btn-primary" type="button" onClick={saveMovement}><Plus size={14} />Save movement</button>
        </div>
        <div className="life-form-grid">
          <label className="life-field">Date<input type="date" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
          <label className="life-field">Movement<select value={draft.movementType} onChange={event => setDraft({ ...draft, movementType: event.target.value })}>{MOVEMENT_TYPES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="life-field">Minutes<input type="number" min="1" value={draft.durationMinutes} onChange={event => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /></label>
          <label className="life-field">Intensity<select value={draft.intensity} onChange={event => setDraft({ ...draft, intensity: event.target.value })}>{EXERCISE_INTENSITIES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="life-field">Energy before<select value={draft.energyBefore} onChange={event => setDraft({ ...draft, energyBefore: event.target.value })}>{EXERCISE_ENERGY_BEFORE.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="life-field">Energy after<select value={draft.energyAfter} onChange={event => setDraft({ ...draft, energyAfter: event.target.value })}>{EXERCISE_ENERGY_AFTER.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="life-field wide">Notes<textarea value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="One line is enough." /></label>
        </div>
      </section>

      <section className="life-system-card">
        <div className="section-label">Weekly movement plan</div>
        <div className="life-card-list">
          {WEEKLY_PLAN.map(([day, plan]) => <article className="life-mini-card" key={day}><strong>{day}</strong><span>{plan}</span></article>)}
        </div>
      </section>

      <section className="life-system-card">
        <div className="recommendation-grid">
          <div className="recommendation-card"><h3>Strength A</h3><ul>{STRENGTH_A.map(item => <li key={item}>{item}</li>)}</ul></div>
          <div className="recommendation-card"><h3>Strength B</h3><ul>{STRENGTH_B.map(item => <li key={item}>{item}</li>)}</ul></div>
          <div className="recommendation-card"><h3>Morning Walk Reset</h3><ol><li>Wake up</li><li>Drink water</li><li>Holmesglen Reserve 20–30 min</li><li>Shower</li><li>Breakfast</li><li>Open Iris Daily Hub</li><li>Start first deep work / study task</li></ol></div>
        </div>
      </section>
      {message && <div className="start-now-message">{message}</div>}
    </div>
  )
}
