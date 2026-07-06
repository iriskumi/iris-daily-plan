import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { getLocalDateKey } from '../focus'
import {
  emptyIris365MomentumEntry,
  getMomentumStreak,
  iris365DayInfo,
  iris365MomentumMarkdown,
  IRIS365_MOMENTUM_END_DATE,
  IRIS365_MOMENTUM_START_DATE,
  loadIris365Momentum,
  MONTHLY_MOMENTUM_PLAN,
  saveIris365MomentumEntry,
} from '../iris365MomentumStorage'

export default function Iris365MomentumTab() {
  const today = getLocalDateKey()
  const [store, setStore] = useState(() => loadIris365Momentum())
  const [entry, setEntry] = useState(() => store.entries[today] ?? emptyIris365MomentumEntry(today))
  const [message, setMessage] = useState('')
  const dayInfo = iris365DayInfo(today)
  const month = MONTHLY_MOMENTUM_PLAN[today.slice(0, 7)] ?? MONTHLY_MOMENTUM_PLAN['2026-07']
  const streaks = useMemo(() => ({
    movement: getMomentumStreak(store.entries, item => item.movementDone, today),
    english: getMomentumStreak(store.entries, item => item.englishOutputDone, today),
    study: getMomentumStreak(store.entries, item => item.studyDone || item.aiOrCourseraDone, today),
    sleep: getMomentumStreak(store.entries, item => item.sleepRhythm === 'on track', today),
  }), [store.entries, today])

  function update<K extends keyof typeof entry>(key: K, value: typeof entry[K]) {
    setEntry(prev => ({ ...prev, [key]: value }))
  }

  function save() {
    setStore(saveIris365MomentumEntry(entry, store))
    setMessage('Iris365 check-in saved. 今天只要往前一点点。')
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(iris365MomentumMarkdown(entry))
    setMessage('Copied Iris365 daily note as Markdown.')
  }

  const neverMissTwice = entry.movementDone || streaks.movement > 0 ? 'On track — never miss twice.' : 'Restart with one small step today.'

  return (
    <div className="page iris365-momentum-page">
      <div className="page-header">
        <h2 className="page-title">Iris365</h2>
        <p className="page-subtitle">不用一下子变很好。今天只要往前一点点。</p>
      </div>

      <section className="life-system-card iris365-overview-card">
        <div>
          <div className="section-label">365 overview</div>
          <h3>Day {dayInfo.dayNumber} / 365</h3>
          <p>365 天不是为了变成完美的人。是为了每天多一点点身体、英语、AI、工作和生活的稳定感。</p>
        </div>
        <div className="life-stat-grid compact">
          <div><strong>{IRIS365_MOMENTUM_START_DATE}</strong><span>start</span></div>
          <div><strong>{IRIS365_MOMENTUM_END_DATE}</strong><span>end</span></div>
          <div><strong>{dayInfo.daysRemaining}</strong><span>days left</span></div>
        </div>
      </section>

      <section className="life-system-card">
        <div className="section-label">Monthly momentum</div>
        <h3>{month.theme}</h3>
        <ul>{month.focus.map(item => <li key={item}>{item}</li>)}</ul>
        <p>{month.reminder}</p>
      </section>

      <section className="life-system-card">
        <div className="life-card-heading">
          <div>
            <div className="section-label">Daily check-in</div>
            <h3>Today’s smallest step</h3>
          </div>
          <button className="btn-primary" type="button" onClick={save}>Save check-in</button>
        </div>
        <div className="life-form-grid">
          <label className="life-field">Sleep rhythm<select value={entry.sleepRhythm} onChange={event => update('sleepRhythm', event.target.value)}><option>on track</option><option>late but okay</option><option>rough</option></select></label>
          <label className="life-field">Mood<select value={entry.mood} onChange={event => update('mood', event.target.value)}><option>low</option><option>okay</option><option>good</option></select></label>
          {[
            ['movementDone', 'Movement'],
            ['studyDone', 'Study/session'],
            ['englishOutputDone', 'English output'],
            ['aiOrCourseraDone', 'AI / Coursera'],
            ['careerOrAdminDone', 'Career / Admin'],
          ].map(([key, label]) => (
            <label className="comfort-checkbox" key={key}>
              <input type="checkbox" checked={Boolean(entry[key as keyof typeof entry])} onChange={event => update(key as keyof typeof entry, event.target.checked as never)} />
              <span>{label}</span>
            </label>
          ))}
          <label className="life-field wide">Smallest win<input value={entry.smallestWin} onChange={event => update('smallestWin', event.target.value)} placeholder="One tiny proof is enough." /></label>
          <label className="life-field wide">Tomorrow restart step<input value={entry.tomorrowRestartStep} onChange={event => update('tomorrowRestartStep', event.target.value)} placeholder="Tomorrow’s smallest restart." /></label>
        </div>
      </section>

      <section className="life-system-card">
        <div className="life-card-heading">
          <div>
            <div className="section-label">Streaks / Never miss twice</div>
            <h3>{neverMissTwice}</h3>
          </div>
          <button className="btn-secondary" type="button" onClick={copyMarkdown}><Copy size={14} />Copy Iris365 note</button>
        </div>
        <div className="life-stat-grid compact">
          <div><strong>{streaks.movement}</strong><span>movement</span></div>
          <div><strong>{streaks.english}</strong><span>English</span></div>
          <div><strong>{streaks.study}</strong><span>study</span></div>
          <div><strong>{streaks.sleep}</strong><span>sleep rhythm</span></div>
        </div>
      </section>

      <section className="life-system-card">
        <div className="section-label">Proof / progress reflection</div>
        <h3>不是没进步，是进步太碎。</h3>
        <p>{entry.smallestWin || 'Save one smallest win today. One tiny proof is enough.'}</p>
      </section>
      {message && <div className="start-now-message">{message}</div>}
    </div>
  )
}
