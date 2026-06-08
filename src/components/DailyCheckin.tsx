import { useState, useEffect } from 'react'
import { Check, Pencil, Zap } from 'lucide-react'
import type {
  DailyCheckin as DailyCheckinType,
  DayType,
  EnergyLevel,
  GeneratePlanOutcome,
} from '../types'
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
    morningMainTask: '',
    morningSecondaryTask1: '',
    morningSecondaryTask2: '',
    morningSmallLifeTask: '',
    availableFocusTime: '3–4 hours',
    fixedCommitments: '',
    planningInstructions: '',
    notes: '',
  }
}

interface Props {
  onGenerate: () => Promise<GeneratePlanOutcome>
  isGenerating?: boolean
  generationMessage?: string | null
  hasPlan?: boolean
  onViewPlan?: () => void
}

export default function DailyCheckin({
  onGenerate,
  isGenerating = false,
  generationMessage,
  hasPlan = false,
  onViewPlan,
}: Props) {
  const [currentStep, setCurrentStep] = useState(1)
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

  async function handleGenerate() {
    saveCheckin(checkin)
    await onGenerate()
  }

  function handleStepAction() {
    if (currentStep < 4) {
      setCurrentStep(step => step + 1)
      return
    }
    void handleGenerate()
  }

  const energyOptions: { value: EnergyLevel; label: string; desc: string }[] = [
    { value: 'low', label: 'Low', desc: 'Foggy, need rest' },
    { value: 'medium', label: 'Medium', desc: 'Steady pace' },
    { value: 'high', label: 'High', desc: 'Sharp, ready' },
  ]

  const dayTypeLabel = DAY_TYPES.find(day => day.id === checkin.dayType)?.label ?? checkin.dayType
  const steps = [
    { id: 1, label: 'Day type', summary: dayTypeLabel },
    { id: 2, label: 'Energy & time', summary: `${checkin.energyLevel} · ${checkin.wakeUpTime}-${checkin.sleepTarget}` },
    { id: 3, label: 'Morning 1 + 2 + 1', summary: checkin.morningMainTask || 'Main task not set' },
    { id: 4, label: "Today's constraints", summary: checkin.availableFocusTime || 'Focus time not set' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Daily Check-in</h2>
        <p className="page-subtitle">
          Tell me about today so I can build a realistic plan for you.
        </p>
      </div>

      <div className="checkin-stepper">
        {steps.filter(step => step.id <= currentStep).map(step => {
          if (step.id < currentStep) {
            return (
              <button
                key={step.id}
                className="checkin-step-row"
                type="button"
                onClick={() => setCurrentStep(step.id)}
              >
                <Check />
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.summary}</small>
                </span>
                <Pencil />
              </button>
            )
          }

          return (
            <div key={step.id} className="card checkin-step-card">
              <div className="card-header">
                <div>
                  <span className="step-indicator">step {step.id} / 4</span>
                  <span className="card-title">{step.label}</span>
                </div>
              </div>

              {step.id === 1 && (
                <div className="day-type-grid">
                  {DAY_TYPES.map(dt => (
                    <button
                      key={dt.id}
                      className={`day-type-card ${checkin.dayType === dt.id ? 'selected' : ''}`}
                      type="button"
                      onClick={() => handleDayType(dt.id)}
                    >
                      <span className="dtc-emoji">{dt.emoji}</span>
                      <span className="dtc-label">{dt.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {step.id === 2 && (
                <>
                  <div className="form-group">
                    <label>Energy level right now</label>
                    <div className="btn-group">
                      {energyOptions.map(e => (
                        <button
                          key={e.value}
                          className={`energy-option ${checkin.energyLevel === e.value ? `selected-${e.value}` : ''}`}
                          type="button"
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
                </>
              )}

              {step.id === 3 && (
                <>
                  <div className="form-group">
                    <label>1 Main Task</label>
                    <input
                      type="text"
                      placeholder="The one task that matters most today"
                      value={checkin.morningMainTask ?? ''}
                      onChange={e => set('morningMainTask', e.target.value)}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Secondary Task 1</label>
                      <input
                        type="text"
                        placeholder="If time allows"
                        value={checkin.morningSecondaryTask1 ?? ''}
                        onChange={e => set('morningSecondaryTask1', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Secondary Task 2</label>
                      <input
                        type="text"
                        placeholder="If energy allows"
                        value={checkin.morningSecondaryTask2 ?? ''}
                        onChange={e => set('morningSecondaryTask2', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                    <label>1 Small Life Task</label>
                    <input
                      type="text"
                      placeholder="Tiny admin/reset/life task"
                      value={checkin.morningSmallLifeTask ?? ''}
                      onChange={e => set('morningSmallLifeTask', e.target.value)}
                    />
                  </div>
                </>
              )}

              {step.id === 4 && (
                <>
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
                      placeholder="Classes, shifts, appointments, calls..."
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
                    <label>Notes (body, mood, anything relevant)</label>
                    <textarea
                      placeholder="Feeling off, bad sleep, anxious about assessment, etc. This shapes the plan."
                      value={checkin.notes}
                      onChange={e => set('notes', e.target.value)}
                      style={{ minHeight: 70 }}
                    />
                  </div>
                </>
              )}

              <button
                className="btn-generate"
                type="button"
                onClick={handleStepAction}
                disabled={isGenerating}
              >
                <Zap />
                {isGenerating
                  ? 'Generating...'
                  : currentStep === 4
                    ? "Generate Today's Plan →"
                    : 'Next →'}
              </button>
            </div>
          )
        })}
      </div>

      {generationMessage && (
        <div className="generation-status-card">
          <div>{generationMessage}</div>
          {hasPlan && onViewPlan && (
            <button className="btn btn-secondary" onClick={onViewPlan}>
              View Plan
            </button>
          )}
        </div>
      )}

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
