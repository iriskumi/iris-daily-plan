import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, CalendarPlus, BookOpen, CalendarDays } from 'lucide-react'
import type {
  Task,
  TaskArea,
  TaskEnergy,
  TaskMode,
  TaskStatus,
} from '../types'
import { archiveOldTasks, loadTasks, saveTasks } from '../storage'
import { getLocalDateKey } from '../focus'
import { createStudyHandoffFromQueueBlock, saveStudyTaskHandoff } from '../studyHandoff'
import {
  ensureQueueBlockForTask,
  isTaskScheduledForDate,
  scheduleTaskForToday,
  unscheduleTaskFromToday,
} from '../queueTaskHelpers'
import {
  TASK_ENERGIES,
  TASK_MODES,
  TASK_STATUSES,
  areaFromCategory,
  categoryFromArea,
  createInboxTask,
  isActiveTask,
  tinyActionForArea,
  tinyActionForTask,
} from '../focusBlocks'
import { DURATION_GROUPS, isStandardDuration, longBlockHint } from '../durations'
import { getDaysUntil } from '../planner'
import {
  areasForTaskKind,
  defaultAreaForKind,
  taskKindFromTask,
  taskKindLabel,
  type TaskKind,
} from '../taskTaxonomy'
import { formatScheduledChipLabel } from '../taskCalendarDefaults'
import { formatTaskLocationLine, formatTaskWhenLine, taskEffectiveDate } from '../taskScheduleDisplay'
import TaskScheduleModal from './TaskScheduleModal'

function deadlineTag(date?: string): { text: string; cls: string } | null {
  if (!date) return null
  const days = getDaysUntil(date)
  if (days < 0) return { text: `Overdue (${Math.abs(days)}d)`, cls: 'deadline-urgent' }
  if (days === 0) return { text: 'Due today', cls: 'deadline-urgent' }
  if (days <= 3) return { text: `${days}d left`, cls: 'deadline-soon' }
  return {
    text: new Date(date + 'T12:00:00').toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    }),
    cls: '',
  }
}

type TaskFormData = Pick<
  Task,
  'title' | 'area' | 'energy' | 'mode' | 'estimatedMinutes' | 'nextTinyAction' | 'status' | 'scheduledDate' | 'scheduledTime' | 'location'
> & {
  taskKind?: TaskKind
}

const emptyForm = (): TaskFormData => ({
  title: '',
  taskKind: 'study-work',
  area: 'Cyber',
  energy: 'Medium',
  mode: 'Focus',
  estimatedMinutes: 25,
  nextTinyAction: '',
  status: 'Inbox',
  scheduledDate: undefined,
  scheduledTime: undefined,
  location: undefined,
})

interface TaskFormProps {
  initial?: Partial<TaskFormData>
  onSave: (data: TaskFormData) => void
  onCancel: () => void
}

