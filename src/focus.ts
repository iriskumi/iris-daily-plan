import type { FocusSession, FocusStats } from './types'

export function localDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date = new Date()): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const diff = day === 0 ? 6 : day - 1
  start.setDate(start.getDate() - diff)
  return start
}

export function getFocusStats(
  sessions: FocusSession[],
  referenceDate = new Date(),
): FocusStats {
  const today = localDateString(referenceDate)
  const weekStart = startOfWeek(referenceDate)

  const todaySessions = sessions.filter(session => session.date === today)
  const weekSessions = sessions.filter(session => new Date(`${session.date}T12:00:00`) >= weekStart)

  return {
    todaySessions: todaySessions.length,
    todayMinutes: todaySessions.reduce((sum, session) => sum + session.focusMinutes, 0),
    weekSessions: weekSessions.length,
    weekMinutes: weekSessions.reduce((sum, session) => sum + session.focusMinutes, 0),
  }
}

export function focusGardenStage(sessionCount: number): {
  label: string
  icon: string
  note: string
} {
  if (sessionCount <= 0) {
    return { label: 'quiet soil', icon: '·', note: 'Start one focus session to plant a seed.' }
  }
  if (sessionCount === 1) {
    return { label: 'seed', icon: '○', note: 'One small seed planted today.' }
  }
  if (sessionCount <= 3) {
    return { label: 'small plant', icon: '♧', note: 'A small focus plant is growing.' }
  }
  if (sessionCount <= 5) {
    return { label: 'tree', icon: '♢', note: 'Your focus tree has taken shape.' }
  }
  return { label: 'mini forest', icon: '⋯', note: 'A quiet little forest for today.' }
}

export function formatFocusStatsMarkdown(stats: FocusStats): string {
  return [
    '## Focus Garden',
    `- Today: ${stats.todaySessions} session${stats.todaySessions === 1 ? '' : 's'} / ${stats.todayMinutes} min`,
    `- This week: ${stats.weekSessions} session${stats.weekSessions === 1 ? '' : 's'} / ${stats.weekMinutes} min`,
  ].join('\n')
}
