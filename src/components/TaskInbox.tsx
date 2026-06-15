import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, Timer } from 'lucide-react'
import type {
  Task,
  TaskCategory,
  TaskArea,
  TaskEnergy,
  TaskMode,
  TaskStatus,
} from '../types'
import { loadTasks, saveTasks } from '../storage'
import { getDaysUntil } from '../planner'
import PomodoroTimer from './PomodoroTimer'
import {
  TASK_AREAS,
  TASK_ENERGIES,
  TASK_MODES,
  TASK_STATUSES,
  categoryFromArea,
  createInboxTask,
  tinyActionForArea,
} from '../focusBlocks'

const CATEGORIES: { id: TaskCategory; label: string }[] = [
  { id: 'assessment', label: 'Assessment' },
  { id: 'cyber-study', label: 'Cyber Study' },
  { id: 'job-search', label: 'Job Search' },
  { id: 'work-shift', label: 'Work / Holmesglen' },
  { id: 'admin-life', label: 'Admin / Life' },
  { id: 'ai', label: 'AI' },
  { id: 'english-practice', label: 'English Practice' },
  { id: 'japanese-practice', label: 'Japanese Practice' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'finance-bills', label: 'Finance / Bills' },
  { id: 'consulting-freelance', label: 'Consulting / Freelance' },
]

function categoryLabel(id: TaskCategory) {
  return CATEGORIES.find(c => c.id === id)?.label ?? id
}

function deadlineTag(deadline?: string): { text: string; cls: string } | null {
  if (!deadline) return null
  const days = getDaysUntil(deadline)
  if (days < 0) return { text: `Overdue (${Math.abs(days)}d)`, cls: 'deadline-urgent' }
  if (days === 0) return { text: 'Due today', cls: 'deadline-urgent' }
  if (days <= 3) return { text: `${days}d left`, cls: 'deadline-soon' }
  return {
    text: new Date(deadline + 'T12:00:00').toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    }),
    cls: '',
  }
}

type TaskFormData = Pick<
  Task,
  'title' | 'area' | 'energy' | 'mode' | 'estimatedMinutes' | 'nextTinyAction' | 'status'
> & {
  deadline?: string
}

const emptyForm = (): TaskFormData => ({
  title: '',
  area: 'Cyber',
  energy: 'Medium',
  mode: 'Focus',
  estimatedMinutes: 25,
  nextTinyAction: '',
  status: 'Inbox',
  deadline: undefined,
})

interface TaskFormProps {
  initial?: Partial<TaskFormData>
  onSave: (data: TaskFormData) => void
  onCancel: () => void
}

