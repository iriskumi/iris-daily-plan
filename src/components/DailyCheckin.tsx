import { useState, useEffect } from 'react'
import { Check, GripVertical, Pencil, Plus, Zap } from 'lucide-react'
import type {
  DailyCheckin as DailyCheckinType,
  DayType,
  EnergyLevel,
  GeneratePlanOutcome,
  RankedCheckinTask,
  TaskArea,
} from '../types'
import { loadCheckin, loadSettings, loadTasks, saveCheckin, saveTasks } from '../storage'
import {
  TASK_AREAS,
  categoryFromArea,
  createInboxTask,
  isActiveTask,
  isOldAssessmentTask,
  normalizeArea,
} from '../focusBlocks'

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
    rankedTasks: [],
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

const ESTIMATE_OPTIONS: Array<15 | 25 | 45 | 60> = [15, 25, 45, 60]

function makeRankedRow(
  title: string,
  area: TaskArea,
  orderIndex: number,
  taskId?: string,
  estimatedMinutes: 15 | 25 | 45 | 60 = 25,
): RankedCheckinTask {
  return {
    id: taskId ?? crypto.randomUUID(),
    taskId,
    title,
    area,
    estimatedMinutes,
    orderIndex,
  }
}

function initialRankedTasks(saved?: RankedCheckinTask[]): RankedCheckinTask[] {
  const inboxTasks = loadTasks()
  const activeTaskIds = new Set(inboxTasks.filter(isActiveTask).map(task => task.id))
  if (saved && saved.length > 0) {
    const activeSaved = saved
      .filter(task => !isOldAssessmentTask(task))
      .filter(task => !task.taskId || activeTaskIds.has(task.taskId))
      .map((task, index) => ({ ...task, area: normalizeArea(task.area), orderIndex: index }))
      .sort((a, b) => a.orderIndex - b.orderIndex)
    if (activeSaved.length > 0) return activeSaved
  }
  const activeInboxTasks = inboxTasks.filter(isActiveTask)
  if (activeInboxTasks.length > 0) {
    return activeInboxTasks.slice(0, 6).map((task, index) =>
      makeRankedRow(
        task.title,
        normalizeArea(task.area),
        index,
        task.id,
        task.estimatedMinutes >= 60
          ? 60
          : task.estimatedMinutes >= 45
            ? 45
            : task.estimatedMinutes >= 25
              ? 25
              : 15,
      ),
    )
  }
  return [
    makeRankedRow('', 'Cyber', 0, undefined, 25),
    makeRankedRow('', 'Job', 1, undefined, 25),
    makeRankedRow('', 'Life reset', 2, undefined, 15),
    makeRankedRow('', 'Other', 3, undefined, 25),
    makeRankedRow('', 'Other', 4, undefined, 25),
  ]
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
    const base = saved ? { ...defaultCheckin(), ...saved, date: todayString() } : defaultCheckin()
    return {
      ...base,
      rankedTasks: initialRankedTasks(base.rankedTasks),
    }
  })
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

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
    syncRankedTasksToInbox()
    saveCheckin(checkin)
    await onGenerate()
  }

  function setRankedTasks(updater: (tasks: RankedCheckinTask[]) => RankedCheckinTask[]) {
    setCheckin(prev => {
      const next = updater(prev.rankedTasks ?? []).map((task, index) => ({
        ...task,
        orderIndex: index,
      }))
      return { ...prev, rankedTasks: next }
    })
  }

  function updateRankedTask(id: string, patch: Partial<RankedCheckinTask>) {
    setRankedTasks(tasks => tasks.map(task => task.id === id ? { ...task, ...patch } : task))
  }

  function addRankedTask() {
    setRankedTasks(tasks => [
      ...tasks,
      makeRankedRow('', 'Other', tasks.length, undefined, 25),
    ])
  }

  function moveRankedTask(targetId: string) {
    if (!draggedTaskId || draggedTaskId === targetId) return
    setRankedTasks(tasks => {
      const dragged = tasks.find(task => task.id === draggedTaskId)
      if (!dragged) return tasks
      const withoutDragged = tasks.filter(task => task.id !== draggedTaskId)
      const targetIndex = withoutDragged.findIndex(task => task.id === targetId)
      if (targetIndex < 0) return tasks
      return [
        ...withoutDragged.slice(0, targetIndex),
        dragged,
        ...withoutDragged.slice(targetIndex),
      ]
    })
  }

  function syncRankedTasksToInbox() {
    const rows = (checkin.rankedTasks ?? [])
      .map((task, index) => ({ ...task, orderIndex: index, title: task.title.trim() }))
      .filter(task => task.title)
    if (rows.length === 0) return

    const inboxTasks = loadTasks()
    const existingIds = new Set(inboxTasks.map(task => task.id))
    const createdTaskPairs = rows
      .filter(row => !row.taskId || !existingIds.has(row.taskId))
      .map(row => {
        const task = createInboxTask({
          title: row.title,
          area: normalizeArea(row.area),
          energy: row.estimatedMinutes <= 15 ? 'Low' : row.estimatedMinutes <= 25 ? 'Medium' : 'High',
          mode: row.area === 'Admin' ? 'Admin' : row.area === 'Life reset' ? 'Recovery' : 'Focus',
          estimatedMinutes: row.estimatedMinutes === 60 ? 45 : row.estimatedMinutes as 15 | 25 | 45,
        })
        return [row.id, {
          ...task,
          estimatedMinutes: row.estimatedMinutes,
          pomodoroLength: row.estimatedMinutes,
          category: categoryFromArea(normalizeArea(row.area)),
        }] as const
      })
    const createdTasks = createdTaskPairs.map(([, task]) => task)
    const createdIdMap = new Map(createdTaskPairs.map(([rowId, task]) => [rowId, task.id]))

    const updatedTasks = inboxTasks.map(task => {
      const row = rows.find(item => item.taskId === task.id)
      if (!row) return task
      return {
        ...task,
        title: row.title,
        area: normalizeArea(row.area),
        category: categoryFromArea(normalizeArea(row.area)),
        estimatedMinutes: row.estimatedMinutes,
        pomodoroLength: row.estimatedMinutes,
        updatedAt: new Date().toISOString(),
      }
    })
    saveTasks([...createdTasks, ...updatedTasks])
    if (createdIdMap.size > 0) {
      setCheckin(prev => ({
        ...prev,
        rankedTasks: (prev.rankedTasks ?? []).map(task => ({
          ...task,
          taskId: task.taskId ?? createdIdMap.get(task.id),
        })),
      }))
    }
  }

  function handleStepAction() {
    if (currentStep < 4) {
      if (currentStep === 3) syncRankedTasksToInbox()
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
    { id: 3, label: "Today's to-do", summary: checkin.rankedTasks?.find(task => task.title.trim())?.title || 'Tasks not set' },
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
                  <div className="ranked-task-list">
                    {(checkin.rankedTasks ?? []).map((task, index) => {
                      const isPlaceholder = !task.title.trim()
                      return (
                        <div
                          key={task.id}
                          className={`ranked-task-row ${isPlaceholder ? 'placeholder' : ''}`}
                          draggable
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragOver={event => event.preventDefault()}
                          onDrop={() => moveRankedTask(task.id)}
                          onDragEnd={() => setDraggedTaskId(null)}
                        >
                          <span className="ranked-task-drag" aria-label="Drag to reorder">
                            <GripVertical size={16} />
                          </span>
                          <span className={`ranked-task-badge ${index === 0 ? 'rank-one' : ''}`}>
                            {index + 1}
                          </span>
                          <div className="ranked-task-main">
                            <input
                              value={task.title}
                              onChange={event => updateRankedTask(task.id, { title: event.target.value })}
                              placeholder={
                                index === 0
                                  ? 'Type your most important task'
                                  : index === 1
                                    ? 'Type the next useful task'
                                : 'Type a small task or reset'
                              }
                            />
                            <select
                              className="ranked-task-area-select"
                              value={task.area}
                              onChange={event =>
                                updateRankedTask(task.id, {
                                  area: event.target.value as TaskArea,
                                })
                              }
                              aria-label={`Area for task ${index + 1}`}
                            >
                              {TASK_AREAS.map(area => (
                                <option key={area} value={area}>
                                  {area}
                                </option>
                              ))}
                            </select>
                          </div>
                          <select
                            className="ranked-task-estimate"
                            value={task.estimatedMinutes}
                            onChange={event =>
                              updateRankedTask(task.id, {
                                estimatedMinutes: Number(event.target.value) as 15 | 25 | 45 | 60,
                              })
                            }
                            aria-label={`Estimate for task ${index + 1}`}
                          >
                            {ESTIMATE_OPTIONS.map(minutes => (
                              <option key={minutes} value={minutes}>
                                {minutes} min
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                    <button className="ranked-task-add" type="button" onClick={addRankedTask}>
                      <Plus size={15} />
                      Add a task
                    </button>
                  </div>

                  <div className="ranked-task-footer">
                    <span>Drag to reorder · app will follow your sequence</span>
                    <strong>
                      Total {(checkin.rankedTasks ?? []).reduce((sum, task) => sum + task.estimatedMinutes, 0)} min
                    </strong>
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
                      placeholder="e.g. Keep today light, use only active tasks, no deep work after 7pm, bills first"
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
