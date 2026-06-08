import type { FocusStats } from '../types'
import { focusGardenStage, localDateString } from '../focus'
import { loadFocusSessions } from '../storage'

interface Props {
  stats: FocusStats
  compact?: boolean
}

export default function FocusGarden({ stats, compact = false }: Props) {
  const stage = focusGardenStage(stats.todaySessions)
  const sessions = loadFocusSessions()
  const weekCounts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = localDateString(date)
    return sessions.filter(session => session.date === key).length
  })
  const maxCount = Math.max(1, ...weekCounts)

  return (
    <div className={`focus-garden ${compact ? 'compact' : ''}`}>
      <div className="focus-garden-visual" aria-hidden="true">
        {stage.icon}
      </div>
      <div className="focus-garden-body">
        <div className="focus-garden-label">{stage.label}</div>
        <div className="focus-garden-note">{stage.note}</div>
        <div className="focus-stats-grid">
          <div>
            <span>{stats.todaySessions}</span>
            <small>today sessions</small>
          </div>
          <div>
            <span>{stats.todayMinutes}</span>
            <small>today min</small>
          </div>
          <div>
            <span>{stats.weekSessions}</span>
            <small>week sessions</small>
          </div>
          <div>
            <span>{stats.weekMinutes}</span>
            <small>week min</small>
          </div>
        </div>
        <div className="focus-sparkline" aria-label="Focus sessions this week">
          {weekCounts.map((count, index) => (
            <span
              key={index}
              style={{ height: `${Math.max(2, Math.round((count / maxCount) * 28))}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
