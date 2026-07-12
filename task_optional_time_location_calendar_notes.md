# Task optional time, location, and calendar notes

## Summary

Task Inbox now supports optional **date**, **time**, and **location** on tasks. These fields are not required and existing tasks continue to work unchanged.

## Task fields

Optional fields on `Task` (in `src/types.ts`):

- `scheduledDate?: string` — YYYY-MM-DD reminder / calendar date
- `scheduledTime?: string` — HH:MM optional time
- `location?: string` — optional place for life reminders or Google Calendar events

`deadline` is still written when `scheduledDate` is set from the Add Task form so planner and queue due-date logic keep working. Existing tasks that only have `deadline` are read via `taskEffectiveDate()`.

No migration runs on load. Missing time/location is valid.

## Add Task form

Layout (`TaskInbox.tsx`):

1. Title, Type (Study/Work | Life)
2. Row: Area/tag | Date (optional)
3. Helper: use date/time only for reminders or calendar blocks
4. Row: Time (optional) | Location (optional)
5. Row: Estimated time | Energy
6. Next tiny action

Labels use “Date (optional)”, “Time (optional)”, “Location (optional)” instead of “Deadline”.

## Task cards

When present, cards show:

- `13 Jul · 10:30` (date only, time only, or both)
- Location on its own line

Empty placeholders are not shown. Overdue/due-soon chips still use the effective date when no formatted when-line is shown.

## Today queue

`BlockQueueView` and Today homepage queue cards show:

- `10:30 · Task title` when the source task has `scheduledTime`
- Location line when set

Manual queue order is unchanged (no time-based re-sort).

## Schedule modal

`TaskScheduleModal` prefills from the task:

- Date: `scheduledDate` or `deadline` or today
- Start time: `scheduledTime` only (empty if unset — no auto next-hour default)
- Duration: `estimatedMinutes` or type default
- Location: `task.location`
- Notes: next tiny action, type, area/tag, Daily Hub source

Create is disabled until the user picks a start time **or** checks **All-day reminder**. API also rejects timed events without `startTime` (no silent 09:00 / midnight events).

## Google Calendar API

`POST /api/google/calendar-events` accepts `location` and sets `event.location`. Timed events require `startTime` unless `allDay: true`.

## Compatibility

- Existing task IDs, StudySessionRecord, Focus Mode, Today Done, Add to Today, Open in Study unchanged
- localStorage keys unchanged
- Notion / Obsidian exports unchanged
- Tasks without time/location display and behave as before; Schedule modal asks for time when needed

## Files touched

- `src/types.ts` — task + calendar input types
- `src/taskScheduleDisplay.ts` — format helpers
- `src/taskCalendarDefaults.ts` — modal defaults and notes
- `src/components/TaskInbox.tsx` — form, save, cards
- `src/components/TaskScheduleModal.tsx` — location, time validation
- `src/components/BlockQueueView.tsx` — queue display
- `src/components/HomeCommandCentre.tsx` — Today queue display
- `src/blockQueue.ts` — due date fallback includes `scheduledDate`
- `api/google/calendar-events.ts` — location + timed validation
- `src/index.css` — schedule line styles
