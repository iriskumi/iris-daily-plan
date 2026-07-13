import { useEffect, useState } from 'react'
import { getLocalDateKey } from '../focus'
import { loadIris365Entry, saveIris365Entry } from '../iris365Storage'

export function toTimeInputValue(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const hour = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)))
  const minute = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)))
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

interface DailyRhythmLogProps {
  className?: string
  wakeTime?: string
  sleepTime?: string
  onWakeTimeChange?: (value: string) => void
  onSleepTimeChange?: (value: string) => void
}

export default function DailyRhythmLog({
  className,
  wakeTime: wakeTimeProp,
  sleepTime: sleepTimeProp,
  onWakeTimeChange,
  onSleepTimeChange,
}: DailyRhythmLogProps) {
  const controlled = onWakeTimeChange !== undefined
  const today = getLocalDateKey()
  const [wakeTime, setWakeTime] = useState('')
  const [sleepTime, setSleepTime] = useState('')

  useEffect(() => {
    if (controlled) return
    const entry = loadIris365Entry(today)
    setWakeTime(entry.wakeTime)
    setSleepTime(entry.sleepTime)
  }, [today, controlled])

  const wakeValue = controlled ? (wakeTimeProp ?? '') : wakeTime
  const sleepValue = controlled ? (sleepTimeProp ?? '') : sleepTime

  function persistWake(value: string) {
    if (controlled) {
      onWakeTimeChange?.(value)
      return
    }
    const entry = loadIris365Entry(today)
    setWakeTime(value)
    saveIris365Entry({ ...entry, date: today, wakeTime: value })
  }

  function persistSleep(value: string) {
    if (controlled) {
      onSleepTimeChange?.(value)
      return
    }
    const entry = loadIris365Entry(today)
    setSleepTime(value)
    saveIris365Entry({ ...entry, date: today, sleepTime: value })
  }

  return (
    <section className={['daily-rhythm-log', className].filter(Boolean).join(' ')}>
      <div className="daily-rhythm-log-copy">
        <p className="hub-card-kicker">Daily rhythm</p>
        <p className="hub-support-copy">Log wake and sleep when you know them. Syncs with Iris 365.</p>
      </div>
      <div className="daily-rhythm-grid">
        <label className="daily-rhythm-field">
          <span>Wake</span>
          <input
            type="time"
            value={toTimeInputValue(wakeValue)}
            onChange={event => persistWake(event.target.value)}
          />
        </label>
        <label className="daily-rhythm-field">
          <span>Sleep</span>
          <input
            type="time"
            value={toTimeInputValue(sleepValue)}
            onChange={event => persistSleep(event.target.value)}
          />
        </label>
      </div>
    </section>
  )
}
