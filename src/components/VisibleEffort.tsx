import { getLocalDateKey } from '../focus'
import type { StartNowRecord } from '../startNowTypes'

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function effortType(record: StartNowRecord) {
  if (record.actionType === 'Move Body') return 'Body'
  if (record.actionType === 'Before I Spiral') return 'Reset'
  if (record.actionType === 'Work / Resume') return 'Career'
  return record.actionType
}

function amountLabel(record: StartNowRecord) {
  if (record.reps) return `${record.reps} reps`
  if (record.points) return `+${record.points} pts`
  if (record.completedMinutes || record.durationMinutes) return `${record.completedMinutes ?? record.durationMinutes} min`
  return 'done'
}

function recordMark(record: StartNowRecord) {
  if (record.actionType === 'English') return '●'
  if (record.actionType === 'Move Body') return record.reps ? '|||||' : '∥'
  if (record.actionType === 'Reset' || record.actionType === 'Before I Spiral') return '✦'
  if (record.actionType === 'Study' || record.actionType === 'Project') return '▰'
  return '▱'
}

function effortClass(record: StartNowRecord) {
  return `visible-effort-${record.actionType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function englishPoints(record: StartNowRecord) {
  if (record.actionType !== 'English') return 0
  if (record.points) return record.points
  if (record.completedMinutes || record.durationMinutes) {
    return Math.max(1, Math.round((record.completedMinutes ?? record.durationMinutes ?? 0) / 5))
  }
  return 0
}

export function VisibleEffortTile({ record }: { record: StartNowRecord }) {
  return (
    <article className={`visible-effort-tile ${effortClass(record)}`}>
      <span>{effortType(record)}</span>
      <strong>{amountLabel(record)}</strong>
      {record.tinyWin && <small>{record.tinyWin}</small>}
      <em>{timeLabel(record.completedAt)}</em>
    </article>
  )
}

export function EffortReceipt({ record }: { record: StartNowRecord }) {
  return (
    <section className="effort-receipt" aria-label="Effort receipt">
      <div className="section-label">Effort Receipt</div>
      <h3>{record.contribution || `${effortType(record)} Sprint`}</h3>
      <strong>{amountLabel(record)}</strong>
      {record.tinyWin && <p>Tiny win: {record.tinyWin}</p>}
      <small>Today counted. One small tile added.</small>
    </section>
  )
}

export function VisibleEffortStrip({ records }: { records: StartNowRecord[] }) {
  const visible = records.slice(0, 10)
  const englishBeads = Math.min(24, records.reduce((sum, record) => sum + englishPoints(record), 0))
  const bodyTallies = Math.min(20, records.reduce((sum, record) => sum + (record.actionType === 'Move Body' ? (record.reps ?? record.completedMinutes ?? 1) : 0), 0))
  const studyTiles = records.filter(record => record.actionType === 'Study' || record.actionType === 'Project' || record.actionType === 'Work / Resume').length

  return (
    <section className="visible-effort-strip-card" aria-label="Visible effort today">
      <div className="visible-effort-strip-header">
        <div>
          <div className="section-label">Today’s traces</div>
          <h3>{records.length > 0 ? '今天不是空白页。' : '小痕迹也算数。'}</h3>
        </div>
        <span>{records.length} tile{records.length === 1 ? '' : 's'}</span>
      </div>

      <div className="visible-effort-marks" aria-label="Effort marks">
        <div><span>Study</span><strong>{'▰'.repeat(Math.min(8, studyTiles)) || '·'}</strong></div>
        <div><span>English</span><strong className="english-beads">{Array.from({ length: englishBeads || 1 }, (_, index) => <i key={index} className={englishBeads ? '' : 'empty'} />)}</strong></div>
        <div><span>Body</span><strong>{bodyTallies ? '|'.repeat(bodyTallies) : '·'}</strong></div>
        <div><span>Reset</span><strong>{records.some(record => record.actionType === 'Reset' || record.actionType === 'Before I Spiral') ? '✦' : '·'}</strong></div>
      </div>

      <div className="visible-effort-tile-row">
        {visible.length === 0 ? (
          <p>Complete one tiny action to add the first trace.</p>
        ) : visible.map(record => <VisibleEffortTile key={record.id} record={record} />)}
      </div>
    </section>
  )
}

export function WeeklyEffortWall({ records }: { records: StartNowRecord[] }) {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const key = getLocalDateKey(date)
    return {
      key,
      label: date.toLocaleDateString('en-AU', { weekday: 'short' }),
      records: records.filter(record => record.date === key),
    }
  })

  return (
    <section className="weekly-effort-wall" aria-label="Weekly effort wall">
      <div className="section-label">This week’s traces</div>
      <h3>不是没进步，是痕迹太轻。</h3>
      <div className="weekly-effort-grid">
        {days.map(day => (
          <article key={day.key}>
            <span>{day.label}</span>
            <div>
              {day.records.length === 0 ? <em>·</em> : day.records.slice(0, 6).map(record => <i key={record.id}>{recordMark(record)}</i>)}
            </div>
            <small>{day.records.map(record => `${effortType(record)} ${amountLabel(record)}`).slice(0, 2).join(' · ') || 'blank page'}</small>
          </article>
        ))}
      </div>
    </section>
  )
}
