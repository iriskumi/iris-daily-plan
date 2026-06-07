import type { FocusStats } from '../types'
import { focusGardenStage } from '../focus'

interface Props {
  stats: FocusStats
  compact?: boolean
}

export default function FocusGarden({ stats, compact = false }: Props) {
  const stage = focusGardenStage(stats.todaySessions)

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
      </div>
    </div>
  )
}
