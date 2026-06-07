import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import type { DailyCheckin as DailyCheckinType, DayType, EnergyLevel } from '../types'
import { loadCheckin, loadSettings, saveCheckin } from '../storage'

const DAY_TYPES: { id: DayType; emoji: string; label: string; commitments: string }[] = [
  { id: 'normal', emoji: '☀️', label: 'Normal Day', commitments: '' },
  {
    id: 'evening-class',
    emoji: '🎓',
    label: 'Evening Class (Tue/Thu)',
    commitments: 'Holmesglen class 5:30pm–9:00pm',
  },
  {
    id: 'saturday-class',
    emoji: '💻',
    label: 'Saturday Class',
    commitments: 'Holmesglen online class 9:00am–5:30pm',
  },
  {
    id: 'work-shift',
    emoji: '🏫',
    label: 'Work Shift Day',
    commitments: 'Work shift at Holmesglen (check roster)',
  },
  { id: 'low-energy', emoji: '🌙', label: 'Low-Energy Day', commitments: '' },
  { id: 'admin-catchup', emoji: '📋', label: 'Admin Catch-Up', commitments: '' },
]

function todayString() {
  return new Date().toISOString().split('T')[0]
}

function defaultCheckin(): DailyCheckinType {
  const settings = loadSettings()
  return {
    date: todayString(),
    dayType: 'normal',
    wakeUpTime: '07:30',
    sleepTarget: settings.defaultSleepTarget,
    energyLevel: 'medium',
    availableFocusTime: '3–4 hours',
    fixedCommitments: '',
    planningInstructions: '',
    notes: '',
  }
}

interface Props {
  onGenerate: () => void
}

export default function DailyCheckin({ onGenerate }: Props) {
  const [checkin, setCheckin] = useState<DailyCheckinType>(() => {
    const saved = loadCheckin()
    if (saved) return { ...defaultCheckin(), ...saved, date: todayString() }
    return defaultCheckin()
  })

  useEffect(() => {
    saveCheckin(checkin)
  }, [checkin])

  function set<K extends keyof DailyCheckinType>(key: K, value: DailyCheckinType[K]) {
    setCheckin(prev => ({ ...prev, [key]: value }))
  }

  function handleDayType(dt: DayType) {
    const match = DAY_TYPES.find(d => d.id === dt)
    setCheckin(prev => ({
      ...prev,
      dayType: dt,
      fixedCommitments: match?.commitments ?? prev.fixedCommitments,
    }))
  }

  const energyOptions: { value: EnergyLevel; label: string; desc: string }[] = [
    { value: 'low', label: 'Low', desc: 'Foggy, tired, need rest' },
    { value: 'medium', label: 'Medium', desc: 'Functional, steady pace' },
    { value: 'high', label: 'High', desc: 'Sharp, ready to push' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Daily Check-in</h2>
        <p className="page-subtitle">
          Tell me about today so I can build a realistic plan for you.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <span className="step-indicator">Step 1/4</span>
            <span className="card-title">What kind of day is today?</span>
          </div>
        </div>
        <div className="day-type-grid">
          {DAY_TYPES.map(dt => (
            <button
              key={dt.id}
              className={`day-type-card ${checkin.dayType === dt.id ? 'selected' : ''}`}
              onClick={() => handleDayType(dt.id)}
            >
              <span className="dtc-emoji">{dt.emoji}</span>
              <span className="dtc-label">{dt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-1">
        <div className="card-header">
          <div>
            <span className="step-indicator">Step 2/4</span>
            <span className="card-title">Energy & Time</span>
          </div>
        </div>

        <div className="form-group">
          <label>Energy level right now</label>
          <div className="btn-group">
            {energyOptions.map(e => (
              <button
                key={e.value}
                className={`energy-option ${checkin.energyLevel === e.value ? `selected-${e.value}` : ''}`}
                onClick={() => set('energyLevel', e.value)}
              >
                <span className="energy-option-label">{e.label}</span>
                <span className="energy-option-desc">{e.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Wake-up time</label>
            <input
              type="time"
              value={checkin.wakeUpTime}
              onChange={e => set('wakeUpTime', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Sleep target</label>
            <input
              type="time"
              value={checkin.sleepTarget}
              onChange={e => set('sleepTarget', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card mt-1">
        <div className="card-header">
          <div>
            <span className="step-indicator">Step 3/4</span>
            <span className="card-title">Today's Constraints</span>
          </div>
        </div>

        <div className="form-group">
          <label>Available focus time</label>
          <input
            type="text"
            placeholder="e.g. 3 hours, all afternoon, only mornings"
            value={checkin.availableFocusTime}
            onChange={e => set('availableFocusTime', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Fixed commitments today</label>
          <input
            type="text"
            placeholder="Classes, shifts, appointments, calls…"
            value={checkin.fixedCommitments}
            onChange={e => set('fixedCommitments', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Planning instructions</label>
          <textarea
            placeholder="e.g. Keep today light, prioritise Cybersecurity assessment, no deep work after 7pm, bills first"
            value={checkin.planningInstructions}
            onChange={e => set('planningInstructions', e.target.value)}
            style={{ minHeight: 70 }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <div className="step-indicator step-indicator-inline">Step 4/4</div>
          <label>Notes (body, mood, anything relevant)</label>
          <textarea
            placeholder="Feeling off, bad sleep, anxious about assessment, etc. This shapes the plan."
            value={checkin.notes}
            onChange={e => set('notes', e.target.value)}
            style={{ minHeight: 70 }}
          />
        </div>
      </div>

      <button className="btn-generate" onClick={onGenerate}>
        <Zap />
        Generate Today's Plan
      </button>

      <p
        className="text-xs text-muted"
        style={{ textAlign: 'center', marginTop: '0.6rem', lineHeight: 1.5 }}
      >
        Your check-in is saved automatically. Add tasks, work leads, and bills first for a
        better plan.
      </p>
    </div>
  )
}
