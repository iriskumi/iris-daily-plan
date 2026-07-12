# Task Calendar Scheduling Notes

## Product boundary

- **Daily Hub** owns: what to do, what started, what completed, visible progress.
- **Google Calendar** owns: optional time reminders and scheduled blocks.
- Calendar events are created **only** when the user clicks **Schedule** on a Task Inbox card and confirms in the modal.

Nothing auto-schedules on import, queue add, study start, or completion.

## Task mental model (UI)

Two high-level types in Task Inbox:

| Type | Examples (area chips) |
|------|---------------------|
| Study / Work | Cyber, AI, Vibe Coding, Job, English, Study, Expression Review |
| Life | Admin, Life reset |

Existing `category` values and stored tasks are unchanged. Mapping is display-only via `taskTaxonomy.ts`.

## Schedule flow

1. User opens **Schedule** on a task card (secondary action).
2. Modal prefills title, date, time, duration, reminder, notes from `taskCalendarDefaults.ts`.
3. If Google Calendar is connected with **write scope** (`calendar.events`), user can **Create calendar event**.
4. If not connected, user sees connect + **Copy event details**.
5. On success, optional fields on the task are set:
   - `calendarEventId`, `calendarEventUrl`, `calendarStart`, `calendarEnd`, `calendarStatus: 'scheduled'`
6. **Remove calendar link** clears local fields only; does not delete the Google event.

## Smart defaults

| Task kind | Default duration | Default reminder |
|-----------|------------------|------------------|
| Study / Work | task estimate or 50 min | 10 min before |
| Life | task estimate or 30 min | 30 min before |
| Admin / bills with deadline | task estimate or 30 min | 24 h before (all-day option available) |

## API

- `GET /api/google/calendar-today?status=1` — verified connection + import/write scope flags.
- `POST /api/google/calendar-events` — creates a primary-calendar event (requires reconnect with new OAuth scopes).

OAuth scopes now include `calendar.events` in addition to `calendar.readonly`. Existing tokens may show **Needs reconnect** for scheduling until the user reconnects.

## Integrations page

Google Calendar card shows:

- Status: Connected / Needs reconnect / Not connected / Unknown
- Import availability
- Task scheduling availability
- **Test connection** button (calls status endpoint with calendar verification)

## Not changed

- Task IDs, StudySessionRecord, Focus Mode, Today Done, Add to Today, Open in Study
- localStorage key names (`iris-tasks`, etc.)
- Notion / Obsidian export schemas
