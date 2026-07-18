interface WeekBarDay {
  key: string
  label: string
  value: number
  isToday?: boolean
}

interface WeekBarsProps {
  days: WeekBarDay[]
  unit?: string
  maxValue?: number
  className?: string
}

export default function WeekBars({ days, unit = '', maxValue, className = '' }: WeekBarsProps) {
  const peak = maxValue ?? Math.max(1, ...days.map(day => day.value))
  return (
    <div className={`week-bars ${className}`.trim()} aria-hidden="true">
      {days.map(day => {
        const height = day.value > 0 ? Math.max(12, Math.round((day.value / peak) * 100)) : 4
        return (
          <div key={day.key} className={`week-bar-col ${day.isToday ? 'today' : ''}`}>
            <div className="week-bar-track">
              <span className="week-bar-fill" style={{ height: `${height}%` }} title={`${day.value}${unit}`} />
            </div>
            <small>{day.label}</small>
          </div>
        )
      })}
    </div>
  )
}

export function lastSevenDayKeys(endDate = new Date()): string[] {
  const keys: string[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(endDate)
    date.setDate(endDate.getDate() - offset)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    keys.push(`${y}-${m}-${d}`)
  }
  return keys
}

export function weekdayLabel(dateKey: string, todayKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`)
  if (dateKey === todayKey) return 'Today'
  return date.toLocaleDateString('en-AU', { weekday: 'narrow' })
}
