import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, Timer } from 'lucide-react'
import type {
  Task,
  TaskCategory,
  Difficulty,
  Urgency,
  Importance,
} from '../types'
import { loadTasks, saveTasks } from '../storage'
import { getDaysUntil } from '../planner'
import PomodoroTimer from './PomodoroTimer'

const CATEGORIES: { id: TaskCategory; label: string }[] = [
  { id: 'assessment', label: 'Assessment' },
  { id: 'cyber-study', label: 'Cyber Study' },
  { id: 'job-search', label: 'Job Search' },
  { id: 'work-shift', label: 'Work / Holmesglen' },
  { id: 'admin-life', label: 'Admin / Life' },
  { id: 'english-practice', label: 'English Practice' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'finance-bills', label: 'Finance / Bills' },
  { id: 'consulting-freelance', label: 'Consulting / Freelance' },
]

const DEEP_FOCUS_CATEGORIES: TaskCategory[] = [
  'assessment',
  'cyber-study',
  'english-practice',
  'consulting-freelance',
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

const emptyForm = (): Omit<Task, 'id' | 'createdAt' | 'done'> => ({
  title: '',
  category: 'cyber-study',
  deadline: undefined,
  estimatedMinutes: 50,
  difficulty: 'medium',
  urgency: 'medium',
  importance: 'medium',
  minimumVersion: '',
  nextAction: '',
  checklist: [],
  pomodoroEnabled: false,
  pomodoroLength: 50,
  breakLength: 10,
  pomodoroSessions: 1,
})

interface TaskFormProps {
  initial?: Partial<Omit<Task, 'id' | 'createdAt' | 'done'>>
  onSave: (data: Omit<Task, 'id' | 'createdAt' | 'done'>) => void
  onCancel: () => void
}

function TaskForm({ initial, onSave, onCancel }: TaskFormProps) {
  const [form, setForm] = useState({ ...emptyForm(), ...initial })

  function f<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function handleCategoryChange(cat: TaskCategory) {
    const isDeepFocus = DEEP_FOCUS_CATEGORIES.includes(cat)
    setForm(prev => ({
      ...prev,
      category: cat,
      pomodoroEnabled: isDeepFocus ? true : prev.pomodoroEnabled,
      pomodoroLength: isDeepFocus ? 50 : prev.pomodoroLength,
      breakLength: isDeepFocus ? 10 : prev.breakLength,
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
        className={`btn-option ${cur === o ? `selected-${o}` : ''}`}
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
          <label>Category</label>
          <select
            value={form.category}
            onChange={e => handleCategoryChange(e.target.value as TaskCategory)}
          >
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
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
          <input
            type="number"
            min={5}
            step={5}
            value={form.estimatedMinutes}
            onChange={e => f('estimatedMinutes', Number(e.target.value))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Difficulty</label>
          <select
            value={form.difficulty}
            onChange={e => f('difficulty', e.target.value as Difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <div className="form-group mt-1">
        <label>Urgency</label>
        <div className="btn-group">
          {triBtn(
            form.urgency,
            ['low', 'medium', 'high'] as Urgency[],
            ['Low', 'Medium', 'High'],
            v => f('urgency', v),
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Importance</label>
        <div className="btn-group">
          {triBtn(
            form.importance,
            ['low', 'medium', 'high'] as Importance[],
            ['Low', 'Medium', 'High'],
            v => f('importance', v),
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Next action</label>
        <input
          placeholder="e.g. Open assessment brief and read part 2"
          value={form.nextAction ?? ''}
          onChange={e => f('nextAction', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Minimum completion version</label>
        <input
          placeholder="e.g. Answer Q1 only, 20 min review"
          value={form.minimumVersion ?? ''}
          onChange={e => f('minimumVersion', e.target.value)}
        />
      </div>

      {/* Pomodoro section */}
      <div className="pomo-form-section">
        <div className="pomo-form-label">
          <Timer size={13} />
          Focus mode (Pomodoro)
        </div>
        <div className="btn-group mb-sm">
          <button
            type="button"
            className={`btn-option ${form.pomodoroEnabled ? 'selected' : ''}`}
            onClick={() => f('pomodoroEnabled', true)}
          >
            🍅 On
          </button>
          <button
            type="button"
            className={`btn-option ${!form.pomodoroEnabled ? 'selected' : ''}`}
            onClick={() => f('pomodoroEnabled', false)}
          >
            Off
          </button>
        </div>

        {form.pomodoroEnabled && (
          <div className="pomo-form-row">
            <div>
              <div className="pomo-form-field-label">Focus</div>
              <div className="pomo-quick-btns">
                {[25, 50].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`pomo-quick-btn ${form.pomodoroLength === n ? 'active' : ''}`}
                    onClick={() => f('pomodoroLength', n)}
                  >
                    {n}m
                  </button>
                ))}
                <input
                  type="number"
                  className="pomo-quick-input"
                  min={10}
                  step={5}
                  value={form.pomodoroLength}
                  onChange={e => f('pomodoroLength', Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <div className="pomo-form-field-label">Break</div>
              <div className="pomo-quick-btns">
                {[5, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`pomo-quick-btn ${form.breakLength === n ? 'active' : ''}`}
                    onClick={() => f('breakLength', n)}
                  >
                    {n}m
                  </button>
                ))}
                <input
                  type="number"
                  className="pomo-quick-input"
                  min={5}
                  step={5}
                  value={form.breakLength}
                  onChange={e => f('breakLength', Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <div className="pomo-form-field-label">Sessions</div>
              <input
                type="number"
                className="pomo-quick-input"
                style={{ width: 52 }}
                min={1}
                max={6}
                value={form.pomodoroSessions ?? 1}
                onChange={e => f('pomodoroSessions', Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!form.title.trim()) return
            onSave(form)
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

  function addTask(data: Omit<Task, 'id' | 'createdAt' | 'done'>) {
    const task: Task = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      done: false,
    }
    persist([task, ...tasks])
    setShowForm(false)
  }

  function updateTask(id: string, data: Omit<Task, 'id' | 'createdAt' | 'done'>) {
    persist(tasks.map(t => (t.id === id ? { ...t, ...data } : t)))
    setEditingId(null)
  }

  function toggleDone(id: string) {
    persist(tasks.map(t => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function deleteTask(id: string) {
    if (confirm('Delete this task?')) {
      persist(tasks.filter(t => t.id !== id))
    }
  }

  const filtered = tasks.filter(t => {
    if (filter === 'done') return t.done
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
                          {categoryLabel(task.category)}
                        </span>
                        <span className={`badge badge-urgency-${task.urgency}`}>
                          {task.urgency}
                        </span>
                        {task.pomodoroEnabled && (
                          <span className="pomo-badge-inline">
                            🍅 {task.pomodoroLength ?? 50}m
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
                      {task.nextAction && (
                        <div className="task-next-action">{task.nextAction}</div>
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
