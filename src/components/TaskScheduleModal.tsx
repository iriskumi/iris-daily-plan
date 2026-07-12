import { useEffect, useState } from 'react'
import { CalendarDays, Check, Copy, ExternalLink, X } from 'lucide-react'
import type { GoogleCalendarImportMeta, Task } from '../types'
import {
  buildScheduleDraftFromTask,
  formatScheduleDraftForCopy,
  type TaskScheduleDraft,
} from '../taskCalendarDefaults'
import {
  calendarStatusLabel,
  canScheduleToCalendar,
  connectGoogleCalendar,
  createCalendarEventFromTask,
  getGoogleCalendarStatus,
} from '../services/calendarService'

interface TaskScheduleModalProps {
  task: Task
  open: boolean
  onClose: () => void
  onScheduled: (patch: Pick<Task, 'calendarEventId' | 'calendarEventUrl' | 'calendarStart' | 'calendarEnd' | 'calendarStatus'>) => void
  onAddToToday?: () => void
  onOpenInStudy?: () => void
}

export default function TaskScheduleModal({
  task,
  open,
  onClose,
  onScheduled,
  onAddToToday,
  onOpenInStudy,
}: TaskScheduleModalProps) {
  const [draft, setDraft] = useState<TaskScheduleDraft>(() => buildScheduleDraftFromTask(task))
  const [calendarMeta, setCalendarMeta] = useState<GoogleCalendarImportMeta>({ connected: false })
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [createdEventUrl, setCreatedEventUrl] = useState<string | undefined>()

  useEffect(() => {
    if (!open) return
    setDraft(buildScheduleDraftFromTask(task))
    setMessage(null)
    setSuccess(false)
    setCreatedEventUrl(undefined)
    setLoadingStatus(true)
    void getGoogleCalendarStatus().then(status => {
      setCalendarMeta(status)
      setLoadingStatus(false)
    })
  }, [open, task])

  if (!open) return null

  async function handleCopyDetails() {
    await navigator.clipboard.writeText(formatScheduleDraftForCopy(draft))
    setMessage('Copied event details. Paste into your calendar app.')
  }

  async function handleCreateEvent() {
    setSubmitting(true)
    setMessage(null)
    const result = await createCalendarEventFromTask({
      summary: draft.title.trim(),
      date: draft.date,
      startTime: draft.allDay ? undefined : draft.startTime,
      durationMinutes: draft.durationMinutes,
      reminderMinutes: draft.reminderMinutes,
      description: draft.notes,
      taskId: task.id,
      allDay: draft.allDay,
    })
    setSubmitting(false)
    if (!result.success || !result.data) {
      setMessage(result.message)
      return
    }
    setCreatedEventUrl(result.data.htmlLink)
    onScheduled({
      calendarEventId: result.data.id,
      calendarEventUrl: result.data.htmlLink,
      calendarStart: result.data.start,
      calendarEnd: result.data.end,
      calendarStatus: 'scheduled',
    })
    setSuccess(true)
    setMessage('Scheduled in Google Calendar.')
  }

  const canCreate = canScheduleToCalendar(calendarMeta)

  return (
    <div className="task-schedule-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="task-schedule-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-schedule-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="task-schedule-header">
          <div>
            <div className="section-label">Schedule task</div>
            <h3 id="task-schedule-title">{task.title}</h3>
            <p>Optional calendar reminder. Daily Hub still owns completion.</p>
          </div>
          <button type="button" className="btn-ghost" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="task-schedule-status">
          <CalendarDays size={15} />
          <span>
            {loadingStatus ? 'Checking Google Calendar…' : `Status: ${calendarStatusLabel(calendarMeta)}`}
          </span>
          {calendarMeta.accountEmail && <small>{calendarMeta.accountEmail}</small>}
        </div>

        {!canCreate && !loadingStatus && (
          <div className="task-schedule-notice">
            <p>Connect Google Calendar to create events from tasks.</p>
            <div className="task-schedule-notice-actions">
              <button type="button" className="btn btn-secondary" onClick={connectGoogleCalendar}>
                Connect Google Calendar
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void handleCopyDetails()}>
                <Copy size={14} />
                Copy event details
              </button>
            </div>
          </div>
        )}

        <div className="task-schedule-form">
          <label>
            Event title
            <input
              value={draft.title}
              onChange={event => setDraft(prev => ({ ...prev, title: event.target.value }))}
            />
          </label>
          <div className="task-schedule-row">
            <label>
              Date
              <input
                type="date"
                value={draft.date}
                onChange={event => setDraft(prev => ({ ...prev, date: event.target.value }))}
              />
            </label>
            <label>
              Start time
              <input
                type="time"
                value={draft.startTime}
                disabled={draft.allDay}
                onChange={event => setDraft(prev => ({ ...prev, startTime: event.target.value }))}
              />
            </label>
          </div>
          <div className="task-schedule-row">
            <label>
              Duration (min)
              <input
                type="number"
                min="1"
                value={draft.durationMinutes}
                disabled={draft.allDay}
                onChange={event => setDraft(prev => ({ ...prev, durationMinutes: Number(event.target.value) || 25 }))}
              />
            </label>
            <label>
              Reminder (min before)
              <input
                type="number"
                min="0"
                value={draft.reminderMinutes}
                onChange={event => setDraft(prev => ({ ...prev, reminderMinutes: Number(event.target.value) || 0 }))}
              />
            </label>
          </div>
          <label className="task-schedule-checkbox">
            <input
              type="checkbox"
              checked={draft.allDay}
              onChange={event => setDraft(prev => ({ ...prev, allDay: event.target.checked }))}
            />
            All-day reminder
          </label>
          <label>
            Notes
            <textarea
              value={draft.notes}
              onChange={event => setDraft(prev => ({ ...prev, notes: event.target.value }))}
              rows={4}
            />
          </label>
        </div>

        {message && <div className="start-now-message">{message}</div>}

        <div className="task-schedule-actions">
          {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting || !draft.title.trim()}
              onClick={() => void handleCreateEvent()}
            >
              {submitting ? 'Creating…' : success ? 'Created' : 'Create calendar event'}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => void handleCopyDetails()}>
            <Copy size={14} />
            Copy event details
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {success && (
          <div className="task-schedule-success">
            <Check size={15} />
            <span>Scheduled. Today queue is separate — add it only if you want.</span>
            <div className="task-action-row">
              {onAddToToday && (
                <button type="button" className="btn btn-secondary task-action-btn" onClick={onAddToToday}>
                  Add to Today
                </button>
              )}
              {onOpenInStudy && (
                <button type="button" className="btn btn-secondary task-action-btn" onClick={onOpenInStudy}>
                  Open in Study
                </button>
              )}
              {createdEventUrl && (
                <a className="btn btn-secondary task-action-btn" href={createdEventUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} />
                  Open event
                </a>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