function TaskForm({ initial, onSave, onCancel }: TaskFormProps) {
  const [form, setForm] = useState({ ...emptyForm(), ...initial })

  function f<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function handleAreaChange(area: TaskArea) {
    setForm(prev => ({
      ...prev,
      area,
      mode: area === 'Admin' ? 'Admin' : area === 'Life reset' ? 'Recovery' : prev.mode,
      nextTinyAction: prev.nextTinyAction?.trim() ? prev.nextTinyAction : tinyActionForArea(area),
    }))
  }

  const triBtn = <V extends string>(
    cur: V,
    opts: V[],
    labels: string[],
    onChange: (v: V) => void,
  ) =>
    opts.map((o, i) => (
      <button
        key={o}
        type="button"
            className={`btn-option ${cur === o ? 'selected' : ''}`}
        onClick={() => onChange(o)}
      >
        {labels[i]}
      </button>
    ))

  return (
    <div className="inline-form">
      <div className="form-title">
        <Plus size={14} />
        {initial?.title ? 'Edit Task' : 'Add Task'}
      </div>

      <div className="form-group">
        <label>Title *</label>
        <input
          autoFocus
          placeholder="What needs doing?"
          value={form.title}
          onChange={e => f('title', e.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Area</label>
          <select
            value={form.area}
            onChange={e => handleAreaChange(e.target.value as TaskArea)}
          >
            {TASK_AREAS.map(area => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Deadline (optional)</label>
          <input
            type="date"
            value={form.deadline ?? ''}
            onChange={e => f('deadline', e.target.value || undefined)}
          />
        </div>
      </div>

      <div className="form-row mt-1">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Est. time (minutes)</label>
          <div className="btn-group">
            {[5, 15, 25, 45].map(minutes => (
              <button
                key={minutes}
                type="button"
                className={`btn-option ${form.estimatedMinutes === minutes ? 'selected' : ''}`}
                onClick={() => f('estimatedMinutes', minutes as 5 | 15 | 25 | 45)}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Mode</label>
          <div className="btn-group">
            {triBtn(
              form.mode ?? 'Focus',
              TASK_MODES,
              TASK_MODES,
              v => f('mode', v as TaskMode),
            )}
          </div>
        </div>
      </div>

      <div className="form-group mt-1">
        <label>Energy</label>
        <div className="btn-group">
          {triBtn(
            form.energy ?? 'Medium',
            TASK_ENERGIES,
            TASK_ENERGIES,
            v => f('energy', v as TaskEnergy),
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Status</label>
        <div className="btn-group">
          {triBtn(
            form.status ?? 'Inbox',
            TASK_STATUSES,
            TASK_STATUSES,
            v => f('status', v as TaskStatus),
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Next tiny action</label>
        <input
          placeholder={tinyActionForArea(form.area ?? 'Other')}
          value={form.nextTinyAction ?? ''}
          onChange={e => f('nextTinyAction', e.target.value)}
        />
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!form.title.trim()) return
            onSave({
              ...form,
              area: form.area ?? 'Other',
              energy: form.energy ?? 'Medium',
              mode: form.mode ?? 'Focus',
              status: form.status ?? 'Inbox',
              estimatedMinutes: form.estimatedMinutes as 5 | 15 | 25 | 45,
              nextTinyAction: form.nextTinyAction?.trim() || tinyActionForArea(form.area ?? 'Other'),
            })
          }}
        >
          <Check size={14} />
          Save
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  )
}

const ALL_FILTER = 'all'
type Filter = TaskCategory | 'all' | 'done'

export default function TaskInbox() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [filter, setFilter] = useState<Filter>(ALL_FILTER)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [timerOpenId, setTimerOpenId] = useState<string | null>(null)

  function persist(updated: Task[]) {
    setTasks(updated)
    saveTasks(updated)
  }

  function addTask(data: TaskFormData) {
    const task = createInboxTask({
      title: data.title,
      area: data.area ?? 'Other',
      energy: data.energy ?? 'Medium',
      mode: data.mode ?? 'Focus',
      estimatedMinutes: data.estimatedMinutes as 5 | 15 | 25 | 45,
      nextTinyAction: data.nextTinyAction,
    })
    task.status = data.status ?? 'Inbox'
    task.deadline = data.deadline
    task.done = task.status === 'Done'
    persist([task, ...tasks])
    setShowForm(false)
  }

  function updateTask(id: string, data: TaskFormData) {
    persist(tasks.map(t => {
      if (t.id !== id) return t
      const nextTinyAction = data.nextTinyAction?.trim() || tinyActionForArea(data.area ?? 'Other')
      return {
        ...t,
        ...data,
        area: data.area ?? 'Other',
        energy: data.energy ?? 'Medium',
        mode: data.mode ?? 'Focus',
        status: data.status ?? 'Inbox',
        estimatedMinutes: data.estimatedMinutes as 5 | 15 | 25 | 45,
        category: categoryFromArea(data.area ?? 'Other'),
        nextTinyAction,
        nextAction: nextTinyAction,
        pomodoroEnabled: data.mode === 'Focus',
        pomodoroLength: data.estimatedMinutes,
        breakLength: Number(data.estimatedMinutes) >= 25 ? 10 : 5,
        done: data.status === 'Done',
        updatedAt: new Date().toISOString(),
      }
    }))
    setEditingId(null)
  }

  function toggleDone(id: string) {
    persist(tasks.map(t => (
      t.id === id
        ? {
            ...t,
            done: !t.done,
            status: !t.done ? 'Done' : 'Inbox',
            updatedAt: new Date().toISOString(),
          }
        : t
    )))
  }

  function deleteTask(id: string) {
    if (confirm('Delete this task?')) {
      persist(tasks.filter(t => t.id !== id))
    }
  }

  const filtered = tasks.filter(t => {
    if (filter === 'done') return t.done || t.status === 'Done'
    if (filter === ALL_FILTER) return !t.done
    return !t.done && t.category === filter
  })

  const pendingCount = tasks.filter(t => !t.done).length
  const doneCount = tasks.filter(t => t.done).length
  const totalCount = tasks.length
  const doneRatio = totalCount > 0 ? doneCount / totalCount : 0

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h2 className="page-title">Task Inbox</h2>
            <div className="task-progress-bar" aria-label="Task completion progress">
              <span style={{ width: `${Math.round(doneRatio * 100)}%` }} />
            </div>
            <p className="page-subtitle">
              {pendingCount} pending · {doneCount} done
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
            }}
          >
            <Plus size={14} />
            Add Task
          </button>
        </div>
      </div>

      {showForm && !editingId && (
        <TaskForm onSave={addTask} onCancel={() => setShowForm(false)} />
      )}

      <div className="filter-bar mt-1">
        <button
          className={`filter-chip ${filter === ALL_FILTER ? 'active' : ''}`}
          onClick={() => setFilter(ALL_FILTER)}
        >
          All pending
        </button>
        {CATEGORIES.map(c => {
          const count = tasks.filter(t => !t.done && t.category === c.id).length
          if (count === 0) return null
          return (
            <button
              key={c.id}
              className={`filter-chip ${filter === c.id ? 'active' : ''}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label} ({count})
            </button>
          )
        })}
        {doneCount > 0 && (
          <button
            className={`filter-chip ${filter === 'done' ? 'active' : ''}`}
            onClick={() => setFilter('done')}
          >
            Done ({doneCount})
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-check" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="18" />
            <path d="M16.5 24.5 21.5 29.5 32 18.5" />
          </svg>
          <h3>
            {filter === 'done'
              ? 'Nothing completed yet'
              : filter === ALL_FILTER
                ? 'Task inbox is clear'
                : `No ${categoryLabel(filter as TaskCategory)} tasks`}
          </h3>
          <p>
            {filter === ALL_FILTER
              ? 'Add tasks or use Recurring Templates to add structured routines.'
              : 'Switch filter or add a new task.'}
          </p>
        </div>
      ) : (
        <div className="task-list">
          {filtered.map(task => {
            const dl = deadlineTag(task.deadline)
            const timerOpen = timerOpenId === task.id

            return (
              <div key={task.id}>
                {editingId === task.id ? (
                  <TaskForm
                    initial={task}
                    onSave={data => updateTask(task.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className={`task-card ${task.done ? 'task-done' : ''}`}>
                    <div
                      className={`task-checkbox ${task.done ? 'checked' : ''}`}
                      onClick={() => toggleDone(task.id)}
                    />
                    <div className="task-content">
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        <span className={`badge badge-${task.category}`}>
                          {task.area ?? categoryLabel(task.category)}
                        </span>
                        <span className="badge">
                          {task.energy ?? 'Medium'}
                        </span>
                        <span className="badge">
                          {task.mode ?? 'Focus'}
                        </span>
                        <span className="badge">
                          {task.status ?? (task.done ? 'Done' : 'Inbox')}
                        </span>
                        {task.pomodoroEnabled && (
                          <span className="pomo-badge-inline">
                            {task.pomodoroLength ?? task.estimatedMinutes}m
                          </span>
                        )}
                        {dl && (
                          <span className={`task-deadline ${dl.cls}`}>{dl.text}</span>
                        )}
                        <span className="text-xs text-muted">
                          {task.estimatedMinutes < 60
                            ? `${task.estimatedMinutes}m`
                            : `${(task.estimatedMinutes / 60).toFixed(1)}h`}
                        </span>
                      </div>
                      {(task.nextTinyAction || task.nextAction) && (
                        <div className="task-next-action">
                          {task.nextTinyAction || task.nextAction}
                        </div>
                      )}
                      {task.checklist && task.checklist.length > 0 && (
                        <ul className="task-checklist">
                          {task.checklist.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      )}

                      {/* Pomodoro timer section */}
                      {task.pomodoroEnabled && !task.done && (
                        <div className="pomo-toggle-row">
                          <button
                            className={`pomo-toggle-btn pomo-toggle-primary ${timerOpen ? 'active' : ''}`}
                            onClick={() => setTimerOpenId(timerOpen ? null : task.id)}
                          >
                            <Timer size={12} />
                            {timerOpen ? 'Hide timer' : 'Start focus'}
                          </button>
                        </div>
                      )}

                      {timerOpen && task.pomodoroEnabled && (
                        <PomodoroTimer
                          pomodoroLength={task.pomodoroLength ?? 50}
                          breakLength={task.breakLength ?? 10}
                          sessions={task.pomodoroSessions ?? 1}
                          taskId={task.id}
                          taskTitle={task.title}
                          category={task.category}
                          onMarkDone={() => {
                            toggleDone(task.id)
                            setTimerOpenId(null)
                          }}
                        />
                      )}
                    </div>
                    <div className="task-actions">
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setEditingId(task.id)
                          setShowForm(false)
                          setTimerOpenId(null)
                        }}
                        title="Edit"
                      >
                        <Pencil />
                      </button>
                      <button
                        className="btn-danger-ghost"
                        onClick={() => deleteTask(task.id)}
                        title="Delete"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