function TaskForm({ initial, onSave, onCancel, isEdit = false }: TaskFormProps & { isEdit?: boolean }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    ...initial,
    taskKind: initial?.taskKind ?? taskKindFromTask({
      area: initial?.area,
      category: categoryFromArea(initial?.area ?? 'Other'),
    }),
    area: initial?.area ?? defaultAreaForKind(initial?.taskKind ?? 'study-work'),
  }))
  const suggestedTinyAction = tinyActionForTask(form.title, form.area ?? 'Other')
  const areaOptions = areasForTaskKind(form.taskKind ?? 'study-work')

  function f<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function handleKindChange(kind: TaskKind) {
    setForm(prev => ({
      ...prev,
      taskKind: kind,
      area: areasForTaskKind(kind).includes(prev.area as TaskArea) ? prev.area : defaultAreaForKind(kind),
      mode: kind === 'life' && prev.area === 'Admin' ? 'Admin' : prev.mode,
      nextTinyAction: prev.nextTinyAction?.trim() ? prev.nextTinyAction : tinyActionForArea(defaultAreaForKind(kind)),
    }))
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

      <div className="form-group">
        <label>Type</label>
        <div className="btn-group">
          {(['study-work', 'life'] as const).map(kind => (
            <button
              key={kind}
              type="button"
              className={`btn-option ${form.taskKind === kind ? 'selected' : ''}`}
              onClick={() => handleKindChange(kind)}
            >
              {taskKindLabel(kind)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Area / tag (optional)</label>
          <select
            value={form.area}
            onChange={e => handleAreaChange(e.target.value as TaskArea)}
          >
            {areaOptions.map(area => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Date (optional)</label>
          <input
            type="date"
            value={form.scheduledDate ?? ''}
            onChange={e => f('scheduledDate', e.target.value || undefined)}
          />
        </div>
      </div>
      <p className="form-hint">Use date/time only when this task needs a reminder or calendar block.</p>

      <div className="form-row mt-1">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Time (optional)</label>
          <input
            type="time"
            value={form.scheduledTime ?? ''}
            placeholder="Optional time, e.g. 10:30"
            onChange={e => f('scheduledTime', e.target.value || undefined)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Location (optional)</label>
          <input
            value={form.location ?? ''}
            placeholder="Optional location, e.g. Holmesglen Reserve, Chadstone, Online"
            onChange={e => f('location', e.target.value || undefined)}
          />
        </div>
      </div>

      <div className="form-row mt-1">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Est. time (minutes)</label>
          <select
            value={form.estimatedMinutes}
            onChange={event => f('estimatedMinutes', Number(event.target.value))}
          >
            {!isStandardDuration(form.estimatedMinutes) && (
              <option value={form.estimatedMinutes}>{form.estimatedMinutes} min (custom / legacy)</option>
            )}
            {DURATION_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.values.map(minutes => (
                  <option key={minutes} value={minutes}>{minutes} min</option>
                ))}
              </optgroup>
            ))}
          </select>
          {longBlockHint(form.estimatedMinutes) && (
            <div className={`long-block-hint ${form.estimatedMinutes >= 150 ? 'strong' : ''}`}>
              {longBlockHint(form.estimatedMinutes)}
            </div>
          )}
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
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
      </div>

      {isEdit ? (
      <div className="form-row mt-1">
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
      ) : null}

      {isEdit && (
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
      )}

      <div className="form-group">
        <label>Next tiny action</label>
        <input
          placeholder={suggestedTinyAction}
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
              estimatedMinutes: form.estimatedMinutes,
              nextTinyAction: form.nextTinyAction?.trim() || suggestedTinyAction,
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
type Filter = TaskKind | typeof ALL_FILTER | 'done' | 'archived'

export default function TaskInbox() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [filter, setFilter] = useState<Filter>(ALL_FILTER)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null)
  const today = getLocalDateKey()

  function persist(updated: Task[]) {
    setTasks(updated)
    saveTasks(updated)
  }

  function addTaskToToday(taskId: string) {
    const task = scheduleTaskForToday(taskId, today)
    if (task) {
      setTasks(loadTasks())
      setActionMessage(`Added "${task.title}" to today's queue.`)
    }
  }

  function removeTaskFromToday(taskId: string) {
    unscheduleTaskFromToday(taskId, today)
    setTasks(loadTasks())
    setActionMessage('Removed from today\'s queue.')
  }

  function openTaskInStudy(task: Task) {
    const scheduled = isTaskScheduledForDate(task, today)
      ? task
      : scheduleTaskForToday(task.id, today)
    if (!scheduled) return
    setTasks(loadTasks())
    const block = ensureQueueBlockForTask(scheduled, today)
    saveStudyTaskHandoff(createStudyHandoffFromQueueBlock(block, 'today-queue'))
    window.dispatchEvent(new CustomEvent('iris-open-tab', { detail: { tab: 'study' } }))
    setActionMessage(`Opened "${task.title}" in Study. Press Start when ready.`)
  }

  function addTask(data: TaskFormData) {
    const task = createInboxTask({
      title: data.title,
      area: data.area ?? 'Other',
      energy: data.energy ?? 'Medium',
      mode: data.mode ?? 'Focus',
      estimatedMinutes: data.estimatedMinutes,
      nextTinyAction: data.nextTinyAction,
    })
    task.status = data.status ?? 'Inbox'
    task.scheduledDate = data.scheduledDate
    task.scheduledTime = data.scheduledTime?.trim() || undefined
    task.location = data.location?.trim() || undefined
    task.deadline = data.scheduledDate
    task.done = task.status === 'Done'
    persist([task, ...tasks])
    setShowForm(false)
  }

  function updateTask(id: string, data: TaskFormData) {
    persist(tasks.map(t => {
      if (t.id !== id) return t
      const nextTinyAction = data.nextTinyAction?.trim() || tinyActionForTask(data.title, data.area ?? 'Other')
      return {
        ...t,
        ...data,
        area: data.area ?? 'Other',
        energy: data.energy ?? 'Medium',
        mode: data.mode ?? 'Focus',
        status: data.status ?? 'Inbox',
        estimatedMinutes: data.estimatedMinutes,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime?.trim() || undefined,
        location: data.location?.trim() || undefined,
        deadline: data.scheduledDate,
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

  function handleArchiveOldTasks() {
    if (!confirm('Archive Done, Skipped, and old assessment tasks? This will hide them from planning but keep the data.')) return
    setTasks(archiveOldTasks())
    setFilter('archived')
  }

  function removeCalendarLink(taskId: string) {
    persist(tasks.map(task => task.id === taskId
      ? {
          ...task,
          calendarEventId: undefined,
          calendarEventUrl: undefined,
          calendarStart: undefined,
          calendarEnd: undefined,
          calendarStatus: undefined,
          updatedAt: new Date().toISOString(),
        }
      : task))
    setActionMessage('Removed local calendar link. Google Calendar event was not deleted.')
  }

  function applyCalendarSchedule(taskId: string, patch: Pick<Task, 'calendarEventId' | 'calendarEventUrl' | 'calendarStart' | 'calendarEnd' | 'calendarStatus'>) {
    persist(tasks.map(task => task.id === taskId
      ? { ...task, ...patch, updatedAt: new Date().toISOString() }
      : task))
  }

  const filtered = tasks.filter(t => {
    if (filter === 'done') return t.done || t.status === 'Done'
    if (filter === 'archived') return t.status === 'Archived'
    if (filter === ALL_FILTER) return isActiveTask(t)
    return isActiveTask(t) && taskKindFromTask(t) === filter
  })

  const pendingCount = tasks.filter(isActiveTask).length
  const doneCount = tasks.filter(t => t.done).length
  const archivedCount = tasks.filter(t => t.status === 'Archived').length
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
              {pendingCount} pending · {doneCount} done · Study/Work or Life → Add to today → Start in Study
            </p>
          </div>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              onClick={handleArchiveOldTasks}
            >
              Archive completed/old tasks
            </button>
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
        <button
          className={`filter-chip ${filter === 'study-work' ? 'active' : ''}`}
          onClick={() => setFilter('study-work')}
        >
          Study / Work ({tasks.filter(t => isActiveTask(t) && taskKindFromTask(t) === 'study-work').length})
        </button>
        <button
          className={`filter-chip ${filter === 'life' ? 'active' : ''}`}
          onClick={() => setFilter('life')}
        >
          Life ({tasks.filter(t => isActiveTask(t) && taskKindFromTask(t) === 'life').length})
        </button>
        {doneCount > 0 && (
          <button
            className={`filter-chip ${filter === 'done' ? 'active' : ''}`}
            onClick={() => setFilter('done')}
          >
            Done ({doneCount})
          </button>
        )}
        {archivedCount > 0 && (
          <button
            className={`filter-chip ${filter === 'archived' ? 'active' : ''}`}
            onClick={() => setFilter('archived')}
          >
            Archived ({archivedCount})
          </button>
        )}
      </div>

      {actionMessage && <div className="start-now-message">{actionMessage}</div>}

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
                : `No ${taskKindLabel(filter as TaskKind)} tasks`}
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
            const effectiveDate = taskEffectiveDate(task)
            const dl = deadlineTag(effectiveDate)
            const whenLine = formatTaskWhenLine(task)
            const locationLine = formatTaskLocationLine(task)
            const isLargeTask = task.estimatedMinutes >= 90
            const totalEstimateLabel = `${task.estimatedMinutes} min total`
            const inTodayQueue = isTaskScheduledForDate(task, today)
            const scheduledLabel = formatScheduledChipLabel(task.calendarStart)
            const kind = taskKindFromTask(task)

            return (
              <div key={task.id}>
                {editingId === task.id ? (
                  <TaskForm
                    isEdit
                    initial={{
                      ...task,
                      taskKind: kind,
                      area: task.area ?? areaFromCategory(task.category),
                      scheduledDate: task.scheduledDate ?? task.deadline?.slice(0, 10),
                      scheduledTime: task.scheduledTime,
                      location: task.location,
                    }}
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
                        <span className="badge badge-task-kind">{taskKindLabel(kind)}</span>
                        <span className={`badge badge-${task.category}`}>
                          {task.area ?? areaFromCategory(task.category)}
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
                        {inTodayQueue && (
                          <span className="badge badge-today-queue">In today</span>
                        )}
                        {scheduledLabel && (
                          <span className="badge badge-calendar-scheduled">Calendar · {scheduledLabel}</span>
                        )}
                        {isLargeTask && (
                          <span className="badge">
                            Large task
                          </span>
                        )}
                        {dl && !whenLine && (
                          <span className={`task-deadline ${dl.cls}`}>{dl.text}</span>
                        )}
                        <span className="text-xs text-muted">
                          {isLargeTask
                            ? totalEstimateLabel
                            : task.estimatedMinutes < 60
                            ? `${task.estimatedMinutes}m`
                            : `${(task.estimatedMinutes / 60).toFixed(1)}h`}
                        </span>
                      </div>
                      {(whenLine || locationLine) && (
                        <div className="task-schedule-lines">
                          {whenLine && <div className="task-when-line">{whenLine}</div>}
                          {locationLine && <div className="task-location-line">{locationLine}</div>}
                        </div>
                      )}
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

                      {isActiveTask(task) && (
                        <div className="task-action-row">
                          {!inTodayQueue ? (
                            <button type="button" className="btn btn-primary task-action-btn" onClick={() => addTaskToToday(task.id)}>
                              <CalendarPlus size={13} />
                              Add to today
                            </button>
                          ) : (
                            <>
                              <button type="button" className="btn btn-primary task-action-btn" onClick={() => openTaskInStudy(task)}>
                                <BookOpen size={13} />
                                Open in Study
                              </button>
                              <button type="button" className="btn btn-secondary task-action-btn" onClick={() => removeTaskFromToday(task.id)}>
                                Remove from today
                              </button>
                            </>
                          )}
                          {inTodayQueue ? null : (
                            <button type="button" className="btn btn-secondary task-action-btn" onClick={() => openTaskInStudy(task)}>
                              <BookOpen size={13} />
                              Open in Study
                            </button>
                          )}
                          <button type="button" className="btn btn-secondary task-action-btn" onClick={() => setScheduleTask(task)}>
                            <CalendarDays size={13} />
                            {task.calendarStatus === 'scheduled' ? 'Reschedule' : 'Schedule'}
                          </button>
                          {task.calendarStatus === 'scheduled' && (
                            <>
                              {task.calendarEventUrl && (
                                <a className="btn btn-secondary task-action-btn" href={task.calendarEventUrl} target="_blank" rel="noreferrer">
                                  Open event
                                </a>
                              )}
                              <button type="button" className="btn btn-secondary task-action-btn" onClick={() => removeCalendarLink(task.id)}>
                                Remove calendar link
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="task-actions">
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setEditingId(task.id)
                          setShowForm(false)
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

      {scheduleTask && (
        <TaskScheduleModal
          task={scheduleTask}
          open={Boolean(scheduleTask)}
          onClose={() => setScheduleTask(null)}
          onScheduled={patch => {
            applyCalendarSchedule(scheduleTask.id, patch)
            setActionMessage(`Scheduled "${scheduleTask.title}" in Google Calendar.`)
          }}
          onAddToToday={() => {
            addTaskToToday(scheduleTask.id)
            setScheduleTask(null)
          }}
          onOpenInStudy={() => {
            openTaskInStudy(scheduleTask)
            setScheduleTask(null)
          }}
        />
      )}
    </div>
  )
}
